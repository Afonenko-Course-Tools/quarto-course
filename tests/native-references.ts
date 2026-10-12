import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { collectExport } from "../_extensions/course-core/body-export/collect.ts";
import {
  assertReferenceTargets,
  resolveReferences,
} from "../_extensions/course-core/body-export/references.ts";
import { buildBodies } from "../_extensions/course-core/body-export/producer.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url))),
  root = await Deno.makeTempDir({ prefix: "native-references-" });
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const walk = (v: any, f: (n: any) => void) => {
  if (Array.isArray(v)) { for (const n of v) walk(n, f); }
  else if (v && typeof v === "object") {
    f(v);
    for (const n of Object.values(v)) walk(n, f);
  }
};
try {
  await copy(
    join(repo, "_extensions/course-core"),
    join(root, "_extensions/course-core"),
  );
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    'project:\n  type: book\n  output-dir: _site\n  pre-render: _extensions/course-core/entrypoints/pre.ts\n  post-render: _extensions/course-core/entrypoints/post.ts\nbook:\n  title: References\n  chapters: [index.qmd, nested/questions.qmd]\nformat: html\nfilters: [course-core]\ncourse: {id: references-demo}\nbibliography: refs.bib\ncsl: styles/numeric.csl\nlink-citations: true\nnocite: "@uncited"\nabstract: "Private metadata [@private]"\n',
  );
  await Deno.writeTextFile(
    join(root, "refs.bib"),
    "@book{public, author={Doe, Jane}, title={PUBLIC_ATTRIBUTION}, year={2024}, url={https://example.org/public}}\n@book{private, author={Private, Author}, title={PRIVATE_ATTRIBUTION}, year={2023}}\n@book{other, title={UNSELECTED_ATTRIBUTION}, year={2022}}\n@book{uncited, title={NOCITE_ATTRIBUTION}, year={2021}}\n@book{answer, title={ANSWER_ATTRIBUTION}, year={2020}}\n",
  );
  await Deno.mkdir(join(root, "nested"));
  await Deno.mkdir(join(root, "styles"));
  await Deno.writeTextFile(
    join(root, "styles/numeric.csl"),
    '<style xmlns="http://purl.org/net/xbiblio/csl" version="1.0" class="in-text"><info><title>Fixture numeric</title><id>https://example.org/fixture-numeric</id><updated>2026-10-12T00:00:00Z</updated></info><citation><layout prefix="[" suffix="]"><text variable="citation-number"/></layout></citation><bibliography><layout><text variable="title"/><text variable="URL" prefix=" "/></layout></bibliography></style>',
  );
  await Deno.writeTextFile(join(root, "index.qmd"), "# Introduction");
  await Deno.writeTextFile(
    join(root, "nested/questions.qmd"),
    "---\nexercise-bank: true\nexercise-statement-visibility: open\nassessment: {kind: lab, id: selected}\n---\n# References\n\n::: {#exr-one difficulty=introductory time=1}\nPublic attribution [@public].\n\nSee @sec-local.\n\n### Local section {#sec-local}\n\n::: {.grading-notes}\nSecret [@private].\n:::\n\n::: {.solution}\nSecret solution [@private].\n:::\n:::\n\n::: {#exr-other difficulty=introductory time=1}\nUnselected [@other].\n:::\n\n::: {.task-items stage=homework}\n1. @exr-one\n:::\n",
  );
  const selected = await collectExport(root, { book: ".", work: "selected" });

  const { package: p, publicPackage: pub } = await buildBodies(
    selected.result,
    {
      projectRoot: root,
      courseId: "references-demo",
      work: "selected",
      includeClosed: true,
    },
  );
  assert(
    p.questions.length === 1 &&
      p.questions[0].source === "nested/questions.qmd",
    "selected inventory changed",
  );
  const text = JSON.stringify(pub);
  assert(
    text.includes("PUBLIC_ATTRIBUTION") &&
      text.includes("https://example.org/public"),
    "native standalone attribution missing",
  );
  assert(
    !/PRIVATE_ATTRIBUTION|UNSELECTED_ATTRIBUTION|NOCITE_ATTRIBUTION|"Cite"/
      .test(text),
    "public references leak private/unselected/nocite citations or retain Cite",
  );
  const ids = new Set<string>(), targets: string[] = [];
  walk(pub.questions[0].condition, (n) => {
    if (n.t === "Cite") throw Error("unresolved Cite");
    const a = n.t === "Header"
      ? n.c[1]
      : ["Div", "Span", "Table", "Figure", "Link", "Image"].includes(n.t)
      ? n.c[0]
      : undefined;
    if (a?.[0]) ids.add(a[0]);
    if (n.t === "Link" && n.c[2][0].startsWith("#")) {
      targets.push(n.c[2][0].slice(1));
    }
  });
  assert(
    targets.includes("ref-public") && targets.includes("sec-local"),
    "native bibliography/crossref links missing",
  );
  assert(
    targets.every((id) => ids.has(id)),
    "standalone question contains dangling anchors",
  );
  const sourceDoc = selected.result.documents.find((d) => d.exercises.length)!;
  const answerCitation = {
    t: "Para",
    c: [{
      t: "Cite",
      c: [[{
        citationId: "answer",
        citationPrefix: [],
        citationSuffix: [],
        citationMode: { t: "NormalCitation" },
        citationNoteNum: 0,
        citationHash: 0,
      }], [{ t: "Str", c: "[@answer]" }]],
    }],
  };
  sourceDoc.body!.publicAnswers = {
    "exr-one": {
      answerType: "manual",
      publicAnswerJson: JSON.stringify({
        "pandoc-api-version": p.apiVersion,
        meta: {},
        blocks: [answerCitation],
      }),
    },
  };
  const together = await buildBodies(selected.result, {
    projectRoot: root,
    courseId: "references-demo",
    work: "selected",
  });
  assert(
    JSON.stringify(together.publicPackage.questions[0].publicAnswer).includes(
      '"c":"2"',
    ),
    "condition and answer citations must share native numbering",
  );
  assert(
    JSON.stringify(together.publicPackage.questions[0].condition).includes(
      "ANSWER_ATTRIBUTION",
    ),
    "standalone question must carry one shared bibliography",
  );
  let missing = false;
  try {
    assertReferenceTargets([{
      t: "Para",
      c: [{
        t: "Link",
        c: [["", [], []], [{ t: "Str", c: "Outside" }], ["#sec-outside", ""]],
      }],
    }], { source: "nested/questions.qmd", id: "exr-one" });
  } catch (e) {
    missing = String(e).includes("BODY.REFERENCE_TARGET_MISSING");
  }
  assert(missing, "dangling standalone reference accepted");
  const doc = JSON.parse(
    selected.result.documents.find((d) => d.exercises.length)!.exercises[0]
      .bodyJson,
  );
  let unknown = false;
  try {
    await resolveReferences(
      [{
        t: "Para",
        c: [{
          t: "Cite",
          c: [[{
            citationId: "unknown-source",
            citationPrefix: [],
            citationSuffix: [],
            citationMode: { t: "NormalCitation" },
            citationNoteNum: 0,
            citationHash: 0,
          }], [{ t: "Str", c: "[@unknown-source]" }]],
        }],
      }],
      doc,
      root,
      { source: "nested/questions.qmd", id: "exr-one" },
    );
  } catch (e) {
    unknown = String(e).includes("BODY.CITATION_UNRESOLVED");
  }
  assert(unknown, "native warning-only unknown citation accepted");
  assert(
    text.includes('"c":"1"') && !text.includes("Doe"),
    "nested document custom numeric CSL was ignored",
  );
  console.log(
    "PASS native selected citations, standalone bibliography and crossref, private/unselected/nocite isolation",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
