// Реальный установленный native owner: fresh capture без внешней capsule.
import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { withNativeCaptureScope } from "../_extensions/course-core/capture.ts";
import { withCurrentNativeOperation } from "../_extensions/course-core/public.ts";
const extension = join(
  dirname(dirname(fromFileUrl(import.meta.url))),
  "_extensions/course-core",
);
const resumed = Deno.args[0];
const root = resumed
  ? await Deno.realPath(resumed)
  : await Deno.makeTempDir({ prefix: "assignment-admission-" });
const assert = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
let success = false;
try {
  if (!resumed) {
    await Deno.mkdir(join(root, "_extensions"));
    await copy(extension, join(root, "_extensions/course-core"));
    await Deno.writeTextFile(
      join(root, "_quarto.yml"),
      `project:
  type: website
  render: [index.qmd]
  pre-render: [quarto run _extensions/course-core/entrypoints/native-pre.ts]
  post-render: [quarto run _extensions/course-core/entrypoints/native-post.ts]
format: {html: {theme: none}}
profile: {default: student, group: [[student, full]]}
course: {id: native-admission, view: student}
course-core-runtime: native-ts
course-core-projection: student
exercise-bank: true
default-exercise-statement-visibility: open
filters: [course-core]
`,
    );
    await Deno.writeTextFile(
      join(root, "_quarto-full.yml"),
      "course: {view: full}\ncourse-core-projection: author\n",
    );
    await Deno.writeTextFile(join(root, "_quarto-lab.yml"), "lang: ru\n");
    await Deno.writeTextFile(
      join(root, "index.qmd"),
      `---
assessment: {id: work, kind: seminar}
---
# Работа

::: {#exr-one difficulty=introductory}
Условие участника.

::: {.solution}
PRIVATE-SOLUTION
:::
:::

::: {.task-items}
1. @exr-one
:::
`,
    );
  }
  if (!resumed) await Deno.symlink(root, join(root, "unrelated-source-link"));
  const outputDirectory = join(root, "_generated/assignment-output");
  let descriptor: any, retained: any;
  await withNativeCaptureScope(
    { root, projection: "author", outputDirectory },
    {
      assignment: {
        mode: "new",
        profiles: ["lab"],
        prepare: async (owner) => {
          assert(owner.dir === root, "Чужой observed owner");
          return {
            expectedSources: ["index.qmd"],
            assessments: [{ source: "index.qmd", id: "work" }],
          };
        },
      },
    },
    async (scope) => {
      await scope.withPreparedOperation(async (lease) => {
        retained = lease;
        descriptor = lease.descriptor;
        assert(
          JSON.stringify(descriptor.identity.profiles) === '["lab","full"]',
          "Потеряны functional/full profiles",
        );
        await lease.captureInputs(descriptor, ["index.qmd"], {
          args: ["render", "--output-dir", "_generated/assignment-output"],
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
  const sealed = JSON.parse(
    await Deno.readTextFile(join(generation, "complete.json")),
  );
  const reservation = JSON.parse(
    await Deno.readTextFile(join(generation, "reservation.json")),
  );
  assert(
    reservation.children.length === 1,
    "Неверное число actual capture children",
  );
  const child = JSON.parse(
    await Deno.readTextFile(
      join(generation, "child-" + reservation.children[0].token + ".json"),
    ),
  );
  assert(
    !("implementationFiles" in child.state.assignment.runtime) &&
      !("implementationFiles" in sealed.state.assignment.runtime) &&
      !("rows" in sealed.state) && !("memberships" in sealed.state) &&
      !("invocation" in sealed.state),
    "Сохранён удалённый snapshot/runtime guard",
  );
  let expired = false;
  try {
    await retained.assert(descriptor);
  } catch (e) {
    expired = String(e).includes("OPERATION_EXPIRED");
  }
  assert(expired, "Истёкший prepared lease принят");
  const delivered = await withCurrentNativeOperation({
    root,
    projection: "author",
    profiles: ["lab", "full"],
    outputDirectory,
  }, async (operation) => {
    assert(
      operation.identity.operation === descriptor.identity.operation,
      "Generation заменена",
    );
    await operation.validateRelease({ expectedSources: ["index.qmd"] });
    const provenance = await operation.assignmentProvenance();
    assert(
      provenance.documents.length === 1 &&
        provenance.documents[0].source === "index.qmd",
      "Неполная native provenance",
    );
    return await operation.assignmentDelivery({
      source: "index.qmd",
      assessmentId: "work",
    }, { projectPlans: [] });
  });
  assert(
    !JSON.stringify(delivered).includes("PRIVATE-SOLUTION"),
    "Закрытое решение в student delivery",
  );
  const html = await Deno.readTextFile(join(outputDirectory, "index.html"));
  assert(
    html.includes("Условие участника") && !html.includes("PRIVATE-SOLUTION"),
    "Нет actual projected native HTML",
  );
  success = true;
  console.log(
    "PASS actual native assignment generation, functional/full profiles, lease expiry, complete provenance and private solution projection без capsule",
  );
} finally {
  if (success && !resumed) await Deno.remove(root, { recursive: true });
  else console.error("Сохранён fixture " + root);
}
