import { renderOwner } from "./owner-render.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { copy } from "stdlib/fs";
import type { Course } from "../_extensions/course-core/domain/model.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "course-pedagogy-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
const cue = Deno.env.get("CUE") || "cue";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function write(path: string, text: string) { await Deno.writeTextFile(join(root, path), text); }
async function run(command: string, args: string[], expected?: string) {
  const result = await new Deno.Command(command, { args, cwd: root, stdout: "piped", stderr: "piped" }).output();
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  assert(expected ? !result.success && output.includes(expected) : result.success, output);
}
async function render(profile: "student" | "full", expected?: string, canonical = true) {
  if (!canonical) {
    await run(quarto, ["render", "--profile", profile, "--fail-if-warnings"], expected);
    return;
  }
  const result = await renderOwner(root, profile);
  assert(expected ? !result.success && result.text.includes(expected) : result.success, `${expected || "success"}\n${result.text}`);
}
const modelPath = join(root, "_generated/course-spec/course.json");
async function model(): Promise<Course> { return JSON.parse(await Deno.readTextFile(modelPath)); }
const native = `:::: {#exr-native course-role="demonstration" difficulty="introductory"}
## Прогноз до выполнения

Что выведет программа?

::: {course-role="prerequisites"}
- [Коллекции Java](https://docs.oracle.com/en/java/)
:::

::: {#sol-native}
Ответ представляет собой письменное объяснение.
:::

::: {.callout-tip}
Подсказка неявно связана с окружающим упражнением.
:::

::: {.callout-tip course-role="reading"}
Визуальный callout сохраняет явно указанную учебную роль.
:::
::::

::: {.callout-tip for="exr-native"}
Проверьте порядок обхода.
:::
`;
const graded = `:::: {#exr-essay target="manual" course-role="independent-study" difficulty="advanced"}
## Реферат

Объясните компромисс при проектировании языка.

::: {.grading-notes}
PRIVATE_GRADING_GUIDANCE
::: {course-role="takeaway"}
PRIVATE_NESTED_PEDAGOGY
:::
:::
::::
`;
try {
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  await write("_quarto.yml", `project:
  pre-render: [_extensions/course-core/entrypoints/pre.ts, _extensions/course-core/entrypoints/owner-freeze.ts]
  post-render: _extensions/course-core/entrypoints/post.ts
  type: website
  output-dir: _site
  render: [index.qmd]
course:
  id: pedagogy-test
  validate: true
course-pedagogy:
  document-defaults: true
filters: [course-core]
format: html
`);
  await write("_quarto-student.yml", "course:\n  view: student\n");
  await write("_quarto-full.yml", "course:\n  view: full\n");
  const roles = ["demonstration", "discussion", "self-check", "objectives", "reading", "takeaway", "limitation", "misconception", "criteria", "deliverables"];
  const rest = roles.map(role => `::: {course-role="${role}"${role === "reading" ? ' requirement="required"' : ""} for="exr-essay"}\n${role}\n:::\n`).join("\n");
  await write("index.qmd", `---\ntitle: Учебные элементы\ndifficulty: intermediate\ntime: 25\nwork-mode: pair\n---\n\n## Тема {#sec-topic}\n\n${native}\n${graded}\n::: {#predict-display course-role="prediction"}\nПрогноз как обычный учебный блок.\n:::\n\n${rest}
::: {.when-full}
::: {course-role="discussion"}
PRIVATE_DISCUSSION
:::
:::
`);
  await render("student");
  let result = await model();
  assert(result.exercises.length === 2 && result.exercises[0].id === "exr-native" && result.exercises[0].target === "manual" && !result.exercises[0].authoredTarget, "Задача без target не извлечена как канонический Exercise");
  const elements = result.pedagogy!.elements;
  const byId = (id: string) => elements.find(element => element.id === id)!;
  assert(byId("exr-native").kind === "demonstration" && byId("predict-display").kind === "prediction", "Назначение задачи или обычная роль prediction не извлечены");
  assert(byId("exr-native").metadata?.difficulty === "introductory", "Локальная сложность не заменила значение документа");
  assert(byId("exr-native").metadata?.time === undefined && byId("exr-native").metadata?.workMode === "pair", "Каноническое время унаследовано или форма работы потеряна");
  assert(byId("exr-essay").metadata?.difficulty === "advanced", "Локальная сложность задачи потеряна");
  assert(byId("predict-display").metadata?.difficulty === "intermediate" && byId("predict-display").metadata?.time === 25, "Обычная деятельность не унаследовала значения документа");
  assert(byId("sol-native").exercise === "exr-native", "Связь с окружающим упражнением потеряна");
  assert(elements.find(element => element.kind === "hint")?.exercise === "exr-native", "Явная связь подсказки потеряна");
  assert(elements.filter(element => element.kind === "hint").length === 2, "Подсказка не получила связь с окружающим упражнением");
  const prerequisite = elements.find(element => element.kind === "prerequisites")!;
  assert(prerequisite.exercise === "exr-native" && !prerequisite.metadata, "Вспомогательный блок унаследовал метаданные деятельности");
  assert(JSON.stringify(prerequisite.body).includes("https://docs.oracle.com/en/java/"), "AST штатной ссылки изменён");
  assert(elements.some(element => element.kind === "reading" && element.metadata?.requirement === "required"), "Обязательность материала не извлечена");
  assert(elements.every((element, index) => element.order === index + 1 && element.source === "index.qmd"), "Нарушены порядок элементов или принадлежность документу");
  assert(!JSON.stringify(result).includes("PRIVATE_"), "Студенческая модель содержит скрытое содержимое");
  await render("full");
  result = await model();
  assert(JSON.stringify(result.exercises.find(exercise => exercise.id === "exr-essay")!.gradingNotes).includes("PRIVATE_GRADING_GUIDANCE"), "В полном представлении потеряны примечания преподавателя");
  assert(!JSON.stringify(result.pedagogy).includes("PRIVATE_GRADING_GUIDANCE") && !JSON.stringify(result.pedagogy).includes("PRIVATE_NESTED_PEDAGOGY"), "Закрытые примечания продублированы в публичных учебных элементах");
  assert(JSON.stringify(result.pedagogy).includes("PRIVATE_DISCUSSION"), "Полный профиль не сохранил обсуждение");

  const vet = ["vet", join(repo, "_extensions/course-core/spec/core.cue"), "-d", "#Course", "-c"];
  for (const [rule, mutate] of [
    ["difficulty", (value: Course) => { value.pedagogy!.elements[0].metadata!.difficulty = "hard" as never; }],
    ["CORE006", (value: Course) => { value.pedagogy!.elements.push(structuredClone(value.pedagogy!.elements[0])); }],
    ["CORE007", (value: Course) => { value.pedagogy!.elements[1].exercise = "exr-missing"; }],
    ["CORE007", (value: Course) => { value.pedagogy!.elements[0].kind = "reading"; delete value.pedagogy!.elements[0].metadata; }],
  ] as [string, (value: Course) => void][]) {
    const invalid = structuredClone(result); mutate(invalid);
    await write("invalid.json", JSON.stringify(invalid));
    await run(cue, [...vet, join(root, "invalid.json")], rule);
  }
  const invalid: [string, string, boolean?][] = [
    ['::: {course-role="unknown"}\nНеизвестная роль\n:::', "Неизвестная учебная роль course-role", false],
    ['## Тема {#sec-topic}\n\n::: {#exr-bad course-role="demonstration" difficulty="hard"}\nНеверный блок\n:::', "CORE.EXERCISE_DIFFICULTY_REQUIRED"],
    ['::: {course-role="discussion" time="0"}\nНеверный блок\n:::', "положительное целое", false],
    ['::: {course-role="prerequisites" difficulty="advanced"}\nНеверный блок\n:::', "difficulty допустим", false],
    ['::: {#sol-orphan for="exr-missing"}\nНеверный блок\n:::', "CORE.SOLUTION_PAIRING_INVALID", false],
    ["## Тема {#sec-topic}\n\n" + native + native, "CORE.DUPLICATE_DECLARATION"],
    ['---\ndifficulty: impossible\n---\nБез упражнения', "Недопустимое значение учебного атрибута difficulty", false],
    ['---\ncourse-pedagogy:\n  document-default: true\n---\nБез упражнения', "Неизвестный параметр course-pedagogy", false],
    ['## Тема {#sec-topic}\n\n::: {.when-full}\n::: {#exr-private course-role="demonstration" difficulty="introductory"}\nЗакрытый текст\n:::\n:::\nСм. @exr-private.', "CORE.PROFILE_REFERENCE_INTEGRITY"],
  ];
  for (const [qmd, expected, canonical = true] of invalid) {
    await write("index.qmd", qmd);
    await Deno.writeTextFile(modelPath, "stale model");
    await render("student", expected, canonical);
    console.log("PASS educational refusal: " + expected);
    try { await Deno.stat(modelPath); throw new Error("После ошибки рендера остался устаревший course.json"); }
    catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
  }
  console.log("Учебный контракт: состав заданий, все роли, значения документа, связи, AST ссылок, профили и отклонение неверной разметки — успешно.");
} finally { await Deno.remove(root, { recursive: true }); }
