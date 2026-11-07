import { CoreContractError, normalizeDocument } from "../_extensions/course-core/public.ts";
import { catalogueCitations, catalogueCiteInlines } from "../_extensions/course-core/document/catalogue-cite.ts";
import { assertReferenceTargets, nativeAttributes } from "../_extensions/course-core/body-export/references.ts";
import type { Node, Attributes } from "../_extensions/course-core/document/native-ast.ts";
const check = (value: unknown, message: string) => { if (!value) throw Error(message); };
const attr = (id = ""): Attributes => [id, [], []];
const para = (text: string): Node => ({ t: "Para", c: [{ t: "Str", c: text }] });
const context = { operation: crypto.randomUUID(), input: "native-boundary.qmd", format: "html", projection: "student" as const, exerciseBank: true, defaults: {difficulty: "introductory" as const, "statement-visibility": "open" as const} };
const doc = (blocks: unknown[]) => ({"pandoc-api-version": [1, 23, 1], meta: {}, blocks});
function rejects(action: () => unknown, code: string, label: string) {
  let observed: unknown;
  try { action(); } catch (error) { observed = error; }
  check(observed instanceof CoreContractError && observed.code === code, label + ": нужен " + code + ", получено " + String(observed));
}
for (const value of [
  {t: "Div"},
  {t: "Div", c: [["id", [], [["missing-value"]]], []]},
  {t: "Span", c: [attr(), "not-nodes"]},
  {t: "Header", c: [3, ["bad-classes", [42], []], []]},
  {t: "Link", c: [attr(), [], [17, ""]]},
  {t: "BulletList", c: [null]},
]) rejects(() => normalizeDocument(doc([value]), context), "DOCUMENT_AST", "Повреждённый известный tag");
const citation = (id: string) => ({citationId: id, citationPrefix: [{t: "Str", c: "Префикс"}], citationSuffix: [{t: "Str", c: "Суффикс"}], citationMode: {t: "SuppressAuthor"}, citationNoteNum: 1, citationHash: 0});
for (const rows of [[null], [{...citation("tasks:exr-one"), citationPrefix: "bad"}], [{...citation("tasks:exr-one"), citationMode: {t: "UnknownMode"}}]]) {
  rejects(() => catalogueCitations({t: "Cite", c: [rows, []]}), "QRC.REFERENCE_INVALID", "Повреждённый Cite");
}
const refs = catalogueCitations({t: "Cite", c: [[citation("tasks:exr-one"), citation("tasks:exr-two")], []]});
check(refs?.length === 2 && refs[0]?.reference.style === "number", "Потеряны Cite modes/order");
if (!refs) throw Error("Нет Cite requests");
const inlines = catalogueCiteInlines(refs, (ref) => ({t: "Link", c: [attr(), [{t: "Str", c: ref.key}], ["https://example.test/", ""]]}));
check(inlines[0]?.t === "Str" && inlines[2]?.t === "Link", "Изменился порядок prefix/link/suffix");
const cell = (id: string) => [attr(id), {t: "AlignDefault"}, 1, 1, [para(id)]];
const row = (id: string, cellId: string) => [attr(id), [cell(cellId)]];
const table: Node = {t: "Table", c: [attr("table"), [null, []], [[{t: "AlignDefault"}, {t: "ColWidthDefault"}]], [attr("thead"), [row("headrow", "headcell")]], [[attr("tbody"), 0, [], [row("bodyrow", "bodycell")]]], [attr("tfoot"), []]]};
const tableIds = ["table", "thead", "tbody", "tfoot", "headrow", "headcell", "bodyrow", "bodycell"];
const observedIds = new Set(nativeAttributes(table).map(([id]) => id));
check(observedIds.size === tableIds.length && tableIds.every((id) => observedIds.has(id)), "Потеряны native Table Attr");
assertReferenceTargets([table, {t: "Para", c: tableIds.map((id) => ({t: "Link", c: [attr(), [{t: "Str", c: id}], ["#" + id, ""]]}))}], {});
const numeric = {t: "CodeBlock", c: [["", ["answer-spec"], []], "type: numeric\nkey: {value: 9, tolerance: {absolute: -1}}"]};
rejects(() => normalizeDocument(doc([{t: "Div", c: [["exr-hidden", ["content-hidden"], [["when-profile", "full"]]], [numeric]]}]), context), "ANSWER_INVALID", "Raw hidden answer до projection");
console.log("PASS native AST: malformed known tags/Cite, Table Attr/reference targets, raw hidden answer");
