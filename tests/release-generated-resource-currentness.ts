import { isRecord } from "../_extensions/course-core/document/native-ast.ts";
import { fixtureAt, fixtureRecord, required } from "./helpers/required.ts";
import * as Core from "../_extensions/course-core/public.ts";
import {
  fixtureOperation,
  renderFixture,
} from "./helpers/native-operation-a3.ts";
import { dirname, fromFileUrl, join, resolve, toFileUrl } from "stdlib/path";

const checks: { name: string; passed: boolean; error?: string }[] = [];
const metrics: unknown[] = [];
const roots: string[] = [];
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg"><text>GENERATED_RELEASE</text></svg>';
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
async function fixture() {
  const root = await Deno.makeTempDir({
    prefix: "release-generated-resource-",
  });
  roots.push(root);
  async function put(path: string, text: string) {
    await Deno.mkdir(dirname(join(root, path)), { recursive: true });
    await Deno.writeTextFile(join(root, path), text);
  }
  await put(".gitignore", "/.quarto/\n**/*.quarto_ipynb\n");
  await put(
    "_quarto.yml",
    "project:\n  type: website\n  output-dir: _site\nformat:\n  html:\n    theme: none\ncourse: {id: generated-release, view: student}\n",
  );
  await put(
    "index.qmd",
    '::: {#exr-demo difficulty=introductory statement-visibility=open project="projects/demo"}\nПолное условие.\n\n![Generated](generated.svg)\n\n![Существующий](existing.svg)\n\n::: {.solution}\n![Закрытый](private.svg)\n:::\n:::\n',
  );
  await put("projects/demo/source.txt", "Текущий source\n");
  await put(
    "existing.svg",
    svg.replace("GENERATED_RELEASE", "EXISTING_RELEASE"),
  );
  await put("private.svg", svg.replace("GENERATED_RELEASE", "PRIVATE_RELEASE"));
  await put(
    "generate.lua",
    `return {{Pandoc=function(doc) local f=assert(io.open('generated.svg','wb')); f:write('${svg}'); f:close(); return doc end}}\n`,
  );
  // Тот же existing native post-quarto generator, до late resource observation.
  const extension = fromFileUrl(
    new URL("../_extensions/course-core/", import.meta.url),
  );
  await put(
    "_quarto.yml",
    (await Deno.readTextFile(join(root, "_quarto.yml"))) +
      `filters:\n  - at: pre-ast\n    path: ${extension}native-ts/early-context.lua\n  - at: post-quarto\n    path: ${extension}native-ts/late-kind.lua\n  - at: post-quarto\n    path: ${root}/generate.lua\n  - at: post-render\n    path: ${extension}native-ts/late-filter.lua\n`,
  );
  let beforeAbsent = false;
  try {
    await Deno.stat(join(root, "generated.svg"));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) beforeAbsent = true;
    else throw error;
  }
  assert(beforeAbsent, "Fixture предсоздал generated resource");
  await renderFixture(root);
  assert(
    await Deno.readTextFile(join(root, "generated.svg")) === svg,
    "Native generator не создал точные bytes",
  );
  return root;
}
async function refuse(
  name: string,
  use: () => Promise<unknown>,
  expected = /OPERATION_CHANGED/,
) {
  let error = "";
  try {
    await use();
  } catch (cause) {
    error = String(cause);
  }
  const passed = expected.test(error);
  checks.push({ name, passed, error });
  assert(passed, name + ": " + error);
}
async function negative(name: string, mutate: (root: string) => Promise<void>) {
  const root = await fixture();
  let mutationCompleted = false;
  await refuse(name, () =>
    fixtureOperation(root, async (op) => {
      await mutate(root);
      mutationCompleted = true;
      await op.validateRelease({ expectedSources: ["index.qmd"] });
    }));
  assert(
    mutationCompleted,
    name + ": mutation не завершилась; это не currentness proof",
  );
}
if (Deno.args.includes("--r-cache")) {
  await actualRCache();
} else {try {
    const root = await fixture();
    let escaped: Core.NativeOperation;
    await fixtureOperation(root, async (op) => {
      escaped = op;
      const before = structuredClone(op.metrics);
      const proof = await op.validateRelease({
        expectedSources: ["index.qmd"],
        courseId: "generated-release",
      });
      assert(
        proof.exerciseIds.includes("exr-demo"),
        "Release не проверил existing project",
      );
      const after = structuredClone(op.metrics);
      for (
        const key of [
          "inspectCalls",
          "childRenders",
        ] as const
      ) {
        assert(
          before[key] === after[key],
          "Release добавил discovery/hash/render: " + key,
        );
      }
      metrics.push({ beforeRelease: before, afterRelease: after });
      checks.push({
        name:
          "generated-and-pregenerated-release-no-extra-inspect-walk-hash-render",
        passed: true,
      });
      const resources = await op.resourceFiles({
        files: [
          { source: "generated.svg", target: "resources/generated.svg" },
          { source: "existing.svg", target: "resources/existing.svg" },
        ],
      });
      assert(
        new TextDecoder().decode(required(resources.files[0]).bytes) === svg,
        "Потеряны current generated bytes",
      );
      assert(
        !JSON.stringify(proof).includes("PRIVATE_RELEASE"),
        "Private content попал в proof",
      );
      await refuse(
        "private-resource-not-public",
        () =>
          op.resourceFiles({
            files: [{ source: "private.svg", target: "private.svg" }],
          }),
        /RESOURCE_PRIVATE_OR_SOURCE/,
      );
      await Deno.writeTextFile(
        join(root, "unregistered.txt"),
        "Не native resource",
      );
      const withRootSibling = await op.validateRelease({
        expectedSources: ["index.qmd"],
      });
      assert(
        withRootSibling.exerciseIds.includes("exr-demo"),
        "Независимый root sibling изменил captured release",
      );
      checks.push({
        name: "unregistered-root-sibling-preserves-release",
        passed: true,
      });
      await Deno.remove(join(root, "unregistered.txt"));
      await Deno.writeTextFile(
        join(root, "projects/demo/unregistered.svg"),
        svg,
      );
      const withProjectSibling = await op.validateRelease({
        expectedSources: ["index.qmd"],
      });
      assert(
        withProjectSibling.exerciseIds.includes("exr-demo"),
        "Новый project sibling изменил captured release",
      );
      checks.push({
        name: "unregistered-project-sibling-preserves-release",
        passed: true,
      });
      await refuse(
        "unobserved-project-sibling-not-public-resource",
        () =>
          op.resourceFiles({
            files: [{
              source: "projects/demo/unregistered.svg",
              target: "resources/unregistered.svg",
            }],
          }),
        /RESOURCE_PRIVATE_OR_SOURCE/,
      );
      await Deno.remove(join(root, "projects/demo/unregistered.svg"));
      await Deno.writeTextFile(join(root, "_site/foreign.svg"), svg);
      await refuse(
        "retained-same-bytes-not-observed-resource",
        () =>
          op.resourceFiles({
            files: [{ source: "foreign.svg", target: "foreign.svg" }],
          }),
        /RESOURCE_PRIVATE_OR_SOURCE/,
      );
      await Deno.writeTextFile(
        join(root, "projects/demo/source.txt"),
        "Изменён source проекта до actual A1 acquisition",
      );
      const withProjectDrift = await op.validateRelease({
        expectedSources: ["index.qmd"],
      });
      assert(
        withProjectDrift.exerciseIds.includes("exr-demo"),
        "Release потребовал прежние bytes всего проекта",
      );
      checks.push({
        name: "project-bytes-belong-to-actual-A1-not-captured-release",
        passed: true,
      });
    });
    await refuse(
      "expired-operation",
      () => escaped!.validateRelease({ expectedSources: ["index.qmd"] }),
      /OPERATION_EXPIRED/,
    );
    await negative("project-corridor-symlink", async (root) => {
      await Deno.rename(
        join(root, "projects/demo"),
        join(root, "_generated/original-project"),
      );
      await Deno.symlink(
        join(root, "_generated/original-project"),
        join(root, "projects/demo"),
      );
    });
    await negative("other-operation-current-pointer", async (root) => {
      const path = "_generated/course-spec/native-ts/active.json";
      const foreign = await Deno.readTextFile(join(required(roots[0]), path));
      const current = await Deno.readTextFile(join(root, path));
      assert(
        fixtureAt(JSON.parse(foreign), ["operation"]) !==
          fixtureAt(JSON.parse(current), ["operation"]),
        "Foreign control требует другую genuine operation",
      );
      await Deno.writeTextFile(join(root, path), foreign);
    });
    console.log(
      JSON.stringify({
        status: "PASS",
        checks,
        metrics,
        roots,
        nativeRenderCount: roots.length,
      }),
    );
  } finally {
    if (Deno.env.get("CORE_KEEP_FIXTURES")) {
      console.log("Сохранены release fixtures: " + JSON.stringify(roots));
    } else {for (const root of roots) {
        await Deno.remove(root, { recursive: true });
      }}
  }}

