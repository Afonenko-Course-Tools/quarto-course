import * as Core from "../_extensions/course-core/public.ts";
import { renderFixture } from "./helpers/native-operation-a3.ts";
import { dirname, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "a4a-full-nongradle-" });
async function put(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
const config =
  `project:\n  type: website\n  output-dir: _site\nformat:\n  html:\n    theme: none\ncourse: {id: a4a-sp, view: full}\ncourse-core-projection: author\ncourse-project:\n  starter: {path: starter}\n  instructions:\n    local: {path: README.local.md}\n`;
await put("_quarto.yml", config);
await put(
  "index.qmd",
  `::: {#exr-sp difficulty=introductory statement-visibility=restricted course-role=independent-study project="project/input.qmd"}\nПолное условие SP без Gradle.\n\n::: {.solution}\nАвторское решение.\n:::\n:::\n`,
);
await put("project/input.qmd", "# Проект\n");
await put("project/README.local.md", "Выполните команды Fish и Git.");
await put("project/starter/main.fish", "echo работа\n");
await Deno.mkdir(join(root, "_generated"), { recursive: true });
await renderFixture(root);
const checks: { name: string; passed: boolean }[] = [];
await Core.withCurrentNativeOperation({
  root,
  profiles: [],
  projection: "author",
  outputDirectory: join(root, "_site"),
}, async (op) => {
  const condition = op.condition({
    source: "index.qmd",
    exerciseId: "exr-sp",
    view: "author",
  });
  checks.push({
    name: "actual-native-full-restricted-visible",
    passed: JSON.stringify(condition.body).includes("Полное") &&
      JSON.stringify(condition.body).includes("Авторское"),
  });
  await Core.readProjectContexts([{
    owner: root,
    inputs: ["project/input.qmd"],
    profiles: [],
    format: "html",
  }], async ([group]) => {
    const plan = await Core.planProject(group.contexts[0], {
      audience: "full",
    });
    const files = await Core.materializeProject(plan, condition, {
      submission: { files: [], instructions: "Сдайте архив рабочего дерева." },
    });
    checks.push({
      name: "non-gradle-files",
      passed: files.files.some((f) => f.target === "main.fish") &&
        !files.files.some((f) => f.target.includes("gradle")),
    });
    const readme = new TextDecoder().decode(
      files.files.find((f) => f.target === "README.md")!.bytes,
    );
    checks.push({
      name: "non-gradle-readme",
      passed: readme.includes("Fish") && !readme.includes("gradle test"),
    });
    let refused = "";
    try {
      await Core.materializeProject(
        await Core.planProject(group.contexts[0], { audience: "student" }),
        condition,
        { submission: { files: [], instructions: "Сдайте архив." } },
      );
    } catch (e) {
      refused = String(e);
    }
    checks.push({
      name: "author-not-student-authority",
      passed: refused.includes("CONDITION_BINDING"),
    });
  });
});
console.log(
  JSON.stringify({
    status: checks.every((c) => c.passed) ? "PASS" : "FAIL",
    root,
    checks,
  }),
);
if (checks.some((c) => !c.passed)) throw Error("A4a full/non-Gradle");
