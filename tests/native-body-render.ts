import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { buildBodies } from "../_extensions/course-core/body-export/producer.ts";
const root = await Deno.makeTempDir({ prefix: "native-body-render-" }),
  repo = dirname(dirname(fromFileUrl(import.meta.url))),
  quarto = Deno.env.get("QUARTO") || "quarto";
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
try {
  await copy(
    join(repo, "_extensions/course-core"),
    join(root, "_extensions/course-core"),
  );
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: default\n  output-dir: _site\ncourse:\n  id: actual-body\nfilters: [course-core]\nexercise-bank: true\nexercise-statement-visibility: open\nformat:\n  html:\n    theme: none\n",
  );
  for (const view of ["student", "full"]) {
    await Deno.writeTextFile(
      join(root, "_quarto-" + view + ".yml"),
      "course:\n  view: " + view + "\nproject:\n  output-dir: _site-" + view +
        "\n",
    );
  }
  await Deno.writeTextFile(join(root, "_quarto-extra.yml"), "{}\n");
  await Deno.mkdir(join(root, "nested/assets"), { recursive: true });
  await Deno.writeTextFile(
    join(root, "nested/assets/public.txt"),
    "PUBLIC_BYTES",
  );
  await Deno.writeTextFile(join(root, "private.txt"), "PRIVATE_BYTES");
  await Deno.writeTextFile(
    join(root, "nested/assets/public.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>',
  );
  await Deno.writeTextFile(
    join(root, "nested/index.qmd"),
    `---
assessment:
  kind: lab
---
# Work {#sec-work}

::::: {.content-visible when-profile=extra}
:::: {#exr-public course-role="independent-study" difficulty="introductory" time=10}
PUBLIC_CONDITION [Download](assets/public.txt)

![Public diagram](assets/public.svg)

~~~{.yaml .answer-spec}
type: numeric
key: {value: 314159, tolerance: {absolute: 0}}
~~~

::: {.grading-notes}
PRIVATE_NOTES
:::
::::

:::::

::: {#sol-public}
PRIVATE_SIBLING_SOLUTION
:::

:::: {.content-visible when-profile=full}
::: {#exr-closed course-role="control" difficulty="advanced" time=10}
PRIVATE_CONDITION [Private](../private.txt)
:::
::::

::: {.task-items}
1. @exr-public
:::
`,
  );
  for (const view of ["student", "full"]) {
    const r = await new Deno.Command(quarto, {
      args: ["render", "nested/index.qmd", "--profile", view + ",extra"],
      cwd: root,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(r.success, new TextDecoder().decode(r.stderr));
    const directory = join(root, "_generated/course-spec/documents", view),
      file = [...Deno.readDirSync(directory)][0].name,
      doc = JSON.parse(await Deno.readTextFile(join(directory, file)));
    const result = await buildBodies(doc, {
      projectRoot: root,
      includeClosed: view === "full",
    });
    assert(
      result.publicPackage.questions.length === 1 &&
        result.publicPackage.questions[0].answerType === "numeric",
      "public selected answer type lost",
    );
    assert(
      result.publicPackage.resources.length === 2 &&
        atob(result.publicPackage.resources[0].data) === "PUBLIC_BYTES",
      "public resource bytes lost",
    );
    assert(
      result.publicPackage.resources[0].target === "nested/assets/public.txt" &&
        JSON.stringify(result.publicPackage.questions[0].condition).includes(
          "nested/assets/public.txt",
        ),
      "nested Body URL does not match manifest target",
    );
    assert(
      result.publicPackage.resources.some((resource) =>
        resource.target === "nested/assets/public.svg"
      ) &&
        JSON.stringify(result.publicPackage.questions[0].condition).includes(
          "nested/assets/public.svg",
        ),
      "actual native Image resource or rewritten URL missing",
    );
    assert(
      !JSON.stringify(result.publicPackage).match(
        /PRIVATE_|314159|private\.txt/,
      ),
      "public Body leaked closed data",
    );
    if (view === "full") {
      assert(
        JSON.stringify(result.package).includes("PRIVATE_SIBLING_SOLUTION") &&
          JSON.stringify(result.package).includes("PRIVATE_NOTES") &&
          JSON.stringify(result.package).includes("314159"),
        "full Body lost actual partitions",
      );
    }
  }
  console.log(
    "PASS actual native public/full Body answer prompts, sibling solution, notes and resource bytes",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
