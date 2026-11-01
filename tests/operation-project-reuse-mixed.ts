import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "operation-a1-mixed-" }),
  extension = join(
    dirname(dirname(fromFileUrl(import.meta.url))),
    "_extensions/course-core",
  );
let success = false;
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const put = async (name: string, text: string) => {
  await Deno.mkdir(dirname(join(root, name)), { recursive: true });
  await Deno.writeTextFile(join(root, name), text);
};
try {
  await put(".gitignore", "/.quarto/\n**/*.quarto_ipynb\n");
  await put(
    "_quarto.yml",
    `project:\n  type: website\n  render: [index.qmd, slides.qmd]\n  output-dir: _site\n  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]\n  post-render: [quarto run ${extension}/entrypoints/native-post.ts]\nformat:\n  html: {theme: none, format-label: HTML_NATIVE}\n  revealjs: {theme: simple, format-label: REVEAL_NATIVE}\ncourse: {id: mixed-reuse, view: student}\ncourse-core-runtime: native-ts\ncourse-core-role: exercise-bank\ncourse-core-projection: student\nfilters:\n  - at: pre-ast\n    path: ${extension}/native-ts/early-context.lua\n  - at: post-quarto\n    path: ${extension}/native-ts/late-kind.lua\n  - at: post-render\n    path: ${extension}/native-ts/late-filter.lua\ncourse-project:\n  starter: {path: student}\n  build:\n    files: {shared.txt: shared/source.txt}\n`,
  );
  await put(
    "projects/a/_metadata.yml",
    "course-project:\n  starter: {path: custom-starter}\n",
  );
  await put("projects/a/custom-starter/Main.txt", "ACTUAL_COMMON_SOURCE");
  await put("shared/source.txt", "ROOT_BOUND_SOURCE");
  await put("projects/hidden/student/Hidden.txt", "HIDDEN_PROJECT");
  await put(
    "index.qmd",
    '::: {#exr-html project="/projects/a" difficulty=introductory statement-visibility=open}\nУсловие HTML.\n:::\n\n::: {#exr-hidden .content-visible when-format=latex project="/projects/hidden" difficulty=introductory statement-visibility=restricted}\nСкрытое условие.\n:::\n',
  );
  await put(
    "slides.qmd",
    '::: {#exr-slides project="/projects/a" difficulty=introductory statement-visibility=open}\nУсловие Reveal.\n:::\n',
  );
  const renders: any[] = [];
  await Core.withNativeCaptureScope(
    { root, projection: "student", outputDirectory: join(root, "_site") },
    { expectedSources: ["index.qmd", "slides.qmd"] },
    async (scope) => {
      for (
        const [source, format] of [["index.qmd", "html"], [
          "slides.qmd",
          "revealjs",
        ]]
      ) {
        await scope.captureInputs([source], async (token) => {
          const r = await new Deno.Command("quarto", {
            args: ["render", source, "--to", format],
            cwd: root,
            env: {
              COURSE_CORE_CAPTURE_TOKEN: token,
              QUARTO_RUN_NO_NETWORK: "true",
            },
            stdout: "piped",
            stderr: "piped",
          }).output();
          renders.push({ source, format, exit: r.code });
          assert(r.success, new TextDecoder().decode(r.stderr));
        });
      }
    },
  );
  await Core.withCurrentNativeOperation({
    root,
    profiles: [],
    projection: "student",
    outputDirectory: join(root, "_site"),
  }, async (op) => {
    assert(
      op.catalog.documents.every((d) =>
        !d.exercises.some((e) => e.id === "exr-hidden")
      ),
      "Hidden declaration accidentally became visible",
    );
    const requests = ["html", "revealjs"].map((format) => ({
      owner: root,
      inputs: ["projects/a/native-input.qmd"],
      profiles: [],
      format,
    }));
    let retained: any;
    await op.withProjectContexts(requests, async (batch) => {
      retained = batch;
      assert(
        batch.groups.length === 2 && batch.metrics.inspectCalls === 1,
        "Same input formats performed duplicate native probe",
      );
      for (const [index, format] of ["html", "revealjs"].entries()) {
        const ctx = batch.groups[index].contexts[0];
        assert(
          ctx.format === format &&
            ctx.effectiveMetadata["format-label"] ===
              (format === "html" ? "HTML_NATIVE" : "REVEAL_NATIVE"),
          "Format borrowed/fallback",
        );
        assert(
          ctx.origins["starter.path"].sourceFile ===
              join(root, "projects/a/_metadata.yml") &&
            ctx.origins["starter.path"].resolvedPath ===
              join(root, "projects/a/custom-starter"),
          "Native ancestor origin lost",
        );
        assert(
          ctx.origins["build.files.shared.txt"].resolvedPath ===
            join(root, "shared/source.txt"),
          "Definition base rebased",
        );
      }
      assert(
        batch.groups[0].contexts[0] !== batch.groups[1].contexts[0],
        "Distinct format context collapsed",
      );
    });
    const final = retained.metrics;
    assert(
      final.fullFences === 2 && Object.isFrozen(final),
      "Terminal snapshot/lifetime",
    );
    await op.withProjectContexts(
      requests,
      async (batch) =>
        assert(
          batch.metrics.inspectCalls === 0 &&
            batch.metrics.sourceFileReads === 0 &&
            batch.metrics.sourceCopyBytes === 0 &&
            batch.metrics.probeCacheHits === 1,
          "Identical repeated mixed batch did work",
        ),
    );
    await op.withProjectContexts([{
      owner: root,
      inputs: ["projects/hidden/native-input.qmd"],
      profiles: [],
      format: "html",
    }], async (batch) => {
      assert(
        batch.groups[0].contexts[0].origins["starter.path"].resolvedPath ===
          join(root, "projects/hidden/student"),
        "Private preprojection declaration missing",
      );
      assert(
        batch.metrics.inspectCalls === 1 &&
          batch.metrics.sourceFileReads === 0 &&
          batch.metrics.probeCacheHits === 0,
        "New instrumentation phase falsely reused old probe",
      );
    });
    console.log(
      JSON.stringify({
        root,
        renders,
        terminal: final,
        operation: op.metrics,
        privateHiddenUsed: true,
        mixedSingleProbe: true,
      }),
    );
  });
  let absent = true;
  try {
    await Deno.stat(join(root, "projects/a/native-input.qmd"));
    absent = false;
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  assert(absent, "Virtual input wrote author source");
  success = true;
  console.log(
    "PASS scoped mixed html/revealjs genuine owner witness through seal, shared input one native probe, actual format metadata/ancestor origins, hidden private declaration, repeated/new phase cache and virtual-source absence",
  );
} finally {
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Preserved mixed reuse fixture " + root);
}
