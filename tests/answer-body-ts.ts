import { fixtureSet } from "./helpers/required.ts";
import { validateAnswer, projectChoice } from "../_extensions/course-core/body-export/answer.ts";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
const original = Object.getOwnPropertyDescriptor(Deno, "Command");
assert(original, "Нет свойства Command");
let children = 0;
Object.defineProperty(Deno, "Command", {
  ...original,
  value: class {
    constructor() {
      children++;
      throw Error("Ответ не должен запускать процесс");
    }
  },
});
const forms = [
  "type: manual\nsubmission: text",
  "type: numeric\nkey: {value: 1.25, tolerance: {absolute: 0}}",
  "type: multipart\nparts: [{name: a, label: A, type: manual, submission: text}]",
  "type: matching\nprompts: [A]\noptions: [B]\nkey: {pairs: {A: B}}",
];
let accepted = 0, rejected = 0;
try {
  for (const yaml of forms) {
    const answer = await validateAnswer(yaml, { source: "question.qmd", id: "exr-a" });
    assert(answer.closedKey.type === answer.answerType, "Неправильный ключ/тип");
    assert(!JSON.stringify(answer.publicAnswer).includes('"key"'), "Утечка ключа");
    accepted++;
  }
  for (const yaml of [
    "type: manual\nsubmission: text\nextra: true",
    "type: manual\ntype: numeric",
    "type: numeric\nkey: {value: .inf, tolerance: {absolute: 0}}",
    "type: numeric\nkey: {value: 2, tolerance: {absolute: -1}}",
    "type: manual\nsubmission: &x text",
    "type: manual\nsubmission: !custom text",
    "type: manual\nsubmission: *missing",
    "[]",
    "type: multipart\nparts: [{name: a, label: A, type: manual, submission: text}, {name: a, label: B, type: manual, submission: text}]",
    "type: matching\nprompts: [A, B]\noptions: [X]\nkey: {pairs: {A: X}}",
  ]) {
    let error: unknown;
    try {
      await validateAnswer(yaml, { source: "question.qmd", id: "exr-a" });
    } catch (caught) {
      error = caught;
    }
    assert(error instanceof Error && "code" in error &&
      typeof error.code === "string" && error.code.startsWith("ANSWER_") &&
      error.message.includes("question.qmd") && error.message.includes("exr-a") &&
      error.cause, "Отказ потерял source/id/cause: " + error);
    rejected++;
  }
  const choice = (marks: number[]) => ({
    t: "Div",
    c: [["", ["answer"], [["type", "single-choice"]]], [{
      t: "BulletList",
      c: [0, 1].map((i) => [{
        t: "Plain",
        c: [marks.includes(i)
          ? { t: "Span", c: [["", ["correct"], []], [{ t: "Str", c: String(i) }]] }
          : { t: "Str", c: String(i) }],
      }]),
    }]],
  });
  const yes = await projectChoice(choice([1]));
  assert(yes.closedKey.correct === 1 &&
    !JSON.stringify(yes.publicAnswer).includes('"correct"'), "Выбор/публичная проекция");
  accepted++;
  for (const marks of [[], [0, 1]]) {
    let error: unknown;
    try {
      await projectChoice(choice(marks), { source: "question.qmd", id: "exr-a" });
    } catch (caught) {
      error = caught;
    }
    assert(error instanceof Error && "code" in error && error.code === "ANSWER_INVALID", "Число отметок");
    rejected++;
  }
  const malformed = choice([1]);
  // Первый вариант повреждён; второй всё ещё содержит один правильный valid marker.
  fixtureSet(malformed, ["c",1,0,"c",0,0,"c"], [{
    t: "Span", c: [["",["correct"],[]], "not-nodes"],
  }]);
  let malformedError: unknown;
  try {
    await projectChoice(malformed, { source: "question.qmd", id: "exr-malformed" });
  } catch (caught) {
    malformedError = caught;
  }
  assert(malformedError instanceof Error && "code" in malformedError &&
    (malformedError.code === "ANSWER_INVALID" || malformedError.code === "DOCUMENT_AST"), "Повреждённый direct Span.correct принят либо потерял answer диагностику: " + malformedError);
  rejected++;
  assert(children === 0, "Ответ создал child");
  console.log(JSON.stringify({ accepted, rejected, children, status: "PASS" }));
} finally {
  Object.defineProperty(Deno, "Command", original);
}
