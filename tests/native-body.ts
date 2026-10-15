import type { DocumentResult } from "../_extensions/course-core/domain/model.ts";
const { buildBodies } = await import(
  "../_extensions/course-core/body-export/producer.ts"
);
if (typeof buildBodies !== "function") {
  throw Error("native explicit Body producer missing");
}
const para = (s: string) => ({ t: "Para", c: [{ t: "Str", c: s }] });
const div = (id: string, classes: string[], blocks: unknown[]) => ({
  t: "Div",
  c: [[id, classes, []], blocks],
});
const json = (blocks: unknown[]) =>
  JSON.stringify({ "pandoc-api-version": [1, 23, 1], meta: {}, blocks });
const exercise: any = {
  id: "exr-one",
  target: "manual",
  project: "",
  purpose: "independent-study",
  difficulty: "introductory", time:10,statementVisibility:"restricted",hasSolution:true,hasPublicSolution:false,
  sourceTopic: { id: "sec-topic", owner: "test", rootQmd: "index.qmd" },
  head: { kind: "Header", level: 2, title: "Проверка диапазона" },
  nested: 0,
  unknownAttributes: [],
  bodyJson: json([para("PUBLIC"), div("sol-one", [], [para("NESTED")]), {
    t: "CodeBlock",
    c: [
      ["", ["answer-spec"], []],
      "type: numeric\nkey: {value: 42, tolerance: {absolute: 0}}",
    ],
  }]),
  gradingNotesJson: [json([para("NOTES")])],
};
const work: any = {
  id: "sec-work",
  kind: "test",
  title: "Test",
  slots: [{id:"exr-one",selection:"fixed",candidates:["exr-one"],assignment:{requirement:"required",workMode:"individual"}}],
  memberContainers: 1,
  memberKinds: ["OrderedList"],
  memberSizes: [1],
  bodyJson: json([para("INTRODUCTION"), div("", ["task-items"], [para("ASSIGNMENTS")]), div("sol-work", ["solution"], [para("TEACHER_ONLY")])]),
};
const document: DocumentResult = {
  scope: "document",
  source: "index.qmd",
  course: { id: "test", view: "full" },
  document: {
    source: "index.qmd",
    output: "index.html",
    format: "html",
    profiles: ["full"],
  },
  exercises: [exercise],
  assessment: work,
  body: {
    publicExercises: [{
      ...exercise,
      bodyJson: json([{t: "Header", c: [2, ["question-title", [], []], [{t: "Str", c: "Проверка диапазона"}]]}, div("", ["course-metadata"], [para("DUPLICATE_METADATA")]), para("PUBLIC")]),
      gradingNotesJson: [],
    }],
    publicAssessment: work,
    publicIntroductionJson: work.bodyJson,
  },
  pedagogy: {
    elements: [{
      kind: "solution" as any,
      id: "sol-sibling",
      exercise: "exr-one",
      order: 1,
      bodyJson: json([para("SIBLING")]),
    }],
  },
};
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const value = await buildBodies(document, {
  projectRoot: Deno.cwd(),
  includeClosed: true,
});
assert(
  value.publicPackage.questions[0].title === "Проверка диапазона" &&
    value.publicPackage.questions[0].difficulty === "introductory" &&
    value.publicPackage.questions[0].time === 10,
  "Body потерял авторское название, сложность или время",
);
assert(!JSON.stringify(value.publicPackage.questions[0].condition).match(/Проверка диапазона|DUPLICATE_METADATA/),
  "Книжный заголовок или повторные metadata остались в native условии");
