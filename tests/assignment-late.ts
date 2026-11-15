import { fixtureArray, fixtureAt, required } from "./helpers/required.ts";
import { normalizeDocument } from "../_extensions/course-core/document/normalize.ts";
import { finalizeDocument } from "../_extensions/course-core/document/finalize.ts";
function assert(v: unknown, s: string): asserts v {
  if (!v) throw Error(s);
}
const context = {
  operation: "11111111-1111-4111-8111-111111111111",
  captureWitness: "22222222-2222-4222-8222-222222222222",
  input: "/frozen/bank.qmd",
  format: "html",
  profiles: ["full"],
  projection: "author" as const,
  exerciseBank: true,
  defaults: {
    difficulty: "introductory" as const,
    "statement-visibility": "restricted" as const,
  },
};
const p = (s: string) => ({ t: "Para", c: [{ t: "Str", c: s }] }),
  a = (text: string, correct = false) => ({
    t: "Para",
    c: correct ? [{ t: "Span", c: [["", ["correct"], []], [{ t: "Str", c: text }]] }] : [{ t: "Str", c: text }],
  });
const ast = {
  "pandoc-api-version": [1, 23, 1],
  meta: {},
  blocks: [
    {
      t: "Div",
      c: [
        ["exr-one", [], []],
        [
          p("CONDITION"),
          {
            t: "Div",
            c: [
              ["", ["answer"], [["type", "single-choice"]]],
              [
                {
                  t: "BulletList",
                  c: [[a("EARLY", true)], [a("B")]],
                },
              ],
            ],
          },
        ],
      ],
    },
  ],
};
const early = normalizeDocument(ast, context, {
  source: "bank.qmd",
  assessments: [{ source: "work.qmd", id: "work" }],
});
const body: unknown = JSON.parse(
  JSON.stringify(fixtureAt(early.ast, ["blocks", 0, "c", 1])).replaceAll("EARLY", "ACTUAL-LATE"),
);
const late = {
  context,
  occurrences: [
    {
      key: required(early.occurrences[0]).key,
      body: fixtureArray(body),
      nativeKind: "Div",
      anchor: "exr-one",
    },
  ],
  assignment: { introductions: [] },
};
const final = finalizeDocument(early, late);
assert(
  JSON.stringify(required(final.assignment?.answers["exr-one"]).publicAnswer).includes("ACTUAL-LATE"),
  "Final answer взят не из late AST",
);
assert(
  !JSON.stringify(required(final.occurrences[0]).body).includes("ACTUAL-LATE"),
  "Public answer продублирован в condition",
);
assert(required(required(final.assignment).answers["exr-one"]).responseSlots.length === 2, "Late slots lost");
for (const [name, mutate] of [
  ["missing wrapper", (v: unknown) => fixtureArray(fixtureAt(v, ["occurrences", 0, "body"])).pop()],
  ["missing option", (v: unknown) => fixtureArray(fixtureAt(v, ["occurrences", 0, "body", 1, "c", 1, 0, "c"])).shift()],
  [
    "reordered options",
    (v: unknown) => fixtureArray(fixtureAt(v, ["occurrences", 0, "body", 1, "c", 1, 0, "c"])).reverse(),
  ],
  [
    "duplicate wrapper",
    (v: unknown) =>
      fixtureArray(fixtureAt(v, ["occurrences", 0, "body"])).push(
        structuredClone(fixtureAt(v, ["occurrences", 0, "body", 1])),
      ),
  ],
] as [string, (v: unknown) => void][]) {
  const changed = structuredClone(late);
  mutate(changed);
  let error = "";
  try {
    finalizeDocument(early, changed);
  } catch (e) {
    error = String(e);
  }
  assert(error.includes("BODY.ANSWER_OCCURRENCE_MISMATCH"), name + " accepted/wrong " + error);
}
console.log("PASS late answer single capture, separate condition, missing/reorder/duplicate refusals");
