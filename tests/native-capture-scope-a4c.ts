import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const extension = join(
  dirname(dirname(fromFileUrl(import.meta.url))),
  "_extensions/course-core",
);
const root = await Deno.makeTempDir({ prefix: "a4c-mixed-" });
const check = (ok: unknown, name: string) => {
  if (!ok) throw Error(name);
};
await Deno.writeTextFile(
  join(root, "_quarto.yml"),
  `project:
  type: website
  render: [index.qmd, slides.qmd]
  output-dir: _site
  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]
  post-render: [quarto run ${extension}/entrypoints/native-post.ts]
format:
  revealjs: {theme: simple}
course: {id: mixed-course, view: student}
course-core-runtime: native-ts
course-core-role: page
filters:
  - at: pre-ast
    path: ${extension}/native-ts/early-context.lua
  - at: post-quarto
    path: ${extension}/native-ts/late-kind.lua
  - at: post-render
    path: ${extension}/native-ts/late-filter.lua
`,
);
await Deno.writeTextFile(
  join(root, "index.qmd"),
  "---\nformat: html\n---\n# Страница\n\nОбычная страница.\n",
);
await Deno.writeTextFile(
  join(root, "slides.qmd"),
  "# Слайды\n\nNative revealjs.\n",
);

await Deno.writeTextFile(
  join(root, "_quarto-student.yml"),
  "course: {view: student}\n",
);
await Deno.writeTextFile(
  join(root, "_quarto.yml"),
  (await Deno.readTextFile(join(root, "_quarto.yml"))) +
    "\nprofile:\n  default: student\n",
);
const reservation = {
  root,
  projection: "student" as const,
  outputDirectory: join(root, "_site"),
};
let pendingBefore = "", pendingOperations: string[] = [];
const renders: { source: string; code: number; seconds: number }[] = [];
await Core.withNativeCaptureScope(reservation, {
  expectedSources: ["index.qmd", "slides.qmd"],
}, async (scope) => {
  try {
    await Core.withPendingNativeOperation(
      { ...reservation, profiles: [] },
      async () => {},
    );
  } catch (e) {
    pendingBefore = String(e);
  }
  check(
    pendingBefore.includes("OPERATION_INCOMPLETE"),
    "reservation has no pending descriptor",
  );
  for (const source of ["index.qmd", "slides.qmd"]) {
    await scope.captureInputs([source], async (token) => {
      const started = performance.now();
      const r = await new Deno.Command("quarto", {
        args: [
          "render",
          source,
          "--to",
          source === "index.qmd" ? "html" : "revealjs",
        ],
        cwd: root,
        env: {
          COURSE_CORE_CAPTURE_TOKEN: token,
          QUARTO_RUN_NO_NETWORK: "true",
          DENO_NO_PACKAGE_JSON: "1",
        },
        stdout: "piped",
        stderr: "piped",
      }).output();
      renders.push({
        source,
        code: r.code,
        seconds: (performance.now() - started) / 1000,
      });
      check(
        r.success || (console.error(new TextDecoder().decode(r.stderr)), false),
        "actual scoped child",
      );
    });
    await Core.withPendingNativeOperation({
      ...reservation,
      profiles: ["student"],
    }, async (op) => {
      pendingOperations.push(op.identity.operation);
      check(op.inputs.length === 2, "all expected inputs bound once");
    });
  }
});
await Core.withCurrentNativeOperation({
  ...reservation,
  profiles: ["student"],
  expectedDocuments: [{ source: "index.qmd", format: "html" }, {
    source: "slides.qmd",
    format: "revealjs",
  }],
}, async (op) => {
  check(
    new Set(pendingOperations).size === 1 &&
      pendingOperations[0] === op.identity.operation,
    "one generation for sequence",
  );
  check(
    JSON.stringify(op.identity.profiles) === '["student"]',
    "actual implicit profiles",
  );
  check(op.catalog.documents.length === 2, "union of current captures");
  check(
    op.metrics.inspectCalls === 1 && op.metrics.fullWalks === 1,
    "one inspect and initial snapshot",
  );
  check(
    op.metrics.fullSourceFences === 3 && op.metrics.runtimeHashReads === 5,
    "scoped pending uses local source/runtime guards",
  );
  const proof = await op.validateRelease({
    expectedSources: ["index.qmd", "slides.qmd"],
  });
  console.log(
    JSON.stringify({
      root,
      renders,
      identity: op.identity,
      metrics: op.metrics,
      proof,
    }),
  );
});
console.log("PASS scoped sequential native capture with implicit profiles");
