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
async function render(profile: string, expected?: string) {
  await run(quarto, ["render", "--profile", profile, "--fail-if-warnings"], expected);
}
const modelPath = join(root, "_generated/course-spec/course.json");
async function model(): Promise<Course> { return JSON.parse(await Deno.readTextFile(modelPath)); }
const native = `:::: {#exr-native course-role="prediction" difficulty="introductory"}
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
const graded = `:::: {#exr-essay target="manual"}
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
  pre-render: _extensions/course-core/entrypoints/pre.ts
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
  await write("index.qmd", `---\ntitle: Учебные элементы\ndifficulty: intermediate\ntime: 25\nwork-mode: pair\n---\n\n${native}\n${graded}\n${rest}
::: {.when-full}
::: {course-role="discussion"}
PRIVATE_DISCUSSION
:::
:::
`);
  await render("student");
  let result = await model();
  assert(result.exercises.length === 1 && result.exercises[0].id === "exr-essay", "Вопросы без target изменили состав оцениваемых заданий");
  const elements = result.pedagogy!.elements;
  const byId = (id: string) => elements.find(element => element.id === id)!;
  assert(byId("exr-native").kind === "prediction", "Роль деятельности не извлечена");
  assert(byId("exr-native").metadata?.difficulty === "introductory", "Локальная сложность не заменила значение документа");
  assert(byId("exr-native").metadata?.time === 25 && byId("exr-native").metadata?.workMode === "pair", "Значения документа потеряны");
  assert(byId("exr-essay").metadata?.difficulty === "intermediate", "Оцениваемое задание не унаследовало сложность");
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
  assert(JSON.stringify(result.exercises[0].gradingNotes).includes("PRIVATE_GRADING_GUIDANCE"), "В полном представлении потеряны примечания преподавателя");
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
  const invalid = [
    ['::: {course-role="unknown"}\nНеизвестная роль\n:::', "Неизвестная учебная роль course-role"],
    ['::: {#exr-bad difficulty="hard"}\nНеверный блок\n:::', "Недопустимое значение учебного атрибута difficulty"],
    ['::: {course-role="discussion" time="0"}\nНеверный блок\n:::', "положительное целое"],
    ['::: {course-role="prerequisites" difficulty="advanced"}\nНеверный блок\n:::', "difficulty допустим"],
    ['::: {#sol-orphan for="exr-missing"}\nНеверный блок\n:::', "видимое упражнение"],
    [native + native, "Повторный идентификатор упражнения"],
    ['---\ndifficulty: impossible\n---\nБез упражнения', "Недопустимое значение учебного атрибута difficulty"],
    ['---\ncourse-pedagogy:\n  document-default: true\n---\nБез упражнения', "Неизвестный параметр course-pedagogy"],
    ['::: {.when-full}\n::: {#exr-private}\nЗакрытый текст\n:::\n:::\n::: {#sol-public for="exr-private"}\nОтвет\n:::', "видимое упражнение"],
  ];
  for (const [qmd, expected] of invalid) {
    await write("index.qmd", qmd);
    await render("student", expected);
    try { await Deno.stat(modelPath); throw new Error("После ошибки рендера остался устаревший course.json"); }
    catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
  }
  console.log("Учебный контракт: состав заданий, все роли, значения документа, связи, AST ссылок, профили и отклонение неверной разметки — успешно.");
} finally { await Deno.remove(root, { recursive: true }); }
