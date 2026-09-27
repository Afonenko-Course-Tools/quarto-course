import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { assemble } from "../_extensions/course-core/domain/assemble.ts";
import type { Fragment } from "../_extensions/course-core/domain/model.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "course-activation-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function render(expected?: string) {
  const result = await new Deno.Command(quarto, { args: ["render", "--fail-if-warnings"], cwd: root, stdout: "piped", stderr: "piped" }).output();
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  assert(expected ? !result.success && output.includes(expected) : result.success, output);
}
const config = "project:\n  type: default\n  render: [index.qmd]\nformat: html\n";
const generated = join(root, "_generated/course-spec");
try {
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  await Deno.writeTextFile(join(root, "_quarto.yml"), config);
  await Deno.writeTextFile(join(root, "index.qmd"), "# Standalone theme/navigation package\n\nOrdinary Quarto content.\n");
  await Deno.mkdir(generated, { recursive: true });
  await Deno.writeTextFile(join(generated, "sentinel"), "unrelated data");
  await render();
  assert(await Deno.readTextFile(join(generated, "sentinel")) === "unrelated data", "Installing the shared bundle activated destructive Core hooks");

  const course = 'course:\n  schema: "1.0"\n  id: legacy\n  validate: true\nfilters: [course-core]\n';
  await Deno.writeTextFile(join(root, "_quarto.yml"), config + course);
  await Deno.writeTextFile(join(root, "index.qmd"), '::: {#exr-native}\nA plain native exercise.\n:::\n');
  await render();
  const modelPath = join(generated, "course.json");
  const model = JSON.parse(await Deno.readTextFile(modelPath));
  assert(model.schema === "1.0" && !("pedagogy" in model) && model.exercises.length === 0, "Legacy 1.0 IR changed");
  await Deno.writeTextFile(join(root, "index.qmd"), '::: {#exr-native difficulty="introductory"}\nNew metadata.\n:::\n');
  await render('requires course.schema: "1.1"');

  await Deno.writeTextFile(join(root, "_quarto.yml"), config + course.replace("validate: true", "validate: false"));
  await Deno.writeTextFile(join(root, "index.qmd"), "# Validation disabled\n");
  await Deno.mkdir(generated, { recursive: true });
  await Deno.writeTextFile(modelPath, "stale model");
  await render();
  try { await Deno.stat(modelPath); throw new Error("validate:false retained stale course.json"); }
  catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }

  const part = (schema: string): Fragment => ({source:"index.qmd",course:{id:"mixed",schema},exercises:[]});
  let rejected = false;
  try { assemble(["old.qmd", "new.qmd"], new Map([["old.qmd", part("1.0")], ["new.qmd", part("1.1")]]), []); }
  catch (error) { rejected = String(error).includes("Inconsistent course schema"); }
  assert(rejected, "Mixed schema versions accepted");
  console.log("Core activation: inactive bundle preserved files; legacy 1.0 unchanged; new metadata and mixed schemas rejected; validate:false invalidated stale model.");
} finally { await Deno.remove(root, { recursive: true }); }
