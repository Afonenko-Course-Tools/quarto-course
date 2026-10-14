import {copy} from "stdlib/fs";
import {collectExport} from "../_extensions/course-core/body-export/collect.ts";
import {buildBodies} from "../_extensions/course-core/body-export/producer.ts";

const assert = (value: unknown, message: string) => {if (!value) throw Error(message);};
const root = await Deno.makeTempDir({prefix: "body-no-publication-"});
try {
  await Deno.mkdir(root + "/bank");
  await copy(new URL("../_extensions/course-core", import.meta.url).pathname, root + "/bank/_extensions/course-core");
  await Deno.writeTextFile(root + "/_quarto.yml", "project: {type: default}\ncourse: {id: demo}\n");
  await Deno.writeTextFile(root + "/bank/_quarto.yml", "project: {type: book}\nbook: {title: Банк, chapters: [index.qmd, external.qmd, relative.qmd]}\nformat: html\nfilters: [course-core]\nreference-catalog: {namespace: tasks}\n");
  const doc = (id: string, body: string) => `---\ntitle: Работа\nexercise-bank: true\nexercise-statement-visibility: restricted\nassessment: {id: lab-${id}, kind: lab}\n---\n# Работа\n\n::: {#exr-${id} course-role=control difficulty=introductory time=10}\n## Задача\n${body}\n:::\n\n::: {.task-items}\n- @exr-${id}\n:::\n`;
  await Deno.writeTextFile(root + "/bank/index.qmd", doc("internal", "[Детали](#inside) [Сама задача](#exr-internal)\n\n### Детали {#inside}\nТекст."));
  await Deno.writeTextFile(root + "/bank/external.qmd", doc("external", "[Справочник](https://example.org/reference)"));
  await Deno.writeTextFile(root + "/bank/relative.qmd", doc("relative", "[Другой документ](external.qmd)"));
  const collected = await collectExport(root, {book: "bank", work: "*"});
  const input = {projectRoot: collected.projectRoot, courseId: collected.courseId, bodyReferences: collected.bodyReferences};
  const internal = await buildBodies(collected.result, {...input, work: "lab-internal"});
  const external = await buildBodies(collected.result, {...input, work: "lab-external"});
  const encoded = JSON.stringify(internal.publicPackage);
  assert(encoded.includes('"#inside"'), "Локальный anchor должен обходиться без публикации");
  assert(!encoded.includes('"#exr-internal"'), "Очевидная self-ссылка должна стать текстом");
  assert(JSON.stringify(external.publicPackage).includes("https://example.org/reference"), "Готовый внешний URL должен сохраняться без публикации");
  try {
    await buildBodies(collected.result, {...input, work: "lab-relative"});
    throw Error("Относительный source target без публикации принят");
  } catch (error) {assert(String(error).includes("BODY.PUBLICATION_REQUIRED"), String(error));}
  try {
    await collected.bodyReferences!.resolve("tasks:exr-external", "default", "index.qmd");
    throw Error("QRC target без публикации принят");
  } catch (error) {assert(String(error).includes("BODY.QRC_REFERENCE_UNRESOLVED"), String(error));}
  console.log("PASS native Body без публикации: local/self/HTTP, предметный отказ относительной адресации и QRC");
} finally {await Deno.remove(root, {recursive: true});}
