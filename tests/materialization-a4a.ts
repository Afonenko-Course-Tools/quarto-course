import { required } from "./helpers/required.ts";
import * as Core from "../_extensions/course-core/public.ts";
import { fixtureOperation, renderFixture } from "./helpers/native-operation-a3.ts";
import { dirname, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "a4a-condition-" });
async function put(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
await put(
  "_quarto.yml",
  `project:\n  type: website\n  output-dir: _site\nformat:\n  html:\n    theme: none\ncourse-project:\n  starter: {path: starter}\n  instructions:\n    gradle: {path: shared/gradle.md, base: config}\n    local: {path: README.local.md}\n  build:\n    files:\n      build.gradle: {path: shared/build.gradle, base: config}\n      settings.gradle: {path: shared/settings.gradle, base: config}\n`,
);
for (const [p, t] of Object.entries({
  "shared/gradle.md": "Общая инструкция: [Руководство](guide.txt).",
  "shared/guide.txt": "Общий материал.",
  "shared/build.gradle": "plugins { id 'java' }",
  "shared/settings.gradle": "rootProject.name='a4a'",

  "project/README.local.md": "Локально: [Руководство](guide.txt).",
  "project/guide.txt": "Собственный материал.",
  "project/starter/Main.java": "class Main {}",
  "project/reference/private.svg": "PRIVATE_RESOURCE_BYTES_NOT_FOR_README",
  "visible.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
  "private.svg": "<svg/>",
}))
  await put(p, t);
await put(
  "index.qmd",
  `::: {#exr-demo difficulty=introductory statement-visibility=open project="project"}\nПолное условие с [переходом](#point), таблицей и ![изображением](visible.svg).

[Справочник](#qrc-unresolved){.qrc-link data-qrc-ref="book:sec-help" data-qrc-style="default" data-qrc-custom="true"} и [Другая цель](#qrc-unresolved){.qrc-link data-qrc-ref="book:sec-other" data-qrc-style="default" data-qrc-custom="true"}.\n\n::: {#point}\nНужный фрагмент.\n:::\n\n::: {.public-tests}\nПубличные проверки\n\n- При входе **2** ожидается **4**.\n\n~~~java\nassertEquals(4, square(2));\n~~~\n:::\n\n::: {.callout-tip collapse=true}\n## Пояснение к проверкам\nШтатный сворачиваемый callout Quarto.\n:::\n\n<details open data-public-tests="ordinary">\n<summary>Дополнительное пояснение</summary>\n<img src="project/reference/private.svg">\n</details>\n\n::: {.content-visible when-format=latex}\n![Скрыто](private.svg)\n:::\n:::\n\n::: {#exr-private-resource difficulty=introductory statement-visibility=open project="project"}\n![Закрытый ресурс](project/reference/private.svg)\n:::\n`,
);
await renderFixture(root);
const checks: { name: string; passed: boolean }[] = [];
await fixtureOperation(root, async (op) => {
  await Core.readProjectContexts(
    [
      {
        owner: root,
        directories: ["project"],
        profiles: [],
        format: "html",
      },
    ],
    async (fixtureGroups) => {
      const group = required(fixtureGroups[0]);
      const plan = await Core.planProject(required(group.contexts[0]), {
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
        passed:
          closure.fragments.some((f) => f.source === "shared/gradle.md" && f.links.includes("guide.txt")) &&
          closure.fragments.some((f) => f.source === "project/README.local.md" && f.links.includes("guide.txt")),
      });
      checks.push({
        name: "parse-fragments-once",
        passed:
          Core.projectPlanMetrics(plan).pandocCalls === before.pandocCalls + 2 &&
          JSON.stringify(closure) === JSON.stringify(repeat),
      });
      checks.push({
        name: "distinct-native-reference-identity",
        passed:
          required(closure.fragments[0]).references.length === 2 &&
          new Set(required(closure.fragments[0]).references.map((r) => r.token)).size === 2,
      });
      const linksBySource = Object.fromEntries(
        closure.fragments.map((f) => [
          f.source,
          Object.fromEntries(f.references.map((r) => [r.token, "https://example.invalid/" + r.key.replace(":", "/")])),
        ]),
      );
      const bindings = {
        linksBySource,
        submission: {
          files: [{ name: "Main.java", starterPath: "Main.java" }],
          instructions: "Сдайте Main.java.",
        },
      };
      for (const [name, candidate, expected] of [
        ["cloned-condition-still-refused", structuredClone(condition), "CONDITION_AUTHORITY"],
        [
          "native-private-resource-still-refused",
          op.condition({
            source: "index.qmd",
            exerciseId: "exr-private-resource",
            view: "student",
          }),
          "ARTIFACT_PRIVATE",
        ],
      ] as const) {
        let error = "";
        try {
          await Core.materializeCondition(plan, candidate, bindings);
        } catch (cause) {
          error = String(cause);
        }
        checks.push({ name, passed: error.includes(expected) });
        if (!error.includes(expected)) throw Error(name + ": " + error);
        console.log("PASS " + name);
      }
      const inventory = await Core.materializeCondition(plan, condition, bindings),
        project = await Core.materializeProject(plan, condition, bindings);
      const readme = new TextDecoder().decode(inventory.files.find((f) => f.target === "README.md")!.bytes);
      const starterReadme = new TextDecoder().decode(project.files.find((f) => f.target === "README.md")!.bytes);
      checks.push({
        name: "native-callout-and-pandoc-raw-wrappers-through-readme",
        passed: [readme, starterReadme].every(
          (text) =>
            text.includes("Пояснение к проверкам") &&
            text.includes("Штатный сворачиваемый callout Quarto.") &&
            text.includes('<details open data-public-tests="ordinary">') &&
            text.includes("Дополнительное пояснение"),
        ),
      });
      checks.push({
        name: "raw-html-does-not-import-private-resource-bytes",
        passed: [inventory, project].every((files) =>
          files.files.every(
            (file) =>
              !file.target.includes("private.svg") &&
              !new TextDecoder().decode(file.bytes).includes("PRIVATE_RESOURCE_BYTES_NOT_FOR_README"),
          ),
        ),
      });
      checks.push({
        name: "ordinary-public-tests-condition-and-readme",
        passed:
          JSON.stringify(condition.body).includes('"public-tests"') &&
          [readme, starterReadme].every(
            (text) =>
              text.includes("Публичные проверки") &&
              text.includes("При входе **2** ожидается **4**.") &&
              text.includes("assertEquals(4, square(2));"),
          ),
      });
      checks.push({
        name: "condition-only-no-code-build",
        passed:
          inventory.files.every((f) => f.target === "README.md" || f.reason === "condition-resource") &&
          !inventory.files.some((f) => /Main.java|build.gradle|settings.gradle/.test(f.target)),
      });
      checks.push({
        name: "complete-readme",
        passed:
          readme.includes("Полное условие") &&
          readme.includes("Общая инструкция") &&
          readme.includes("Локально") &&
          readme.includes("Сдайте") &&
          readme.includes('id="point"'),
      });
      checks.push({
        name: "own-resource-bases",
        passed:
          inventory.files.some((f) => f.target === "resources/shared/guide.txt") &&
          inventory.files.some((f) => f.target === "resources/project/guide.txt") &&
          inventory.files.some((f) => f.target === "resources/visible.svg") &&
          !inventory.files.some((f) => f.target.includes("private.svg")),
      });
      checks.push({
        name: "native-reference-links-resolved",
        passed:
          readme.includes("https://example.invalid/book/sec-help") &&
          readme.includes("https://example.invalid/book/sec-other") &&
          !readme.includes("qrc-unresolved"),
      });
      checks.push({
        name: "project-route-preserved",
        passed:
          project.files.some((f) => f.target === "Main.java") && project.files.some((f) => f.target === "build.gradle"),
      });
      checks.push({
        name: "closure-not-reparsed-by-writer",
        passed: Core.projectPlanMetrics(plan).pandocCalls === before.pandocCalls + 6,
      });
    },
  );
});
console.log(
  JSON.stringify({
    status: checks.every((c) => c.passed) ? "PASS" : "FAIL",
    root,
    checks,
  }),
);
if (checks.some((c) => !c.passed)) throw Error("A4a condition closure");
