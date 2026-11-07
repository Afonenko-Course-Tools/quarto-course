import { fixtureAt, fixtureRecord, fixtureString, required } from "./helpers/required.ts";
import { beginNativeOperation, withPendingNativeOperation } from "../_extensions/course-core/runtime/operation.ts";
import type { NativePendingOperationExpectation } from "../_extensions/course-core/runtime/contracts.ts";
import { join } from "stdlib/path";
const owner = await Deno.makeTempDir({ prefix: "static-diagrams-" });
const previous = Deno.env.get("QUARTO_PROJECT_INPUT_FILES");
let success = false;
try {
  await Deno.writeTextFile(join(owner, "_quarto.yml"), "project: {type: website, render: [index.qmd]}\nformat: {html: {theme: none}}\ncourse-core-source-policy: static\n");
  await Deno.writeTextFile(join(owner, "index.qmd"), "# Нативные статические диаграммы\n\n```java\nclass Main {}\n```\n\n```{mermaid}\nflowchart LR\n  A --> B\n```\n\n```{dot}\ndigraph G { A -> B }\n```\n\n```{=html}\n<p>raw</p>\n```\n");
  Deno.env.set("QUARTO_PROJECT_INPUT_FILES", join(owner, "index.qmd"));
  await beginNativeOperation(owner);
  const pointer = fixtureRecord(JSON.parse(await Deno.readTextFile(join(owner, "_generated/course-spec/native-ts/active.json"))));
  const state = fixtureRecord(JSON.parse(await Deno.readTextFile(join(fixtureString(pointer.directory), "state.json"))));
  if (fixtureAt(state, ["metrics", "inspectCalls"]) !== 1) throw Error("Native diagram admission changed inspect count");
  const expectation: NativePendingOperationExpectation = { root: owner, profiles: [], projection: "student", outputDirectory: join(owner, "_site") };
  await withPendingNativeOperation(expectation, async (pending) => {
    if (pending.inputs.length !== 1 || required(pending.inputs[0]).source !== "index.qmd" ||
      !required(pending.inputs[0]).captureWitness || pending.identity.projection !== "student" ||
      pending.identity.profiles.length !== 0 || pending.identity.operation !== pointer.operation) {
      throw Error("Native static diagram admission lost actual pending input/identity");
    }
  });
  let rejected = false;
  try {
    await withPendingNativeOperation({ ...expectation, profiles: ["foreign"] }, async () => {});
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("OPERATION_BINDING");
  }
  if (!rejected) throw Error("Pending admission accepted a foreign profile");
  const after = fixtureRecord(JSON.parse(await Deno.readTextFile(join(fixtureString(pointer.directory), "state.json"))));
  if (fixtureAt(after, ["metrics", "inspectCalls"]) !== 1) throw Error("Pending validation repeated native inspection");
  console.log("PASS genuine markdown owner: mermaid + dot + raw + ordinary Java accepted; same one native inspect");
  success = true;
} finally {
  if (previous === undefined) Deno.env.delete("QUARTO_PROJECT_INPUT_FILES"); else Deno.env.set("QUARTO_PROJECT_INPUT_FILES", previous);
  if (success) await Deno.remove(owner, { recursive: true }); else console.error("Fixture retained: " + owner);
}
