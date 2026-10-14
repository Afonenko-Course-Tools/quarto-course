import {copy} from "stdlib/fs";
import {join} from "stdlib/path";
import {collectExport} from "../_extensions/course-core/body-export/collect.ts";
import {buildBodies} from "../_extensions/course-core/body-export/producer.ts";

const assert = (value: unknown, message: string) => {if (!value) throw Error(message);};
const root = await Deno.makeTempDir({prefix: "native-body-titles-"});
try {
  for (const name of ["course-core", "course-presentation"]) {
    await copy(new URL("../_extensions/" + name, import.meta.url).pathname, join(root, "_extensions", name));
  }
  const config = "project: {type: book}\nbook: {title: Банк, chapters: [index.qmd]}\ncourse: {id: title-test}\nfilters: [course-core, course-presentation]\nformat: html\nlang: ru\n";
  const source = `---
title: Работа
exercise-bank: true
exercise-statement-visibility: open
assessment: {id: lab, kind: lab}
---
# Работа

::: {#exr-one difficulty=introductory time=10}
## Проверка [диапазона]{#title-detail}

AUTHORED_CONDITION. [Подробности](#details). [Название](#title-detail).

### Подробности {#details}

Упражнение 13 — обычный авторский текст.
:::

::: {.task-items}
- @exr-one
:::
`;
  await Deno.writeTextFile(join(root, "_quarto.yml"), config);
  await Deno.writeTextFile(join(root, "index.qmd"), source);
  const quarto = Deno.env.get("QUARTO") || "quarto";
  const render = await new Deno.Command(quarto, {args: ["render", "--profile", "full"], cwd: root, stdout: "piped", stderr: "piped"}).output();
  assert(render.success, new TextDecoder().decode(render.stderr));
  const html = await Deno.readTextFile(join(root, "_book/index.html"));
  assert(html.includes('class="theorem-title"') && html.includes('id="title-detail"'), "Обычный HTML книги потерял native-заголовок или его якорь");
  const collected = await collectExport(root, {book: ".", work: "lab"});
  const body = await buildBodies(collected.result, {projectRoot: root, work: "lab", courseId: collected.courseId});
  const question = body.publicPackage.questions[0], condition = JSON.stringify(question.condition);
  assert(question.title === "Проверка диапазона", "Авторское название не перенесено в metadata");
  assert(!condition.includes("theorem-title") && !condition.includes("Проверка диапазона"), "Native Body сохранил книжный номер или повторный заголовок");
  assert(condition.includes("AUTHORED_CONDITION") && condition.includes("#details") && condition.includes('"details"'), "Потерян текст или внутренняя fragment-цель");
  assert(condition.includes("#title-detail") && condition.includes('"title-detail"'), "Потеряна авторская fragment-цель внутри native-заголовка");
  assert(condition.includes("Упражнение") && condition.includes('"13"'), "Удалён обычный авторский текст о номере упражнения");
  assert(question.difficulty === "introductory" && question.time === 10 && !condition.includes("course-metadata"), "Потеряны metadata или остался их presentation-дубликат");
  assert(await Deno.readTextFile(join(root, "_quarto.yml")) === config && await Deno.readTextFile(join(root, "index.qmd")) === source, "Изменён авторский источник");
  assert(await Deno.readTextFile(join(root, "_book/index.html")) === html, "Body export изменил обычный HTML книги");
  console.log("PASS native book → Body: название отдельно, без книжного префикса, текст/якоря/metadata сохранены, HTML неизменён");
} finally {await Deno.remove(root, {recursive: true});}
