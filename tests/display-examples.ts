// Native exm display examples share pedagogy and solution links, never Exercise facts.
import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { assemble } from "../_extensions/course-core/domain/assemble.ts";
async function modelFor(profile:string){const entries=[...Deno.readDirSync(join(root,"_generated/course-spec/documents",profile))];const doc=JSON.parse(await Deno.readTextFile(join(root,"_generated/course-spec/documents",profile,entries[0].name)));return assemble([doc.source],new Map([[doc.source,doc]]),[])}
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "display-examples-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const example = `:::: {#exm-native course-role="discussion"}
DISPLAY_CONDITION

::: {.grading-notes}
PRIVATE_NOTES
:::

~~~{.yaml .answer-spec}
type: numeric
key: {value: 42, tolerance: {absolute: 0}}
# PRIVATE_KEY
~~~
::::

::: {#sol-native}
DISPLAY_SOLUTION
:::
`;
const closed = `:::: {.content-visible when-profile=full}
::: {#exm-closed course-role="discussion"}
PRIVATE_EXAMPLE
:::
::::

::: {#sol-closed}
PRIVATE_EXAMPLE_SOLUTION
:::
`;
async function write(body: string) {
  await Deno.writeTextFile(join(root, "index.qmd"), body);
}
async function direct(profile: "student" | "full", expected?: string) {
  const r = await new Deno.Command(quarto, {
    args: [
      "render",
      "--profile",
      profile,
      "--to",
      "html",
      "--fail-if-warnings",
    ],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(r.stdout) +
    new TextDecoder().decode(r.stderr);
  assert(
    expected ? !r.success && text.includes(expected) : r.success,
    `${expected || "success"}: ${text}`,
  );
}
try {
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    `project:\n  type: default\n  output-dir: _site\n  render: [index.qmd]\ncourse:\n  id: display-test\n  validate: true\nfilters: [course-core, course-presentation]\nformat: html\n`,
  );
  for (const profile of ["student", "full"]) {
    await Deno.writeTextFile(
      join(root, `_quarto-${profile}.yml`),
      `course:\n  view: ${profile}\n`,
    );
  }
  const bare =
    "\n::: {#exm-bare}\nBare display example.\n:::\n\n::: {#sol-bare}\nBare explanation.\n:::\n";
  await write(example + closed + bare);
  for (const profile of ["student", "full"] as const) {
    await direct(profile);
    const html = await Deno.readTextFile(join(root, "_site/index.html"));
    const model = await modelFor(profile);
    assert(
      model.exercises.length === 0,
      "Display exm entered canonical Exercise catalog",
    );
    assert(
      html.includes("DISPLAY_CONDITION") && html.includes("DISPLAY_SOLUTION"),
      "Display example or paired solution disappeared",
    );

    assert(
      profile === "full"
        ? html.includes("PRIVATE_EXAMPLE_SOLUTION") &&
          html.includes("PRIVATE_NOTES")
        : !html.includes("PRIVATE_") &&
          !JSON.stringify(model).includes("PRIVATE_"),
      "Example privacy projection changed",
    );
  }
  await write("::: {#sol-orphan}\nOrphan native solution\n:::\n");
  await direct("student");

  await write(
    example +
      "\n:::: {.content-visible when-profile=full}\n::: {#exm-native}\nDuplicate example\n:::\n::::\n",
  );
  await direct("student");
  const canonical =
    '\n## Topic {#sec-topic}\n\n::: {#exr-task course-role="demonstration" difficulty="introductory"}\nCanonical condition.\n:::\n';
  await write(example + canonical);
  await direct("student");
  const model = await modelFor("student");
  assert(
    model.exercises.length === 0,
    "Mixed owner promoted display example to Exercise",
  );
  await write(example + canonical.replace("exr-task", "exr-native"));
  await direct("student");
  console.log(
    "PASS native display examples: student/full, closed ancestor, notes/keys, exact solution links, native orphan and duplicates and mixed canonical owner",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
