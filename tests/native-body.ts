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
  difficulty: "introductory",
  sourceTopic: { id: "sec-topic", owner: "test", rootQmd: "index.qmd" },
  head: { kind: "Para", level: 0, title: "" },
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
  items: ["exr-one"],
  memberContainers: 1,
  memberKinds: ["OrderedList"],
  memberSizes: [1],
  bodyJson: json([]),
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
      bodyJson: json([para("PUBLIC")]),
      gradingNotesJson: [],
    }],
    publicAssessment: work,
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
