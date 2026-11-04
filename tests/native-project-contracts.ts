import * as Core from "../_extensions/course-core/public.ts";
import { readProjectContextFile } from "../_extensions/course-core/infrastructure/project-context.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const reuseFixture = Deno.env.get("CONTRACT_REUSE_FIXTURE");
const root = reuseFixture ||
  await Deno.makeTempDir({ prefix: "core-contracts-" });
const extension = join(
  dirname(dirname(fromFileUrl(import.meta.url))),
  "_extensions/course-core",
);
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const put = async (p: string, s: string) => {
  await Deno.mkdir(dirname(join(root, p)), { recursive: true });
  await Deno.writeTextFile(join(root, p), s);
};
const old = Deno.env.get("CONTRACT_OLD_BUDGET") === "1",
  evidence = Deno.env.get("CONTRACT_EVIDENCE");
const baseline = Deno.env.get("CONTRACT_BASELINE");
const command = Deno.Command, write = Deno.writeTextFile;
let active = false;
const calls: unknown[] = [], writes: string[] = [];
let success = false;
(Deno as any).Command = new Proxy(command, {
  construct(t, args: any[]) {
    if (active) calls.push(args[1]?.args);
    return Reflect.construct(t, args);
  },
});
(Deno as any).writeTextFile = async (p: any, s: string, ...rest: any[]) => {
  if (active) writes.push(String(p));
  return await (write as any)(p, s, ...rest);
};
const normalize = (v: unknown) =>
  JSON.parse(
    JSON.stringify(v, (_k, x) =>
      typeof x === "string" ? x.replaceAll(root, "OWNER") : x),
  );
