import { beginNativeOperation } from "../_extensions/course-core/runtime/operation.ts";
import { join } from "stdlib/path";
const owner = await Deno.makeTempDir({ prefix: "static-diagrams-" });
const previous = Deno.env.get("QUARTO_PROJECT_INPUT_FILES");
let success = false;
try {
  await Deno.writeTextFile(join(owner, "_quarto.yml"), "project: {type: website, render: [index.qmd]}\nformat: {html: {theme: none}}\ncourse-core-source-policy: static\n");
  await Deno.writeTextFile(join(owner, "index.qmd"), "# Нативные статические диаграммы\n\n```java\nclass Main {}\n```\n\n```{mermaid}\nflowchart LR\n  A --> B\n```\n\n```{dot}\ndigraph G { A -> B }\n```\n\n```{=html}\n<p>raw</p>\n```\n");
  Deno.env.set("QUARTO_PROJECT_INPUT_FILES", join(owner, "index.qmd"));
  await beginNativeOperation(owner);
  const pointer = JSON.parse(await Deno.readTextFile(join(owner, "_generated/course-spec/native-ts/active.json")));
  const state = JSON.parse(await Deno.readTextFile(join(pointer.directory, "state.json")));
  if (state.sourcePolicy !== "static" || state.metrics.inspectCalls !== 1) throw Error("Native diagram admission changed policy/inspect count");
  console.log("PASS genuine markdown owner: mermaid + dot + raw + ordinary Java accepted; same one native inspect");
  success = true;
} finally {
  if (previous === undefined) Deno.env.delete("QUARTO_PROJECT_INPUT_FILES"); else Deno.env.set("QUARTO_PROJECT_INPUT_FILES", previous);
  if (success) await Deno.remove(owner, { recursive: true }); else console.error("Fixture retained: " + owner);
}
