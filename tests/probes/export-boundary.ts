import {
  buildPackage,
  publicQuestion,
  validateAnswer,
} from "./export-boundary/package.ts";
const root = new URL("./export-boundary/", import.meta.url);
const corpus = () =>
  ["corpus.qmd", "work-one.qmd", "work-two.qmd"].map((name) =>
    new URL("fixtures/" + name, root)
  );
const assert = (x: unknown, m = "assertion failed") => {
  if (!x) throw new Error(m);
};
async function rejects(fn: () => unknown, code: string) {
  try {
    await fn();
  } catch (e) {
    assert(String(e).includes(code), String(e));
    return;
  }
  throw new Error(`expected ${code}`);
}
Deno.test("package retains native bodies, separates closed content, deduplicates fixed works and survives move", async () => {
  const a = await buildPackage(
    corpus(),
    "course-a",
  );
  const moved = await Deno.makeTempDir();
  let b;
  try {
    for (
      const name of [
        "corpus.qmd",
        "work-one.qmd",
        "work-two.qmd",
        "data.txt",
        "dot.png",
      ]
    ) {
      await Deno.copyFile(
        new URL("fixtures/" + name, root),
        moved + "/" + (name === "corpus.qmd" ? "chapter.qmd" : name),
      );
    }
    b = await buildPackage(
      ["chapter.qmd", "work-one.qmd", "work-two.qmd"].map((name) =>
        new URL("file://" + moved + "/" + name)
      ),
      "course-a",
      "moved/chapter.qmd",
    );
  } finally {
    await Deno.remove(moved, { recursive: true });
  }
  assert(a.questions.length === 2);
  assert(a.works.length === 2);
  assert(a.works.map((w) => w.key).join() === b.works.map((w) => w.key).join());
  assert(a.works[0].items[0] === a.works[1].items[0]);
  assert(
    a.questions.map((q) => q.key).join() ===
      b.questions.map((q) => q.key).join(),
  );
  const pub = JSON.stringify(a.questions.map(publicQuestion));
  for (
    const secret of [
      "TEACHER_SECRET",
      "GRADING_SECRET",
      "correct",
      "closedKey",
      "answer-spec",
    ]
  ) assert(!pub.includes(secret), secret);
  assert(pub.includes("TLS") && pub.includes("{{literal}}"));
  assert(
    JSON.stringify(a) ===
      JSON.stringify(
        await buildPackage(corpus(), "course-a"),
      ),
  );
  await Deno.writeTextFile(
    new URL("fixtures/package.json", root),
    JSON.stringify(a, null, 2) + "\n",
  );
});
Deno.test("mature YAML/CUE validates and projects numeric multipart matching without keys", async () => {
  for (
    const source of [
      "type: numeric\nkey: {value: 12.5, tolerance: {absolute: 0.1}}",
      "type: multipart\nparts:\n - {name: cost, label: Cost, type: numeric, key: {value: 12.5, tolerance: {absolute: 0.1}}}\n - {name: why, label: Why, type: manual, submission: text}",
      "type: matching\nprompts: [Process, Thread]\noptions: [Own, Shared, Distractor]\nkey: {pairs: {Process: Own, Thread: Shared}}",
    ]
  ) {
    const a = await validateAnswer(source);
    assert(a.publicAnswer.length > 0);
    assert(!JSON.stringify(a.publicAnswer).includes("12.5"));
    assert(!JSON.stringify(a.publicAnswer).includes("pairs"));
  }
  await rejects(
    () => validateAnswer("type: numeric\ntype: manual"),
    "ANSWER_YAML",
  );
  await rejects(
    () => validateAnswer("type: numeric\nkey: {value: nope}"),
    "ANSWER_INVALID",
  );
  await rejects(
    () =>
      validateAnswer(
        "type: matching\nprompts: [A, A]\noptions: [B]\nkey: {pairs: {A: B}}",
      ),
    "ANSWER_INVALID",
  );
  await rejects(
    () => validateAnswer("type: numeric\nkey: !custom 2"),
    "ANSWER_YAML",
  );
  await rejects(
    () => validateAnswer("type: multipart\nparts: &x [*x]"),
    "ANSWER_YAML",
  );
});

Deno.test("PL contract proof uses native elements stable UUIDs and fixed work reuse, neutralizes literal Mustache", async () => {
  const { exportPl } = await import("./export-boundary/pl.ts");
  const p = await buildPackage(
    corpus(),
    "course-a",
  );
  const a = await exportPl(p, {
    courseInstance: "p0",
    assessmentSet: "Practice",
    topic: "P0",
    points: 2,
  });
  const b = await exportPl(
    await buildPackage(
      corpus(),
      "course-a",
      "moved.qmd",
    ),
    { courseInstance: "p0", assessmentSet: "Practice", topic: "P0", points: 2 },
  );
  const infos = Object.keys(a).filter((k) => k.endsWith("/info.json"));
  assert(infos.length === 2);
  for (const key of infos) assert(a[key] === b[key]);
  const html = Object.entries(a).filter(([k]) => k.endsWith("question.html"))
    .map(([, v]) => v).join();
  assert(
    html.includes("pl-multiple-choice") && html.includes('order="fixed"') &&
      html.includes("pl-rich-text-editor"),
  );
  assert(html.includes("&#123;&#123;literal&#125;&#125;"));
  assert(!html.includes("TEACHER_SECRET"));
  assert(
    Object.keys(a).filter((k) => k.endsWith("infoAssessment.json")).length ===
      2,
  );
  const bad = structuredClone(p);
  bad.questions[0].answerType = "matching";
  await rejects(
    () =>
      exportPl(bad, {
        courseInstance: "p0",
        assessmentSet: "Practice",
        topic: "P0",
        points: 2,
      }),
    "ADAPTER",
  );
});
Deno.test("canonical declarations and fixed work membership are validated by CUE", async () => {
  const original = await Deno.readTextFile(
    new URL("fixtures/corpus.qmd", root),
  );
  const path = new URL("fixtures/invalid.qmd", root);
  try {
    await Deno.writeTextFile(
      path,
      original + "\n::: {#exr-manual}\nDuplicate\n:::\n",
    );
    await rejects(() => buildPackage(path, "course-a"), "PACKAGE_INVALID");
  } finally {
    await Deno.remove(path);
  }
});
Deno.test("native answer-spec extraction fails closed without module and retains every public bank option", async () => {
  const src = new URL("fixtures/answers.qmd", root);
  await rejects(
    () => buildPackage(src, "course-a", "answers.qmd", false),
    "ANSWER_MODULE_REQUIRED",
  );
  const p = await buildPackage(src, "course-a");
  assert(p.questions.length === 3);
  const pub = JSON.stringify(p.questions.map(publicQuestion));
  assert(
    pub.includes("Distractor") && pub.includes("Cost") &&
      pub.includes("Explanation"),
  );
  assert(!pub.includes("12.5") && !pub.includes("pairs"));
  await Deno.writeTextFile(
    new URL("fixtures/answers-package.json", root),
    JSON.stringify(p, null, 2) + "\n",
  );
});
Deno.test("public question projection rejects a closed condition before returning its body", async () => {
  const p = await buildPackage(
    corpus(),
    "course-a",
  );
  p.questions[0].visibility = "closed";
  await rejects(() => publicQuestion(p.questions[0]), "PACKAGE_PRIVATE");
});