const nativeTitle = {t: "Span", c: [["", ["theorem-title"], []], [{t: "Strong", c: [{t: "Str", c: "Упражнение 13 (Проверка диапазона)"}]}]]};
const titleHeader = {t: "Header", c: [2, ["question-title", [], []], [{t: "Str", c: "Проверка диапазона"}]]};
const titleLink = {t: "Para", c: [{t: "Link", c: [["", [], []], [{t: "Str", c: "Перейти"}], ["#question-title", ""]]}]};
for (const [blocks, expected, forbidden] of [
  [[{t: "Para", c: [nativeTitle, {t: "Space"}, {t: "Str", c: "\u00a0"}]},
    div("", ["course-metadata"], [para("DUPLICATE_METADATA")]), titleHeader, titleLink, para("PUBLIC")], "PUBLIC", "Упражнение 13"],
  [[{t: "Para", c: [nativeTitle, {t: "Space"}, {t: "Str", c: "AUTHORED_TAIL"}]}], "AUTHORED_TAIL", "Упражнение 13"],
  [[{t: "Para", c: [{t: "Str", c: "AUTHOR_PREFIX"}, {t: "Space"}, nativeTitle]}], "Упражнение 13", "NEVER_PRESENT"],
  [[para("Упражнение 13 — обычный авторский текст")], "Упражнение 13", "NEVER_PRESENT"],
  [[para("PUBLIC"), {t: "Para", c: [nativeTitle]}], "Упражнение 13", "NEVER_PRESENT"],
  [[{t: "Para", c: [{...nativeTitle, c: [["authored-anchor", ["theorem-title"], []], nativeTitle.c[1]]}]}], "authored-anchor", "NEVER_PRESENT"],
] as const) {
  const fixture = structuredClone(document);
  fixture.body!.publicExercises[0].bodyJson = json(blocks);
  const question = (await buildBodies(fixture, {projectRoot: Deno.cwd()})).publicPackage.questions[0];
  const body = JSON.stringify(question.condition);
  assert(body.includes(expected) && !body.includes(forbidden), "Неправильная граница удаления native-префикса: " + body);
  assert(!body.includes("DUPLICATE_METADATA"), "Native-префикс помешал удалению повторных metadata");
  if (JSON.stringify(blocks).includes("#question-title")) {
    // Native Quarto already consumed the canonical Header into theorem-title.
    // A remaining Header is authored, including an intentional repeated title.
    assert(question.condition.some(node => node.t === "Header" && node.c[1][0] === "question-title") && body.includes("Проверка диапазона"), "После native-префикса удалён авторский повторный Header");
  }
}
assert(
  JSON.stringify(value.publicPackage.works[0].introduction).includes("INTRODUCTION") &&
    !JSON.stringify(value.publicPackage.works[0].introduction).match(/ASSIGNMENTS|TEACHER_ONLY/),
  "Введение работы потеряно либо содержит назначения/закрытое решение",
);
assert(
  JSON.stringify(value.package).includes("SIBLING") &&
    JSON.stringify(value.package).includes("NESTED") &&
    JSON.stringify(value.package).includes("NOTES"),
  "closed partitions lost",
);
assert(
  !JSON.stringify(value.publicPackage).match(
    /SIBLING|NESTED|NOTES|closedKey|42/,
  ),
  "public private leak",
);
assert(
  JSON.stringify(value.package.questions[0].condition).includes("PUBLIC") &&
    !JSON.stringify(value.package.questions[0].condition).match(/NESTED|42/),
  "condition partition failed",
);
let failed = false;
try {
  await buildBodies({ ...document, course: { id: "test", view: "student" } }, {
    projectRoot: Deno.cwd(),
    includeClosed: true,
  });
} catch {
  failed = true;
}
assert(failed, "student reconstructed private keys");
console.log(
  "PASS explicit Body inputs, nested/sibling solutions, notes, public/full partitions",
);
const choiceDoc = structuredClone(document);
choiceDoc.course.view = "student";
choiceDoc.document.profiles = ["student"];
choiceDoc.exercises[0].bodyJson = json([para("PUBLIC"), {
  t: "Div",
  c: [["", ["answer"], [["type", "single-choice"]]], [{
    t: "BulletList",
    c: [[para("A")], [para("B")]],
  }]],
}]);
choiceDoc.exercises[0].gradingNotesJson = [];
choiceDoc.body = {
  publicExercises: choiceDoc.exercises,
  publicAssessment: work,
  publicAnswers: {
    "exr-one": {
      answerType: "single-choice",
      publicAnswerJson: json([{
        t: "BulletList",
        c: [[para("A")], [para("B")]],
      }]),
    },
  },
};
const choice = await buildBodies(choiceDoc, { projectRoot: Deno.cwd() });
assert(
  choice.publicPackage.questions[0].answerType === "single-choice",
  "student projected choice was treated as a missing private key",
);
console.log(
  "PASS student single-choice uses validated public answer facts without reconstructing keys",
);

