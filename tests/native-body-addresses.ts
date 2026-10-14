import {copy} from "stdlib/fs";
import {collectExport} from "../_extensions/course-core/body-export/collect.ts";
const assert = (v: unknown, m: string) => {if (!v) throw Error(m);};
const root = await Deno.makeTempDir({prefix: "body-native-addresses-"});
try {
  await Deno.mkdir(root + "/tasks", {recursive: true});
  await copy(new URL("../_extensions/course-core", import.meta.url).pathname, root + "/tasks/_extensions/course-core");
  await Deno.writeTextFile(root + "/_quarto.yml", "project: {type: website}\nwebsite: {site-url: 'https://example.test/course/'}\ncourse: {id: demo}\n");
  await Deno.writeTextFile(root + "/index.qmd", "# Portal\n");
  await Deno.writeTextFile(root + "/tasks/_quarto.yml", "project: {type: book}\nbook: {title: Bank, chapters: [index.qmd, other.qmd, slides.qmd]}\nformat: html\nfilters: [course-core]\nreference-catalog: {namespace: tasks}\n");
  await Deno.writeTextFile(root + "/tasks/index.qmd", `---
title: Работа
format: {html: {output-file: custom.html}}
exercise-bank: true
exercise-statement-visibility: restricted
assessment: {id: lab, kind: lab}
---
# Работа

::: {#exr-a course-role=control difficulty=introductory time=10}
## Задача
Условие.
:::

::: {.task-items}
- @exr-a
:::
`);
  await Deno.writeTextFile(root + "/tasks/other.qmd", "---\ntitle: Другая страница\nformat: {html: {output-file: other-custom.html}}\n---\n# Раздел {#context}\n");
  await Deno.writeTextFile(root + "/tasks/slides.qmd", "---\ntitle: Презентация\nformat: {revealjs: {output-file: slides-custom.html}}\n---\n## Раздел {#sec-slide}\n");
  await Deno.mkdir(root + "/tasks/presentation");
  await Deno.writeTextFile(root + "/tasks/presentation/_quarto.yml", "project: {type: default}\nformat: revealjs\n");
  await Deno.writeTextFile(root + "/tasks/presentation/deck.qmd", "---\ntitle: Презентация\nformat: {revealjs: {output-file: deck-custom.html}}\n---\n## Раздел\n");
  const selected = await collectExport(root, {book: "tasks", work: "lab"});
  const addresses = selected.bodyReferences!;
  assert(await addresses.sourceUrl("index.qmd") === "https://example.test/course/tasks/custom.html", "Собственный output-file не сохранён");
  assert(await addresses.sourceUrl("other.qmd") === "https://example.test/course/tasks/other-custom.html", "Адрес невыбранного документа угадан вместо native inspect");
  assert(await addresses.sourceUrl("slides.qmd") === "https://example.test/course/tasks/slides.html", "Не учтён native HTML writer проекта book");
  assert(await addresses.sourceUrl("presentation/deck.qmd") === "https://example.test/course/tasks/presentation/deck-custom.html", "Не сохранён native Reveal output самостоятельного проекта");
  console.log("PASS native inspect source→custom HTML/Reveal outputs до selected export");
} finally {await Deno.remove(root, {recursive: true});}
