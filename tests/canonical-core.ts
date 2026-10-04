import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const output = Deno.env.get("CANONICAL_TEST_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "canonical-core-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
const selected = Deno.args[0] || "all";
if (
  ![
    "all",
    "purpose",
    "difficulty",
    "topic",
    "absent-topic",
    "display-role",
    "own-title",
    "hidden",
    "negative",
    "positive",
    "projection",
    "ownerless",
    "reference",
  ].includes(selected)
) throw new Error("Unknown canonical test selection: " + selected);
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function command(root: string, args: string[]) {
  const r = await new Deno.Command(quarto, {
    args,
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    code: r.code,
    text: new TextDecoder().decode(r.stdout) +
      new TextDecoder().decode(r.stderr),
  };
}
async function fixture(name: string, body: string) {
  const root = join(output, name);
  await Deno.mkdir(root, { recursive: true });
  for (
    const args of [[
      "create-project",
      root,
      "--type",
      "default",
      "--no-scaffold",
      "--engine",
      "markdown",
    ], ["add", repo, "--no-prompt"]]
  ) {
    const r = await command(root, args);
    assert(r.code === 0, r.text);
  }
  const write = (name: string, text: string) =>
    Deno.writeTextFile(join(root, name), text);
  await write(
    "_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: [_extensions/course-core/entrypoints/owner-freeze.ts]\nformat:\n  html:\n    theme: none\ncourse:\n  id: canonical-proof\nfilters: [course-core]\n`,
  );
  await write("_quarto-student.yml", "course:\n  view: student\n");
  await write("_quarto-full.yml", "course:\n  view: full\n");
  await write("index.qmd", body);
  const api = await import(
    new URL(
      `file://${
        join(root, "_extensions/course-core/owner-preflight/owner.ts")
      }`,
    ).href
  );
  return { root, api, write };
}
const task = (attributes: string, body = "Condition.") =>
  `::: {#exr-task ${attributes}}\n${body}\n:::\n`;
const metadata = 'course-role="demonstration" difficulty="introductory"';
const topic = "## Topic {#sec-topic}\n\n";
console.log(`Canonical evidence: ${output}`);
const negatives: [string, string, string][] = [
  [
    "purpose",
    topic + task('difficulty="introductory"'),
    "CORE.EXERCISE_PURPOSE_REQUIRED",
  ],
  [
    "difficulty",
    "---\ndifficulty: introductory\ncourse-pedagogy:\n  document-defaults: true\n---\n" +
    topic + task('course-role="demonstration"'),
    "CORE.EXERCISE_DIFFICULTY_REQUIRED",
  ],
  [
    "topic",
    "## Automatic\n\n" + task(metadata),
    "CORE.EXERCISE_SOURCE_TOPIC_REQUIRED",
  ],
  ["absent-topic", task(metadata), "CORE.EXERCISE_SOURCE_TOPIC_REQUIRED"],
  [
    "display-role",
    topic + task('course-role="prediction" difficulty="introductory"'),
    "CORE.EXERCISE_PURPOSE_REQUIRED",
  ],
  [
    "own-title",
    task(metadata, "## Title {#sec-own-title}\n\nCondition."),
    "CORE.EXERCISE_SOURCE_TOPIC_REQUIRED",
  ],
  [
    "hidden",
    topic + ":::: {.when-full}\n" + task('course-role="control"') + "::::\n",
    "CORE.EXERCISE_DIFFICULTY_REQUIRED",
  ],
];
for (const [name, body, code] of negatives) {
  if (selected === "all" || selected === name || selected === "negative") {
    const f = await fixture(name, body);
    let error: any;
    try {
      await f.api.prepareOwner(f.root, {
        attemptId: "canonical-" + name,
        profile: "student",
      });
    } catch (e) {
      error = e;
    }
    await Deno.writeTextFile(
      join(output, name + "-result.json"),
      JSON.stringify(error, null, 2),
    );
    assert(
      error?.code === "CORE.INVENTORY_INVALID" &&
        error?.cause?.diagnostics?.some((x: any) => x.code === code),
      `${name}: expected ${code}; got ${JSON.stringify(error)}`,
    );
    console.log(`PASS ${name}: ${code}`);
  }
}
if (["all", "positive"].includes(selected)) {
  const f = await fixture(
    "positive",
    topic + task(metadata, "Condition.\n\n::: {#sol-task}\nDEMO_SOLUTION\n:::"),
  );
  const r = await f.api.runOwner(f.root, "student");
  await Deno.writeTextFile(
    join(output, "positive-result.json"),
    JSON.stringify(r, null, 2),
  );
  assert(r.exitCode === 0, JSON.stringify(r));
  const files = [
    ...Deno.readDirSync(join(r.stage, "_generated/course-spec/core")),
  ];
  const fragment = JSON.parse(
    await Deno.readTextFile(
      join(r.stage, "_generated/course-spec/core", files[0].name),
    ),
  );
  assert(
    fragment.exercises.length === 1,
    "native no-target exr was not extracted as Exercise",
  );
  const exercise = fragment.exercises[0];
  assert(
    exercise.target === "manual" && exercise.authoredTarget === undefined,
    "manual internal binding differs",
  );
  assert(
    exercise.purpose === "demonstration" &&
      exercise.difficulty === "introductory",
    "canonical metadata missing",
  );
  assert(
    exercise.sourceTopic.id === "sec-topic" &&
      exercise.sourceTopic.owner === "canonical-proof" &&
      exercise.sourceTopic.rootQmd === "index.qmd",
    "source topic not proven",
  );
  const html = await Deno.readTextFile(join(r.stage, "_site/index.html"));
  assert(
    html.includes("DEMO_SOLUTION"),
    "demonstration solution absent from student",
  );
  console.log(
    "PASS native paragraph-only no-target canonical Exercise and demonstration solution",
  );
}
if (["all", "projection"].includes(selected)) {
  const body = topic +
    task(
      'course-role="independent-study" difficulty="intermediate"',
      "PUBLIC_CONDITION\n\n- [PUBLIC_CORRECT_OPTION]{.correct}\n- Public other option.\n\n::: {#sol-task}\nPRIVATE_ORDINARY_SOLUTION\n:::\n\n```{.yaml .answer-spec}\ntype: numeric\nkey: {value: 123456789}\n# PRIVATE_STRUCTURED_KEY\n```\n\n::: {.grading-notes}\nPRIVATE_NOTES\n:::",
    ) +
    '\n::: {#exr-control course-role="control" difficulty="advanced"}\nPRIVATE_CONTROL\n\n![Private](secret.svg)\n:::\n\n::: {#sol-control}\nPRIVATE_CONTROL_SOLUTION\n:::\n\n::: {.callout-tip for="exr-control"}\nPRIVATE_CONTROL_HINT\n:::\n';
  const f = await fixture("projection", body);
  await f.write(
    "secret.svg",
    '<svg xmlns="http://www.w3.org/2000/svg"><text>PRIVATE_RESOURCE</text></svg>',
  );
  for (const profile of ["student", "full"]) {
    const r = await f.api.runOwner(f.root, profile);
    await Deno.writeTextFile(
      join(output, "projection-" + profile + "-result.json"),
      JSON.stringify(r, null, 2),
    );
    assert(r.exitCode === 0, JSON.stringify(r));
    const html = await Deno.readTextFile(join(r.stage, "_site/index.html"));
    const fragments = [
      ...Deno.readDirSync(join(r.stage, "_generated/course-spec/core")),
    ];
    const fragment = await Deno.readTextFile(
      join(r.stage, "_generated/course-spec/core", fragments[0].name),
    );
    assert(
      html.includes("PUBLIC_CORRECT_OPTION"),
      "whole correct option hidden",
    );
    if (profile === "student") {
      assert(
        !html.includes("PRIVATE_") && !fragment.includes("PRIVATE_"),
        "student HTML/Core model leaks closed canonical material",
      );
      const search = await Deno.readTextFile(
        join(r.stage, "_site/search.json"),
      );
      assert(
        !search.includes("PRIVATE_"),
        "student search leaks closed canonical material",
      );
      assert(
        !html.includes('class="correct"'),
        "student exposes correct marker",
      );
      try {
        await Deno.stat(join(r.stage, "_site/secret.svg"));
        throw new Error("student published private managed resource");
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) throw e;
      }
    } else {for (
        const marker of [
          "PRIVATE_CONTROL",
          "PRIVATE_ORDINARY_SOLUTION",
          "PRIVATE_CONTROL_SOLUTION",
          "PRIVATE_CONTROL_HINT",
          "PRIVATE_NOTES",
          "PRIVATE_STRUCTURED_KEY",
        ]
      ) assert(html.includes(marker), `full lost ${marker}`);}
  }
  console.log(
    "PASS control and solution student/full native HTML/search/resource projection",
  );
}
if (["all", "ownerless"].includes(selected)) {
  const f = await fixture("ownerless", topic + task(metadata));
  const result = await command(f.root, ["render", "--profile", "student"]);
  await Deno.writeTextFile(join(output, "ownerless.log"), result.text);
  assert(
    result.code !== 0 &&
      result.text.includes("SOURCE.OWNER_PREFLIGHT_REQUIRED"),
    result.text,
  );
  console.log(
    "PASS ownerless canonical render refuses with SOURCE.OWNER_PREFLIGHT_REQUIRED",
  );
}
if (["all", "reference"].includes(selected)) {
  const f = await fixture(
    "reference",
    topic + task('course-role="control" difficulty="advanced"') +
      "\nVisible [task](#exr-task).\n",
  );
  let error: any;
  try {
    await f.api.prepareOwner(f.root, {
      attemptId: "canonical-reference",
      profile: "student",
    });
  } catch (e) {
    error = e;
  }
  await Deno.writeTextFile(
    join(output, "reference-result.json"),
    JSON.stringify(error, null, 2),
  );
  assert(
    error?.code === "CORE.INVENTORY_INVALID" &&
      error?.cause?.diagnostics?.some((x: any) =>
        x.code === "CORE.PROFILE_REFERENCE_INTEGRITY"
      ),
    JSON.stringify(error),
  );
  console.log(
    "PASS visible link to excluded control refuses through CUE profile integrity",
  );
}
