import * as Core from "../_extensions/course-core/public.ts";
const context = {
  operation: crypto.randomUUID(),
  input: "bank.qmd",
  format: "html",
  projection: "student" as const,
  exerciseBank: true,
  defaults: {
    difficulty: "introductory" as const,
    "statement-visibility": "open" as const,
  },
};
const div = (
  id: string,
  body: unknown[],
  classes: string[] = [],
  pairs: string[][] = [],
) => ({ t: "Div", c: [[id, classes, pairs], body] });
const spec = (yaml: string) => ({
  t: "CodeBlock",
  c: [["", ["yaml", "answer-spec"], []], yaml],
});
const para = (s: string) => ({ t: "Para", c: [{ t: "Str", c: s }] });
const correct = {
  t: "Span",
  c: [["", ["correct"], []], [{ t: "Str", c: "Верно" }]],
};
const choice = () =>
  div(
    "",
    [{
      t: "BulletList",
      c: [[{ t: "Plain", c: [correct] }], [para("Неверно")]],
    }],
    ["answer"],
    [["type", "single-choice"]],
  );
const doc = (blocks: unknown[]) => ({
  "pandoc-api-version": [1, 23, 1],
  meta: {},
  blocks,
});
const check = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const forms = [
  ["manual", "type: manual\nsubmission: text"],
  ["numeric", "type: numeric\nkey: {value: 12.5, tolerance: {absolute: 0.1}}"],
  [
    "multipart",
    "type: multipart\nparts:\n  - {name: cost, label: Цена, type: numeric, key: {value: 12.5, tolerance: {absolute: 0.1}}}\n  - {name: reason, label: Причина, type: manual, submission: text}",
  ],
  [
    "matching",
    "type: matching\nprompts: [Процесс, Поток]\noptions: [Свой, Общий, Лишний]\nkey: {pairs: {Процесс: Свой, Поток: Общий}}",
  ],
] as const;
for (const projection of ["student", "author"] as const) {
  const early = Core.normalizeDocument(
    doc([
      ...forms.map(([name, yaml]) =>
        div("exr-" + name, [para("Условие"), spec(yaml)])
      ),
      div("exr-choice", [choice()]),
    ]),
    { ...context, projection },
  );
  for (const [name] of forms) {
    check(
      early.release!.declarations.find((d) => d.id === "exr-" + name)?.answer
        ?.type === name,
      "Нет проверенного " + name,
    );
  }
  const answer = early.release!.declarations.find((d) => d.id === "exr-choice")
    ?.answer;
  check(
    answer?.type === "single-choice" && answer.correct === 0 &&
      answer.count === 2,
    "Choice facts",
  );
  const ast = JSON.stringify(early.ast);
  check(
    !ast.includes('"answer-spec"') && !ast.includes('"correct"') &&
      !ast.includes('"key"') && !ast.includes("12.5"),
    "Закрытый ключ в AST " + projection,
  );
  check(
    ast.includes("Процесс") && ast.includes("Лишний") && ast.includes("Верно"),
    "Публичный ответ потерян",
  );
}
const invalid: [string, unknown[]][] = [
  ["orphan-spec", [spec(forms[0][1])]],
  ["orphan-correct", [div("exr-a", [para("x"), { t: "Para", c: [correct] }])]],
  ["nested-solution", [
    div("exr-a", [div("", [spec(forms[0][1])], ["solution"])]),
  ]],
  ["duplicate-answer", [div("exr-a", [spec(forms[0][1]), choice()])]],
  ["wrong-answer-node", [div("exr-a", [div("", [], ["answer-spec"])])]],
  ["wrong-correct-node", [div("exr-a", [div("", [], ["correct"])])]],
  ["unmarked-choice", [
    div("exr-a", [
      div(
        "",
        [{ t: "BulletList", c: [[para("a")], [para("b")]] }],
        ["answer"],
        [["type", "single-choice"]],
      ),
    ]),
  ]],
];
for (
  const yaml of [
    "type: numeric\nkey: {value: 2, tolerance: {absolute: -1}}",
    "type: numeric\nkey: {value: .inf, tolerance: {absolute: 0}}",
    "type: manual\nsubmission: text\nunknown: value",
    "type: manual\ntype: numeric\nsubmission: text",
    "type: multipart\nparts: [{name: x, label: X, type: manual, submission: text}, {name: x, label: Y, type: manual, submission: text}]",
    "type: matching\nprompts: [A, B]\noptions: [X]\nkey: {pairs: {A: X}}",
    "type: matching\nprompts: [A]\noptions: [X]\nkey: {pairs: {A: Y}}",
    "type: matching\nprompts: [A, A]\noptions: [X]\nkey: {pairs: {A: X}}",
    "type: manual\nsubmission: &x text",
    "type: manual\nsubmission: !custom text",
  ]
) {
  invalid.push([yaml, [
    div("exr-a", [spec(yaml)], [], [["statement-visibility", "restricted"]]),
  ]]);
}
for (const [name, blocks] of invalid) {
  let error = "";
  try {
    Core.normalizeDocument(doc(blocks), context);
  } catch (e) {
    error = String(e);
  }
  check(error.includes("ANSWER_"), "Не отвергнут " + name + ": " + error);
}
console.log(
  JSON.stringify({
    status: "PASS",
    projections: 2,
    forms: 5,
    negatives: invalid.length,
  }),
);