const snapshots: unknown[] = [];
let metrics: any;
try {
  if (!reuseFixture) {
    await put(
      "_quarto.yml",
      `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]\n  post-render: [quarto run ${extension}/entrypoints/native-post.ts]\nformat:\n  html: {theme: none}\ncourse: {id: contracts, view: student}\ncourse-core-runtime: native-ts\ncourse-core-role: exercise-bank\ncourse-core-source-policy: static\ncourse-core-projection: student\nfilters:\n  - at: pre-ast\n    path: ${extension}/native-ts/early-context.lua\n  - at: post-quarto\n    path: ${extension}/native-ts/late-kind.lua\n  - at: post-render\n    path: ${extension}/native-ts/late-filter.lua\n`,
    );
    await put(
      "index.qmd",
      ["a", "b", "c"].map((n) =>
        `::: {#exr-${n} project="/projects/${n}" difficulty=introductory statement-visibility=open}\nУсловие ${n}.\n:::\n`
      ).join("\n"),
    );
    for (const n of ["a", "b", "c"]) {
      const starter = n === "b"
        ? "'false'"
        : n === "c"
        ? "|-\n      starter"
        : "starter";
      await put(
        `projects/${n}/_metadata.yml`,
        `course-project:\n  starter:\n    path: ${starter}\n    requires: {optional: false}\n  components:\n    optional: {path: optional}\n`,
      );
      await put(
        `projects/${n}/${n === "b" ? "false" : "starter"}/main.txt`,
        `Содержимое ${n}\n`,
      );
      await put(`projects/${n}/optional/private.txt`, "Не включать\n");
    }
    const rendered = await new command(
      Deno.env.get("QUARTO") || "/opt/quarto/bin/quarto",
      {
        args: ["render", "index.qmd", "--to", "html"],
        cwd: root,
        env: {
          XDG_CACHE_HOME: Deno.env.get("XDG_CACHE_HOME")!,
          QUARTO_PROFILE: "",
          QUARTO_RUN_NO_NETWORK: "true",
        },
        stdout: "piped",
        stderr: "inherit",
      },
    ).output();
    assert(rendered.success, "Не выполнен настоящий producer");
  }
  await Core.withCurrentNativeOperation({
    root,
    profiles: [],
    projection: "student",
    outputDirectory: join(root, "_site"),
  }, async (op) => {
    const request = {
      owner: root,
      inputs: ["a", "b", "c"].map((n) => `projects/${n}/native-input.qmd`),
      profiles: [],
      format: "html",
    };
    const use = old
      ? op.withProjectContexts.bind(op)
      : (op as any).withProjectContracts?.bind(op);
    assert(use, "Нет нового публичного contract API");
    let escaped: any;
    active = true;
    const started = performance.now();
    await use([request], async (batch: any) => {
      for (const context of batch.groups[0].contexts) {
        escaped = context;
        assert(
          old || !Object.hasOwn(context, "effectiveMetadata"),
          "Narrow handle не обещает full metadata",
        );
        const plan = await Core.planProject(context, { audience: "student" }),
          n = context.input.split("/").at(-2)!;
        const condition = op.condition({
          source: "index.qmd",
          exerciseId: "exr-" + n,
          view: "student",
        });
        const closure = await Core.materializationClosure(plan, condition);
        const inventory = await Core.materializeProject(plan, condition, {
          submission: { files: [], instructions: "Сдайте файлы." },
        });
        const { id: _, ...semantic } = plan;
        snapshots.push(
          normalize({
            contract: Core.decodeProjectContract(context),
            origins: context.origins,
            plan: semantic,
            closure,
            files: inventory.files,
          }),
        );
      }
      metrics = batch;
    });
    active = false;
    let expired = false;
    try {
      await Core.planProject(escaped, { audience: "student" });
    } catch (e) {
      expired = String(e).includes("CONTEXT_EXPIRED");
    }
    assert(expired, "Истёкший handle ожил");
    let forged = false;
    try {
      await Core.planProject(structuredClone(escaped), { audience: "student" });
    } catch (e) {
      forged = String(e).includes("CONTEXT_EXPIRED");
    }
    assert(forged, "DTO получил authority");
    const result = {
      mode: old ? "OLD" : "GREEN",
      wallMs: performance.now() - started,
      metrics: metrics.metrics,
      calls,
      writes,
      snapshots,
      nativeInputs: 3,
    };
    if (evidence) await write(evidence, JSON.stringify(result, null, 2) + "\n");
    if (baseline) {
      const expected = JSON.parse(await Deno.readTextFile(baseline));
      assert(
        JSON.stringify(expected.snapshots) === JSON.stringify(snapshots),
        "Namespace/origins/plan/student inventory bytes отличаются от general",
      );
    }
    assert(
      !writes.some((p) => p.startsWith(root + "/") && p.endsWith(".qmd")),
      "A1 изменил авторский QMD вместо disposable-копии",
    );
    if (!old) {
      active = true;
      await (op as any).withProjectContracts([{
        ...request,
        inputs: request.inputs.slice(1),
      }], async (batch: any) => {
        assert(
          batch.groups.length === 1 &&
            batch.groups[0].contexts.length === request.inputs.length - 1 &&
            batch.groups[0].contexts.every((context: Core.ProjectContractContext, index: number) =>
              context.input === join(root, request.inputs[index + 1])
            ),
          "Subset batch изменил выбранные project inputs",
        );
      });
      active = false;
    }
    console.log(
      JSON.stringify({
        status: "PASS",
        mode: result.mode,
        metrics: metrics.metrics,
        wallMs: result.wallMs,
        parity: !!baseline,
      }),
    );
  });
  if (!old) {
    const options = {
      root,
      profiles: [],
      projection: "student" as const,
      outputDirectory: join(root, "_site"),
    };
    const request = {
      owner: root,
      profiles: [],
      format: "html",
      inputs: ["projects/a/native-input.qmd"],
    };
    let refusal = "", nested = "";
    try {
      await Core.withCurrentNativeOperation(options, async (op) => {
        await op.withProjectContracts([request], async () => {
          try {
            await op.withProjectContexts([request], async () => {
              throw Error("nested callback reached");
            });
          } catch (e) {
            nested = String(e);
          }
        });
      });
    } catch (e) {
      refusal = String(e);
    }
    assert(
      nested.includes("CONTEXT_REQUEST") &&
        refusal.includes("OPERATION_INCOMPLETE"),
      "Old/new methods did not share failed/reentrant guard " + nested +
        refusal,
    );
    refusal = "";
    try {
      await Core.withCurrentNativeOperation(options, async (op) => {
        await op.withProjectContracts([request], async (batch) => {
          const context = batch.groups[0].contexts[0],
            path = join(root, "projects/a/starter/main.txt");
          await write(path, "MUTATED BEFORE FIRST LAZY READ\n");
          await readProjectContextFile(context, path);
        });
      });
    } catch (e) {
      refusal = String(e);
    }
    assert(
      refusal.includes("CONTEXT_CHANGED"),
      "Narrow first real read accepted changed Source " + refusal,
    );
    console.log(
      "PASS shared old/narrow reentrant failure guard and mutation before first narrow lazy read",
    );
  }
  success = true;
} finally {
  (Deno as any).Command = command;
  (Deno as any).writeTextFile = write;
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Fixture retained:", root);
}
