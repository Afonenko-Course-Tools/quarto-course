import { dirname, fromFileUrl, join } from "stdlib/path";
import {
  fixtureOperation,
  renderFixture,
} from "./helpers/native-operation-a3.ts";
import * as Core from "../_extensions/course-core/public.ts";
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const root = await Deno.makeTempDir({ prefix: "course-project-native-" });
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const put = async (path: string, text: string) => {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
};
let success = false;
try {
  await put(
    "_quarto.yml",
    `project:\n  type: book\nbook:\n  title: Проверка\n  chapters: [index.qmd]\nformat:\n  html: {theme: none}\ncourse-project:\n  starter: {path: starter}\n  components: {support: {path: shared, base: config}}\n  testsets: {demo: {path: tests, requires: {support: true}}, hidden: {path: hidden}}\n  solutions: {reference: {path: reference}}\n  delivery: {student: {testsets: {demo: true}}}\n  verification: {testsets: {demo: true, hidden: true}}\n`,
  );
  await put("public.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await put("_metadata.yml", "exercise-defaults: {time: 37}\n");
  await put(
    "index.qmd",
    `---\ntitle: Настоящий документ\n---\n\n::: {#exr-a project="/projects/a" difficulty=introductory statement-visibility=open}\nУсловие из настоящего документа.\n\n![Материал](public.svg)\n\n::: {.solution}\nСкрытое решение.\n:::\n:::\n`,
  );
  for (
    const [path, text] of [
      ["shared/src/test/java/Support.java", "class Support {}"],
      ["projects/a/starter/src/main/java/Main.java", "class Main {}"],
      ["projects/a/tests/src/test/java/Demo.java", "class Demo {}"],
      [
        "projects/a/hidden/src/test/java/PrivateTest.java",
        "class PrivateTest {}",
      ],
      ["projects/a/reference/src/main/java/Main.java", "class Reference {}"],
    ]
  ) await put(path, text);
  const started = performance.now();
  await renderFixture(root);
  await fixtureOperation(root, async (op) => {
    const doc = op.document({ source: "index.qmd" });
    assert(
      (await Deno.readTextFile(join(root, "_site/index.html"))).includes(
        "<title>Проверка</title>",
      ),
      "Утеряна настоящая metadata Quarto",
    );
    assert(
      doc.definitions["exr-a"].project === "/projects/a" &&
        doc.definitions["exr-a"].time === 37,
      "Native metadata потеряла project/defaults от реального Quarto",
    );
    await op.withProjectContracts([{
      owner: root,
      directories: ["projects/a"],
      profiles: [],
      format: "html",
    }], async (batch) => {
      const context = batch.groups[0].contexts[0];
      const student = await Core.planProject(context, { audience: "student" });
      const full = await Core.planProject(context, { audience: "full" });
      const condition = op.condition({
        source: "index.qmd",
        exerciseId: "exr-a",
        view: "student",
      });
      const bindings = {
        submission: {
          files: [{
            name: "Main.java",
            starterPath: "src/main/java/Main.java",
          }],
          instructions: "Отправьте Main.java.",
        },
      };
      const publicFiles = await Core.materializeProject(
        student,
        condition,
        bindings,
      );
      const fullFiles = await Core.materializeProject(
        full,
        condition,
        bindings,
      );
      const text = new TextDecoder();
      assert(
        publicFiles.files.some((f) =>
          f.target === "src/main/java/Main.java" &&
          text.decode(f.bytes) === "class Main {}"
        ),
        "Нет actual starter bytes",
      );
      assert(
        publicFiles.files.some((f) =>
          f.target === "src/test/java/Support.java"
        ),
        "Не выбран inherited shared component",
      );
      assert(
        publicFiles.files.some((f) => f.target === "src/test/java/Demo.java"),
        "Не выбран local inherited testset",
      );
      assert(
        !publicFiles.files.some((f) =>
          f.target.includes("Private") || f.target.startsWith("author/")
        ),
        "Private files попали в student",
      );
      assert(
        fullFiles.files.some((f) =>
          f.target === "src/test/java/PrivateTest.java"
        ),
        "Full потерял hidden testset",
      );
      assert(
        fullFiles.files.some((f) =>
          f.target === "author/reference/src/main/java/Main.java"
        ),
        "Full потерял reference",
      );
      const readme = publicFiles.files.find((f) => f.target === "README.md");
      assert(
        readme &&
          text.decode(readme.bytes).includes(
            "Условие из настоящего документа",
          ) && !text.decode(readme.bytes).includes("Скрытое решение"),
        "README потерял native condition/privacy",
      );
      console.log(
        JSON.stringify({
          loader: batch.metrics,
          materializer: Core.projectPlanMetrics(student),
          files: publicFiles.files.length,
          wallMs: Math.round(performance.now() - started),
        }),
      );
    });
  });
  await Deno.link(
    join(root, "projects/a/reference/src/main/java/Main.java"),
    join(root, "projects/a/starter/src/main/java/Leaked.java"),
  );
  let privateAliasRefused = false;
  try {
    await fixtureOperation(root, async (op) => {
      await op.withProjectContracts([{
        owner: root,
        directories: ["projects/a"],
        profiles: [],
        format: "html",
      }], async (batch) => {
        const plan = await Core.planProject(batch.groups[0].contexts[0], {
          audience: "student",
        });
        await Core.materializeProject(
          plan,
          op.condition({
            source: "index.qmd",
            exerciseId: "exr-a",
            view: "student",
          }),
          {
            submission: {
              files: [{
                name: "Main.java",
                starterPath: "src/main/java/Main.java",
              }],
              instructions: "Отправьте Main.java.",
            },
          },
        );
      });
    });
  } catch (error) {
    privateAliasRefused =
      /BODY\.(RESOURCE_PRIVATE_ROLE|ASSIGNMENT_PROJECT_PLANS)/.test(
        String(error),
      );
  }
  assert(
    privateAliasRefused,
    "Ordinary student materializer раскрыл bytes private hardlink",
  );
  await Deno.remove(join(root, "projects/a/starter/src/main/java/Leaked.java"));
  await Deno.remove(join(root, "public.svg"));
  await Deno.remove(join(root, "_site/public.svg"));
  await Deno.link(
    join(root, "projects/a/reference/src/main/java/Main.java"),
    join(root, "_site/public.svg"),
  );
  let privateResourceRefused = false;
  try {
    await fixtureOperation(root, async (op) => {
      await op.withProjectContracts([{
        owner: root,
        directories: ["projects/a"],
        profiles: [],
        format: "html",
      }], async (batch) => {
        const plan = await Core.planProject(batch.groups[0].contexts[0], {
          audience: "student",
        });
        await Core.materializeCondition(
          plan,
          op.condition({
            source: "index.qmd",
            exerciseId: "exr-a",
            view: "student",
          }),
          {
            submission: { files: [], instructions: "Отправьте исходники." },
          },
        );
      });
    });
  } catch (error) {
    privateResourceRefused = String(error).includes(
      "BODY.RESOURCE_PRIVATE_ROLE",
    );
  }
  assert(
    privateResourceRefused,
    "Ordinary native resource fallback раскрыл bytes private hardlink",
  );
  success = true;
  console.log(
    "PASS actual Quarto metadata → namespace loader → student/full materialization",
  );
} finally {
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Fixture для диагностики: " + root + "; source " + repo);
}
