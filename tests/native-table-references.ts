import { join } from "stdlib/path";
import { buildBodies } from "../_extensions/course-core/body-export/producer.ts";
const root = await Deno.makeTempDir({ prefix: "native-table-references-" });
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
try {
  const input = join(root, "table.md");
  await Deno.writeTextFile(input, "| Head |\n|---|\n| Cell |\n");
  const native = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
    args: ["pandoc", input, "--from=markdown", "--to=json"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(native.success, "native Pandoc Table failed");
  const ast = JSON.parse(new TextDecoder().decode(native.stdout)),
    table = ast.blocks[0];
  assert(table.t === "Table", "fixture must use real Pandoc Table");
  const c = table.c,
    headRow = c[3][1][0],
    bodyRow = c[4][0][3][0],
    footRow = structuredClone(bodyRow);
  c[5][1] = [footRow];
  const intermediateRow = structuredClone(headRow);
  c[4][0][2] = [intermediateRow];
  const attrs = [
    c[0],
    c[3][0],
    c[4][0][0],
    c[5][0],
    headRow[0],
    headRow[1][0][0],
    bodyRow[0],
    bodyRow[1][0][0],
    footRow[0],
    footRow[1][0][0],
    intermediateRow[0],
    intermediateRow[1][0][0],
  ];
  const ids = [
    "table-root",
    "table-head",
    "table-body",
    "table-foot",
    "head-row",
    "head-cell",
    "body-row",
    "cell-target",
    "foot-row",
    "foot-cell",
    "intermediate-row",
    "intermediate-cell",
  ];
  attrs.forEach((a: any, i: number) => a[0] = ids[i]);
  const links = {
    t: "Para",
    c: ids.flatMap(
      (id) => [{
        t: "Link",
        c: [["", [], []], [{ t: "Str", c: id }], ["#" + id, ""]],
      }, { t: "Space" }],
    ),
  };
  ast.blocks.push(links);
  const exercise: any = {
    id: "exr-table",
    purpose: "independent-study",
    difficulty: "introductory",
    time: 1,
    statementVisibility: "open",
    hasSolution: false,
    hasPublicSolution: false,
    bodyJson: JSON.stringify(ast),
  };
  const work: any = {
    id: "table-work",
    kind: "lab",
    title: "Table",
    slots: [{
      id: "exr-table",
      selection: "fixed",
      candidates: ["exr-table"],
      assignment: { requirement: "required", workMode: "individual" },
    }],
  };
  const doc: any = {
    scope: "document",
    source: "index.qmd",
    course: { id: "table-demo", view: "full" },
    document: {
      source: "index.qmd",
      output: "index.html",
      format: "html",
      profiles: ["full"],
    },
    exercises: [exercise],
    assessment: work,
    body: {
      publicExercises: [structuredClone(exercise)],
      publicAssessment: work,
    },
  };
  const good = await buildBodies(doc, {
    projectRoot: root,
    courseId: "table-demo",
    work: "table-work",
  });
  assert(
    good.publicPackage.questions[0].condition.length === 2,
    "supported semantic Table links lost",
  );
  const bad = structuredClone(doc),
    duplicate = JSON.parse(bad.body.publicExercises[0].bodyJson);
  duplicate.blocks[0].c[4][0][3][0][1][0][0][0] = "table-root";
  bad.body.publicExercises[0].bodyJson = JSON.stringify(duplicate);
  let rejected = false;
  try {
    await buildBodies(bad, {
      projectRoot: root,
      courseId: "table-demo",
      work: "table-work",
    });
  } catch (e) {
    rejected = String(e).includes("BODY.REFERENCE_TARGET_DUPLICATE");
  }
  assert(rejected, "semantic Cell duplicate ID was accepted");
  console.log(
    "PASS real native Pandoc Table Head/Body/Foot Row/Cell link targets and duplicate ID rejection",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
