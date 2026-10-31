import * as Core from "../_extensions/course-core/public.ts";
import {
  fixtureOperation,
  renderFixture,
} from "./helpers/native-operation-a3.ts";
import { dirname, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "a4a-release-" });
async function put(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
await put(
  "_quarto.yml",
  "project:\n  type: website\n  output-dir: _site\nformat:\n  html:\n    theme: none\ncourse: {id: a4a-course, view: student}\n",
);
await put(
  "index.qmd",
  `---\nassessment: {id: lab-demo, kind: lab}\ntitle: Работа\n---\n::: {#exr-demo difficulty=introductory statement-visibility=open course-role=demonstration project="project"}\nУсловие.\n\n::: {.solution .content-visible when-format=html}\nРешение.\n:::\n:::\n\n::: {.task-items stage=demonstration}\n- @exr-demo\n:::\n`,
);
await put("project/source.txt", "Обычный source");
await renderFixture(root);
const checks: { name: string; passed: boolean }[] = [];
let escaped: Core.NativeOperation;
await fixtureOperation(root, async (op) => {
  escaped = op;
  const proof = await op.validateRelease({
    expectedSources: ["index.qmd"],
    courseId: "a4a-course",
  });
  checks.push({
    name: "actual-course-assessment-solution-proof",
    passed: proof.exerciseIds.includes("exr-demo") &&
      proof.assessmentIds.includes("lab-demo") &&
      proof.course.view === "student",
  });
  for (
    const [name, request, code] of [
      [
        "duplicate-source",
        { expectedSources: ["index.qmd", "index.qmd"] },
        "RELEASE.EXPECTED_SOURCES_INVALID",
      ],
      [
        "wrong-coverage",
        { expectedSources: ["other.qmd"] },
        "RELEASE.COVERAGE",
      ],
      [
        "wrong-course",
        { expectedSources: ["index.qmd"], courseId: "other" },
        "RELEASE.MIXED_COURSE",
      ],
    ] as const
  ) {
    let error = "";
    try {
      await op.validateRelease({
        ...request,
        expectedSources: [...request.expectedSources],
      });
    } catch (e) {
      error = String(e);
    }
    checks.push({ name, passed: error.includes(code) });
  }
  checks.push({
    name: "public-proof-no-private-payload",
    passed: !JSON.stringify(proof).includes("body") &&
      !JSON.stringify(proof).includes("project-check") &&
      !JSON.stringify(proof).includes(root),
  });
});
let expired = "";
try {
  await escaped!.validateRelease({ expectedSources: ["index.qmd"] });
} catch (e) {
  expired = String(e);
}
checks.push({
  name: "expired-release-authority",
  passed: expired.includes("OPERATION_EXPIRED"),
});
console.log(
  JSON.stringify({
    status: checks.every((c) => c.passed) ? "PASS" : "FAIL",
    root,
    checks,
  }),
);
if (checks.some((c) => !c.passed)) throw Error("A4a native release proof");
