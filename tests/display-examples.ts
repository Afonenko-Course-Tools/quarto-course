// Native exm display examples share pedagogy and solution links, never Exercise facts.
import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { renderOwner } from "./owner-render.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "display-examples-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const example = `:::: {#exm-native course-role="prediction"}
DISPLAY_CONDITION

::: {.grading-notes}
PRIVATE_NOTES
:::

~~~{.yaml .answer-spec}
type: numeric
key: {value: 42}
# PRIVATE_KEY
~~~
::::

::: {#sol-native for="exm-native"}
DISPLAY_SOLUTION
:::
`;
const closed = `:::: {.when-full}
::: {#exm-closed course-role="self-check"}
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
    `project:\n  type: default\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: [_extensions/course-core/entrypoints/pre.ts, _extensions/course-core/entrypoints/owner-freeze.ts]\n  post-render: _extensions/course-core/entrypoints/post.ts\ncourse:\n  id: display-test\n  validate: true\nfilters: [course-core, course-presentation]\nformat: html\n`,
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
    const model = JSON.parse(
      await Deno.readTextFile(join(root, "_generated/course-spec/course.json")),
    );
    assert(
      model.exercises.length === 0,
      "Display exm entered canonical Exercise catalog",
    );
    assert(
      html.includes("DISPLAY_CONDITION") && html.includes("DISPLAY_SOLUTION"),
      "Display example or paired solution disappeared",
    );
    assert(
      model.pedagogy.elements.some((e: any) =>
        e.id === "sol-native" && e.exercise === "exm-native"
      ),
      "Example solution relationship missing",
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
  for (
    const body of [
      "::: {#sol-orphan}\nOrphan\n:::\n",
      example.replace('for="exm-native"', 'for="exm-other"'),
    ]
  ) {
    await write(body);
    await direct("student", "CORE.SOLUTION_PAIRING_INVALID");
  }
  await write(
    example +
      "\n:::: {.when-full}\n::: {#exm-native}\nDuplicate example\n:::\n::::\n",
  );
  await direct("student", "CORE.SOLUTION_PAIRING_INVALID");
  const canonical =
    '\n## Topic {#sec-topic}\n\n::: {#exr-task course-role="demonstration" difficulty="introductory"}\nCanonical condition.\n:::\n';
  await write(example + canonical);
  const rendered = await renderOwner(root, "student");
  assert(rendered.success, rendered.text);
  const model = JSON.parse(
    await Deno.readTextFile(join(root, "_generated/course-spec/course.json")),
  );
  assert(
    model.exercises.length === 1 && model.exercises[0].id === "exr-task",
    "Mixed owner promoted display example to Exercise",
  );
  await write(example + canonical.replace("exr-task", "exr-native"));
  const ambiguous = await renderOwner(root, "student");
  assert(
    !ambiguous.success &&
      ambiguous.text.includes("CORE.SOLUTION_PAIRING_INVALID"),
    "Ambiguous exr/exm suffix pairing accepted: " + ambiguous.text,
  );
  console.log(
    "PASS native display examples: student/full, closed ancestor, notes/keys, exact solution links, orphan/wrong/duplicate/ambiguous refusal and mixed canonical owner",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
