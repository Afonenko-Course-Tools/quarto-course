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
    exercises: [{ id, target: "manual", project: "", purpose: "demonstration", difficulty: "introductory", time: 10, statementVisibility: "restricted", hasSolution: true, hasPublicSolution: true,
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
assert(assembleRelease(expected, [first, { ...second, document: { ...second.document, format: "revealjs" } }], [], {view: "student", profiles: ["student"]}).documents.length === 2, "mixed native web formats rejected");
rejected("mixed active profiles", expected, [first, { ...second, document: { ...second.document, profiles: ["student", "review"] } }], "RELEASE.MIXED_PROFILES");
rejected("invalid active profile value", expected, [first, { ...second, document: { ...second.document, profiles: [17] as unknown as string[] } }], "RELEASE.DOCUMENT_INVALID");
rejected("mixed course domains", expected, [first, { ...second, course: { ...second.course, id: "another-course" } }], "RELEASE.MIXED_COURSE");
rejected("duplicate Exercise IDs", expected, [first, { ...second, exercises: first.exercises.map(item => ({ ...item, sourceTopic: { ...item.sourceTopic, rootQmd: "second.qmd" } })) }], "CORE.DUPLICATE_EXERCISE");
const work = { id: "sec-assessment", kind: "test" as const, title: "Work", items: ["exr-second"], assignments: {"exr-second": {requirement:"required" as const,workMode:"individual" as const}}, memberContainers: 1, memberKinds: ["OrderedList"], memberSizes: [1], bodyJson: body };
rejected("duplicate Assessment IDs", expected, [{ ...first, assessment: work }, { ...second, assessment: work }], "CORE.DUPLICATE_ASSESSMENT");
rejected("unknown target", expected, [first, { ...second, exercises: [{ ...second.exercises[0], target: "missing" }] }], "CORE.UNKNOWN_TARGET");
rejected("unknown cross-document member", expected, [{ ...first, assessment: { ...work, items: ["exr-missing"] } }, second], "CORE.UNKNOWN_MEMBER");
const linked = assembleRelease(expected, [{ ...first, assessment: work }, second], [], expectation);
assert(linked.model.assessments[0].items[0] === "exr-second", "known cross-document member rejected");
const adapter: Adapter = { directory: "unused", contract: { name: "test-adapter", rules: "unused.cue" }, fragments: new Map() };
const adapted = assembleRelease(expected, [first, { ...second, exercises: [{ ...second.exercises[0], target: "test-adapter" }] }], [adapter], expectation);
assert(adapted.model.registeredTargets.includes("test-adapter"), "explicit adapter target missing");
console.log("PASS explicit cross-document membership and selected targets");

function contextFailure(documents: DocumentResult[], code: string, terms: string[]) {
  let error: any;
  try { assembleRelease(expected, documents, [], expectation); } catch (value) { error = value; }
  assert(error?.name === "ExtensionDiagnostic" && error.code === code && terms.every(term => error.message.includes(term)),
    `missing ${code} source/object/related context: ${String(error)}`);
}
contextFailure([first, {...second, exercises: first.exercises}], "CORE.DUPLICATE_EXERCISE", ["first.qmd", "second.qmd", "exr-first"]);
contextFailure([{...first, assessment: work}, {...second, assessment: work}], "CORE.DUPLICATE_ASSESSMENT", ["first.qmd", "second.qmd", work.id]);
contextFailure([{...first, assessment: {...work, items: ["exr-missing"]}}, second], "CORE.UNKNOWN_MEMBER", ["first.qmd", work.id, "items", "exr-missing"]);
console.log("PASS release diagnostic provenance for conflicts and membership");

const hidden={...second,declarations:[{id:"exr-second",source:"second.qmd",difficulty:"introductory" as const,time:25,statementVisibility:"restricted" as const,purpose:"control" as const,hasSolution:true,hasPublicSolution:false}],exercises:[]};
const rawWork={...work,kind:"practical" as const};
const studentRaw=assembleRelease(expected,[{...first,assessment:null,rawAssessment:rawWork},hidden],[],expectation);
assert(studentRaw.model.exercises.length===1,"raw facts recreated hidden AST");
rejected("open test condition",expected,[{...first,assessment:work},{...second,exercises:[{...second.exercises[0],statementVisibility:"open"}]}],"CORE.ASSESSMENT_INVALID");
const demonstration={...work,kind:"seminar" as const,assignments:{"exr-second":{stage:"demonstration" as const,requirement:"required" as const,workMode:"individual" as const}}};
rejected("restricted demonstration",expected,[{...first,assessment:demonstration},second],"CORE.ASSESSMENT_INVALID");
const openDemo={...second,exercises:[{...second.exercises[0],statementVisibility:"open" as const}]};
assert(assembleRelease(expected,[{...first,assessment:demonstration},openDemo],[],expectation).model.assessments.length===1,"open demonstration with solution rejected");
rejected("demonstration without solution",expected,[{...first,assessment:demonstration},{...openDemo,exercises:[{...openDemo.exercises[0],hasSolution:false,hasPublicSolution:false}]}],"CORE.ASSESSMENT_INVALID");
console.log("PASS raw hidden membership, restricted works and actual demonstration guards");

rejected("demonstration solution hidden from public projection",expected,[{...first,assessment:demonstration},{...openDemo,exercises:[{...openDemo.exercises[0],hasSolution:true,hasPublicSolution:false}]}],"CORE.ASSESSMENT_INVALID");
rejected("unknown raw composition member",expected,[{...first,assessment:null,rawAssessment:{...rawWork,items:["exr-missing"]}},hidden],"CORE.UNKNOWN_MEMBER");

for(const stage of ["",null])rejected("invalid falsy stage "+JSON.stringify(stage),expected,[{...first,assessment:{...work,assignments:{"exr-second":{requirement:"required",workMode:"individual",stage} as any}}},second],"CORE.ASSESSMENT_INVALID");
rejected('missing_related_exercise',expected,[{...first,assessment:{...work,relatedExercise:'exr-missing'}},second],'CORE.RELATED_EXERCISE_MISSING');
assert(assembleRelease(expected,[{...first,assessment:{...work,relatedExercise:'exr-first'}},second],[],expectation).model.assessments[0].relatedExercise==='exr-first','canonical relatedExercise lost');
