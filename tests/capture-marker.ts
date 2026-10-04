// An author-supplied capture marker cannot make a downstream adapter skip actual work.
import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "capture-marker-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
try {
  await copy(
    join(repo, "_extensions/course-core"),
    join(root, "_extensions/course-core"),
  );
  await Deno.mkdir(join(root, "_extensions/course-cloud"));
  await Deno.writeTextFile(
    join(root, "_extensions/course-cloud/_extension.yml"),
    "title: Capture marker probe\nversion: 0.0.0\ncontributes:\n  filters: [filter.lua]\n",
  );
  await Deno.writeTextFile(
    join(root, "_extensions/course-cloud/filter.lua"),
    `return {{Pandoc=function(doc)
    assert(doc.meta['course-core-processed'], 'Core must process before this adapter')
    if doc.meta['course-core-capture'] then return doc end
    local file=assert(io.open(quarto.project.directory..'/actual-adapter.txt','w'))
    file:write('ACTUAL_ADAPTER_RAN');file:close()
    return doc
  end}}`,
  );
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: default\n  output-dir: _site\n  render: [index.qmd]\ncourse:\n  id: capture-marker\nfilters: [course-core, course-cloud]\nformat: html\n",
  );
  await Deno.writeTextFile(
    join(root, "index.qmd"),
    "---\ncourse-core-capture: true\n---\n\n# Ordinary display document\n\nActual adapter work must run.\n",
  );
  const r = await new Deno.Command(quarto, {
    args: ["render", "--fail-if-warnings"],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!r.success) throw new Error(new TextDecoder().decode(r.stderr));
  let observed = "";
  try {
    observed = await Deno.readTextFile(join(root, "actual-adapter.txt"));
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  if (observed !== "ACTUAL_ADAPTER_RAN") {
    throw new Error(
      "Authored course-core-capture bypassed actual downstream adapter work",
    );
  }
  console.log(
    "PASS Core clears authored capture marker before actual downstream adapter work",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
