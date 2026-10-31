import { normalizeDocument } from "../_extensions/course-core/document/normalize.ts";
const assert = (v: unknown, s: string) => {
  if (!v) throw Error(s);
};
const para = (s: string) => ({ t: "Para", c: [{ t: "Str", c: s }] }),
  div = (s: string, profile: string) => ({
    t: "Div",
    c: [["", ["content-visible"], [["when-profile", profile]]], [para(s)]],
  });
const context = {
  operation: "11111111-1111-4111-8111-111111111111",
  captureWitness: "22222222-2222-4222-8222-222222222222",
  input: "/frozen/bank.qmd",
  format: "revealjs",
  profiles: ["full", "lab"],
  projection: "author" as const,
  exerciseBank: true,
  defaults: {
    difficulty: "introductory" as const,
    "statement-visibility": "restricted" as const,
  },
};
const correct = {
  t: "Span",
  c: [["", ["correct"], []], [{ t: "Str", c: "A" }]],
};
const input = {
  "pandoc-api-version": [1, 23, 1],
  meta: {},
  blocks: [{
    t: "Div",
    c: [["exr-one", ["content-visible"], [["when-profile", "full"]]], [
      para("CONDITION"),
      div("STUDENT-INNER", "student"),
      div("FULL-INNER", "full"),
      {
        t: "Div",
        c: [["", ["answer"], [["type", "single-choice"]]], [{
          t: "BulletList",
          c: [[
            { t: "Para", c: [correct] },
            div("OPTION-STUDENT", "student"),
            div("OPTION-FULL", "full"),
          ], [para("B")]],
        }]],
      },
      { t: "Div", c: [["", ["solution"], []], [para("PRIVATE-SOLUTION")]] },
    ]],
  }],
};
const early = (normalizeDocument as any)(input, context, {
  source: "bank.qmd",
  assessments: [{ source: "work.qmd", id: "work" }],
  producerProfile: "test-profile",
});
const text = JSON.stringify(early.ast);
assert(
  text.includes("STUDENT-INNER") && text.includes("OPTION-STUDENT"),
  "Assignment потерял student-only часть до ConditionalBlock",
);
assert(
  !text.includes("FULL-INNER") && !text.includes("OPTION-FULL") &&
    !text.includes("PRIVATE-SOLUTION"),
  "Assignment раскрыл закрытое содержимое",
);
assert(
  !text.includes("when-profile"),
  "Обработанный profile gate оставлен native author pass",
);
assert(
  early.context.format === "revealjs" &&
    early.context.projection === "author" &&
    JSON.stringify(early.context.profiles) === '["full","lab"]',
  "Actual context подменён",
);
assert(
  early.assignment?.answers["exr-one"].type === "single-choice",
  "Нет normalized answer transport",
);
assert(
  early.assignment.answers["exr-one"].responseSlots.length === 2,
  "Choice response cardinality потеряна",
);
assert(
  early.release.declarations[0].answer.correct === 0,
  "Закрытый canonical answer утрачен",
);
console.log(
  "PASS assignment primary: actual author/revealjs context, student privacy, two bound choice slots, private facts separate",
);
