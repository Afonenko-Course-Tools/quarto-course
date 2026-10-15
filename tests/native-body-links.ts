import {buildBodies} from "../_extensions/course-core/body-export/producer.ts";
import {publicLinks} from "../_extensions/course-core/body-export/links.ts";
const assert = (v: unknown, m: string) => {if (!v) throw Error(m);};
const link = (href: string, text: string) => ({t: "Link", c: [["", [], []], [{t: "Str", c: text}], [href, ""]]});
const reference = (key: string, text: string) => ({t: "Span", c: [["", ["qrc-reference"], [["data-qrc-ref", key], ["data-qrc-style", "title"], ["data-qrc-custom", "true"]]], [{t: "Str", c: text}]]});
const json = (blocks: unknown[]) => JSON.stringify({"pandoc-api-version": [1, 23, 1], meta: {}, blocks});
const blocks = [{t: "Para", c: [reference("tasks:exr-a", "Сама задача"), reference("theory:sec-types", "Теория"), link("#context", "Другой фрагмент"), link("#inside", "Внутренний фрагмент"), link("#table-row", "Строка таблицы"), link("questions.qmd#exr-b", "Другая задача")]}, {t: "Div", c: [["inside", [], []], []]},
  {t: "Table", c: [["table", [], []], [null, []], [], [["", [], []], []], [], [["", [], []], [[["table-row", [], []], []]]]]}];
const exercise = {id: "exr-a", head: {kind: "Header", level: 2, title: "Задача A"}, difficulty: "introductory", time: 10, statementVisibility: "restricted", hasPublicSolution: false, bodyJson: json(blocks)};
const work = {id: "lab", kind: "lab", title: "Лабораторная", slots: [{id: "exr-a", selection: "fixed", candidates: ["exr-a"], assignment: {requirement: "required", workMode: "individual"}}], bodyJson: json([])};
const document: any = {scope: "document", source: "questions.qmd", course: {id: "demo", view: "full"}, exercises: [exercise], assessment: work,
  document: {source: "questions.qmd", output: "questions.html", format: "html", profiles: ["full"]},
  body: {publicExercises: [exercise], publicAssessment: work}};
const bodies = await buildBodies(document, {projectRoot: Deno.cwd(), bodyReferences: {
  namespace: "tasks", sourceUrl: () => "https://example.test/course/tasks/questions.html",
  resolve: (key: string) => {
    if (key !== "theory:sec-types") throw Error("Неизвестная цель " + key);
    return {href: "https://example.test/course/theory/types.html#sec-types", label: "Типы"};
  },
}} as any);
const condition = bodies.publicPackage.questions[0].condition;
const serialized = JSON.stringify(condition);
assert(!serialized.includes("data-qrc-ref") && !serialized.includes("qrc-reference"), "В публичном Body остались QRC-маркеры");
assert(serialized.includes("https://example.test/course/theory/types.html#sec-types"), "Пропала межпроектная теория");
assert(serialized.includes("https://example.test/course/tasks/questions.html#context") && serialized.includes("https://example.test/course/tasks/questions.html#exr-b"), "Удалён другой фрагмент или другая задача того же QMD");
assert(serialized.includes('"#inside"'), "Локальная цель в условии потеряна");
assert(serialized.includes('"#table-row"'), "Native Attr строки таблицы ошибочно стала внешним fragment");
assert(!serialized.includes("#exr-a"), "Self-target остался ссылкой");
let rejected = false;
try {await buildBodies(document, {projectRoot: Deno.cwd()});} catch (e) {rejected = String(e).includes("BODY.QRC_REFERENCE_UNRESOLVED");}
assert(rejected, "Обязательная неразрешённая цель принята без контекста");
console.log("PASS self-target, соседние фрагменты, публичный resolver и selected diagnostics");
const canonical = "https://example.test/course/tasks/custom.html";
const context: any = {namespace: "tasks", sourceUrl: (source: string) => source === "questions.qmd" ? canonical : "https://example.test/course/tasks/second-custom.html",
  resolve: () => {throw Error("Неожиданный QRC запрос");}};
const mapped = await publicLinks([{t: "Para", c: [
  link(canonical + "#exr-a", "Абсолютная self"), link("//example.test/course/tasks/custom.html#exr-a", "Protocol-relative self"),
  link("custom.html#exr-a", "Output self"), link("questions.qmd#context", "Соседний раздел"),
  link("other.qmd#chapter", "Другая страница"), link("https://other.test/custom.html#exr-a", "Другой host"),
  link("asset.svg", "Публичный файл"),
]}], {source: "questions.qmd", id: "exr-a"}, context);
const urls: string[] = [];
const walk = (v: any) => {if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") {if (v.t === "Link") urls.push(v.c[2][0]); Object.values(v).forEach(walk);}};
walk(mapped);
assert(JSON.stringify(urls) === JSON.stringify([canonical + "#context", "https://example.test/course/tasks/second-custom.html#chapter", "https://other.test/custom.html#exr-a", "asset.svg"]),
  "Self или обычная QMD-ссылка проигнорировала каноническую public output карту");
console.log("PASS absolute/protocol-relative/custom self, native outputs и другой host");
