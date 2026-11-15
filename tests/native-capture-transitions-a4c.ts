import { fixtureAt, fixtureRecord, fixtureString } from "./helpers/required.ts";
import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
import { captureFixture, childRender } from "./helpers/native-capture-a4c.ts";
import { quartoExecutable } from "../_extensions/course-core/infrastructure/process.ts";
const nativeExecutable = quartoExecutable();
const implementation = toFileUrl(
  join(dirname(dirname(fromFileUrl(import.meta.url))), "_extensions/course-core/runtime/operation.ts"),
).href;
const results: {
  name: string;
  passed: boolean;
  root?: string;
  error?: string;
}[] = [];
const check = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
async function noComplete(r: Awaited<ReturnType<typeof captureFixture>>) {
  let complete = false;
  try {
    await Core.withCurrentNativeOperation({ ...r, profiles: ["student"] }, async () => {
      complete = true;
    });
  } catch {}
  check(!complete, "failed scope must have no complete");
}
for (const mutation of [
  "source-at-native-pre",
  "source-during-inspect",
  "pointer-during-inspect",
  "runtime-during-inspect",
]) {
  const r = await captureFixture();
  let env: Record<string, string> = {};
  const foreign = crypto.randomUUID();
  const markerPath = join(r.root, "mutation-executed.json");
  const sourceMarker = "SOURCEBOUNDARYMUTATIONMARKER";
  let wrapper: string | undefined;
  if (mutation === "source-at-native-pre") {
    const shim = join(r.root, "source-before-native-pre.ts");
    await Deno.writeTextFile(
      shim,
      `import {beginNativeOperation} from ${JSON.stringify(implementation)};\nconst root=Deno.cwd();\ntry{await Deno.stat(root+'/mutation-executed.json');}catch(error){if(!(error instanceof Deno.errors.NotFound))throw error;await Deno.writeTextFile(root+'/index.qmd',(await Deno.readTextFile(root+'/index.qmd'))+'\\n${sourceMarker}\\n');await Deno.writeTextFile(root+'/mutation-executed.json',JSON.stringify({mutation:'source-at-native-pre'}));}\nawait beginNativeOperation(root);`,
    );
    const config = await Deno.readTextFile(join(r.root, "_quarto.yml"));
    const replaced = config.replace(
      /quarto run [^,\]\n]+\/entrypoints\/native-pre.ts/,
      "quarto run source-before-native-pre.ts",
    );
    check(replaced !== config, "Не заменён настоящий native pre-hook");
    await Deno.writeTextFile(join(r.root, "_quarto.yml"), replaced);
  } else {
    wrapper = await Deno.makeTempFile({ prefix: "a4c-native-inspect-", suffix: ".sh" });
    const change =
      mutation === "source-during-inspect"
        ? `(p/'index.qmd').write_text((p/'index.qmd').read_text()+'\\n${sourceMarker}\\n')`
        : mutation === "pointer-during-inspect"
          ? `(p/'_generated/course-spec/native-ts/active.json').write_text(json.dumps({'operation':${JSON.stringify(foreign)},'directory':str(p/'_generated/course-spec/native-ts'/${JSON.stringify(foreign)})}))`
          : `w=Path(${JSON.stringify(wrapper)});w.write_text(w.read_text()+'\\n# RUNTIMEBOUNDARYMUTATIONMARKER\\n')`;
    await Deno.writeTextFile(
      wrapper,
      `#!/bin/bash\n"$NATIVE_QUARTO_EXECUTABLE" "$@"\ncode=$?\nif [[ "$1" == inspect && "$code" == 0 ]]; then\npython3 - <<'PY_MUTATION'\nfrom pathlib import Path\nimport json\np=Path(${JSON.stringify(r.root)})\nmarker=p/'mutation-executed.json'\nif not marker.exists():\n ${change}\n marker.write_text(json.dumps({'mutation':${JSON.stringify(mutation)}}))\nPY_MUTATION\nmutation_code=$?\nif [[ "$mutation_code" != 0 ]]; then exit "$mutation_code"; fi\nfi\nexit "$code"\n`,
    );
    await Deno.chmod(wrapper, 0o700);
    env = { QUARTO: wrapper, NATIVE_QUARTO_EXECUTABLE: nativeExecutable };
  }
  let error = "",
    operation = "";
  try {
    await Core.withNativeCaptureScope(r, { expectedSources: ["index.qmd", "slides.qmd"] }, async (scope) => {
      operation = fixtureString(
        fixtureAt(JSON.parse(await Deno.readTextFile(join(r.root, "_generated/course-spec/native-ts/active.json"))), [
          "operation",
        ]),
      );
      for (const source of ["index.qmd", "slides.qmd"]) {
        await scope.captureInputs([source], (token) => childRender(r.root, source, token, env));
      }
    });
  } catch (e) {
    error = String(e);
  }
  const executed = fixtureRecord(JSON.parse(await Deno.readTextFile(markerPath)));
  check(executed.mutation === mutation, "Мутация на выбранной native границе не выполнилась: " + mutation);
  if (mutation === "pointer-during-inspect") {
    check(/OPERATION_CHANGED|NotFound/.test(error), mutation + ": " + error);
    await noComplete(r);
    const active = fixtureRecord(
      JSON.parse(await Deno.readTextFile(join(r.root, "_generated/course-spec/native-ts/active.json"))),
    );
    check(active.operation === foreign, "Старая cleanup восстановила чужой pointer");
  } else {
    check(!error, mutation + ": " + error);
    await Core.withCurrentNativeOperation({ ...r, profiles: ["student"] }, async (op) => {
      const pointer = fixtureRecord(
        JSON.parse(await Deno.readTextFile(join(r.root, "_generated/course-spec/native-ts/active.json"))),
      );
      check(
        pointer.operation === operation &&
          op.identity.operation === operation &&
          op.identity.profiles.join(",") === "student" &&
          op.identity.projection === "student" &&
          op.metrics.inspectCalls === 1 &&
          op.metrics.childRenders === 2 &&
          op.catalog.documents
            .map((d) => d.source)
            .sort()
            .join(",") === "index.qmd,slides.qmd",
        "Мутация изменила capture identity/план либо потеряла два children/один inspect",
      );
      for (const source of ["index.qmd", "slides.qmd"]) {
        const document = op.document({ source });
        check(
          document.context.operation === operation &&
            !!document.context.captureWitness &&
            document.context.input === source,
          "Public captured identity/witness не совпали",
        );
        if (source === "index.qmd") {
          const body = await Deno.readTextFile(join(r.outputDirectory, "index.html"));
          check(
            mutation === "runtime-during-inspect" ? body.includes("Native") : body.includes(sourceMarker),
            "Native output не соответствует выполненной мутации",
          );
        }
      }
      if (mutation.startsWith("source-"))
        check((await Deno.readTextFile(join(r.root, "index.qmd"))).includes(sourceMarker), "Нет source marker");
      if (mutation === "runtime-during-inspect")
        check(
          !!wrapper && (await Deno.readTextFile(wrapper)).includes("# RUNTIMEBOUNDARYMUTATIONMARKER"),
          "Нет runtime marker",
        );
      await op.assertCurrent();
    });
  }
  results.push({ name: mutation, passed: true, root: r.root, ...(error ? { error: error.slice(0, 300) } : {}) });
}
// A child changing the observed profile order is refused even when the set is identical.
{
  const r = await captureFixture({ group: true });
  let error = "";
  try {
    await Core.withNativeCaptureScope(
      r,
      {
        expectedSources: ["index.qmd", "slides.qmd"],
      },
      async (scope) => {
        await scope.captureInputs(["index.qmd"], (token) => childRender(r.root, "index.qmd", token));
        await scope.captureInputs(["slides.qmd"], (token) =>
          childRender(r.root, "slides.qmd", token, {}, ["--profile", "extra,student"]),
        );
      },
    );
  } catch (e) {
    error = String(e);
  }
  check(error.includes("ordered profiles"), "same profile set reordered admitted");
  await noComplete(r);
  results.push({
    name: "same profile set reordered",
    passed: true,
    root: r.root,
  });
}
// Source bytes may settle before first bind; no reservation-time source attestation is claimed.
{
  const r = await captureFixture();
  let oldOperation = "",
    tokens: string[] = [],
    abortedScope = "";
  try {
    await Core.withNativeCaptureScope(
      r,
      {
        expectedSources: ["index.qmd", "slides.qmd"],
      },
      async (scope) => {
        oldOperation = fixtureString(
          fixtureAt(JSON.parse(await Deno.readTextFile(join(r.root, "_generated/course-spec/native-ts/active.json"))), [
            "operation",
          ]),
        );
        try {
          await scope.captureInputs(["index.qmd"], async (token) => {
            tokens.push(token);
            throw Error("abort");
          });
        } catch {}
      },
    );
  } catch (cause) {
    abortedScope = String(cause);
  }
  check(abortedScope.includes("OPERATION_INCOMPLETE"), "caught child failure must prevent sealing");
  await noComplete(r);
  const pendingOperations: string[] = [];
  await Core.withNativeCaptureScope(
    r,
    {
      expectedSources: ["index.qmd", "slides.qmd"],
    },
    async (scope) => {
      let beforeBinding = "";
      try {
        await Core.withPendingNativeOperation({ ...r, profiles: [] }, async () => {});
      } catch (error) {
        beforeBinding = String(error);
      }
      check(beforeBinding.includes("OPERATION_INCOMPLETE"), "unbound reservation has no pending descriptor");
      await Deno.writeTextFile(join(r.root, "index.qmd"), "---\nformat: html\n---\n# New before-bind baseline\n");
      for (const source of ["index.qmd", "slides.qmd"]) {
        await scope.captureInputs([source], (token) => {
          tokens.push(token);
          return childRender(r.root, source, token);
        });
        await Core.withPendingNativeOperation({ ...r, profiles: ["student"] }, async (op) => {
          pendingOperations.push(op.identity.operation);
          check(op.inputs.length === 2, "all expected inputs bound once");
        });
        // A posted first child does not seal partial coverage.
        await noComplete(r);
      }
    },
  );
  const expectedDocuments = [
    { source: "index.qmd", format: "html" as const },
    { source: "slides.qmd", format: "revealjs" as const },
  ];
  await Core.withCurrentNativeOperation({ ...r, profiles: ["student"], expectedDocuments }, async (op) => {
    check(op.identity.operation !== oldOperation && new Set(tokens).size === 3, "retry identities reused");
    check(
      new Set(pendingOperations).size === 1 && pendingOperations[0] === op.identity.operation,
      "sequential children must complete the same generation",
    );
    check(
      op.identity.profiles.join(",") === "student" && op.metrics.inspectCalls === 1 && op.metrics.childRenders === 2,
      "actual implicit profiles, two children and one owner inspect",
    );
    const proof = await op.validateRelease({ expectedSources: ["index.qmd", "slides.qmd"] });
    check(JSON.stringify(proof.documents) === JSON.stringify(expectedDocuments), "complete mixed-format release proof");
    check(
      (await Deno.readTextFile(join(r.outputDirectory, "index.html"))).includes("New before-bind baseline"),
      "public capture must use pre-bind bytes",
    );
  });
  results.push({
    name: "new retry and pre-bind baseline",
    passed: true,
    root: r.root,
  });
}
// Unjoined renders create a fresh ordinary generation; failed old cleanup never restores its pointer.
{
  const r = await captureFixture();
  let scopeOperation = "",
    error = "";
  try {
    await Core.withNativeCaptureScope(
      r,
      {
        expectedSources: ["index.qmd", "slides.qmd"],
      },
      async () => {
        scopeOperation = fixtureString(
          fixtureAt(JSON.parse(await Deno.readTextFile(join(r.root, "_generated/course-spec/native-ts/active.json"))), [
            "operation",
          ]),
        );
        const n = await new Deno.Command(nativeExecutable, {
          args: ["render", "index.qmd", "--to", "html"],
          cwd: r.root,
          env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1" },
          stdout: "piped",
          stderr: "piped",
        }).output();
        check(n.success, "ordinary render failed");
      },
    );
  } catch (e) {
    error = String(e);
  }
  check(error.includes("OPERATION_INCOMPLETE"), "old scope sealed after unjoined native");
  await Core.withCurrentNativeOperation({ ...r, profiles: ["student"] }, async (op) => {
    check(
      op.identity.operation !== scopeOperation && op.catalog.documents.length === 1,
      "old pointer restored/unioned",
    );
  });
  results.push({
    name: "unjoined ordinary generation survives old cleanup",
    passed: true,
    root: r.root,
  });
}
// A child launched after the callback returns cannot enter the native command.
{
  const r = await captureFixture();
  let pending: Promise<unknown> | undefined,
    error = "",
    returned = false,
    commandAfterReturn = false;
  try {
    await Core.withNativeCaptureScope(r, { expectedSources: ["index.qmd"] }, async (scope) => {
      pending = scope
        .captureInputs(["index.qmd"], async () => {
          if (returned) commandAfterReturn = true;
        })
        .catch((cause) => String(cause));
      returned = true;
    });
  } catch (cause) {
    error = String(cause);
  }
  await pending;
  check(
    !commandAfterReturn && error.includes("OPERATION_INCOMPLETE"),
    "expired unawaited child started native command or sealed",
  );
  await noComplete(r);
  results.push({ name: "unawaited child cannot start after scope return", passed: true, root: r.root });
}
// An already active child also must be joined; an explicit barrier controls the interleaving.
{
  const r = await captureFixture();
  const started = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  let pending: Promise<unknown> | undefined,
    error = "";
  try {
    await Core.withNativeCaptureScope(r, { expectedSources: ["index.qmd"] }, async (scope) => {
      pending = scope
        .captureInputs(["index.qmd"], async () => {
          started.resolve();
          await release.promise;
        })
        .catch((cause) => String(cause));
      await started.promise;
    });
  } catch (cause) {
    error = String(cause);
  } finally {
    release.resolve();
  }
  await pending;
  check(error.includes("OPERATION_INCOMPLETE"), "unawaited active child sealed");
  await noComplete(r);
  results.push({ name: "unawaited active child refuses seal", passed: true, root: r.root });
}
console.log(JSON.stringify({ status: "PASS", results }));
