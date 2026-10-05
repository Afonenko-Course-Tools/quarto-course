import { dirname, fromFileUrl, join } from "stdlib/path";
import { copy } from "stdlib/fs";

// Проверка рендера: штатные ID, переносимая структура PDF и независимость
// фильтра представления от ядра, темы и навигации.
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const temporary = await Deno.makeTempDir({ prefix: "course-presentation-" });
const integratedRoot = await Deno.makeTempDir({ prefix: "course-presentation-core-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function render(format: string, output: string, metadata: string[] = [], input = "fixture.qmd") {
  const result = await new Deno.Command(quarto, {cwd: temporary,
    args: ["render", input, "--to", format, "--output", output, "--fail-if-warnings", ...metadata], stdout: "piped", stderr: "piped"}).output();
  assert(result.success, new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr));
  return await Deno.readTextFile(join(temporary, output));
}
try {
  await Deno.mkdir(join(temporary, "_extensions"));
  await copy(join(repo, "_extensions/course-presentation"), join(temporary, "_extensions/course-presentation"));
  await copy(join(repo, "tests/presentation/fixture.qmd"), join(temporary, "fixture.qmd"));
  await copy(join(repo, "tests/presentation/course-plan.qmd"), join(temporary, "course-plan.qmd"));
  const plan = await render("html", "course-plan.html", [], "course-plan.qmd");
  assert(plan.includes('class="course-plan"') && plan.includes('tabindex="0"') && plan.includes('role="region"') && plan.includes('aria-label="План вводных занятий"'), "Область обычной таблицы потеряла авторские атрибуты доступности");
  for (const id of ["plan-overview", "plan-first", "plan-last", "ordinary-plan", "plan-destination"]) {
    assert(plan.match(new RegExp(`\\sid="${id}"`, "g"))?.length === 1, `Повторный или потерянный идентификатор плана ${id}`);
  }
  assert((plan.match(/href="#plan-destination"/g) || []).length === 2, "Обычные ссылки таблицы не сохранены");
  for (const marker of ["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON", "ZETA", "OMEGA", "Обычное содержимое"]) {
    assert(plan.includes(marker), `В HTML таблицы отсутствует ${marker}`);
  }
  const html = await render("html", "study.html");
  assert(html.includes('class="course-answer course-answer-solution callout'), "HTML-ответ не оформлен штатным callout");
  assert(html.includes('data-course-for="exr-predict"') && !html.includes(' for="exr-predict"'), "Учебная связь записана как стандартный HTML-атрибут for");
  assert(html.includes("Средний") && html.includes("15 мин") && html.includes("В паре"), "Значения документа не показаны");
  assert(!html.includes("Индивидуально") && html.includes("INDIVIDUAL_WORK_MARKER"), "Повторяющийся бейдж индивидуальной работы остался у задания");
  assert(html.includes("В группе"), "Подпись групповой работы потеряна");
  assert(html.includes("Рекомендуется"), "Нет подписи обязательности материала");
  assert(!html.includes('data-course-course-role'), "Неверное имя атрибута роли");
  for (const id of ["exr-predict", "sol-predict"]) {
    assert(html.match(new RegExp(`id="${id}"`, "g"))?.length === 1, `Повторный или потерянный идентификатор ${id}`);
  }
  const slides = await render("revealjs", "lecture.html");
  assert(slides.includes('class="course-answer course-answer-solution fragment"'), "Ответ в режиме lecture не оформлен штатным фрагментом");
  assert((slides.match(/course-answer-hint/g) || []).length === 1, "Явная роль reading ошибочно преобразована в подсказку");
  assert(slides.includes('class="course-answer course-answer-hint fragment"'), "Вложенная подсказка не оформлена штатным фрагментом");
  await Deno.writeTextFile(join(temporary, "study.yml"), "course-presentation:\n  mode: study\n");
  const studySlides = await render("revealjs", "study-slides.html", ["--metadata-file", "study.yml"]);
  assert(studySlides.includes("<details><summary>Показать решение</summary>"), "В Reveal отсутствует раскрытие ответа режима study");
  assert(!studySlides.includes('course-answer-solution fragment'), "Ответ в режиме study ошибочно зависит от перехода вперёд");
  await Deno.writeTextFile(join(temporary, "expanded.yml"), "course-presentation:\n  answers: expanded\n");
  const expanded = await render("revealjs", "expanded.html", ["--metadata-file", "expanded.yml"]);
  assert(!expanded.includes('course-answer-solution fragment') && !expanded.includes("<details>"), "Ответы с expanded остались скрыты");
  const latex = await render("latex", "handout.tex");
  assert(latex.includes("SOLUTION\\_MARKER") && latex.includes("Текст вложенной подсказки"), "При формировании PDF потеряно решение или подсказка");
  assert(!latex.includes("<details>") && !latex.includes("presentation.js"), "HTML-механизм раскрытия попал в небраузерный PDF");
  for (const [name, config] of Object.entries({type: "true", false: "false", unknown: "\n  answres: expanded", mode: "\n  mode: unsupported"})) {
    await Deno.writeTextFile(join(temporary, "invalid.yml"), `course-presentation: ${config}\n`);
    const invalid = await new Deno.Command(quarto, {cwd: temporary, args: ["render", "fixture.qmd", "--to", "html", "--metadata-file", "invalid.yml"], stdout: "piped", stderr: "piped"}).output();
    assert(!invalid.success, `Принята неверная настройка представления ${name}`);
  }
  // Ядро извлекает факты до использования атрибутов фильтром представления.
  await copy(join(repo, "_extensions/course-core"), join(temporary, "_extensions/course-core"));
  await Deno.writeTextFile(join(temporary, "_quarto.yml"), 'project:\n  type: default\ncourse:\n  id: presentation-test\n  view: student\n  validate: false\n');
  const original = await Deno.readTextFile(join(temporary, "fixture.qmd"));
  await Deno.writeTextFile(join(temporary, "fixture.qmd"), original.replace("filters: [course-presentation]", "filters: [course-presentation, course-core]"));
  const wrongOrder = await new Deno.Command(quarto, {cwd: temporary, args: ["render", "fixture.qmd", "--to", "html"], stdout: "piped", stderr: "piped"}).output();
  assert(!wrongOrder.success && new TextDecoder().decode(wrongOrder.stderr).includes("Фильтр course-core должен предшествовать course-presentation"), "Неверный порядок фильтров не отклонён");
  // Native Core integration has its own project and selected-document result.
  await copy(join(repo, "_extensions"), join(integratedRoot, "_extensions"));
  await Deno.writeTextFile(join(integratedRoot, "_quarto.yml"), 'project:\n  type: default\n  output-dir: _site\n  render: [fixture.qmd]\ncourse:\n  id: presentation-test\nfilters: [course-core, course-presentation]\nformat: html\n');
  await Deno.writeTextFile(join(integratedRoot, "_quarto-student.yml"), "course:\n  view: student\n");
  await Deno.writeTextFile(join(integratedRoot, "_quarto-full.yml"), "course:\n  view: full\n");
  await Deno.writeTextFile(join(integratedRoot, "fixture.qmd"), original
    .replace("filters: [course-presentation]\n", "")
    .replace('#exr-predict course-role="prediction"', '#exr-predict course-role="demonstration" difficulty="intermediate" time="15"')
    + '\n::: {#prediction-display course-role="prediction"}\nОбычная деятельность с наследованием.\n:::\n');
  const integrated = await new Deno.Command(quarto, {cwd: integratedRoot,
    args: ["render", "fixture.qmd", "--to", "html", "--profile", "student", "--fail-if-warnings"], stdout: "piped", stderr: "piped"}).output();
  assert(integrated.success, new TextDecoder().decode(integrated.stdout) + new TextDecoder().decode(integrated.stderr));
  const fragments = [];
  for await (const entry of Deno.readDir(join(integratedRoot, "_generated/course-spec/documents/student"))) {
    if (entry.name.endsWith(".json")) fragments.push(JSON.parse(await Deno.readTextFile(join(integratedRoot, "_generated/course-spec/documents/student", entry.name))));
  }
  assert(fragments.length === 1, "Отсутствует фрагмент учебной модели Core");
  const prediction = fragments[0].pedagogy.elements.find((element: {kind: string}) => element.kind === "prediction");
  assert(prediction?.metadata?.difficulty === "intermediate" && prediction.metadata.time === 15, "Фильтр представления использовал роль или значения до извлечения ядром");
  assert(fragments[0].exercises[0].purpose === "demonstration" && fragments[0].exercises[0].sourceTopic.id === "sec-predict", "Канонические факты потеряны до представления");
  assert(!JSON.stringify(fragments[0]).includes("course-metadata"), "Элементы оформления попали в учебную модель");
  assert(fragments[0].pedagogy.elements.find((element: {id?: string}) => element.id === "individual-display")?.metadata?.workMode === "individual", "Скрытие бейджа изменило предметные сведения о форме работы");
  console.log("Представление: обычная таблица плана, раскрытие в HTML, режимы Reveal, метаданные, штатные ID и ссылки, содержимое PDF — успешно.");
} finally {
  await Deno.remove(temporary, {recursive: true});
  await Deno.remove(integratedRoot, {recursive: true});
}
