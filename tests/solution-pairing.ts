import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";

// Original declarations must be valid before either audience is projected.
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "course-original-solutions-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
const selected = Deno.args[0] || "all";
if (!["all", "negative", "positive"].includes(selected)) {
  throw new Error("SOLUTION_PAIRING_TEST: unknown selection " + selected);
}
const example = (id: string, content: string) =>
  `:::: {#exm-${id}}\n${content}\n::::\n`;
const solution = (id: string, content = "SOLUTION_MARKER") =>
  `::: {#sol-${id}}\n${content}\n:::\n`;
const negative = [
  {
    name: "hidden duplicate",
    body: example("task", "EXAMPLE_MARKER") +
      `:::: {.when-full}\n${solution("task")}${solution("task")}::::\n`,
    expected: "Повторный идентификатор учебного элемента: sol-task",
  },
  {
    name: "hidden wrong enclosing example",
    body: example("one", `::: {.when-full}\n${solution("two")}:::\n`) +
      example("two", "EXAMPLE_MARKER"),
    expected: "CORE.SOLUTION_PAIRING_INVALID: sol-two",
  },
  {
    name: "hidden duplicate through inline note",
    body: example("task", "EXAMPLE_MARKER") + solution("task") +
      "\n[Note[^duplicate]]{.when-full}\n\n[^duplicate]:\n" +
      "    ::: {#sol-task}\n    HIDDEN_SOLUTION\n    :::\n",
    expected: "Повторный идентификатор учебного элемента: sol-task",
  },
  {
    name: "hidden wrong enclosing example through inline note",
    body: example(
      "one",
      "[Note[^wrong]]{.when-full}\n\n[^wrong]:\n" +
        "    ::: {#sol-two}\n    HIDDEN_SOLUTION\n    :::\n",
    ) +
      example("two", "EXAMPLE_MARKER"),
    expected: "CORE.SOLUTION_PAIRING_INVALID: sol-two",
  },
];
const positive = [
  {
    name: "nested pair",
    body: example("task", solution("task")),
    closed: false,
  },
  {
    name: "external pair",
    body: example("task", "EXAMPLE_MARKER") + solution("task"),
    closed: false,
  },
  {
    name: "explicitly closed nested pair",
    body: example("task", `::: {.when-full}\n${solution("task")}:::\n`),
    closed: true,
  },
];
try {
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: website\n  render: [index.qmd]\n  output-dir: _site\n" +
      "format:\n  html:\n    theme: none\nfilters: [course-core]\ncourse:\n  id: original-solutions\n",
  );
  for (const profile of ["student", "full"] as const) {
    await Deno.writeTextFile(
      join(root, `_quarto-${profile}.yml`),
      `course:\n  view: ${profile}\n`,
    );
    const cases = [
      ...(selected !== "positive" ? negative : []),
      ...(selected !== "negative" ? positive : []),
    ];
    for (const test of cases) {
      await Deno.writeTextFile(
        join(root, "index.qmd"),
        "# Original solution declarations {#sec-original}\n\n" + test.body,
      );
      const result = await new Deno.Command(quarto, {
        args: [
          "render",
          ".",
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
      const text = new TextDecoder().decode(result.stdout) +
        new TextDecoder().decode(result.stderr);
      if ("expected" in test) {
        if (result.success || !text.includes(test.expected)) {
          throw new Error(
            `${profile}: ${test.name}: expected ${test.expected}\n${text}`,
          );
        }
      } else {
        if (!result.success) {
          throw new Error(`${profile}: ${test.name}\n${text}`);
        }
        const html = await Deno.readTextFile(join(root, "_site/index.html"));
        if (
          html.includes("SOLUTION_MARKER") !==
            (!test.closed || profile === "full")
        ) {
          throw new Error(
            `${profile}: ${test.name}: solution projection changed`,
          );
        }
      }
      console.log(`PASS ${profile}: ${test.name}`);
    }
  }
} finally {
  await Deno.remove(root, { recursive: true });
}
