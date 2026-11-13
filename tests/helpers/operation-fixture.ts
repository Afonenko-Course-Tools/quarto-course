import * as Core from "../../_extensions/course-core/public.ts";
import { withNativeCaptureScope } from "../../_extensions/course-core/capture.ts";
import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { fixtureAt, fixtureString } from "./required.ts";

/** Внешняя fixture проходит штатный producer, затем открывается публичным reader. */
export async function operationFixture(assignment = false) {
  const root = await Deno.makeTempDir({ prefix: "core-operation-lifecycle-" });
  try {
    const relativeOutput = assignment ? "_generated/output" : "_site";
    const repo = dirname(dirname(dirname(fromFileUrl(import.meta.url))));
    await Deno.mkdir(join(root, "_extensions"));
    await copy(join(repo, "_extensions/course-core"), join(root, "_extensions/course-core"));
    await Deno.writeTextFile(
      join(root, "_quarto.yml"),
      `project:
  type: website
  render: [bank.qmd]
  output-dir: ${relativeOutput}
  pre-render: [quarto run _extensions/course-core/entrypoints/pre.ts]
  post-render: [quarto run _extensions/course-core/entrypoints/post.ts]
format: {html: {theme: none}}
course: {id: operation-lifecycle, view: full}
course-core-runtime: native-ts
course-core-projection: author
filters: [course-core]
`,
    );
    await Deno.writeTextFile(join(root, "_quarto-full.yml"), "course: {view: full}\n");
    await Deno.writeTextFile(
      join(root, "bank.qmd"),
      `---
exercise-bank: true
assessment: {id: work, kind: seminar}
---
# Работа

::: {#exr-one difficulty=introductory statement-visibility=open}
Условие.
:::

::: {.task-items}
1. @exr-one
:::
`,
    );
    const expectation = {
      root,
      outputDirectory: join(root, relativeOutput),
      projection: "author" as const,
      profiles: ["full"],
    };
    if (assignment) {
      await withNativeCaptureScope(
        {
          root,
          projection: expectation.projection,
          outputDirectory: expectation.outputDirectory,
        },
        {
          assignment: {
            mode: "new",
            prepare: async () => ({
              expectedSources: ["bank.qmd"],
              assessments: [{ source: "bank.qmd", id: "work" }],
            }),
          },
        },
        async (scope) => {
          await scope.withPreparedOperation(async (lease) => {
            await lease.captureInputs(lease.descriptor, ["bank.qmd"], {
              args: ["render", "--output-dir", relativeOutput],
              timeoutMs: 60000,
            });
          });
        },
      );
    } else {
      const result = await new Deno.Command(Deno.env.get("QUARTO") ?? "quarto", {
        args: ["render", "--profile", "full"],
        cwd: root,
        env: { QUARTO_RUN_NO_NETWORK: "true" },
        stdout: "piped",
        stderr: "piped",
      }).output();
      if (!result.success) throw Error(new TextDecoder().decode(result.stderr));
    }
    const pointer: unknown = JSON.parse(
      await Deno.readTextFile(join(root, "_generated/course-spec/native-ts/active.json")),
    );
    const completePath = join(fixtureString(fixtureAt(pointer, ["directory"])), "complete.json");
    return {
      root,
      expectation,
      completePath,
      use: <T>(use: (op: Core.NativeOperation) => Promise<T>) => Core.withCurrentNativeOperation(expectation, use),
      close: () => Deno.remove(root, { recursive: true }),
    };
  } catch (error) {
    await Deno.remove(root, { recursive: true });
    throw error;
  }
}
