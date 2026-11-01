import { assertBodyPackage } from "../_extensions/course-core/body-export/producer.ts";
const root = await Deno.makeTempDir();
const question = (id: string) => ({
  owner: "demo",
  id,
  key: "demo/" + id,
  source: "bank.qmd",
  visibility: "public",
  statementVisibility: "open",
  hasPublicSolution: false,
  condition: [{ t: "Opaque", c: { arbitrary: true } }],
  publicAnswer: [],
  answerType: "manual",
  closedKey: null,
  solution: [],
  gradingNotes: [],
});
export const base = {
  schema: "course-body-package-v2",
  owner: "demo",
  release: "6.0.0",
  apiVersion: [1, 23, 1],
  questions: [question("exr-a")],
  works: [{
    owner: "demo",
    id: "work",
    key: "demo/work",
    source: "work.qmd",
    kind: "lab",
    title: "Work",
    slots: [{
      id: "demo/work/exr-a",
      selection: "fixed",
      candidates: ["demo/exr-a"],
      assignment: { requirement: "required", workMode: "individual" },
    }],
  }],
  resources: [{ opaque: "resource" }],
};
try {
  const cases: [string, (p: any) => void, boolean][] = [
    ["valid", () => {}, true],
    ["body-v1", (p) => p.schema = "course-body-package-v1", false],
    ["root-unknown", (p) => p.extra = true, false],
    ["work-items", (p) => p.works[0].items = ["demo/exr-a"], false],
    ["work-assignments", (p) => p.works[0].assignments = {}, false],
    ["question-unknown", (p) => p.questions[0].extra = true, false],
    ["slot-items", (p) => p.works[0].slots[0].items = [], false],
    [
      "assignment-unknown",
      (p) => p.works[0].slots[0].assignment.unknown = true,
      false,
    ],
    [
      "foreign-owner",
      (p) => p.works[0].slots[0].id = "other/work/exr-a",
      false,
    ],
    ["foreign-work", (p) => p.works[0].slots[0].id = "demo/other/exr-a", false],
    ["fixed-alt-id", (p) => p.works[0].slots[0].id = "demo/work/alt-a", false],
    [
      "fixed-wrong-id",
      (p) => p.works[0].slots[0].id = "demo/work/exr-b",
      false,
    ],
    ["random-exr-id", (p) => {
      p.questions.push(question("exr-b"));
      p.works[0].slots[0].selection = "random";
      p.works[0].slots[0].candidates.push("demo/exr-b");
    }, false],
    ["valid-random", (p) => {
      p.questions.push(question("exr-b"));
      p.works[0].slots[0].selection = "random";
      p.works[0].slots[0].id = "demo/work/alt-choice";
      p.works[0].slots[0].candidates.push("demo/exr-b");
    }, true],
  ];
  const addQuestion = (p: any) => {
    p.questions.push(question("exr-b"));
    p.works[0].slots.push({
      ...structuredClone(p.works[0].slots[0]),
      id: "demo/work/exr-b",
      candidates: ["demo/exr-b"],
    });
  };
  cases.push(
    ["question-owner", (p) => p.questions[0].owner = "other", false],
    ["question-key", (p) => p.questions[0].key = "demo/exr-b", false],
    ["work-owner", (p) => p.works[0].owner = "other", false],
    ["work-key", (p) => p.works[0].key = "demo/other", false],
    [
      "duplicate-question",
      (p) => p.questions.push(structuredClone(p.questions[0])),
      false,
    ],
    ["duplicate-work", (p) => p.works.push(structuredClone(p.works[0])), false],
    [
      "duplicate-slot",
      (p) => p.works[0].slots.push(structuredClone(p.works[0].slots[0])),
      false,
    ],
    ["duplicate-member", (p) => {
      p.works[0].slots.push({
        ...structuredClone(p.works[0].slots[0]),
        id: "demo/work/alt-b",
        selection: "random",
        candidates: ["demo/exr-a", "demo/exr-a"],
      });
    }, false],
    ["unused-question", (p) => p.questions.push(question("exr-b")), false],
    [
      "unknown-reference",
      (p) => p.works[0].slots[0].candidates = ["demo/exr-unknown"],
      false,
    ],
    ["fixed-empty", (p) => p.works[0].slots[0].candidates = [], false],
    ["random-single", (p) => {
      p.works[0].slots[0].selection = "random";
      p.works[0].slots[0].id = "demo/work/alt-a";
    }, false],
    ["valid-choice", (p) => {
      addQuestion(p);
      p.works[0].slots = [{
        ...p.works[0].slots[0],
        id: "demo/work/alt-a",
        selection: "choice",
        candidates: ["demo/exr-a", "demo/exr-b"],
      }];
    }, true],
    ["choice-optional", (p) => {
      addQuestion(p);
      p.works[0].slots = [{
        ...p.works[0].slots[0],
        id: "demo/work/alt-a",
        selection: "choice",
        candidates: ["demo/exr-a", "demo/exr-b"],
        assignment: { requirement: "optional", workMode: "individual" },
      }];
    }, false],
    ["test-open", (p) => p.works[0].kind = "test", false],
    ["practical-open", (p) => p.works[0].kind = "practical", false],
    ["test-restricted", (p) => {
      p.works[0].kind = "test";
      p.questions[0].statementVisibility = "restricted";
    }, true],
    [
      "demonstration-missing",
      (p) => p.works[0].slots[0].assignment.stage = "demonstration",
      false,
    ],
    ["demonstration-valid", (p) => {
      p.works[0].slots[0].assignment.stage = "demonstration";
      p.questions[0].purpose = "demonstration";
      p.questions[0].hasPublicSolution = true;
    }, true],
    ["demonstration-hidden", (p) => {
      p.works[0].slots[0].assignment.stage = "demonstration";
      p.questions[0].purpose = "demonstration";
      p.questions[0].hasPublicSolution = true;
      p.questions[0].statementVisibility = "restricted";
    }, false],
    ["time-positive", (p) => p.questions[0].time = 1.5, true],
    ["time-zero", (p) => p.questions[0].time = 0, false],
    ["theory-zero", (p) => p.works[0].theoryTime = 0, false],
    [
      "assignment-invalid",
      (p) => p.works[0].slots[0].assignment.workMode = "nobody",
      false,
    ],
    ["closed-key-missing", (p) => delete p.questions[0].closedKey, false],
    ["choice-foreign-owner", (p) => {
      addQuestion(p);
      p.works[0].slots = [{
        ...p.works[0].slots[0],
        id: "other/work/alt-a",
        selection: "choice",
        candidates: ["demo/exr-a", "demo/exr-b"],
      }];
    }, false],
    ["empty-api", (p) => p.apiVersion = [], false],
    ["negative-api", (p) => p.apiVersion = [-1], false],
  );
  for (const [name, mutate, valid] of cases) {
    const data = structuredClone(base);
    mutate(data);
    let accepted = true, error: unknown;
    const original = Deno.Command;
    (Deno as any).Command = class {
      constructor() {
        throw Error("Проверка пакета не должна запускать процесс");
      }
    };
    try {
      await assertBodyPackage(data as any, root);
    } catch (e) {
      accepted = false;
      error = e;
    } finally {
      (Deno as any).Command = original;
    }
    if (accepted !== valid) {
      throw Error(name + " accepted=" + accepted + " " + error);
    }
    console.log("PASS " + name);
  }
} finally {
  await Deno.remove(root, { recursive: true });
}
