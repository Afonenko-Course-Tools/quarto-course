import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
import { captureFixture, childRender } from "./helpers/native-capture-a4c.ts";
const implementation = toFileUrl(
  join(
    dirname(dirname(fromFileUrl(import.meta.url))),
    "_extensions/course-core/runtime/operation.ts",
  ),
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
    await Core.withCurrentNativeOperation(
      { ...r, profiles: ["student"] },
      async () => {
        complete = true;
      },
    );
  } catch {}
  check(!complete, "failed scope must have no complete");
}
for (
  const mutation of [
    "source-during-snapshot",
    "source-during-inspect",
    "pointer-during-inspect",
    "runtime-during-inspect",
  ]
) {
  const r = await captureFixture();
  let env: Record<string, string> = {};
  const foreign = crypto.randomUUID();
  if (mutation === "source-during-snapshot") {
    const shim = join(r.root, "snapshot-mutation.ts");
    await Deno.writeTextFile(
      shim,
      `import {beginNativeOperation} from ${
        JSON.stringify(implementation)
      };\nconst read=Deno.readFile;let once=false;Deno.readFile=async(...args)=>{const bytes=await read(...args);if(String(args[0])===Deno.cwd()+'/index.qmd'&&!once){once=true;await Deno.writeTextFile(Deno.cwd()+'/index.qmd','# Changed during snapshot\\n');}return bytes};await beginNativeOperation(Deno.cwd());`,
    );
    let config = await Deno.readTextFile(join(r.root, "_quarto.yml"));
    config = config.replace(
      /quarto run [^,\]\n]+\/entrypoints\/native-pre.ts/,
      "quarto run snapshot-mutation.ts",
    );
    await Deno.writeTextFile(join(r.root, "_quarto.yml"), config);
  } else {
    const wrapper = await Deno.makeTempFile({
      prefix: "a4c-native-inspect-",
      suffix: ".sh",
    });
    // All source fixtures and the wrapper are test-owned. The native command still performs one real inspect.
    const script =
      `#!/bin/bash\n/opt/quarto/bin/quarto "$@"\ncode=$?\nif [[ "$1" == inspect && "$code" == 0 ]]; then\npython - <<'PY'\nfrom pathlib import Path\nimport json\np=Path(${
        JSON.stringify(r.root)
      })\n${
        mutation === "source-during-inspect"
          ? "(p/'index.qmd').write_text('# Changed during inspect\\n')"
          : mutation === "pointer-during-inspect"
          ? `(p/'_generated/course-spec/native-ts/active.json').write_text(json.dumps({'operation':${
            JSON.stringify(foreign)
          },'directory':str(p/'_generated/course-spec/native-ts'/${
            JSON.stringify(foreign)
          })}))`
          : `w=Path(${
            JSON.stringify(wrapper)
          });w.write_text(w.read_text()+'\\n# changed runtime\\n')`
      }\nPY\nfi\nexit "$code"\n`;
    await Deno.writeTextFile(wrapper, script);
    await Deno.chmod(wrapper, 0o700);
    env = { QUARTO: wrapper };
  }
  let error = "";
  try {
    await Core.withNativeCaptureScope(r, {
      expectedSources: ["index.qmd", "slides.qmd"],
    }, async (scope) => {
      await scope.captureInputs(
        ["index.qmd"],
        (token) => childRender(r.root, "index.qmd", token, env),
      );
    });
  } catch (e) {
    error = String(e);
  }
  check(/OPERATION_CHANGED|NotFound/.test(error), mutation + ": " + error);
  await noComplete(r);
  if (mutation === "pointer-during-inspect") {
    const active = JSON.parse(
      await Deno.readTextFile(
        join(r.root, "_generated/course-spec/native-ts/active.json"),
      ),
    );
    check(active.operation === foreign, "old cleanup restored pointer");
  }
  results.push({
    name: mutation,
    passed: true,
    root: r.root,
    error: error.slice(0, 300),
  });
}
// A child changing the observed profile order is refused even when the set is identical.
{
  const r = await captureFixture({ group: true });
  let error = "";
  try {
    await Core.withNativeCaptureScope(r, {
      expectedSources: ["index.qmd", "slides.qmd"],
    }, async (scope) => {
      await scope.captureInputs(
        ["index.qmd"],
        (token) => childRender(r.root, "index.qmd", token),
      );
      await scope.captureInputs(
        ["slides.qmd"],
        (token) =>
          childRender(r.root, "slides.qmd", token, {}, [
            "--profile",
            "extra,student",
          ]),
      );
    });
  } catch (e) {
    error = String(e);
  }
  check(
    error.includes("ordered profiles"),
    "same profile set reordered admitted",
  );
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
  let oldOperation = "", tokens: string[] = [];
  try {
    await Core.withNativeCaptureScope(r, {
      expectedSources: ["index.qmd", "slides.qmd"],
    }, async (scope) => {
      oldOperation = JSON.parse(
        await Deno.readTextFile(
          join(r.root, "_generated/course-spec/native-ts/active.json"),
        ),
      ).operation;
      try {
        await scope.captureInputs(["index.qmd"], async (token) => {
          tokens.push(token);
          throw Error("abort");
        });
      } catch {}
    });
  } catch {}
  await Core.withNativeCaptureScope(r, {
    expectedSources: ["index.qmd", "slides.qmd"],
  }, async (scope) => {
    await Deno.writeTextFile(
      join(r.root, "index.qmd"),
      "---\nformat: html\n---\n# New before-bind baseline\n",
    );
    for (const source of ["index.qmd", "slides.qmd"]) {
      await scope.captureInputs([source], (token) => {
        tokens.push(token);
        return childRender(r.root, source, token);
      });
    }
  });
  await Core.withCurrentNativeOperation(
    { ...r, profiles: ["student"] },
    async (op) => {
      check(
        op.identity.operation !== oldOperation && new Set(tokens).size === 3,
        "retry identities reused",
      );
    },
  );
  results.push({
    name: "new retry and pre-bind baseline",
    passed: true,
    root: r.root,
  });
}
// Unjoined renders create a fresh ordinary generation; failed old cleanup never restores its pointer.
{
  const r = await captureFixture();
  let scopeOperation = "", error = "";
  try {
    await Core.withNativeCaptureScope(r, {
      expectedSources: ["index.qmd", "slides.qmd"],
    }, async () => {
      scopeOperation = JSON.parse(
        await Deno.readTextFile(
          join(r.root, "_generated/course-spec/native-ts/active.json"),
        ),
      ).operation;
      const n = await new Deno.Command("quarto", {
        args: ["render", "index.qmd", "--to", "html"],
        cwd: r.root,
        env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1" },
        stdout: "piped",
        stderr: "piped",
      }).output();
      check(n.success, "ordinary render failed");
    });
  } catch (e) {
    error = String(e);
  }
  check(
    error.includes("OPERATION_INCOMPLETE"),
    "old scope sealed after unjoined native",
  );
  await Core.withCurrentNativeOperation(
    { ...r, profiles: ["student"] },
    async (op) => {
      check(
        op.identity.operation !== scopeOperation &&
          op.catalog.documents.length === 1,
        "old pointer restored/unioned",
      );
    },
  );
  results.push({
    name: "unjoined ordinary generation survives old cleanup",
    passed: true,
    root: r.root,
  });
}
// The callback must await its active child; catching this refusal cannot complete a generation.
{
  const r = await captureFixture();
  let pending: Promise<unknown> | undefined, error = "";
  try {
    await Core.withNativeCaptureScope(
      r,
      { expectedSources: ["index.qmd"] },
      async (scope) => {
        pending = scope.captureInputs(["index.qmd"], async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }).catch((e) => String(e));
      },
    );
  } catch (e) {
    error = String(e);
  }
  await pending;
  check(
    /OPERATION_INCOMPLETE|OPERATION_CHANGED/.test(error),
    "unawaited child sealed",
  );
  await noComplete(r);
  results.push({
    name: "unawaited child refuses seal",
    passed: true,
    root: r.root,
  });
}
console.log(JSON.stringify({ status: "PASS", results }));
