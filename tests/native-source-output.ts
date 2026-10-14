import {copy} from "stdlib/fs";
import {join} from "stdlib/path";
import {collectExport} from "../_extensions/course-core/body-export/collect.ts";
import {loadNativeRun} from "../_extensions/course-core/infrastructure/native-run.ts";

const assert = (value: unknown, message: string) => {if (!value) throw Error(message);};
const root = await Deno.makeTempDir({prefix: "course-native-source-output-"});
try {
  const bank = join(root, "bank");
  await Deno.mkdir(join(bank, "nested"), {recursive: true});
  await copy(new URL("../_extensions/course-core", import.meta.url).pathname, join(bank, "_extensions/course-core"));
  const authored: Record<string, string> = {
    "_quarto.yml": "project: {type: default}\ncourse: {id: demo}\n",
    "bank/_quarto.yml": "project: {type: book}\nbook: {title: Банк, chapters: [index.qmd, nested/task.qmd]}\nformat: html\noutput-file: global.html\nfilters: [course-core]\n",
    "bank/global.qmd": "---\ntitle: Общие настройки\n---\n# Общие настройки\n",
    "bank/nested/format.qmd": "---\ntitle: Настройки формата\nformat: {html: {output-file: specific.html}}\n---\n# Настройки формата\n",
    "bank/index.qmd": "---\ntitle: Работа\noutput-file: custom-work.html\nassessment: {id: lab, kind: lab}\n---\n# Работа\n\n::: {.task-items}\n- @exr-one\n:::\n",
    "bank/nested/task.qmd": "---\ntitle: Задачи\noutput-file: custom-task.html\nexercise-bank: true\nexercise-statement-visibility: restricted\n---\n# Задачи\n\n::: {#exr-one course-role=control difficulty=introductory time=10}\nУсловие первого запуска.\n:::\n",
  };
  for (const [path, value] of Object.entries(authored)) await Deno.writeTextFile(join(root, path), value);
  const first = await collectExport(root, {book: "bank", work: "lab"});
  assert(first.result.model.exercises.length === 1, "Не получено выбранное упражнение");
  const run = await loadNativeRun(bank);
  assert(run.documents.some(d => d.document.output === "custom-work.html.json"), "Потерян собственный output-file работы");
  assert(run.documents.some(d => d.document.output === "nested/custom-task.html.json"), "Потерян собственный output-file вложенного документа");
  assert(run.documents.some(d => d.source === "global.qmd" && d.document.output === "global.html.json"), "Потерян общий output-file проекта");
  assert(run.documents.some(d => d.source === "nested/format.qmd" && d.document.output === "nested/global.html.json"), "Настройка HTML вмешалась в исходный JSON writer");
  for (const doc of run.documents) {
    assert(run.outputFiles.includes(join(run.outputDirectory, doc.document.output)), "Документ не привязан к текущему native output");
    await Deno.stat(join(run.outputDirectory, doc.document.output));
  }
  for (const [path, value] of Object.entries(authored)) assert(await Deno.readTextFile(join(root, path)) === value, "Изменён авторский источник: " + path);
  const updated = authored["bank/nested/task.qmd"].replace("первого", "второго");
  await Deno.writeTextFile(join(bank, "nested/task.qmd"), updated);
  const second = await collectExport(root, {book: "bank", work: "lab"});
  assert(JSON.stringify(second.result.model.exercises).includes("второго"), "Повторный экспорт использует старый AST");
  assert((await loadNativeRun(bank)).outputDirectory !== run.outputDirectory, "Повторный экспорт использует прежний output-dir");
  for await (const entry of Deno.readDir(bank)) assert(!entry.name.startsWith("_quarto-course-export-"), "Оставлен временный профиль");
  await Deno.writeTextFile(join(bank, "collision.qmd"), "---\ntitle: Конфликт\noutput-file: custom-work.html\n---\n# Конфликт\n");
  let collision = false, collisionDiagnostic = "";
  try {await collectExport(root, {book: "bank", work: "lab"});}
  catch (error) {
    collisionDiagnostic = String(error);
    // Quarto 1.11.5 can reject the duplicate during relocation before Core's
    // post-render hook; either boundary must reject the current collection.
    collision = collisionDiagnostic.includes("NATIVE.DUPLICATE_OUTPUT") ||
      collisionDiagnostic.includes("rename '") && collisionDiagnostic.includes("custom-work.html.json");
  }
  assert(collision, "Два документа присвоили один native output: " + collisionDiagnostic);
  let stale = false;
  try {await loadNativeRun(bank); stale = true;} catch { /* Отказ не подтверждает прежний запуск. */ }
  assert(!stale, "После отказа доступен прежний завершённый запуск");
  console.log("PASS исходный JSON output-file: корень, вложенный документ, авторские байты, свежий повторный запуск");
} finally {await Deno.remove(root, {recursive: true});}
