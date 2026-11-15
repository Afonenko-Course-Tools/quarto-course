import { fixtureArray, fixtureAt, fixtureRecord, fixtureSet, required } from "./helpers/required.ts";
import { BodyPackageSchema } from "../_extensions/course-core/body-export/package-contracts.ts";
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
  works: [
    {
      owner: "demo",
      id: "work",
      key: "demo/work",
      source: "work.qmd",
      kind: "lab",
      title: "Work",
      slots: [
        {
          id: "demo/work/exr-a",
          selection: "fixed",
          candidates: ["demo/exr-a"],
          assignment: { requirement: "required", workMode: "individual" },
        },
      ],
    },
  ],
  resources: [
    {
      owner: "demo",
      source: "bank.qmd",
      effectiveBase: root,
      target: "figure.svg",
      data: btoa("<svg/>"),
      visibility: "public",
    },
  ],
};
try {
  const native = BodyPackageSchema.parse(base);
  required(native.questions[0]).condition = [
    {
      t: "Table",
      c: [
        ["table", [], []],
        [null, []],
        [[{ t: "AlignDefault" }, { t: "ColWidthDefault" }]],
        [["", [], []], []],
        [[["", [], []], 0, [], []]],
        [["", [], []], []],
      ],
      nativeExtension: { opaque: [1, { x: true }] },
    },
    {
      t: "Figure",
      c: [
        ["figure", [], []],
        [null, []],
        [
          {
            t: "Para",
            c: [{ t: "Image", c: [["", [], []], [], ["figure.svg", ""]] }],
          },
        ],
      ],
    },
    { t: "HorizontalRule" },
  ];
  const decoded = BodyPackageSchema.parse(native);
  if (
    JSON.stringify(required(decoded.questions[0]).condition) !== JSON.stringify(required(native.questions[0]).condition)
  )
    throw Error("Native body payload changed");
  const cases: [string, (p: unknown) => void, boolean][] = [
    ["valid", () => {}, true],
    ["body-scalar", (p) => fixtureSet(p, ["questions", 0, "condition"], [42]), false],
    ["body-array", (p) => fixtureSet(p, ["questions", 0, "condition"], [[]]), false],
    ["body-missing-tag", (p) => fixtureSet(p, ["questions", 0, "condition"], [{ c: [] }]), false],
    ["body-nonstring-tag", (p) => fixtureSet(p, ["questions", 0, "condition"], [{ t: 42 }]), false],
    ["body-v1", (p) => fixtureSet(p, ["schema"], "course-body-package-v1"), false],
    ["root-unknown", (p) => fixtureSet(p, ["extra"], true), false],
    ["work-items", (p) => fixtureSet(p, ["works", 0, "items"], ["demo/exr-a"]), false],
    ["work-assignments", (p) => fixtureSet(p, ["works", 0, "assignments"], {}), false],
    ["question-unknown", (p) => fixtureSet(p, ["questions", 0, "extra"], true), false],
    ["slot-items", (p) => fixtureSet(p, ["works", 0, "slots", 0, "items"], []), false],
    ["assignment-unknown", (p) => fixtureSet(p, ["works", 0, "slots", 0, "assignment", "unknown"], true), false],
    ["foreign-owner", (p) => fixtureSet(p, ["works", 0, "slots", 0, "id"], "other/work/exr-a"), false],
    ["foreign-work", (p) => fixtureSet(p, ["works", 0, "slots", 0, "id"], "demo/other/exr-a"), false],
    ["fixed-alt-id", (p) => fixtureSet(p, ["works", 0, "slots", 0, "id"], "demo/work/alt-a"), false],
    ["fixed-wrong-id", (p) => fixtureSet(p, ["works", 0, "slots", 0, "id"], "demo/work/exr-b"), false],
    [
      "random-exr-id",
      (p) => {
        fixtureArray(fixtureAt(p, ["questions"])).push(question("exr-b"));
        fixtureSet(p, ["works", 0, "slots", 0, "selection"], "random");
        fixtureArray(fixtureAt(p, ["works", 0, "slots", 0, "candidates"])).push("demo/exr-b");
      },
      false,
    ],
    [
      "valid-random",
      (p) => {
        fixtureArray(fixtureAt(p, ["questions"])).push(question("exr-b"));
        fixtureSet(p, ["works", 0, "slots", 0, "selection"], "random");
        fixtureSet(p, ["works", 0, "slots", 0, "id"], "demo/work/alt-choice");
        fixtureArray(fixtureAt(p, ["works", 0, "slots", 0, "candidates"])).push("demo/exr-b");
      },
      true,
    ],
  ];
  const addQuestion = (p: unknown) => {
    fixtureArray(fixtureAt(p, ["questions"])).push(question("exr-b"));
    fixtureArray(fixtureAt(p, ["works", 0, "slots"])).push({
      ...fixtureRecord(structuredClone(fixtureAt(p, ["works", 0, "slots", 0]))),
      id: "demo/work/exr-b",
      candidates: ["demo/exr-b"],
    });
  };
  cases.push(
    ["question-owner", (p) => fixtureSet(p, ["questions", 0, "owner"], "other"), false],
    ["question-key", (p) => fixtureSet(p, ["questions", 0, "key"], "demo/exr-b"), false],
    ["work-owner", (p) => fixtureSet(p, ["works", 0, "owner"], "other"), false],
    ["work-key", (p) => fixtureSet(p, ["works", 0, "key"], "demo/other"), false],
    [
      "duplicate-question",
      (p) => fixtureArray(fixtureAt(p, ["questions"])).push(structuredClone(fixtureAt(p, ["questions", 0]))),
      false,
    ],
    [
      "duplicate-work",
      (p) => fixtureArray(fixtureAt(p, ["works"])).push(structuredClone(fixtureAt(p, ["works", 0]))),
      false,
    ],
    [
      "duplicate-slot",
      (p) =>
        fixtureArray(fixtureAt(p, ["works", 0, "slots"])).push(structuredClone(fixtureAt(p, ["works", 0, "slots", 0]))),
      false,
    ],
    [
      "duplicate-member",
      (p) => {
        fixtureArray(fixtureAt(p, ["works", 0, "slots"])).push({
          ...fixtureRecord(structuredClone(fixtureAt(p, ["works", 0, "slots", 0]))),
          id: "demo/work/alt-b",
          selection: "random",
          candidates: ["demo/exr-a", "demo/exr-a"],
        });
      },
      false,
    ],
    ["unused-question", (p) => fixtureArray(fixtureAt(p, ["questions"])).push(question("exr-b")), false],
    ["unknown-reference", (p) => fixtureSet(p, ["works", 0, "slots", 0, "candidates"], ["demo/exr-unknown"]), false],
    ["fixed-empty", (p) => fixtureSet(p, ["works", 0, "slots", 0, "candidates"], []), false],
    [
      "random-single",
      (p) => {
        fixtureSet(p, ["works", 0, "slots", 0, "selection"], "random");
        fixtureSet(p, ["works", 0, "slots", 0, "id"], "demo/work/alt-a");
      },
      false,
    ],
    [
      "valid-choice",
      (p) => {
        addQuestion(p);
        fixtureSet(
          p,
          ["works", 0, "slots"],
          [
            {
              ...fixtureRecord(fixtureAt(p, ["works", 0, "slots", 0])),
              id: "demo/work/alt-a",
              selection: "choice",
              candidates: ["demo/exr-a", "demo/exr-b"],
            },
          ],
        );
      },
      true,
    ],
    [
      "choice-optional",
      (p) => {
        addQuestion(p);
        fixtureSet(
          p,
          ["works", 0, "slots"],
          [
            {
              ...fixtureRecord(fixtureAt(p, ["works", 0, "slots", 0])),
              id: "demo/work/alt-a",
              selection: "choice",
              candidates: ["demo/exr-a", "demo/exr-b"],
              assignment: { requirement: "optional", workMode: "individual" },
            },
          ],
        );
      },
      false,
    ],
    ["test-open", (p) => fixtureSet(p, ["works", 0, "kind"], "test"), false],
    ["practical-open", (p) => fixtureSet(p, ["works", 0, "kind"], "practical"), false],
    [
      "test-restricted",
      (p) => {
        fixtureSet(p, ["works", 0, "kind"], "test");
        fixtureSet(p, ["questions", 0, "statementVisibility"], "restricted");
      },
      true,
    ],
    [
      "demonstration-missing",
      (p) => fixtureSet(p, ["works", 0, "slots", 0, "assignment", "stage"], "demonstration"),
      false,
    ],
    [
      "demonstration-valid",
      (p) => {
        fixtureSet(p, ["works", 0, "slots", 0, "assignment", "stage"], "demonstration");
        fixtureSet(p, ["questions", 0, "purpose"], "demonstration");
        fixtureSet(p, ["questions", 0, "hasPublicSolution"], true);
      },
      true,
    ],
    [
      "demonstration-hidden",
      (p) => {
        fixtureSet(p, ["works", 0, "slots", 0, "assignment", "stage"], "demonstration");
        fixtureSet(p, ["questions", 0, "purpose"], "demonstration");
        fixtureSet(p, ["questions", 0, "hasPublicSolution"], true);
        fixtureSet(p, ["questions", 0, "statementVisibility"], "restricted");
      },
      false,
    ],
    ["time-positive", (p) => fixtureSet(p, ["questions", 0, "time"], 1.5), true],
    ["time-zero", (p) => fixtureSet(p, ["questions", 0, "time"], 0), false],
    ["theory-zero", (p) => fixtureSet(p, ["works", 0, "theoryTime"], 0), false],
    ["assignment-invalid", (p) => fixtureSet(p, ["works", 0, "slots", 0, "assignment", "workMode"], "nobody"), false],
    ["closed-key-missing", (p) => delete fixtureRecord(fixtureAt(p, ["questions", 0]))["closedKey"], false],
    [
      "choice-foreign-owner",
      (p) => {
        addQuestion(p);
        fixtureSet(
          p,
          ["works", 0, "slots"],
          [
            {
              ...fixtureRecord(fixtureAt(p, ["works", 0, "slots", 0])),
              id: "other/work/alt-a",
              selection: "choice",
              candidates: ["demo/exr-a", "demo/exr-b"],
            },
          ],
        );
      },
      false,
    ],
    ["empty-api", (p) => fixtureSet(p, ["apiVersion"], []), false],
    ["negative-api", (p) => fixtureSet(p, ["apiVersion"], [-1]), false],
  );
  for (const [name, mutate, valid] of cases) {
    const data: unknown = structuredClone(base);
    mutate(data);
    let accepted = true,
      error: unknown;
    const original = required(Object.getOwnPropertyDescriptor(Deno, "Command"));
    Object.defineProperty(Deno, "Command", {
      configurable: original.configurable ?? false,
      enumerable: original.enumerable ?? false,
      writable: true,
      value: class {
        constructor() {
          throw Error("Проверка пакета не должна запускать процесс");
        }
      },
    });
    try {
      await assertBodyPackage(data, root);
    } catch (e) {
      accepted = false;
      error = e;
    } finally {
      Object.defineProperty(Deno, "Command", original);
    }
    if (accepted !== valid) {
      throw Error(name + " accepted=" + accepted + " " + error);
    }
    console.log("PASS " + name);
  }
} finally {
  await Deno.remove(root, { recursive: true });
}