const {validateAnswer} = await import("../_extensions/course-core/body-export/answer.ts");
const answerContext = {source: "questions.qmd", id: "exr-one"};
for (const [source, code] of [
  ["type: manual\ntype: numeric\n", "ANSWER_YAML"],
  ["type: numeric\nkey: {value: invalid}\n", "ANSWER_INVALID"],
]) {
  let error: any;
  try { await validateAnswer(source, answerContext); } catch (value) { error = value; }
  assert(error?.code === code && error.cause && error.message.includes("questions.qmd") && error.message.includes("exr-one") && error.message.includes("answer"),
    "answer error lost its ID, source/question/field or parser/CUE cause: " + String(error));
  if (code === "ANSWER_INVALID") assert(error.cause.name === "ExternalToolFailure" && error.cause.tool && error.cause.exitCode && error.cause.stderr,
    "CUE answer rejection lost foreign tool/exit/stderr");
}
const originalCue = Deno.env.get("CUE");
try {
  Deno.env.set("CUE", "/tmp/course-guaranteed-missing-cue-" + crypto.randomUUID());
  let error: any;
  try { await validateAnswer("type: manual\nsubmission: text\n", answerContext); } catch (value) { error = value; }
  assert(error?.name === "ExternalToolFailure" && error.cause && !error.message.includes("ANSWER_INVALID"),
    "tool launch failure was reclassified as an invalid authored answer: " + String(error));
} finally {
  if (originalCue === undefined) Deno.env.delete("CUE"); else Deno.env.set("CUE", originalCue);
}
console.log("PASS answer parser/CUE provenance and launch-failure boundary");

assert(JSON.stringify(value.publicPackage.questions[0].publicAnswer).includes("Ответ:"),
  "Core numeric response prompt must be Russian");
const manualDocument = structuredClone(document);
manualDocument.exercises[0].bodyJson = json([para("AUTHORED_RESPONSE_UNCHANGED")]);
const manualBody = await buildBodies(manualDocument, {projectRoot: Deno.cwd()});
assert(JSON.stringify(manualBody.publicPackage.questions[0].publicAnswer).includes("Ответ:"),
  "Core default manual response prompt must be Russian");
for (const source of ["type: manual\nsubmission: text\n", "type: numeric\nkey: {value: 2, tolerance: {absolute: 0}}\n"]) {
  assert(JSON.stringify((await validateAnswer(source)).publicAnswer).includes("Ответ:"),
    "Core authored-bank generated response prompt must be Russian");
}
const matchingAnswer = await validateAnswer("type: matching\nprompts: [AUTHORED_PROMPT]\noptions: [AUTHORED_OPTION]\nkey: {pairs: {AUTHORED_PROMPT: AUTHORED_OPTION}}\n");
const matchingText = JSON.stringify(matchingAnswer.publicAnswer);
for (const text of ["Условия", "Варианты", "Соответствия:", "AUTHORED_PROMPT", "AUTHORED_OPTION"]) {
  assert(matchingText.includes(text), "generated matching heading or authored label lost: " + text);
}
console.log("PASS Russian generated answer labels and unchanged authored matching content");