/** Два actual knitr captures используют один authored QMD/cache, затем настоящий Download. */
async function actualRCache() {
  const downloadSource = Deno.env.get("COURSE_DOWNLOAD_PUBLIC");
  assert(downloadSource, "G1 требует настоящий Download public.ts");
  const root = await Deno.makeTempDir({ prefix: "core-knitr-cache-" });
  roots.push(root);
  const extension = fromFileUrl(
    new URL("../_extensions/course-core/", import.meta.url),
  );
  await Deno.mkdir(join(root, "_extensions"));
  // Та же sibling-установка, что в Download tests/package-bytes.ts. Через
  // границу передаётся только ArtifactFiles; operation/materializer остаются Core.
  for (
    const [source, name] of [
      [extension, "course-core"],
      [dirname(await Deno.realPath(downloadSource)), "project-download"],
    ] as const
  ) {
    const installed = await new Deno.Command("cp", {
      args: ["-R", source, join(root, "_extensions", name)],
    }).output();
    assert(installed.success, "Не удалось установить " + name);
  }
  const download: unknown = await import(
    toFileUrl(join(root, "_extensions/project-download/public.ts")).href
  );
  const packageArtifact = fixtureRecord(download).packageArtifact;
  assert(
    typeof packageArtifact === "function",
    "Нет настоящего packageArtifact",
  );
  const outputDirectory = join(root, "_generated/output");
  const ledger = join(root, "execution-ledger.txt");
  const privateMarkers = [
    "PRIVATE_R_SOLUTION_8531",
    "PRIVATE_R_REFERENCE_6429",
    "reference/Secret.txt",
  ];
  function publicOnly(value: string) {
    for (const marker of privateMarkers) {
      assert(!value.includes(marker), "G1 private leak: " + marker);
    }
  }
  function nodes(value: unknown, tag: string): number {
    if (Array.isArray(value)) {
      return value.reduce<number>((sum, v: unknown) => sum + nodes(v, tag), 0);
    }
    if (!isRecord(value)) return 0;
    return Number(value.t === tag) +
      Object.values(value).reduce<number>((sum, v) => sum + nodes(v, tag), 0);
  }
  function nativeText(value: unknown): string {
    if (Array.isArray(value)) return value.map(nativeText).join("");
    if (!isRecord(value)) return "";
    if (value.t === "Str" && typeof value.c === "string") return value.c;
    if (value.t === "Space" || value.t === "SoftBreak") return " ";
    return nativeText(value.c);
  }
  function hasInlineResult(value: unknown): boolean {
    if (Array.isArray(value)) return value.some(hasInlineResult);
    return isRecord(value) &&
      ((value.t === "Para" && nativeText(value) === "Вычислено: 42.") ||
        Object.values(value).some(hasInlineResult));
  }
  const equal = (a: Uint8Array, b: Uint8Array) =>
    a.length === b.length && a.every((v, i) => v === b[i]);
  async function put(path: string, text: string) {
    await Deno.mkdir(dirname(join(root, path)), { recursive: true });
    await Deno.writeTextFile(join(root, path), text);
  }
  await put(
    "_quarto.yml",
    `project:
  type: website
  render: [index.qmd]
  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]
  post-render: [quarto run ${extension}/entrypoints/native-post.ts]
format: {html: {theme: none}}
execute: {freeze: auto, cache: true}
profile: {default: student, group: [[student, full]]}
course: {id: knitr-cache, view: student}
course-core-runtime: native-ts
course-core-projection: student
exercise-bank: true
default-exercise-statement-visibility: open
filters:
  - at: pre-ast
    path: ${extension}/native-ts/early-context.lua
  - at: post-quarto
    path: ${extension}/native-ts/late-kind.lua
  - at: post-render
    path: ${extension}/native-ts/late-filter.lua
course-project:
  starter: {path: starter}
  solutions: {reference: {path: reference}}
  build:
    files:
      build.gradle: {path: common/build.gradle, base: config}
      settings.gradle: {path: common/settings.gradle, base: config}
  instructions:
    gradle: {path: common/gradle.md, base: config}
`,
  );
  await put(
    "_quarto-full.yml",
    "course: {view: full}\ncourse-core-projection: author\n",
  );
  await put("common/build.gradle", "plugins { id 'java' }\n");
  await put("common/settings.gradle", "rootProject.name='cache-fixture'\n");
  await put("common/gradle.md", "Выполните gradle test.\n");
  await put("projects/demo/starter/Main.txt", "Открытая заготовка\n");
  await put("projects/demo/reference/Secret.txt", privateMarkers[1] + "\n");
  await put("projects/demo/native-input.qmd", "# Контекст проекта\n");
  await put("included.qmd", "INCLUDED_NATIVE_57: `r value + 2L`.\n");
  await put(
    "index.qmd",
    `---
assessment: {id: work, kind: seminar}
---
# Вычисляемая работа

::: {#exr-demo project="/projects/demo" difficulty=introductory}

\`\`\`{r}
#| label: cache-proof
#| echo: false
#| results: asis
#| fig-format: png
cat("executed\\n", file=${JSON.stringify(ledger)}, append=TRUE)
value <- 6L * 7L
cat("| computed | value |\\n|---|---:|\\n| result |", value + 1L, "|\\n\\n")
plot(1:3, c(1,4,9), type="b", main="computed")
\`\`\`

Вычислено: \`r value\`.

{{< include included.qmd >}}

::: {.solution}
${privateMarkers[0]}
:::
:::

::: {.task-items}
1. @exr-demo
:::
`,
  );
  const captures: {
    capture: number;
    operation: string;
    entries: number;
    ledger: number;
  }[] = [];
  for (const capture of [1, 2]) {
    const descriptor = await Core.withNativeCaptureScope(
      { root, projection: "author", outputDirectory },
      {
        assignment: {
          mode: "new",
          prepare: async () => ({
            expectedSources: ["index.qmd"],
            assessments: [{ source: "index.qmd", id: "work" }],
          }),
        },
      },
      (scope) =>
        scope.withPreparedOperation(async (lease) => {
          await lease.captureInputs(lease.descriptor, ["index.qmd"], {
            args: ["render", "--output-dir", "_generated/output"],
            timeoutMs: 60000,
          });
          return lease.descriptor;
        }),
    );
    const executions =
      (await Deno.readTextFile(ledger)).trim().split("\n").length;
    assert(executions === 1, "Повторный actual R-cell execution");
    await Core.withCurrentNativeOperation({
      root,
      projection: "author",
      profiles: ["full"],
      outputDirectory,
    }, async (op) => {
      assert(
        op.identity.operation === descriptor.identity.operation,
        "Чужая generation",
      );
      await op.validateRelease({ expectedSources: ["index.qmd"] });
      await op.withProjectContracts([{
        owner: root,
        directories: ["projects/demo"],
        profiles: ["full"],
        format: "html",
      }], async (batch) => {
        const context = required(required(batch.groups[0]).contexts[0]);
        const student = await Core.planProject(context, {
          audience: "student",
        });
        const full = await Core.planProject(context, { audience: "full" });
        const delivery = await op.assignmentDelivery({
          source: "index.qmd",
          assessmentId: "work",
        }, {
          projectPlans: [{
            source: "index.qmd",
            exerciseId: "exr-demo",
            student,
            full,
          }],
        });
        const condition = required(delivery.conditions["exr-demo"]);
        assert(
          nodes(condition.body, "Table") === 1 &&
            nodes(condition.body, "Image") === 1 &&
            JSON.stringify(condition.body).includes("43") &&
            hasInlineResult(condition.body),
          "Computed native Table/Image/inline42 потеряны",
        );
        assert(
          JSON.stringify(condition.body).includes("INCLUDED_NATIVE_57") &&
            JSON.stringify(condition.body).includes("44"),
          "Native include/inline result lost",
        );
        publicOnly(JSON.stringify(delivery));
        const inventory = await Core.materializeProject(student, condition, {
          submission: {
            files: [{ name: "Main.txt" }],
            instructions: "Сдайте Main.txt.",
          },
        });
        const readme = new TextDecoder().decode(
          required(inventory.files.find((f) => f.target === "README.md")).bytes,
        );
        const png = required(
          inventory.files.find((f) => f.target.endsWith(".png")),
        );
        assert(
          inventory.files.filter((f) => f.target.endsWith(".png")).length ===
              1 &&
            equal(
              png.bytes.slice(0, 8),
              new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
            ),
          "Нужен один actual PNG",
        );
        assert(
          readme.includes("Вычислено: 42.") && readme.includes("43") &&
            readme.includes("computed") && readme.includes(png.target),
          "README потерял computed content/PNG target",
        );
        // Assignment ветка normalizeDocument удаляет private solution даже при
        // actual author/full envelope; проверяется её student-projected HTML.
        const html = await Deno.readTextFile(
          join(outputDirectory, "index.html"),
        );
        publicOnly(html);
        publicOnly(readme);
        const sources = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+\.png)"/g)]
          .map((match) => required(match[1]));
        assert(
          sources.length === 1 && html.includes("Вычислено: 42.") &&
            html.includes("43") &&
            equal(
              await Deno.readFile(
                resolve(
                  outputDirectory,
                  decodeURIComponent(required(sources[0])),
                ),
              ),
              png.bytes,
            ),
          "HTML/PNG/inventory не одной generation",
        );
        const zip: unknown = await Reflect.apply(packageArtifact, download, [
          inventory,
        ]);
        assert(zip instanceof Uint8Array, "Download не вернул ZIP bytes");
        const archive = join(root, `_generated/capture-${capture}.zip`);
        await Deno.writeFile(archive, zip);
        const run = async (args: string[]) => {
          const result = await new Deno.Command("unzip", {
            args,
            stdout: "piped",
            stderr: "piped",
          }).output();
          assert(
            result.success,
            "ZIP CRC/read failure: " + new TextDecoder().decode(result.stderr),
          );
          return result.stdout;
        };
        await run(["-t", archive]);
        const names = new TextDecoder().decode(await run(["-Z1", archive]))
          .trim().split("\n").sort();
        assert(
          JSON.stringify(names) === JSON.stringify(
            inventory.files.map((f) => f.target).sort(),
          ),
          "ZIP inventory отличается",
        );
        for (const file of inventory.files) {
          publicOnly(file.target);
          publicOnly(new TextDecoder().decode(file.bytes));
          assert(
            equal(await run(["-p", archive, file.target]), file.bytes),
            "ZIP bytes отличаются: " + file.target,
          );
        }
        captures.push({
          capture,
          operation: descriptor.identity.operation,
          entries: names.length,
          ledger: executions,
        });
      });
    });
  }
  assert(
    required(captures[0]).operation !== required(captures[1]).operation,
    "Не выполнены две разные captures",
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      case: "actual-R-knitr-cache",
      retainedFixtureForReview: root,
      captures,
    }),
  );
}
