import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { loadNativeRun } from "../_extensions/course-core/infrastructure/native-run.ts";
import { assembleRelease } from "../_extensions/course-core/domain/release.ts";
const root = await Deno.makeTempDir({ prefix: "native-lifecycle-" }),
  repo = dirname(dirname(fromFileUrl(import.meta.url))),
  quarto = Deno.env.get("QUARTO") || "quarto";
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
async function write(p: string, v: string) {
  await Deno.writeTextFile(join(root, p), v);
}
async function render(args: string[] = [], error?: string) {
  const r = await new Deno.Command(quarto, {
    args: ["render", ...args, "--profile", "student"],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(r.stdout) +
    new TextDecoder().decode(r.stderr);
  assert(error ? !r.success && text.includes(error) : r.success, text);
}
const page = (id: string) =>
  `# Topic {#sec-${id}}\n\n::: {#exr-${id} course-role="independent-study" difficulty="introductory"}\nPublic condition\n:::\n`;
try {
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  await write(
    "_quarto.yml",
    "project:\n  type: default\n  output-dir: _site-student\n  render: [index.qmd, second.qmd]\n  pre-render: _extensions/course-core/entrypoints/pre.ts\n  post-render: _extensions/course-core/entrypoints/post.ts\nfilters: [course-core]\ncourse:\n  id: lifecycle\nformat:\n  html:\n    theme: none\n",
  );
  await write("_quarto-student.yml", "course:\n  view: student\n");
  await write("index.qmd", page("index"));
  await write("second.qmd", page("second"));
  await render();
  let run = await loadNativeRun(root, { view: "student" });
  assert(
    run.documents.length === 2 && run.outputFiles.length === 2,
    "full current inputs missing",
  );
  assembleRelease(run.documents.map((d) => d.source), run.documents, [], {
    view: "student",
    profiles: ["student"],
  });
  await write(
    "fail.lua",
    'return {{Pandoc=function(doc) error("LATE_NATIVE_FAILURE") end}}',
  );
  await render(
    ["index.qmd", "--lua-filter", "fail.lua"],
    "LATE_NATIVE_FAILURE",
  );
  let failed = false;
  try {
    await loadNativeRun(root);
  } catch {
    failed = true;
  }
  assert(failed, "late failure accepted previous completion");
  await render(["index.qmd"]);
  run = await loadNativeRun(root);
  assert(
    run.documents.length === 1,
    "selected render adopted retained document",
  );
  await Deno.remove(join(root, "second.qmd"));
  const config = await Deno.readTextFile(join(root, "_quarto.yml"));
  await write(
    "_quarto.yml",
    config.replace("[index.qmd, second.qmd]", "[index.qmd]"),
  );
  await render();
  run = await loadNativeRun(root);
  assert(
    run.documents.length === 1 &&
      !run.outputFiles.some((p) => p.endsWith("second.html")),
    "removed input retained as current",
  );
  // Native book writer selects the real chapter URL, using the same current bridge.
  await write(
    "_quarto.yml",
    config.replace("type: default", "type: book").replace(
      "  render: [index.qmd, second.qmd]\n",
      "",
    ) + "book:\n  title: Native book\n  chapters: [index.qmd, chapter.qmd]\n",
  );
  await write("chapter.qmd", page("chapter"));
  await render();
  run = await loadNativeRun(root);
  assert(
    run.documents.length === 2 &&
      run.outputFiles.some((p) => p.endsWith("/chapter.html")),
    "book current chapter output missing",
  );
  await write(
    "_quarto.yml",
    (await Deno.readTextFile(join(root, "_quarto.yml"))).replace(
      "  pre-render: _extensions/course-core/entrypoints/pre.ts\n",
      "",
    ).replace(
      "  post-render: _extensions/course-core/entrypoints/post.ts\n",
      "",
    ),
  );
  await render(["index.qmd"]);
  let stale = false;
  try {
    await loadNativeRun(root);
    stale = true;
  } catch {}
  assert(!stale, "hookless render retained completed native-run");
  console.log(
    "PASS ordinary hooks, late failure/retry, selected capture, removed input, native book outputs",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
