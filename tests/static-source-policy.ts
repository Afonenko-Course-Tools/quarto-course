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
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
const put = async (path: string, text: string) => {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
};
const results: { name: string; error?: string }[] = [];
let success = false;
try {
  for (const name of ["unknown-policy", "null-policy", "getters", "actual-read", "resource-read", "output"]) {
    await Deno.remove(root, { recursive: true });
    await Deno.mkdir(root);
    const policy = name === "unknown-policy" ? "typo" : name === "null-policy" ? "null" : "static";
    await put(
      "_quarto.yml",
      `project:\n  type: website\n  render: [index.qmd]\n  output-dir: _site\nformat: {html: {theme: none}}\ncourse-core-source-policy: ${policy}\ncourse-project:\n  starter: {path: student}\n`,
    );
    await put(
      "index.qmd",
      "# Текст\n\n[Ресурс](visible.txt)\n\n::: {#exr-one project=\"/projects/a\" difficulty=introductory statement-visibility=open}\nУсловие.\n:::\n",
    );
    await put("visible.txt", "VISIBLE\n");
    await put("projects/a/student/f0.java", "class F0 {}\n");
    if (name === "unknown-policy" || name === "null-policy") {
      let error = "";
      const previous = Deno.env.get("QUARTO_PROJECT_INPUT_FILES");
      Deno.env.set("QUARTO_PROJECT_INPUT_FILES", join(root, "index.qmd"));
      try {
        await beginNativeOperation(root);
      } catch (e) {
        error = String(e);
      } finally {
        if (previous === undefined) Deno.env.delete("QUARTO_PROJECT_INPUT_FILES");
        else Deno.env.set("QUARTO_PROJECT_INPUT_FILES", previous);
      }
      assert(error.includes("OPERATION_SOURCE_POLICY"), name + ": " + error);
      results.push({ name, error });
      continue;
    }
    await renderFixture(root);
    const retained: { operation?: Core.NativeOperation; context?: Core.ProjectContext } = {};
    let error = "";
    try {
      await fixtureOperation(root, async (op) => {
        retained.operation = op;
        if (name === "getters" || name === "actual-read") {
          const expected = name === "actual-read" ? "CHANGED_BEFORE_REAL_READ\n" : "class F0 {}\n";
          if (name === "actual-read") await put("projects/a/student/f0.java", expected);
          await op.withProjectContexts([{
            owner: root,
            inputs: ["projects/a/native-input.qmd"],
            profiles: [],
            format: "html",
          }], async (batch) => {
            const context = batch.groups[0].contexts[0];
            retained.context = context;
            const metadata = JSON.stringify(context.effectiveMetadata);
            const origins = JSON.stringify(context.origins);
            const path = join(root, "projects/a/student/f0.java");
            const paths = await projectContextFiles(context, dirname(path));
            assert(paths.includes(path), "A1 потерял фактический project file");
            const bytes = await readProjectContextFile(context, path);
            assert(new TextDecoder().decode(bytes) === expected, "A1 не вернул текущие bytes до acquisition");
            bytes[0] = 0;
            assert(new TextDecoder().decode(await readProjectContextFile(context, path)) === expected, "Caller изменил captured bytes через возвращённую копию");
            await batch.checkpoint();
            assert(JSON.stringify(context.effectiveMetadata) === metadata && JSON.stringify(context.origins) === origins, "Metadata/origins изменились внутри живой batch");
          });
          assert(retained.context, "A1 callback не получил context");
          let expired = "";
          try {
            await projectContextFiles(retained.context, join(root, "projects/a/student"));
          } catch (e) {
            expired = String(e);
          }
          assert(expired.includes("CONTEXT_EXPIRED"), "A1 context пережил собственную batch");
          op.document({ source: "index.qmd" });
          const resource = await op.resourceInventory({ files: [{ source: "visible.txt", target: "visible.txt" }] });
          assert(new TextDecoder().decode(resource.files[0].bytes) === "VISIBLE\n", "Потеряны bytes наблюдённого ресурса");
        } else if (name === "resource-read") {
          await put("visible.txt", "CHANGED_BEFORE_RESOURCE_READ\n");
          await put("_site/visible.txt", "CHANGED_BEFORE_RESOURCE_READ\n");
          const resource = await op.resourceInventory({ files: [{ source: "visible.txt", target: "visible.txt" }] });
          assert(new TextDecoder().decode(resource.files[0].bytes) === "CHANGED_BEFORE_RESOURCE_READ\n", "Не прочитаны фактические конечные bytes");
        } else {
          await put("_site/index.html", "PRIVATE_OUTPUT_CHANGE");
        }
      });
    } catch (e) {
      error = String(e);
    }
    assert(!error, name + ": " + error);
    assert(retained.operation, "Operation callback не начался");
    let expired = "";
    try {
      retained.operation.metrics;
    } catch (e) {
      expired = String(e);
    }
    assert(expired.includes("OPERATION_EXPIRED"), "Operation пережила callback");
    results.push({ name, ...(error ? { error } : {}) });
  }
  console.log(JSON.stringify({ results }));
  console.log("PASS source-policy enum / current A1 bytes / caller copy / short lifetime / finished resource copies");
  success = true;
} finally {
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Fixture retained: " + root);
}
