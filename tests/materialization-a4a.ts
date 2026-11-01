import * as Core from "../_extensions/course-core/public.ts";
import {
  fixtureOperation,
  renderFixture,
} from "./helpers/native-operation-a3.ts";
import { dirname, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "a4a-condition-" });
async function put(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
await put(
  "_quarto.yml",
  `project:\n  type: website\n  output-dir: _site\nformat:\n  html:\n    theme: none\ncourse-project:\n  starter: {path: starter}\n  instructions:\n    gradle: {path: shared/gradle.md}\n    local: {path: README.local.md}\n  build:\n    files:\n      build.gradle: shared/build.gradle\n      settings.gradle: shared/settings.gradle\n`,
);
for (
  const [p, t] of Object.entries({
    "shared/gradle.md": "Общая инструкция: [Руководство](guide.txt).",
    "shared/guide.txt": "Общий материал.",
    "shared/build.gradle": "plugins { id 'java' }",
    "shared/settings.gradle": "rootProject.name='a4a'",
    "project/input.qmd": "# Код",
    "project/README.local.md": "Локально: [Руководство](guide.txt).",
    "project/guide.txt": "Собственный материал.",
    "project/starter/Main.java": "class Main {}",
    "visible.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
    "private.svg": "<svg/>",
  })
) await put(p, t);
await put(
  "index.qmd",
  `::: {#exr-demo difficulty=introductory statement-visibility=open project="project/input.qmd"}\nПолное условие с [переходом](#point), таблицей и ![изображением](visible.svg).

[Справочник](#qrc-unresolved){.qrc-link data-qrc-ref="book:sec-help" data-qrc-style="default" data-qrc-custom="true"} и [Другая цель](#qrc-unresolved){.qrc-link data-qrc-ref="book:sec-other" data-qrc-style="default" data-qrc-custom="true"}.\n\n::: {#point}\nНужный фрагмент.\n:::\n\n::: {.content-visible when-format=latex}\n![Скрыто](private.svg)\n:::\n:::\n`,
);
await renderFixture(root);
const checks: { name: string; passed: boolean }[] = [];
await fixtureOperation(root, async (op) => {
  await Core.readProjectContexts([{
    owner: root,
    inputs: ["project/input.qmd"],
    profiles: [],
    format: "html",
  }], async ([group]) => {
    const plan = await Core.planProject(group.contexts[0], {
        audience: "student",
      }),
      condition = op.condition({
        source: "index.qmd",
        exerciseId: "exr-demo",
        view: "student",
      });
    const before = Core.projectPlanMetrics(plan);
    const closure = await Core.materializationClosure(plan, condition),
      repeat = await Core.materializationClosure(plan, condition);
    checks.push({
      name: "own-fragment-bases",
      passed: closure.fragments.some((f) =>
        f.source === "shared/gradle.md" && f.links.includes("guide.txt")
      ) && closure.fragments.some((f) =>
        f.source === "project/README.local.md" && f.links.includes("guide.txt")
      ),
    });
    checks.push({
      name: "parse-fragments-once",
      passed:
        Core.projectPlanMetrics(plan).pandocCalls === before.pandocCalls + 2 &&
        JSON.stringify(closure) === JSON.stringify(repeat),
    });
    checks.push({
      name: "distinct-native-reference-identity",
      passed: closure.fragments[0].references.length === 2 &&
        new Set(closure.fragments[0].references.map((r) => r.token)).size === 2,
    });
    const linksBySource = Object.fromEntries(
      closure.fragments.map(
        (f) => [
          f.source,
          Object.fromEntries(
            f.references.map(
              (r) => [
                r.token,
                "https://example.invalid/" + r.key.replace(":", "/"),
              ],
            ),
          ),
        ],
      ),
    );
    const bindings = {
      linksBySource,
      submission: {
        files: [{ name: "Main.java", starterPath: "Main.java" }],
        instructions: "Сдайте Main.java.",
      },
    };
    const inventory = await Core.materializeCondition(
        plan,
        condition,
        bindings,
      ),
      project = await Core.materializeProject(plan, condition, bindings);
    const readme = new TextDecoder().decode(
      inventory.files.find((f) => f.target === "README.md")!.bytes,
    );
    checks.push({
      name: "condition-only-no-code-build",
      passed: inventory.files.every((f) =>
        f.target === "README.md" || f.reason === "condition-resource"
      ) && !inventory.files.some((f) =>
        /Main.java|build.gradle|settings.gradle/.test(f.target)
      ),
    });
    checks.push({
      name: "complete-readme",
      passed: readme.includes("Полное условие") &&
        readme.includes("Общая инструкция") && readme.includes("Локально") &&
        readme.includes("Сдайте") && readme.includes('id="point"'),
    });
    checks.push({
      name: "own-resource-bases",
      passed: inventory.files.some((f) =>
        f.target === "resources/shared/guide.txt"
      ) && inventory.files.some((f) =>
        f.target === "resources/project/guide.txt"
      ) && inventory.files.some((f) =>
        f.target === "resources/visible.svg"
      ) && !inventory.files.some((f) =>
        f.target.includes("private.svg")
      ),
    });
    checks.push({
      name: "native-reference-links-resolved",
      passed: readme.includes("https://example.invalid/book/sec-help") &&
        readme.includes("https://example.invalid/book/sec-other") &&
        !readme.includes("qrc-unresolved"),
    });
    checks.push({
      name: "project-route-preserved",
      passed: project.files.some((f) => f.target === "Main.java") &&
        project.files.some((f) => f.target === "build.gradle"),
    });
    checks.push({
      name: "closure-not-reparsed-by-writer",
      passed:
        Core.projectPlanMetrics(plan).pandocCalls === before.pandocCalls + 6,
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
if (checks.some((c) => !c.passed)) throw Error("A4a condition closure");
