import type { DocumentResult, Adapter } from "../_extensions/course-core/domain/model.ts";

const module = await import("../_extensions/course-core/domain/release.ts");
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
assert(typeof module.assembleRelease === "function", "explicit current-document release assembler is missing");
const assembleRelease = module.assembleRelease;
const body = JSON.stringify({ "pandoc-api-version": [1, 23, 1], meta: {}, blocks: [] });
function document(source: string, id: string): DocumentResult {
  return {
    scope: "document", source, course: { id: "native-release", view: "student" },
    document: { source, format: "html", output: source.replace(/\.qmd$/, ".html"), profiles: ["student"] },
    exercises: [{ id, target: "manual", project: "", purpose: "demonstration", difficulty: "introductory",
      sourceTopic: { id: "sec-shared", owner: "native-release", rootQmd: source }, head: { kind: "Para", level: 0, title: "Condition" },
      nested: 0, unknownAttributes: [], bodyJson: body }],
  };
}
const first = document("first.qmd", "exr-first");
const second = document("second.qmd", "exr-second");
const expectation = {view: "student" as const, profiles: ["student"]};
const expected = ["first.qmd", "second.qmd"];
const release = assembleRelease(expected, [second, first], [], expectation);
assert(release.scope === "release" && release.model.exercises.length === 2 && release.documents[0].source === "first.qmd", "complete explicit release or order missing");
assert(release.model.exercises.every(item => item.sourceTopic.id === "sec-shared"), "incidental Header ID wrongly required global uniqueness");
console.log("PASS current explicit release and page-scoped topics");
function rejected(name: string, sources: string[], documents: DocumentResult[], code: string, adapters: Adapter[] = []) {
  let error;
  try { assembleRelease(sources, documents, adapters, expectation); } catch (value) { error = value; }
  assert(error && String(error).includes(code), `${name}: expected ${code}, got ${String(error)}`);
  console.log(`PASS release refusal: ${name}`);
}
rejected("missing current document", expected, [first], "RELEASE.MISSING_DOCUMENT");
rejected("extra current document", ["first.qmd"], [first, second], "RELEASE.UNEXPECTED_DOCUMENT");
rejected("duplicate result", expected, [first, second, first], "RELEASE.DUPLICATE_DOCUMENT");
rejected("duplicate expected source", ["first.qmd", "first.qmd"], [first], "RELEASE.EXPECTED_SOURCES_INVALID");
rejected("empty coverage", [], [], "RELEASE.EXPECTED_SOURCES_INVALID");
rejected("mismatched source envelope", expected, [first, { ...second, document: { ...second.document, source: "elsewhere.qmd" } }], "RELEASE.DOCUMENT_INVALID");
rejected("mixed views", expected, [first, { ...second, course: { ...second.course, view: "full" } }], "RELEASE.MIXED_VIEW");
rejected("mixed formats", expected, [first, { ...second, document: { ...second.document, format: "gfm" } }], "RELEASE.MIXED_FORMAT");
rejected("mixed active profiles", expected, [first, { ...second, document: { ...second.document, profiles: ["student", "review"] } }], "RELEASE.MIXED_PROFILES");
rejected("invalid active profile value", expected, [first, { ...second, document: { ...second.document, profiles: [17] as unknown as string[] } }], "RELEASE.DOCUMENT_INVALID");
rejected("mixed course domains", expected, [first, { ...second, course: { ...second.course, id: "another-course" } }], "RELEASE.MIXED_COURSE");
rejected("duplicate Exercise IDs", expected, [first, { ...second, exercises: first.exercises.map(item => ({ ...item, sourceTopic: { ...item.sourceTopic, rootQmd: "second.qmd" } })) }], "CORE.DUPLICATE_EXERCISE");
const work = { id: "sec-assessment", kind: "test" as const, title: "Work", items: ["exr-second"], memberContainers: 1, memberKinds: ["OrderedList"], memberSizes: [1], bodyJson: body };
rejected("duplicate Assessment IDs", expected, [{ ...first, assessment: work }, { ...second, assessment: work }], "CORE.DUPLICATE_ASSESSMENT");
rejected("unknown target", expected, [first, { ...second, exercises: [{ ...second.exercises[0], target: "missing" }] }], "CORE.UNKNOWN_TARGET");
rejected("unknown cross-document member", expected, [{ ...first, assessment: { ...work, items: ["exr-missing"] } }, second], "CORE.UNKNOWN_MEMBER");
const linked = assembleRelease(expected, [{ ...first, assessment: work }, second], [], expectation);
assert(linked.model.assessments[0].items[0] === "exr-second", "known cross-document member rejected");
const adapter: Adapter = { directory: "unused", contract: { name: "test-adapter", rules: "unused.cue" }, fragments: new Map() };
const adapted = assembleRelease(expected, [first, { ...second, exercises: [{ ...second.exercises[0], target: "test-adapter" }] }], [adapter], expectation);
assert(adapted.model.registeredTargets.includes("test-adapter"), "explicit adapter target missing");
console.log("PASS explicit cross-document membership and selected targets");
