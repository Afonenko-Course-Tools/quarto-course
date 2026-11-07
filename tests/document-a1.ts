import type { Node, ContainerNode } from "../_extensions/course-core/document/native-ast.ts";
import { fixtureArray, fixtureAt, required } from "./helpers/required.ts";
import {
  CoreContractError,
  finalizeDocument,
  normalizeDocument,
} from "../_extensions/course-core/public.ts";
function assert(v: unknown, m: string): asserts v {
  if (!v) throw Error(m);
}
const context = {
  operation: crypto.randomUUID(),
  input: "/book/tasks/input.qmd",
  format: "html",
  projection: "student" as const,
  exerciseBank: true,
};
const para = (s: string) => ({ t: "Para", c: [{ t: "Str", c: s }] });
const exr = (
  id: string,
  attrs: [string, string][] = [],
  body: Node[] = [para("Условие")],
): ContainerNode => ({ t: "Div", c: [[id, [], attrs], body] });
const ordinary = { t: "CodeBlock", c: [["", ["yaml"], []], "ordinary: true"] };
const span = {
  t: "Span",
  c: [["keep", ["foreign"], [["foreign-key", "value"]]], [{
    t: "Str",
    c: "inline",
  }]],
};
const base = {
  "pandoc-api-version": [1, 23, 1],
  meta: {},
  blocks: [
    ordinary,
    para("До"),
    exr("exr-one", [["difficulty", "introductory"], [
      "statement-visibility",
      "open",
    ]], [
      { t: "Para", c: [span] },
      { t: "BulletList", c: [[para("list")]] },
      exr("", [], []),
    ]),
  ],
};
fixtureArray(fixtureAt(base, ["blocks", 2, "c", 1])).pop();
const early = normalizeDocument(base, context);
assert(
  JSON.stringify(early.ast.blocks[0]) === JSON.stringify(ordinary),
  "Обычный YAML поглощён",
);
assert(JSON.stringify(early.ast).includes("foreign-key"), "Span потерян");
assert(early.occurrences.length === 1, "Неверная таблица появлений");
const occurrence = required(early.occurrences[0]);
const late = {
  context,
  occurrences: [{
    key: occurrence.key,
    body: [para("Позднее условие")],
    nativeKind: "Theorem",
    anchor: "exr-one",
  }],
};
const complete = finalizeDocument(
  JSON.parse(JSON.stringify(early)),
  JSON.parse(JSON.stringify(late)),
);
assert(
  complete.status === "complete" &&
    JSON.stringify(required(complete.occurrences[0]).body).includes("Позднее условие"),
  "Late body не связан",
);
const partial = finalizeDocument(early, { context, occurrences: [] });
assert(
  partial.status === "partial" &&
    required(partial.unresolved[0]).exerciseId === "exr-one",
  "Потерянное обязательное тело принято как готовое",
);
function rejects(code: string, action: () => unknown) {
  try {
    action();
  } catch (e) {
    assert(e instanceof CoreContractError && e.code === code, String(e));
    return;
  }
  throw Error("Принято: " + code);
}
rejects(
  "DOCUMENT_BINDING",
  () =>
    finalizeDocument(early, {
      ...late,
      context: { ...context, operation: crypto.randomUUID() },
    }),
);
rejects(
  "DOCUMENT_BINDING",
  () =>
    finalizeDocument(early, {
      ...late,
      context: { ...context, format: "revealjs" },
    }),
);
rejects(
  "DOCUMENT_BINDING",
  () =>
    finalizeDocument(early, {
      ...late,
      context: { ...context, projection: "author" },
    }),
);
rejects(
  "DOCUMENT_DUPLICATE",
  () =>
    normalizeDocument({
      ...base,
      blocks: [
        exr("exr-one", [["difficulty", "introductory"], [
          "difficulty",
          "advanced",
        ], ["statement-visibility", "open"]]),
      ],
    }, context),
);
rejects(
  "EXERCISE_CONTRACT",
  () =>
    normalizeDocument({
      ...base,
      blocks: [{
        t: "Div",
        c: [["", ["content-hidden"], []], [
          exr("exr-hidden", [["difficulty", "impossible"]]),
        ]],
      }],
    }, context),
);
const marker = {
  t: "CodeBlock",
  c: [
    ["", ["yaml", "course-exercise"], []],
    "difficulty: advanced\nstatement-visibility: restricted\n",
  ],
};
const literal = normalizeDocument({
  ...base,
  blocks: [
    exr("exr-marked", [["difficulty", "introductory"], [
      "statement-visibility",
      "open",
    ]], [marker, para("Тело")]),
  ],
}, context);
assert(
  JSON.stringify(fixtureAt(literal.ast, ["blocks", 0, "c", 1, 0])) ===
      JSON.stringify(marker) &&
    required(literal.definitions["exr-marked"]).difficulty === "introductory" &&
    required(literal.definitions["exr-marked"])["statement-visibility"] === "open",
  "Обычный CodeBlock не должен быть вторым API декларации",
);
const malformedLiteral = { ...marker, c: [marker.c[0], "broken: [*unknown"] };
const outside = normalizeDocument(
  { ...base, blocks: [malformedLiteral] },
  context,
);
assert(
  JSON.stringify(outside.ast.blocks) === JSON.stringify([malformedLiteral]),
  "Содержимое обычного YAML CodeBlock не должно разбираться Core",
);
const repeated = normalizeDocument({
  ...base,
  blocks: [base.blocks[2], structuredClone(base.blocks[2])],
}, context);
assert(
  repeated.occurrences.length === 2 &&
    required(repeated.occurrences[0]).key !== required(repeated.occurrences[1]).key,
  "Повторные появления смешаны",
);

