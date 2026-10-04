import { renderOwner } from "./owner-render.ts";
import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { assemble } from "../_extensions/course-core/domain/assemble.ts";
import { adapters } from "../_extensions/course-core/infrastructure/adapters.ts";
import type { Fragment } from "../_extensions/course-core/domain/model.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "course-activation-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function render(expected?: string, owner = false) {
  if (owner) {
    const result = await renderOwner(root, "student");
    assert(expected ? !result.success && result.text.includes(expected) : result.success, result.text);
    return;
  }
  const result = await new Deno.Command(quarto, { args: ["render", "--fail-if-warnings"], cwd: root, stdout: "piped", stderr: "piped" }).output();
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  assert(expected ? !result.success && output.includes(expected) : result.success, output);
}
async function rejected(action: () => unknown, expected: string) {
  try { await action(); } catch (error) { assert(String(error).includes(expected), String(error)); return; }
  throw new Error(`Ожидался отказ: ${expected}`);
}
const config = "project:\n  type: default\n  output-dir: _site\n  render: [index.qmd]\nformat: html\nlang: ru\n";
const generated = join(root, "_generated/course-spec");
try {
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  await Deno.writeTextFile(join(root, "_quarto.yml"), config);
  await Deno.writeTextFile(join(root, "index.qmd"), "# Независимое оформление\n\nОбычный документ Quarto.\n");
  await Deno.mkdir(generated, { recursive: true });
  await Deno.writeTextFile(join(generated, "sentinel"), "посторонние данные");
  await render();
  assert(await Deno.readTextFile(join(generated, "sentinel")) === "посторонние данные", "Установка набора расширений самовольно включила обработчики Core");

  await Deno.writeTextFile(join(root, "_quarto.yml"), config + "course:\n  id: passive\n  validate: true\n");
  await render();
  assert(await Deno.readTextFile(join(generated, "sentinel")) === "посторонние данные", "Метаданные course без обработчиков активировали Core");
  // The passive sentinel assertion is complete; this is not an owner service artifact.
  await Deno.remove(join(generated, "sentinel"));
  const activeConfig = config.replace("project:\n", "project:\n  pre-render: [_extensions/course-core/entrypoints/pre.ts, _extensions/course-core/entrypoints/owner-freeze.ts]\n  post-render: _extensions/course-core/entrypoints/post.ts\n");
  const course = 'course:\n  id: current\n  validate: true\nfilters: [course-core]\n';
  await Deno.writeTextFile(join(root, "_quarto.yml"), activeConfig + course);
  await Deno.writeTextFile(join(root, "_quarto-student.yml"), "course:\n  view: student\n");
  await Deno.writeTextFile(join(root, "_quarto-full.yml"), "course:\n  view: full\n");
  await Deno.writeTextFile(join(root, "index.qmd"), '## Тема {#sec-native}\n\n::: {#exr-native course-role="demonstration" difficulty="introductory"}\nУпражнение с учебными метаданными.\n:::\n');
  await render(undefined, true);
  const modelPath = join(generated, "course.json");
  const model = JSON.parse(await Deno.readTextFile(modelPath));
  assert(!("schema" in model) && model.pedagogy.elements[0].metadata.difficulty === "introductory" && model.exercises.length === 1 && model.exercises[0].target === "manual" && model.exercises[0].sourceTopic.id === "sec-native",
    "Единый контракт должен извлекать учебные метаданные без селектора версии и каноническую задачу без target");
  // Schema-selector refusal also applies to ordinary noncanonical documents.
  await Deno.writeTextFile(join(root, "index.qmd"), "# Unsupported schema\n");
  for (const schema of ["1.0", "1.1"]) {
    await Deno.writeTextFile(join(root, "_quarto.yml"), activeConfig + course.replace("course:\n", `course:\n  schema: "${schema}"\n`));
    await render("Поле course.schema не поддерживается");
  }
  const obsolete = {source:"index.qmd",course:{id:"current",schema:"1.1"},exercises:[]} as unknown as Fragment;
  await rejected(() => assemble(["index.qmd"], new Map([["index.qmd", obsolete]]), []), "Поле course.schema не поддерживается");

  const adapterPath = join(root, "_extensions/test-adapter");
  await Deno.mkdir(adapterPath);
  await Deno.writeTextFile(join(adapterPath, "rules.cue"), "package course\n");
  const contract = { name: "test-adapter", rules: "rules.cue" };
  await Deno.writeTextFile(join(adapterPath, "contract.json"), JSON.stringify(contract));
  assert((await adapters(root, [])).length === 0, "Установка пакета включила адаптер неявно");
  assert((await adapters(root, ["test-adapter"])).length === 1, "Текущий адаптер не найден");
  for (const field of ["version", "requires_core", "api", "ir", "supported_ir"]) {
    await Deno.writeTextFile(join(adapterPath, "contract.json"), JSON.stringify({...contract, [field]: "1.0"}));
    assert((await adapters(root, [])).length === 0, "Неактивный устаревший адаптер влияет на Core");
    await rejected(() => adapters(root, ["test-adapter"]), `поле ${field} не поддерживается`);
  }
  await Deno.remove(adapterPath, { recursive: true });

  await Deno.writeTextFile(join(root, "_quarto.yml"), activeConfig + course.replace("validate: true", "validate: false"));
  await Deno.writeTextFile(join(root, "index.qmd"), "# Проверка отключена\n");
  await Deno.mkdir(generated, { recursive: true });
  await Deno.writeTextFile(modelPath, "устаревшая модель");
  await render();
  try { await Deno.stat(modelPath); throw new Error("validate:false сохранил устаревший course.json"); }
  catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
  console.log("Включение Core: независимость пакетов, текущие метаданные, отказ от старых селекторов и контрактов адаптеров, удаление устаревшей модели — успешно.");
} finally { await Deno.remove(root, { recursive: true }); }
