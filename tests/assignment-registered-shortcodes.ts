// Один bounded actual Quarto capture; запускается владельцем HEAVY, не pure fixture.
import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { withNativeCaptureScope } from "../_extensions/course-core/capture.ts";
import { withCurrentNativeOperation } from "../_extensions/course-core/public.ts";
const extension = join(
  dirname(dirname(fromFileUrl(import.meta.url))),
  "_extensions/course-core",
);
const root = await Deno.makeTempDir({ prefix: "native-authoring-" });
const source = "tasks/index.qmd";
const assert = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
let success = false;
try {
  await Deno.mkdir(join(root, "_extensions"));
  await Deno.mkdir(join(root, "tasks"));
  await copy(extension, join(root, "_extensions/course-core"));
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    `project:
  type: website
  render: [tasks/index.qmd]
  pre-render: [quarto run _extensions/course-core/entrypoints/native-pre.ts]
  post-render: [quarto run _extensions/course-core/entrypoints/native-post.ts]
format: {html: {theme: none}}
course: {id: native-authoring, view: full}
course-core-runtime: native-ts
course-core-projection: author
exercise-defaults: {difficulty: introductory, statement-visibility: open, time: 7, target: inherited, course-role: demonstration, project-check: inherited-check}
filters: [course-core]
shortcodes: [shortcodes.lua]
`,
  );
  await Deno.writeTextFile(
    join(root, "_quarto-full.yml"),
    "course: {view: full}\n",
  );
  await Deno.writeTextFile(
    join(root, "shortcodes.lua"),
    `return {['public-native']=function(args)
  return pandoc.Strong({pandoc.Str('NATIVE-RESOLVED'), pandoc.Space(), pandoc.Str(pandoc.utils.stringify(args[1]))})
end}\n`,
  );
  await Deno.writeTextFile(
    join(root, "tasks/_metadata.yml"),
    `exercise-defaults: {time: 13, target: false, course-role: false, project-check: false}\n`,
  );
  await Deno.writeTextFile(
    join(root, source),
    `---
title: "*Богатый заголовок*"
exercise-bank: true
exercise-defaults: {time: 17}
assessment: {id: work, kind: seminar}
---
# Работа

::: {#exr-one difficulty=advanced time=19}
{{< meta title >}}

{{< public-native {{< meta title >}} >}}

::: {.solution}
{{< unknown-private-handler "PRIVATE-SHORTCODE" >}}
:::
:::

::: {#exr-inherit}
Унаследованное условие.
:::

::: {.task-items}
1. @exr-one
2. @exr-inherit
:::
`,
  );
  const outputDirectory = join(root, "_generated/out");
  let descriptor: any;
  await withNativeCaptureScope(
    { root, projection: "author", outputDirectory },
    {
      assignment: {
        mode: "new",
        prepare: async () => ({
          expectedSources: [source],
          assessments: [{ source, id: "work" }],
        }),
      },
    },
    async (scope) => {
      await scope.withPreparedOperation(async (lease) => {
        descriptor = lease.descriptor;
        await lease.captureInputs(descriptor, [source], {
          args: ["render", "--output-dir", "_generated/out"],
          timeoutMs: 60000,
        });
      });
    },
  );
  const generation = join(
    root,
    "_generated/course-spec/native-ts",
    descriptor.identity.operation,
  );
  const early = JSON.parse(
    await Deno.readTextFile(join(generation, "0.early.json")),
  );
  const explicit = early.definitions["exr-one"],
    inherited = early.definitions["exr-inherit"];
  assert(
    explicit.difficulty === "advanced" && explicit.time === 19,
    "Explicit attrs потеряли приоритет",
  );
  assert(
    inherited.difficulty === "introductory" && inherited.time === 17 &&
      inherited["statement-visibility"] === "open",
    "Project/directory/page defaults не объединены actual Quarto",
  );
  for (const field of ["target", "course-role", "project-check"]) {
    assert(!Object.hasOwn(inherited, field), "false не сбросил " + field);
  }
  const delivery = await withCurrentNativeOperation({
    root,
    profiles: descriptor.identity.profiles,
    projection: "author",
    outputDirectory,
  }, async (operation) => {
    await operation.validateRelease({ expectedSources: [source] });
    return await operation.assignmentDelivery(
      { source, assessmentId: "work" },
      { projectPlans: [] },
    );
  });
  const text = JSON.stringify(delivery);
  assert(
    text.includes("NATIVE-RESOLVED") && text.includes('"Strong"') &&
      text.includes('"Emph"'),
    "Actual late rich/nested shortcode AST потерян",
  );
  assert(
    !text.includes("PRIVATE-SHORTCODE") && !text.includes("quarto-shortcode__"),
    "Private/неразрешённый AST попал в delivery",
  );
  success = true;
  console.log(
    "PASS one actual native capture: merged canonical defaults, explicit attrs, false resets, rich/nested registered shortcode and private projection",
  );
} finally {
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Сохранён fixture " + root);
}
