import { dirname, fromFileUrl, join } from "stdlib/path";
const root = dirname(dirname(fromFileUrl(import.meta.url)));
const quarto = Deno.env.get("QUARTO") || "quarto";
for (
  const args of [
    [
      "pandoc",
      "tests/fixtures/canonical-core/projection.qmd",
      "--lua-filter",
      "tests/canonical-topology.lua",
      "--lua-filter",
      "tests/canonical-projection.lua",
      "-t",
      "markdown",
    ],
  ]
) {
  const r = await new Deno.Command(quarto, {
    cwd: root,
    args,
    env: { CANONICAL_EXTENSION: join(root, "_extensions/course-core") },
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!r.success) throw new Error(new TextDecoder().decode(r.stderr));
}
console.log(
  "PASS native source topology and student projection including conditional Span → Note → canonical Div",
);
