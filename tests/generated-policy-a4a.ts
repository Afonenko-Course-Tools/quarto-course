import { required } from "./helpers/required.ts";
import * as Core from "../_extensions/course-core/public.ts";
import {
  fixtureOperation,
  renderFixture,
} from "./helpers/native-operation-a3.ts";
import { dirname, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "a4a-generated-policy-" });
const authored: string[] = [];
async function put(path: string, text: string) {
  authored.push(path);
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
await put(
  "_quarto.yml",
  "project:\n  type: website\n  output-dir: _site\nformat:\n  html:\n    theme: none\ncourse-project:\n  starter: {path: starter}\n",
);
for (
  const [path, text] of Object.entries({
    "_output/other-profile/payload.txt": "Retained output",
    "nested/_output/lesson.txt": "Reserved native output segment",
    "_output-lessons/diagram.svg": "<svg xmlns='http://www.w3.org/2000/svg'/>",
    "_output.md": "Обычное похожее имя",
    ".cache/course-data/input.txt": "Обычный учебный cache",
  })
) await put(path, text);
const variants = {
  normal: "",
  source:
    "  build:\n    files:\n      payload.txt: {path: ../../_output/other-profile/payload.txt}\n",
  target: "  build:\n    files:\n      _output/payload.txt: {path: ../../_output.md}\n",
  lesson:
    "  build:\n    files:\n      material.txt: {path: ../../_output.md}\n      _output-lessons/notes.md: {path: ../../_output.md}\n",
};
let bank = "";
for (const [name, extra] of Object.entries(variants)) {

  await put(`projects/${name}/starter/main.txt`, "Стартовый материал\n");
  if (extra) {
    await put(`projects/${name}/_metadata.yml`, "course-project:\n" + extra);
  }
  bank +=
    `::: {#exr-${name} difficulty=introductory statement-visibility=open project="projects/${name}"}\nПолное условие.\n\n![Иллюстрация](_output-lessons/diagram.svg)\n:::\n\n`;
}
bank +=
  '::: {#exr-generated difficulty=introductory statement-visibility=open project="projects/normal"}\n[Ресурс](_output/other-profile/payload.txt)\n:::\n';
await put("index.qmd", bank);
await renderFixture(root);
const checks: { name: string; passed: boolean; error?: string }[] = [];
await fixtureOperation(root, async (op) => {
for (const audience of ["student", "full"] as const) {
  let error = "";
  try {
    await Core.readProjectContexts([{
      owner: root,
      directories: ["projects/source"],
      profiles: [],
      format: "html",
    }], async (fixtureGroups) => {
    const g = required(fixtureGroups[0]);
      const plan=await Core.planProject(required(g.contexts[0]), { audience });
      await Core.materializeProject(plan,op.condition({source:"index.qmd",exerciseId:"exr-source",view:"student"}),{submission:{files:[],instructions:"Сдайте материал."}});
    });
  } catch (e) {
    error = String(e);
  }
  checks.push({
    name: `direct-source-${audience}`,
    passed: /CONTEXT_PATH|PROJECT_PATH|ARTIFACT_SOURCE/.test(error),
    error,
  });
}

  await Core.readProjectContexts([{
    owner: root,
    directories: ["normal", "target", "lesson"].map((n) =>
      `projects/${n}`
    ),
    profiles: [],
    format: "html",
  }], async (fixtureGroups) => {
    const group = required(fixtureGroups[0]);
    for (const audience of ["student", "full"] as const) {
      for (const name of ["target"]) {
        let error = "";
        try {
          const p = await Core.planProject(required(group.contexts[1]), { audience });
          await Core.materializeProject(
            p,
            op.condition({
              source: "index.qmd",
              exerciseId: "exr-target",
              view: "student",
            }),
            {
              submission: { files: [], instructions: "Сдайте материал." },
            },
          );
        } catch (e) {
          error = String(e);
        }
        checks.push({
          name: `direct-${name}-${audience}`,
          passed:
            /CONTEXT_PATH|PROJECT_PATH|ARTIFACT_SOURCE|ARTIFACT_TARGET/
              .test(error),
          error,
        });
      }
      const plan = await Core.planProject(required(group.contexts[0]), { audience });
      let error = "";
      try {
        await Core.materializeCondition(
          plan,
          op.condition({
            source: "index.qmd",
            exerciseId: "exr-generated",
            view: "student",
          }),
          { submission: { files: [], instructions: "Сдайте материал." } },
        );
      } catch (e) {
        error = String(e);
      }
      checks.push({
        name: `direct-condition-resource-${audience}`,
        passed: /ARTIFACT_SOURCE|ARTIFACT_TARGET/.test(error),
        error,
      });
      const lesson = required(group.contexts[2]);
      const lessonPlan = await Core.planProject(lesson, { audience });
      const lessonCondition = op.condition({
        source: "index.qmd",
        exerciseId: "exr-lesson",
        view: "student",
      });
      if (audience === "full") {
        await Deno.mkdir(join(root, "_output/new-profile"), { recursive: true });
        await Deno.writeTextFile(
          join(root, "_output/new-profile/marker"),
          "Other profile output",
        );
        await op.assertCurrent();
        await Core.assertProjectContext(lesson);
      }
      const legal = await Core.materializeProject(
        lessonPlan,
        lessonCondition,
        { submission: { files: [], instructions: "Сдайте материал." } },
      );
      checks.push({
        name: `similar-names-${audience}`,
        passed: legal.files.some((f) =>
          f.target === "_output-lessons/notes.md"
        ) && legal.files.some((f) => f.target === "material.txt") &&
          legal.files.some((f) =>
            f.target === "resources/_output-lessons/diagram.svg"
          ),
      });
      if (audience === "full") {
        checks.push({
          name: "other-profile-output-does-not-expire-context-or-operation",
          passed: legal.files.some((f) =>
            f.target === "material.txt" &&
            new TextDecoder().decode(f.bytes) === "Обычное похожее имя"
          ),
        });
      }
    }
  });
});
console.log(
  JSON.stringify({
    status: checks.every((c) => c.passed) ? "PASS" : "FAIL",
    root,
    checks,
    nestedEducationalOutput:
      "Not allowed: exact _output segment already reserved by native source policy",
  }),
);
if (checks.some((c) => !c.passed)) throw Error("A4a generated source policy");
