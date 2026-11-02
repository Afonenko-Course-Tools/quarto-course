import * as Core from "../_extensions/course-core/public.ts";
import { beginNativeOperation } from "../_extensions/course-core/runtime/operation.ts";
import {
  projectContextFiles,
  readProjectContextFile,
} from "../_extensions/course-core/infrastructure/project-context.ts";
import {
  fixtureOperation,
  renderFixture,
} from "./helpers/native-operation-a3.ts";
import { dirname, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "core-static-" });
const assert = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const put = async (path: string, text: string) => {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
};
const results: unknown[] = [];
const cases = Deno.env.get("ONLY_CASE")?.split(",") ??
  [
    "getters",
    "actual-read",
    "resource-read",
    "source",
    "new-qmd",
    "symlink",
    "output",
    "explicit",
    "general",
    "executable",
    "ojs",
    "unknown-policy",
    "missing-facts",
    "null-policy",
  ];
let success = false;
try {
  for (const name of cases) {
    await Deno.remove(root, { recursive: true });
    await Deno.mkdir(root);
    await put(
      "_quarto.yml",
      `project:\n  type: website\n  render: [index.qmd]\n  output-dir: _site\nformat: {html: {theme: none}}\n${
        name === "general"
          ? ""
          : `course-core-source-policy: ${
            name === "unknown-policy"
              ? "typo"
              : name === "null-policy"
              ? "null"
              : "static"
          }\n`
      }course-project:\n  starter: {path: student}\n`,
    );
    await put(
      "index.qmd",
      `# Статический текст\n\n[Ресурс](visible.txt)\n\n\`\`\`java\nclass Main {}\n\`\`\`\n\n\`\`\`{=html}\n<p>RAW_STATIC</p>\n\`\`\`\n\n::: {#exr-one project="/projects/a" difficulty=introductory statement-visibility=open}\nУсловие.\n:::\n`,
    );
    await put("visible.txt", "VISIBLE\n");
    for (let i = 0; i < 16; i++) {
      await put(`projects/a/student/f${i}.java`, `class F${i} {}\n`);
    }
    await Deno.mkdir(join(root, "projects/a/student/empty"));
    if (
      ["executable", "ojs", "unknown-policy", "missing-facts", "null-policy"]
        .includes(name)
    ) {
      if (name === "executable") {
        await put("cell.qmd", "```{python}\nprint('MUST_NOT_EXECUTE')\n```\n");
        await put("index.qmd", "{{< include cell.qmd >}}\n");
      }
      if (name === "ojs") {
        await put("index.qmd", "---\nojs-engine: true\n---\n# Нет cells\n");
      }
      let error = "";
      const ActualCommand = Deno.Command;
      if (name === "missing-facts") {
        (Deno as any).Command = new Proxy(ActualCommand, {
          construct(target, args: any[]) {
            const command = Reflect.construct(target, args);
            if (args[1]?.args?.[0] === "inspect") {
              const output = command.output.bind(command);
              command.output = async () => {
                const result = await output();
                const native = JSON.parse(
                  new TextDecoder().decode(result.stdout),
                );
                delete native.fileInformation["index.qmd"].codeCells;
                return {
                  ...result,
                  stdout: new TextEncoder().encode(JSON.stringify(native)),
                };
              };
            }
            return command;
          },
        });
      }
      const previous = Deno.env.get("QUARTO_PROJECT_INPUT_FILES");
      Deno.env.set("QUARTO_PROJECT_INPUT_FILES", join(root, "index.qmd"));
      try {
        await beginNativeOperation(root);
      } catch (e) {
        error = String(e);
      } finally {
        (Deno as any).Command = ActualCommand;
        if (previous === undefined) {
          Deno.env.delete("QUARTO_PROJECT_INPUT_FILES");
        } else Deno.env.set("QUARTO_PROJECT_INPUT_FILES", previous);
      }
      assert(
        error.includes("OPERATION_SOURCE_POLICY"),
        name + " admission accepted: " + error,
      );
      results.push({ name, error });
      continue;
    }
    await renderFixture(root);
    let error = "",
      retained: any,
      cached: any,
      firstMetadata = "",
      firstOrigins = "";
    try {
      await fixtureOperation(root, async (op) => {
        retained = op;
        if (["getters", "general"].includes(name)) {
          await op.withProjectContexts([{
            owner: root,
            inputs: ["projects/a/native-input.qmd"],
            profiles: [],
            format: "html",
          }], async (batch) => {
            const context = batch.groups[0].contexts[0];
            cached = context;
            const metadata = JSON.stringify(context.effectiveMetadata),
              origins = JSON.stringify(context.origins);
            firstMetadata = metadata;
            firstOrigins = origins;
            assert(
              batch.metrics.fullFences === (name === "general" ? 1 : 0),
              "A1 source fence counter misreported",
            );
            const paths = await projectContextFiles(
              context,
              join(root, "projects/a/student"),
            );
            for (const path of paths) {
              await readProjectContextFile(context, path);
            }
            await op.resourceInventory({
              files: [{ source: "visible.txt", target: "visible.txt" }],
            });
            const original = {
              lstat: Deno.lstat,
              realPath: Deno.realPath,
              readDir: Deno.readDir,
              readFile: Deno.readFile,
            };
            let calls = 0;
            for (
              const key of Object.keys(original) as (keyof typeof original)[]
            ) {
              (Deno as any)[key] = (...args: any[]) => {
                calls++;
                return Reflect.apply(original[key], Deno, args);
              };
            }
            try {
              for (let repeat = 0; repeat < 3; repeat++) {
                assert(
                  JSON.stringify(
                    await projectContextFiles(
                      context,
                      join(root, "projects/a/student"),
                    ),
                  ) === JSON.stringify(paths),
                  "tree changed",
                );
                for (const path of paths) {
                  const bytes = await readProjectContextFile(context, path);
                  bytes[0] = 0; // caller copy must not alter the cache
                  assert(
                    (await readProjectContextFile(context, path))[0] !== 0,
                    "cache bytes escaped",
                  );
                }
                op.metrics;
                op.document({ source: "index.qmd" });
                const resource = await op.resourceInventory({
                  files: [{ source: "visible.txt", target: "visible.txt" }],
                });
                assert(
                  new TextDecoder().decode(resource.files[0].bytes) ===
                    "VISIBLE\n",
                  "resource bytes changed",
                );
              }
            } finally {
              Object.assign(Deno, original);
            }
            assert(
              name === "general" ? calls > 0 : calls === 0,
              `cached getters FS calls=${calls} (${name})`,
            );
            assert(
              JSON.stringify(context.effectiveMetadata) === metadata &&
                JSON.stringify(context.origins) === origins,
              "metadata/origins changed",
            );
            results.push({
              name,
              files: paths.length,
              cachedGetterFS: calls,
              origins: context.origins,
            });
          });
          if (name === "getters") {
            await op.withProjectContexts([{
              owner: root,
              inputs: ["projects/a/native-input.qmd"],
              profiles: [],
              format: "html",
            }], async (batch) => {
              const context = batch.groups[0].contexts[0];
              assert(
                JSON.stringify(context.effectiveMetadata) === firstMetadata &&
                  JSON.stringify(context.origins) === firstOrigins,
                "warm native metadata/origins differ",
              );
              assert(
                batch.metrics.inspectCalls === 0 &&
                  batch.metrics.sourceFileReads === 0 &&
                  batch.metrics.sourceCopyBytes === 0 &&
                  batch.metrics.fullFences === 0,
                "warm static A1 repeated work",
              );
            });
          }
        } else {
          if (name === "actual-read") {
            await put(
              "projects/a/student/f0.java",
              "CHANGED_BEFORE_REAL_READ\n",
            );
            await op.withProjectContexts([{
              owner: root,
              inputs: ["projects/a/native-input.qmd"],
              profiles: [],
              format: "html",
            }], async () => {
              throw Error("changed actual read accepted");
            });
          }
          if (name === "resource-read") {
            await put("visible.txt", "CHANGED_BEFORE_RESOURCE_READ\n");
            await op.resourceInventory({
              files: [{ source: "visible.txt", target: "visible.txt" }],
            });
          }
          if (name === "source" || name === "explicit") {
            await put("projects/a/student/f0.java", "CHANGED\n");
          }
          if (name === "new-qmd") await put("new.qmd", "# Новый QMD\n");
          if (name === "symlink") {
            await Deno.remove(join(root, "projects/a/student/empty"));
            await Deno.symlink("/tmp", join(root, "projects/a/student/empty"));
          }
          if (name === "output") {
            await put("_site/index.html", "PRIVATE_OUTPUT_CHANGE");
          }
          if (name === "explicit") await op.assertCurrent();
        }
      });
    } catch (e) {
      error = String(e);
    }
    if (["getters", "general"].includes(name)) assert(!error, error);
    else {assert(
        error.includes("OPERATION_CHANGED"),
        name + " boundary accepted: " + error,
      );}
    let expired = "";
    try {
      retained.metrics;
    } catch (e) {
      expired = String(e);
    }
    assert(
      expired.includes("OPERATION_EXPIRED"),
      "operation survived callback",
    );
    if (cached) {
      try {
        await projectContextFiles(cached, join(root, "projects/a/student"));
        throw Error("context survived");
      } catch (e) {
        assert(String(e).includes("CONTEXT_EXPIRED"), String(e));
      }
    }
    if (error) results.push({ name, error });
  }
  console.log(JSON.stringify({ results }));
  console.log(
    "PASS static source policy / cached getters / real boundaries / lifecycle / general",
  );
  success = true;
} finally {
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Fixture retained: " + root);
}