const demo = normalizeDocument({
  ...base,
  blocks: [
    exr("exr-demo", [["difficulty", "introductory"], [
      "statement-visibility",
      "open",
    ], ["course-role", "demonstration"]], [para("Задача"), {
      t: "Div",
      c: [["", ["solution"], []], [para("Ответ")]],
    }]),
  ],
}, context);
const onlyExercise = {
  context,
  occurrences: [{
    key: required(demo.occurrences[0]).key,
    body: [para("Задача")],
    nativeKind: "Theorem",
    anchor: "exr-demo",
  }],
};
assert(
  finalizeDocument(demo, onlyExercise).status === "partial",
  "Потеря безусловного solution binding молча принята",
);
const nestedLiteral = normalizeDocument({
  ...base,
  blocks: [
    exr("exr-deep", [["difficulty", "introductory"], [
      "statement-visibility",
      "open",
    ]], [{
      t: "Div",
      c: [["", [], []], [{
        ...marker,
        c: [marker.c[0], "difficulty: impossible"],
      }]],
    }]),
  ],
}, context);
assert(
  JSON.stringify(nestedLiteral.ast).includes("difficulty: impossible"),
  "CodeBlock во вложенном обычном Div потерян",
);
rejects(
  "DOCUMENT_BINDING",
  () =>
    finalizeDocument(early, {
      ...late,
      context: { ...context, input: "/book/foreign.qmd" },
    }),
);
const restricted = normalizeDocument({
  ...base,
  blocks: [
    exr("exr-restricted", [["difficulty", "introductory"], [
      "statement-visibility",
      "restricted",
    ]], [para("CLOSED_STATEMENT")]),
  ],
}, context);
assert(
  !JSON.stringify(restricted.ast).includes("CLOSED_STATEMENT") &&
    restricted.occurrences.length === 0,
  "Закрытое условие попало в student writer",
);
rejects("ANSWER_INVALID", () =>
  normalizeDocument({
    ...base,
    blocks: [
      exr("exr-answer", [["difficulty", "introductory"], [
        "statement-visibility",
        "open",
      ]], [{
        t: "CodeBlock",
        c: [["", ["yaml", "answer-spec"], []], "key: SECRET"],
      }]),
    ],
  }, context));

const publicDeclaration: [string, string][] = [["difficulty", "introductory"], [
  "statement-visibility",
  "open",
], ["course-role", "demonstration"]];
const pairedSolution = {
  t: "Div",
  c: [["sol-demo", ["solution"], []], [para("PUBLIC_BOUND_SOLUTION")]],
};
const publicSource = exr("exr-demo", publicDeclaration, [
  para("Условие"),
  pairedSolution,
]);
const conflictingSource = exr("exr-private", [["difficulty", "introductory"], [
  "statement-visibility",
  "open",
], ["course-role", "independent-study"]], [pairedSolution]);
rejects(
  "SOLUTION_PAIRING_INVALID",
  () =>
    normalizeDocument({
      ...base,
      blocks: [exr("exr-demo", publicDeclaration), conflictingSource],
    }, context),
);
const pairedRepeated = normalizeDocument({
  ...base,
  blocks: [publicSource, structuredClone(publicSource)],
}, context);
assert(
  pairedRepeated.occurrences.length === 4 &&
    new Set(pairedRepeated.occurrences.map((row) => row.key)).size === 4,
  "Правильные пары повторных occurrences потеряны",
);
assert(
  pairedRepeated.occurrences.filter((row) => row.kind === "solution").every(
    (row) => row.exerciseId === "exr-demo" && row.publicSolution,
  ),
  "Повторные решения получили неверного владельца",
);
const standalonePair = normalizeDocument({
  ...base,
  blocks: [pairedSolution, exr("exr-demo", publicDeclaration)],
}, context);
assert(
  standalonePair.occurrences.some((row) =>
    row.kind === "solution" && row.exerciseId === "exr-demo" &&
    row.publicSolution
  ),
  "Отдельное публичное решение потеряно",
);

console.log(
  "PASS document A1 JSON roundtrip, literal CodeBlocks/attrs, hidden validation, repeated occurrences, partial and foreign bindings",
);
