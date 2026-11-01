import { finalizeDocument } from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const extension = join(repo, "_extensions/course-core/native-ts");
const evidence = Deno.env.get("A1_CONDITIONAL_RESULTS");
const root = await Deno.makeTempDir({ prefix: "a1-review-fix-conditional-" });
const results: any[] = [];
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const solution = (attrs = "") =>
  `::: {.solution ${attrs}}\nCONDITIONAL_WITNESS_BODY\n:::\n`;
for (
  const [name, body, expectedVisible, standalone] of [
    ["unconditional", solution(), true],
    [
      "visible-wrapper",
      `::: {.content-visible when-format=html}\n${solution()}\n:::\n`,
      true,
    ],
    [
      "hidden-on-solution",
      solution(".content-visible when-format=latex"),
      false,
    ],
    [
      "visible-on-solution",
      solution(".content-visible when-format=html"),
      true,
    ],
    [
      "hidden-by-content-hidden",
      solution(".content-hidden when-format=html"),
      false,
    ],
    [
      "visible-by-content-hidden",
      solution(".content-hidden when-format=latex"),
      true,
    ],
    [
      "visible-named-solution",
      solution("#sol-demo .content-visible when-format=html"),
      true,
    ],
    [
      "visible-standalone-named",
      solution("#sol-demo .content-visible when-format=html"),
      true,
      true,
    ],
    [
      "hidden-standalone-named",
      solution("#sol-demo .content-visible when-format=latex"),
      false,
      true,
    ],
  ] as const
) {
  const dir = root + "/" + name;
  await Deno.mkdir(dir);
  await Deno.writeTextFile(
    dir + "/_quarto.yml",
    `project:\n  type: book\n  output-dir: _site\nbook:\n  title: Проверка\n  chapters: [index.qmd]\nformat:\n  html:\n    theme: none\ncourse-core-projection: student\nfilters:\n  - at: pre-ast\n    path: ${extension}/early-context.lua\n  - at: post-quarto\n    path: ${extension}/late-kind.lua\n  - at: post-render\n    path: ${extension}/late-filter.lua\n`,
  );
  await Deno.writeTextFile(
    dir + "/index.qmd",
    `# Проверка\n\n::: {#exr-demo difficulty=introductory statement-visibility=open course-role=demonstration}\nPUBLIC_CONDITION\n\n${
      standalone ? ":::\n" + body : body + "\n:::\n"
    }`,
  );
  const context = {
    operation: crypto.randomUUID(),
    input: dir + "/index.qmd",
    format: "html",
    projection: "student",
    exerciseBank: true,
  };
  const capture = dir + "/capture";
  await Deno.writeTextFile(
    dir + "/run.json",
    JSON.stringify({ context, capture }),
  );
  const p = await new Deno.Command("quarto", {
    args: ["render", "index.qmd", "--to", "html"],
    cwd: dir,
    env: {
      COURSE_CORE_TS_RUN: dir + "/run.json",
      QUARTO_RUN_NO_NETWORK: "true",
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const log = new TextDecoder().decode(p.stdout) +
    new TextDecoder().decode(p.stderr);
  await Deno.writeTextFile(dir + "/render.log", log);
  assert(p.success, name + ": native render failed");
  const early = JSON.parse(await Deno.readTextFile(capture + ".early.json")),
    late = JSON.parse(await Deno.readTextFile(capture + ".late.json")),
    final = finalizeDocument(early, late);
  const html = await Deno.readTextFile(dir + "/_site/index.html");
  const row = {
    name,
    expectedVisible,
    renderExit: p.code,
    status: final.status,
    htmlContainsSolution: html.includes("CONDITIONAL_WITNESS_BODY"),
    finalBodyContainsSolution: JSON.stringify(final).includes(
      "CONDITIONAL_WITNESS_BODY",
    ),
    hasPublicSolution: !!final.hasPublicSolution["exr-demo"],
    bodyContainsInternalMarkers: final.occurrences.some((row) =>
      /data-course-core-/.test(JSON.stringify(row.body))
    ),
    solutionBodyContainsPayload: final.occurrences.some((row) =>
      row.kind === "solution" &&
      JSON.stringify(row.body).includes("CONDITIONAL_WITNESS_BODY")
    ),
    solutionNativeKinds: final.occurrences.filter((row) =>
      row.kind === "solution"
    ).map((row) => row.nativeKind),
    earlySolutionKeys: early.occurrences.filter((r: any) =>
      r.kind === "solution"
    ).map((r: any) => r.key),
    lateOccurrenceKeys: late.occurrences.map((r: any) => r.key),
    finalSolutionOccurrences: final.occurrences.filter((r) =>
      r.kind === "solution"
    ).length,
  };
  assert(
    row.htmlContainsSolution === expectedVisible,
    name + ": native condition does not match control",
  );
  results.push(row);
  if (evidence) {
    await Deno.writeTextFile(
      evidence,
      JSON.stringify({ root, results }, null, 2) + "\n",
    );
  }
}
for (const row of results) {
  assert(row.status === "complete", row.name + ": required body lost");
  assert(
    !row.bodyContainsInternalMarkers,
    row.name + ": внутренняя метка осталась в позднем теле",
  );
  assert(
    row.solutionBodyContainsPayload === row.expectedVisible,
    row.name + ": позднее solution body не соответствует native body",
  );
  assert(
    row.solutionNativeKinds.every((kind: string) => kind === "Proof"),
    row.name + ": потерян native Proof kind",
  );
  assert(
    row.finalSolutionOccurrences === (row.expectedVisible ? 1 : 0),
    row.name + ": late solution occurrence потерян или выдуман",
  );
  assert(
    row.hasPublicSolution === row.expectedVisible,
    row.name +
      ": public witness не соответствует фактической native visibility",
  );
  if (row.expectedVisible) {
    assert(
      row.lateOccurrenceKeys.includes(row.earlySolutionKeys[0]),
      row.name + ": key не пережил native condition",
    );
  }
  const html = await Deno.readTextFile(
    root + "/" + row.name + "/_site/index.html",
  );
  assert(
    !/data-course-core-|course-core-ts-binding/.test(
      html,
    ),
    row.name + ": внутренняя метка попала в writer",
  );
}
console.log(JSON.stringify({ status: "PASS", results }));
const lost = results.filter((r) => r.expectedVisible && !r.hasPublicSolution);
assert(
  lost.length === 0,
  "REVIEW_I2: native visible conditional solution lost its late positive witness: " +
    lost.map((r) => r.name).join(", "),
);
