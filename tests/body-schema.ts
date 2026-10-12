const schema = Deno.args[0] ||
  new URL("../_extensions/course-core/body-export/package.cue", import.meta.url)
    .pathname;
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
const base = {
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
  for (const [name, mutate, valid] of cases) {
    const data = structuredClone(base);
    mutate(data);
    const file = root + "/" + name + ".json";
    await Deno.writeTextFile(file, JSON.stringify({ packageData: data }));
    const result = await new Deno.Command(Deno.env.get("CUE") || "cue", {
      args: ["vet", file, schema, "-c"],
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (result.success !== valid) {
      throw Error(
        name + " accepted=" + result.success + " " +
          new TextDecoder().decode(result.stderr),
      );
    }
    console.log("PASS " + name);
  }
} finally {
  await Deno.remove(root, { recursive: true });
}
