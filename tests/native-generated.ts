import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url))),
  root = await Deno.makeTempDir({ prefix: "native-jupyter-" }),
  quarto = Deno.env.get("QUARTO") || "quarto";
try {
  await copy(
    join(repo, "_extensions/course-core"),
    join(root, "_extensions/course-core"),
  );
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: default\n  output-dir: _site\ncourse:\n  id: generated-python\n  view: student\nfilters: [course-core]\nexercise-bank: true\nexercise-statement-visibility: open\nformat:\n  html:\n    theme: none\n",
  );
  const markup =
    "## Generated topic {#sec-generated-topic}\n\n:::: {#exr-generated course-role=independent-study difficulty=introductory time=10}\nGENERATED_PUBLIC\n\n~~~{.yaml .answer-spec}\ntype: numeric\nkey: {value: 987654, tolerance: {absolute: 0}}\n~~~\n::::";
  await Deno.writeTextFile(
    join(root, "index.qmd"),
    "---\njupyter: python3\n---\n# Topic {#sec-topic}\n\n```{python}\n#| echo: false\nfrom IPython.display import Markdown, display\ndisplay(Markdown(" +
      JSON.stringify(markup) + "))\n```\n",
  );
  const r = await new Deno.Command(quarto, {
    args: ["render", "index.qmd"],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!r.success) {
    throw Error(
      new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr),
    );
  }
  const dir = join(root, "_generated/course-spec/documents/student"),
    file = [...Deno.readDirSync(dir)][0].name,
    doc = JSON.parse(await Deno.readTextFile(join(dir, file)));
  if (
    doc.exercises[0]?.id !== "exr-generated" ||
    doc.body.publicAnswers["exr-generated"].answerType !== "numeric" ||
    JSON.stringify(doc).includes("987654")
  ) throw Error("generated Jupyter answer validation/projection failed");
  console.log(
    "PASS actual native Jupyter generated exercise and valid answer bank",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
