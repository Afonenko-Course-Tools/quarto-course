import { buildPackage, publicQuestion } from "./package.ts";
import { exportPl } from "./pl.ts";
import { validatePackage } from "./transport.ts";
const assert = (x: unknown, m = "assertion failed") => {
  if (!x) throw Error(m);
};
async function rejects(f: () => unknown, code: string) {
  try {
    await f();
  } catch (e) {
    assert(String(e).includes(code), String(e));
    return;
  }
  throw Error("expected " + code);
}
async function sources(contents: string[], f: (urls: URL[]) => Promise<void>) {
  const dir = await Deno.makeTempDir();
  try {
    const urls = [];
    for (const [i, s] of contents.entries()) {
      const path = dir + "/" + i + ".qmd";
      await Deno.writeTextFile(path, s);
      urls.push(new URL("file://" + path));
    }
    await f(urls);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}
const q = "::: {#exr-shared}\nPublic condition.\n:::\n";
const work = (id: string, title: string, body = "1. @exr-shared") =>
  `---\nassessment:\n  kind: lab\n---\n\n# ${title} {#${id}}\n\n[Not membership](#exr-other)\n\n::: {.assessment-items}\n${body}\n:::\n`;
Deno.test("review: accepted one-work-per-QMD metadata sec-ID and citation list share canonical questions", async () => {
  await sources(
    [work("sec-work-one", "First work") + "\n" + q],
    async (urls) => {
      const p = await buildPackage(urls[0], "course-a");
      assert(p.works.length === 1, "accepted assessment was silently lost");
    },
  );
  await sources([
    q,
    work("sec-work-one", "First work"),
    work("sec-work-two", "Second work"),
  ], async (urls) => {
    const p = await buildPackage(urls as any, "course-a");
    assert(p.works.length === 2);
    assert(p.works[0].key === "course-a/sec-work-one");
    assert(p.works[0].title === "First work");
    assert(p.works[1].items[0] === p.works[0].items[0]);
    assert(p.works[0].items.length === 1);
    assert(p.questions.length === 1);
  });
});
Deno.test("review: no automatic work ID, missing/duplicate list or legacy assessment container acceptance", async () => {
  for (
    const body of [
      work("sec-work-one", "First work").replace(" {#sec-work-one}", ""),
      work("sec-work-one", "First work") +
      "\n::: {.assessment-items}\n1. @exr-shared\n:::\n",
      work("sec-work-one", "First work").replace(".assessment-items", ".other"),
      "::: {#assessment-one}\n- [x](#exr-shared)\n:::\n",
    ]
  ) {
    await sources([body + "\n" + q], async (urls) => {
      await rejects(() => buildPackage(urls[0], "course-a"), "PACKAGE_INVALID");
    });
  }
});
Deno.test("review: nested and sibling solutions are private and nested notes never enter public condition", async () => {
  for (const nested of [true, false]) {
    const solution =
      "::: {#sol-shared}\nTEACHER_SECRET\n\n::: {.grading-notes}\nGRADING_SECRET\n:::\n:::\n";
    const source = nested
      ? "::: {#exr-shared}\nPublic.\n\n::: {.wrapper}\n" + solution +
        ":::\n:::\n"
      : q + solution;
    await sources([source], async (urls) => {
      const p = await buildPackage(urls[0], "course-a");
      const question = p.questions[0];
      assert(JSON.stringify(question.solution).includes("TEACHER_SECRET"));
      assert(JSON.stringify(question.gradingNotes).includes("GRADING_SECRET"));
      const pub = JSON.stringify(publicQuestion(question));
      assert(!pub.includes("SECRET") && !pub.includes("sol-shared"));
    });
  }
  await sources([
    '::: {#exr-shared}\nPublic.\n\n::: {.content-visible when-profile="full"}\nFULL_SECRET\n:::\n:::\n',
  ], async (urls) => {
    await rejects(() => buildPackage(urls[0], "course-a"), "PACKAGE_INVALID");
  });
  await sources([q + "::: {#sol-other}\nWrong owner\n:::\n"], async (urls) => {
    await rejects(() => buildPackage(urls[0], "course-a"), "PACKAGE_INVALID");
  });
});
const spec =
  "```{.yaml .answer-spec}\ntype: numeric\nkey: {value: 2, tolerance: {absolute: 0}}\n```\n";
const choice =
  '::: {.answer type="single-choice"}\n- A\n- [B]{.correct}\n:::\n';
Deno.test("review: CUE rejects duplicate answer occurrences before numeric/choice banks can overwrite", async () => {
  for (const pair of [[spec, spec], [choice, spec], [choice, choice]]) {
    await sources([
      "::: {#exr-shared}\nPublic.\n\n" + pair.join("\n") + ":::\n",
    ], async (urls) => {
      await rejects(
        () => buildPackage(urls[0], "course-a"),
        "ANSWER_DECLARATIONS",
      );
    });
  }
  await sources([
    "::: {#exr-shared}\nPublic.\n\n::: {.wrapper}\n" + spec + ":::\n:::\n",
  ], async (urls) => {
    const p = await buildPackage(urls[0], "course-a");
    assert(p.questions[0].answerType === "numeric");
    assert(
      !JSON.stringify(publicQuestion(p.questions[0])).includes("answer-spec"),
    );
  });
});
const sample = () =>
  buildPackage(
    ["corpus.qmd", "work-one.qmd", "work-two.qmd"].map((name) =>
      new URL("./fixtures/" + name, import.meta.url)
    ),
    "course-a",
  );
async function extra(p: any, target: string) {
  const bytes = new TextEncoder().encode("UNSELECTED_PUBLIC_RESOURCE");
  p.resources.push({
    ...p.resources[0],
    target,
    source: "unselected",
    data: btoa(new TextDecoder().decode(bytes)),
    sha256: Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ).map((x) => x.toString(16).padStart(2, "0")).join(""),
  });
}
Deno.test("review: PL copies only exact native targets and ignores incidental prose resource names", async () => {
  const p = await sample();
  await extra(p, "resources/course-a/data");
  await extra(p, "resources/course-a/prose.txt");
  p.questions[0].condition.push({
    t: "Para",
    c: [{ t: "Str", c: "resources/course-a/prose.txt" }],
  });
  const files = await exportPl(p, {
    courseInstance: "p0",
    assessmentSet: "Practice",
    topic: "P0",
    points: 2,
  });
  assert(Object.keys(files).some((k) => k.endsWith("/data.txt")));
  assert(
    !Object.keys(files).some((k) =>
      k.endsWith("/data") || k.endsWith("/prose.txt")
    ),
  );
});
Deno.test("review: transport rejects noncanonical relative resource destinations before writes", async () => {
  for (
    const target of [
      "resources/course-a/./data.txt",
      "resources/course-a/a/../data.txt",
      "resources//course-a/data.txt",
      "resources/course-a/data.txt/",
    ]
  ) {
    const p = await sample();
    p.resources.push({ ...p.resources[0], target });
    await rejects(() => validatePackage(p), "ADAPTER");
  }
});
