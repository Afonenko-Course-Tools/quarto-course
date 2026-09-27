import { dirname, fromFileUrl, join } from "stdlib/path";
import { copy } from "stdlib/fs";
import type { Course } from "../_extensions/course-core/domain/model.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "course-pedagogy-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
const cue = Deno.env.get("CUE") || "cue";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function write(path: string, text: string) { await Deno.writeTextFile(join(root, path), text); }
async function run(command: string, args: string[], expected?: string) {
  const result = await new Deno.Command(command, { args, cwd: root, stdout: "piped", stderr: "piped" }).output();
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  assert(expected ? !result.success && output.includes(expected) : result.success, output);
}
async function render(profile: string, expected?: string) {
  await run(quarto, ["render", "--profile", profile, "--fail-if-warnings"], expected);
}
const modelPath = join(root, "_generated/course-spec/course.json");
async function model(): Promise<Course> { return JSON.parse(await Deno.readTextFile(modelPath)); }
const native = `:::: {#exr-native course-role="prediction" difficulty="introductory"}
## Predict before executing

What will the program print?

::: {course-role="prerequisites"}
- [Java collections](https://docs.oracle.com/en/java/)
:::

::: {#sol-native}
The answer is a written explanation.
:::

::: {.callout-tip}
A hint with an implicit enclosing exercise.
:::

::: {.callout-tip course-role="reading"}
A visual callout retains its explicit educational role.
:::
::::

::: {.callout-tip for="exr-native"}
Check the iteration order.
:::
`;
const graded = `:::: {#exr-essay target="manual"}
## Essay

Explain a language design trade-off.

::: {.grading-notes}
PRIVATE_GRADING_GUIDANCE
::: {course-role="takeaway"}
PRIVATE_NESTED_PEDAGOGY
:::
:::
::::
`;
try {
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  await write("_quarto.yml", `project:
  type: website
  output-dir: _site
  render: [index.qmd]
course:
  schema: "1.1"
  id: pedagogy-test
  validate: true
course-pedagogy:
  document-defaults: true
filters: [course-core]
format: html
`);
  await write("_quarto-student.yml", "course:\n  view: student\n");
  await write("_quarto-full.yml", "course:\n  view: full\n");
  const roles = ["demonstration", "discussion", "self-check", "objectives", "reading", "takeaway", "limitation", "misconception", "criteria", "deliverables"];
  const rest = roles.map(role => `::: {course-role="${role}"${role === "reading" ? ' requirement="required"' : ""} for="exr-essay"}\n${role}\n:::\n`).join("\n");
  await write("index.qmd", `---\ntitle: Pedagogy\ndifficulty: intermediate\ntime: 25\nwork-mode: pair\n---\n\n${native}\n${graded}\n${rest}
::: {.when-full}
::: {course-role="discussion"}
PRIVATE_DISCUSSION
:::
:::
`);
  await render("student");
  let result = await model();
  assert(result.exercises.length === 1 && result.exercises[0].id === "exr-essay", "Native questions changed grading membership");
  const elements = result.pedagogy!.elements;
  const byId = (id: string) => elements.find(element => element.id === id)!;
  assert(byId("exr-native").kind === "prediction", "Activity role missing");
  assert(byId("exr-native").metadata?.difficulty === "introductory", "Local difficulty did not override document defaults");
  assert(byId("exr-native").metadata?.time === 25 && byId("exr-native").metadata?.workMode === "pair", "Document defaults were lost");
  assert(byId("exr-essay").metadata?.difficulty === "intermediate", "Graded exercise did not inherit difficulty");
  assert(byId("sol-native").exercise === "exr-native", "Enclosing exercise relationship was lost");
  assert(elements.find(element => element.kind === "hint")?.exercise === "exr-native", "Explicit hint relation was lost");
  assert(elements.filter(element => element.kind === "hint").length === 2, "Enclosing exercise did not establish an implicit hint relation");
  const prerequisite = elements.find(element => element.kind === "prerequisites")!;
  assert(prerequisite.exercise === "exr-native" && !prerequisite.metadata, "Auxiliary block inherited assignment metadata");
  assert(JSON.stringify(prerequisite.body).includes("https://docs.oracle.com/en/java/"), "Native link AST changed");
  assert(elements.some(element => element.kind === "reading" && element.metadata?.requirement === "required"), "Reading requirement missing");
  assert(elements.every((element, index) => element.order === index + 1 && element.source === "index.qmd"), "Source order/ownership is unstable");
  assert(!JSON.stringify(result).includes("PRIVATE_"), "Student IR includes unprojected content");
  await render("full");
  result = await model();
  assert(JSON.stringify(result.exercises[0].gradingNotes).includes("PRIVATE_GRADING_GUIDANCE"), "Full grading notes disappeared");
  assert(!JSON.stringify(result.pedagogy).includes("PRIVATE_GRADING_GUIDANCE") && !JSON.stringify(result.pedagogy).includes("PRIVATE_NESTED_PEDAGOGY"), "Private grading notes duplicated into public pedagogy");
  assert(JSON.stringify(result.pedagogy).includes("PRIVATE_DISCUSSION"), "Full profile did not project discussion");

  const vet = ["vet", join(repo, "_extensions/course-core/spec/core.cue"), "-d", "#Course", "-c"];
  for (const [rule, mutate] of [
    ["difficulty", (value: Course) => { value.pedagogy!.elements[0].metadata!.difficulty = "hard" as never; }],
    ["CORE006", (value: Course) => { value.pedagogy!.elements.push(structuredClone(value.pedagogy!.elements[0])); }],
    ["CORE007", (value: Course) => { value.pedagogy!.elements[1].exercise = "exr-missing"; }],
    ["CORE007", (value: Course) => { value.pedagogy!.elements[0].kind = "reading"; delete value.pedagogy!.elements[0].metadata; }],
  ] as [string, (value: Course) => void][]) {
    const invalid = structuredClone(result); mutate(invalid);
    await write("invalid.json", JSON.stringify(invalid));
    await run(cue, [...vet, join(root, "invalid.json")], rule);
  }
  const invalid = [
    ['::: {course-role="unknown"}\nUnknown\n:::', "Unknown course-role"],
    ['::: {#exr-bad difficulty="hard"}\nBad\n:::', "Invalid pedagogy difficulty"],
    ['::: {course-role="discussion" time="0"}\nBad\n:::', "positive integer"],
    ['::: {course-role="prerequisites" difficulty="advanced"}\nBad\n:::', "difficulty requires"],
    ['::: {#sol-orphan for="exr-missing"}\nBad\n:::', "visible exercise"],
    [native + native, "Duplicate native exercise ID"],
    ['---\ndifficulty: impossible\n---\nNo exercise', "Invalid pedagogy difficulty"],
    ['---\ncourse-pedagogy:\n  document-default: true\n---\nNo exercise', "Unknown course-pedagogy option"],
    ['::: {.when-full}\n::: {#exr-private}\nPrivate\n:::\n:::\n::: {#sol-public for="exr-private"}\nAnswer\n:::', "visible exercise"],
  ];
  for (const [qmd, expected] of invalid) {
    await write("index.qmd", qmd);
    await render("student", expected);
    try { await Deno.stat(modelPath); throw new Error("Failed render retained stale course.json"); }
    catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
  }
  console.log("Pedagogy: native/graded membership, all roles, document defaults, relationships, AST links, profile privacy, CUE and authoring rejection cases passed.");
} finally { await Deno.remove(root, { recursive: true }); }
