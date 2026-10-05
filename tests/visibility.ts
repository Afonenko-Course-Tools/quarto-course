import { assemble } from "../_extensions/course-core/domain/assemble.ts";
import type { DocumentResult } from "../_extensions/course-core/domain/model.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { copy } from "stdlib/fs";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const temporary = await Deno.makeTempDir({ prefix: "course-visibility-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function write(path: string, text: string) { await Deno.mkdir(dirname(join(temporary, path)), {recursive:true}); await Deno.writeTextFile(join(temporary,path),text); }
let currentView = "student";
async function render(profile: string, expected?: string, _canonical = true) {
  const result = await (async () => {
      const output = await new Deno.Command(quarto, {args:["render","--profile",profile,"--fail-if-warnings"],cwd:temporary,stdout:"piped",stderr:"piped"}).output();
      return {success: output.success, text: new TextDecoder().decode(output.stdout) + new TextDecoder().decode(output.stderr)};
    })();
  assert(expected ? !result.success && result.text.includes(expected) : result.success, `${profile}: ${expected || "success"}\n${result.text}`);
  if (!expected) currentView = profile === "student" ? "student" : "full";
  return result.text;
}
const modelPath = join(temporary,"_generated/course-spec/course.json");
async function model() {
  const directory = join(temporary, "_generated/course-spec/documents", currentView);
  const files = [...Deno.readDirSync(directory)].filter(entry => entry.name.endsWith(".json"));
  assert(files.length === 1, "Expected one native document result");
  const result: DocumentResult = JSON.parse(await Deno.readTextFile(join(directory, files[0].name)));
  assert(result.scope === "document", "Local render falsely claimed release scope");
  return assemble([result.source], new Map([[result.source, result]]), []);
}
async function exists(path: string) { try { await Deno.stat(path); return true; } catch { return false; } }
const exercise = (id: string, text: string, attributes="") => `:::: {#exr-${id} target="manual" course-role="independent-study" difficulty="introductory" ${attributes}}\n## ${id}\n\n${text}\n::::\n`;
try {
  await copy(join(repo,"_extensions"),join(temporary,"_extensions"));
  await write("_quarto.yml", `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\ncourse:\n  id: visibility-test\nfilters: [course-core]\nformat: html\n`);
  await write("_quarto-student.yml", "course:\n  view: student\n");
  await write("_quarto-full.yml", "course:\n  view: full\n");
  await write("_quarto-review.yml", "course:\n  view: full\n");
  const main = `---\nassessment:\n  kind: test\n---\n\n# Assessment {#sec-control}\n\n`
    + exercise("public","PUBLIC_STUDENT\n\n::: {.grading-notes}\nPRIVATE_NOTES\n:::")
    + ":::::: {.when-full}\n" + exercise("private","PRIVATE_CONTROL")
    + "::: {.assessment-items}\n1. @exr-private\n:::\n::::::\n"
    + ":::::: {.content-visible when-profile=full}\n" + exercise("standard","STANDARD_FULL") + "::::::\n"
    + ":::::: {.unless-full}\n" + exercise("student","STUDENT_ONLY") + "::::::\n"
    + "::: {.when-full}\n::: {.when-student}\nNEVER_VISIBLE\n:::\n:::\n"
    + "A [INLINE_PRIVATE]{.when-full}.\n\n```{.text .when-full}\nCODE_PRIVATE\n```\n";
  await write("index.qmd", main);
  await render("full");
  let result = await model();
  assert(result.course.view === "full", "Полное представление отсутствует");
  assert(result.exercises.length === 3 && result.assessments.length === 1,"Неверное число объектов в полном представлении");
  assert(result.exercises[0].gradingNotes?.length === 1,"Примечания не извлечены");
  assert(!JSON.stringify(result.exercises[0].body).includes("PRIVATE_NOTES"),"Примечания попали в условие задания");
  assert(!JSON.stringify(result.assessments[0].body).includes("PRIVATE_NOTES"),"Примечания попали в текст занятия");
  await render("student");
  result = await model();
  const html = await Deno.readTextFile(join(temporary,"_site/index.html"));
  const encoded = JSON.stringify(result);
  assert(result.course.view === "student" && result.exercises.length === 2 && result.assessments.length === 0,"Неверное число объектов в студенческом представлении");
  for (const marker of ["PRIVATE_NOTES","PRIVATE_CONTROL","STANDARD_FULL","NEVER_VISIBLE","INLINE_PRIVATE","CODE_PRIVATE"])
    assert(!html.includes(marker) && !encoded.includes(marker),`В студенческом представлении найдено закрытое содержимое: ${marker}`);
  await write("index.qmd", "# Произвольный профиль\n\n::: {.when-review}\nREVIEW_ONLY\n:::\n");
  await render("review");
  assert((await Deno.readTextFile(join(temporary,"_site/index.html"))).includes("REVIEW_ONLY"), "Произвольный профиль потерян");
  assert((await model()).exercises.length === 0, "Произвольный профиль создал задачу");
  const invalid = [
    [".when-full .when-student", "допустим только один класс .when-"],
    [".when-Full", "имя профиля в нижнем регистре"],
    ['.when-full .content-visible when-profile="full"', "Нельзя смешивать краткую и стандартную запись"],
    ['.content-visible when-profile="full" when-format="html"', "Условия профиля нельзя совмещать"],
    ['.content-visible .content-hidden when-profile="full"', "одновременно иметь классы content-visible и content-hidden"],
  ];
  for (const [selector, expected] of invalid) {
    await write("index.qmd",`# Invalid\n\n::: {${selector}}\nInvalid\n:::\n`);
    await Deno.mkdir(dirname(modelPath), {recursive:true}); await Deno.writeTextFile(modelPath,"{}");
    await render("student", expected, false);
    console.log("PASS visibility refusal: " + expected);
    assert(!await exists(modelPath),"После ошибки рендера осталась прежняя опубликованная модель");
  }
  // Native document YAML replaces its nested course map at this filter stage.
  // Preserve the required ID so this fixture isolates the view mismatch.
  await write("index.qmd", "---\ncourse:\n  id: visibility-test\n  view: full\n---\n# Неверное представление\n");
  await render("student", "course.view не соответствует выбранному профилю Quarto", false);
  await write("index.qmd", "# Неверные примечания\n\n::: {.grading-notes}\nВне задания\n:::\n");
  await render("full", "Каждый блок grading-notes должен относиться ровно к одному заданию", false);
  await write("index.qmd", "## Примечания {#sec-notes}\n\n" + exercise("nested","::: {.grading-notes}\n::: {.grading-notes}\nNested\n:::\n:::"));
  await render("full", "Блоки grading-notes нельзя вкладывать друг в друга");
  // Видимость не зависит от target: регистрируется минимальный публичный адаптер.
  await write("_extensions/public-test/contract.json", JSON.stringify({name:"public-test",rules:"spec.cue"}));
  await write("_extensions/public-test/validate.lua", "return {validate=function(doc) end}\n");
  await write("_extensions/public-test/spec.cue", "package course\n#Course: {}\n");
  const currentConfig=await Deno.readTextFile(join(temporary,"_quarto.yml"));
  await write("_quarto.yml",currentConfig.replace("  id: visibility-test", "  adapters: [public-test]\n  id: visibility-test"));
  await write("index.qmd", "# Публичный адаптер {#sec-public}\n\n:::: {#exr-open target=\"public-test\" course-role=\"independent-study\" difficulty=\"introductory\"}\n## Открытая контрольная\nПубличное условие\n::::\n");
  await render("student");
  assert((await model()).exercises[0].target === "public-test","Удалено публичное задание адаптера");
  console.log("Видимость: HTML и модели full/student, произвольные профили, штатная запись, примечания, неверные условия, устаревшие модели и публичные target — успешно.");
} finally { await Deno.remove(temporary,{recursive:true}); }
