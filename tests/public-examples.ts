import { CoreContractError, normalizeDocument } from "../_extensions/course-core/public.ts";
import type { DocumentContext } from "../_extensions/course-core/public.ts";
const context: DocumentContext = {
  operation: crypto.randomUUID(), input: "public-examples.qmd", format: "html",
  projection: "student", exerciseBank: true,
  defaults: { difficulty: "introductory", "statement-visibility": "open" },
};
const attr = (id = "", classes: string[] = []) => [id, classes, []];
const str = (c: string) => ({ t: "Str", c });
const para = (c: string) => ({ t: "Para", c: [str(c)] });
const header = (id: string, text: string, level = 2) => ({ t: "Header", c: [level, attr(id), [str(text)]] });
const div = (body: unknown[], classes: string[] = [], id = "") => ({ t: "Div", c: [attr(id, classes), body] });
const doc = (blocks: unknown[]) => ({ "pandoc-api-version": [1, 23, 1], meta: {}, blocks });
function check(v: unknown, message: string): asserts v { if (!v) throw Error(message); }
function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === "object" && !Array.isArray(v); }
function publicBodies(v: unknown): unknown[][] {
  if (Array.isArray(v)) return v.flatMap(publicBodies);
  if (!record(v)) return [];
  const c = v.c;
  if (v.t === "Div" && Array.isArray(c) && Array.isArray(c[0]) && Array.isArray(c[0][1]) && c[0][1].includes("public-tests") && Array.isArray(c[1])) return [c[1]];
  return Object.values(v).flatMap(publicBodies);
}
const authoredPara = { t: "Para", c: [{ t: "Strong", c: [str("Примеры")] }] };
const cases = [
  div([para("Содержимое")], ["public-tests"], "examples-a"),
  div([header("keep-heading", "Старое название", 1), para("Открыто сразу")], ["public-tests"]),
  div([para("До заголовка"), header("later-heading", "Позднее название", 4), para("После")], ["public-tests"]),
  div([authoredPara, para("Сохранённый авторский абзац")], ["public-tests"]),
];
for (const projection of ["student", "author"] as const) {
  const result = normalizeDocument(doc([div([{ t: "BulletList", c: [[div(cases)]] }])]), { ...context, projection });
  const bodies = publicBodies(result.ast.blocks);
  check(bodies.length === cases.length, "Потеряны вложенные public-tests");
  bodies.forEach((body, i) => {
    const first = body[0];
    check(record(first) && first.t === "Header" && Array.isArray(first.c), "Первый блок public-tests — native Header");
    check(first.c[0] === 3 && JSON.stringify(first.c[2]) === JSON.stringify([str("Открытые примеры")]), "Требуется единый Header3");
    check(body.filter((b) => record(b) && b.t === "Header").length === 1, "Заголовок продублирован");
    if (i === 1 || i === 2) check(Array.isArray(first.c[1]) && first.c[1][0] === (i === 1 ? "keep-heading" : "later-heading"), "Потерян ID заголовка");
    if (i === 3) check(JSON.stringify(body).includes(JSON.stringify(authoredPara)), "Эвристика поглотила Para/Strong");
  });
  check(!JSON.stringify(result.ast).match(/details|callout|collapse/), "Добавлено скрывающее оформление");
}
for (const malformed of [
  { t: "Header", c: [3, attr(), [{ t: "Span", c: [attr("", ["correct"]), [str("Недопустимая отметка")]] }]] },
  { t: "Header", c: [3, attr(), [div([], ["answer"])]] },
]) {
  let caught: unknown;
  try { normalizeDocument(doc([div([malformed], ["public-tests"])]), context); } catch (error) { caught = error; }
  check(caught instanceof CoreContractError && caught.code === "ANSWER_INVALID", "Header нормализован раньше raw answer validation");
}
console.log("PASS public-tests: nested native Header3, preserved ID/body, raw validation");
