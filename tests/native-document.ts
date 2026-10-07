import { dirname, fromFileUrl, join } from "stdlib/path";
import { copy } from "stdlib/fs";
import type { DocumentResult } from "../_extensions/course-core/domain/model.ts";

// These renders exercise the public native command: no Owner helpers/hooks.
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "course-native-document-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
const selection = Deno.args[0] || "all";
const started = performance.now();
let nativeCommands = 0;
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function write(name: string, value: string) {
  await Deno.writeTextFile(join(root, name), value);
}
async function render(view = "student", format = "html", expected?: string) {
  nativeCommands++;
  const result = await new Deno.Command(quarto, {
    args: ["render", "index.qmd", "--profile", view, "--to", format, "--fail-if-warnings"],
    cwd: root, stdout: "piped", stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  assert(expected ? !result.success && text.includes(expected) : result.success,
    `${view}/${format}: expected ${expected || "successful ordinary native render"}\n${text}`);
  if (expected) assert(text.includes("источник=") && text.includes("index.qmd"), "missing authored input context: " + text);
  if (expected?.includes("с помощью CUE")) assert(text.includes("missing-cue"), "native CUE refusal lost original launch detail: " + text);
  if (expected?.includes("CORE.METADATA_INVALID")) assert(text.includes("объект=exr-hidden") && text.includes("поле=difficulty"), "missing hidden object/field context: " + text);
  if (expected?.startsWith("CORE.ADAPTER_INVALID")) assert(text.includes("объект=missing-adapter") && text.includes("поле=course.adapters"), "missing adapter object/field context: " + text);
  if (expected === "CORE.DUPLICATE_DECLARATION") assert(text.includes("связано:") && text.includes("объект=exr-duplicate"), "missing duplicate declaration context: " + text);
}
async function document(view: string, format = "html"): Promise<DocumentResult> {
  const directory = join(root, "_generated/course-spec/documents", view);
  const files = [];
  const formats = [];
  for await (const entry of Deno.readDir(directory)) {
    if (entry.isFile && entry.name.endsWith(".json")) {
      const value = JSON.parse(await Deno.readTextFile(join(directory, entry.name)));
      formats.push(value.document.format);
      if (value.document.format === format) files.push(value);
    }
  }
  assert(files.length === 1, `expected one ${view}/${format} document, found ${files.length}; formats: ${formats.join(", ")}`);
  return files[0];
}
const task = (id: string, attributes = 'course-role="independent-study" difficulty="introductory"', body = "PUBLIC_CONDITION") =>
  `:::: {#exr-${id} ${attributes}}\n${body}\n::::\n`;
const topic = "## Native topic {#sec-topic}\n\n";
async function main() {
try {
  await copy(join(repo, "_extensions/course-core"), join(root, "_extensions/course-core"));
  await write("_quarto.yml", "project:\n  type: default\n  render: [index.qmd, retained.qmd]\n  output-dir: _site\nformat:\n  html:\n    theme: none\nfilters: [course-core]\ncourse:\n  id: native-document\n");
  for (const view of ["student", "full"]) await write(`_quarto-${view}.yml`, `course:\n  view: ${view}\n`);
  await write("retained.qmd", "## Retained document {#sec-retained}\n\n" + task("retained"));
  if (selection === "adapter-invalid") {
    await write("index.qmd", "---\ncourse:\n  adapters: [missing-adapter]\n---\n" + topic + task("task"));
    await render("student", "html", "CORE.ADAPTER_INVALID: Требуется ровно один установленный пакет адаптера");
    await write("index.qmd", topic + task("task"));
    await render();
    console.log("PASS named missing adapter context and unconfigured passive adapter path");
    return;
  }
  if (selection === "answer-tool-missing") {
    const originalCue = Deno.env.get("CUE");
    try {
      Deno.env.set("CUE", join(root, "missing-cue"));
      await write("index.qmd", topic + task("task", undefined, ["~~~~{.yaml .answer-spec}", "type: manual", "submission: text", "~~~~"].join(String.fromCharCode(10))));
      await render("student", "html", "ANSWER_INVALID: Не удалось проверить контракт ответа с помощью CUE");
      console.log("PASS neutral native CUE refusal with original launch detail");
    } finally {
      if (originalCue === undefined) Deno.env.delete("CUE"); else Deno.env.set("CUE", originalCue);
    }
    return;
  }
  if (selection === "answer-invalid") {
    await write("index.qmd", topic + task("hidden", 'course-role="control" difficulty="advanced"', "```{.yaml .answer-spec}\ntype: numeric\nkey: {value: invalid}\n```"));
    await render("student", "html", "ANSWER_INVALID");
    console.log("PASS hidden malformed answer rejected before student projection");
    return;
  }
  if (selection === "query") {
    await write("index.qmd", topic + task("hidden", 'course-role="control" difficulty="advanced" .content-visible when-profile=full') + "\n[Hidden](?v=1#exr-hidden).\n");
    await render("student", "html", "CORE.PROFILE_REFERENCE_INTEGRITY");
    console.log("PASS query-only same-document link preserves visibility integrity");
    return;
  }
  await write("index.qmd", topic + task("task", undefined,
    "PUBLIC_CONDITION\n\n::: {#sol-task}\nPRIVATE_SOLUTION\n:::\n\n```{.yaml .answer-spec}\ntype: numeric\nkey: {value: 314159, tolerance: {absolute: 0}}\n```\n\n::: {.grading-notes}\nPRIVATE_NOTES\n:::") +
    task("control", 'course-role="control" difficulty="advanced" .content-visible when-profile=full', "PRIVATE_CONTROL") +
    "\n::: {#sol-control}\nPRIVATE_CONTROL_SOLUTION\n:::\n");
  await Deno.mkdir(join(root, "_generated/course-spec"), { recursive: true });
  await write("_generated/course-spec/course.json", "old full model");
  await render();
  const student = await document("student");
  assert(student.scope === "document" && student.source === "index.qmd" && student.document.source === "index.qmd", "selected render did not produce document scope");
  assert(student.document.format === "html" && student.document.output.endsWith("index.html") && student.document.profiles.includes("student"), "native document context missing: " + JSON.stringify(student.document));
  assert(student.exercises.length === 1 && student.exercises[0].sourceTopic.id === "sec-topic", "actual native topic ownership missing");
  assert(student.body?.publicAnswers?.["exr-task"]?.publicAnswerJson.includes("Ответ:"), "native normalized public answer label must be Russian");
  const html = await Deno.readTextFile(join(root, "_site/index.html"));
  assert(!html.includes("PRIVATE_") && !JSON.stringify(student).includes("PRIVATE_") && !JSON.stringify(student).includes("314159"), "student projection exposed closed content");
  try { await Deno.stat(join(root, "_generated/course-spec/course.json")); throw new Error("local render retained a full course model"); }
  catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
  try { await Deno.stat(join(root, ".course-owner")); throw new Error("ordinary render created Owner state"); }
  catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
  console.log("PASS ordinary selected-document render, native context, topic and closed projection");
  if (selection === "smoke") return;

  await render("full");
  const full = await document("full");
  assert(full.exercises.length === 2 && JSON.stringify(full).includes("PRIVATE_SOLUTION") && JSON.stringify(full).includes("PRIVATE_NOTES"), "full lost closed content");
  assert((await document("student")).exercises.length === 1, "full overwrote student result");
  await render("student", "gfm");
  // Quarto's gfm output uses the public Pandoc commonmark writer here.
  assert((await document("student", "html")).document.format === "html" && (await document("student", "commonmark")).document.format === "commonmark", "output formats overwrote each other");
  console.log("PASS separate view/format document storage");

  await write("index.qmd", topic + ":::: {.content-visible when-profile=full}\n" + task("hidden", 'course-role="control" difficulty="hard"') + "::::\n");
  await render("student", "html", "CORE.METADATA_INVALID: Недопустимое значение учебного атрибута difficulty");
  for await (const entry of Deno.readDir(join(root, "_generated/course-spec/documents/student"))) {
    const value = JSON.parse(await Deno.readTextFile(join(root, "_generated/course-spec/documents/student", entry.name)));
    assert(value.document.format !== "html", "failed render retained its previous document result");
  }
  assert((await document("full")).exercises.length === 2 && (await document("student", "commonmark")).document.format === "commonmark", "failed html render invalidated another view/format");
  console.log("PASS failed-render invalidation is limited to its document/view/format");

  const invalid: [string, string][] = [
    [topic + ":::: {.content-visible when-profile=full}\n" + task("hidden", 'course-role="control" difficulty="hard"') + "::::\n", "CORE.METADATA_INVALID: Недопустимое значение учебного атрибута difficulty"],
    [topic + task("duplicate") + ":::: {.content-visible when-profile=full}\n" + task("duplicate") + "::::\n", "CORE.DUPLICATE_DECLARATION"],
    [topic + task("hidden", 'course-role="control" difficulty="advanced" typo="bad"'), "CORE.EXERCISE_INVALID"],
    [topic + task("outer", undefined, task("nested")), "CORE.EXERCISE_INVALID"],
    ["---\nassessment:\n  kind: test\n---\n" + topic + "::: {.task-items}\nTwo blocks.\n\nMore blocks.\n:::\n", "CORE.ASSESSMENT_INVALID"],
    [topic + task("hidden", 'course-role="control" difficulty="advanced" .content-visible when-profile=full') + "\n[Hidden](#exr-hidden).\n", "CORE.PROFILE_REFERENCE_INTEGRITY"],
    ["---\ncourse:\n  id: INVALID\n---\n" + topic, "CORE.COURSE_INVALID: Идентификатор курса"],
    ["---\nassessment:\n  kind: test\n---\n" + topic + task("task") + "\n::: {.task-items}\n1. [@exr-task]{.content-visible when-profile=full}\n:::\n", "CORE.ASSESSMENT_INVALID"],
    [topic + task("task", 'target="manual" course-role="demonstration" difficulty="introductory"', "## {#sec-empty}\n\nCondition"), "CORE.EXERCISE_INVALID"],
    [topic + task("hidden", 'course-role="control" difficulty="advanced" .content-visible when-profile=full') + "\n[Hidden](index.qmd#exr-hidden).\n", "CORE.PROFILE_REFERENCE_INTEGRITY"],
    [topic + task("hidden", 'course-role="control" difficulty="advanced" .content-visible when-profile=full') + "\n[Hidden](./index.qmd#exr-hidden).\n", "CORE.PROFILE_REFERENCE_INTEGRITY"],
    [topic + task("hidden", 'course-role="control" difficulty="advanced" .content-visible when-profile=full') + "\n[Hidden](index.html#exr-hidden).\n", "CORE.PROFILE_REFERENCE_INTEGRITY"],
    [topic + "\n[Missing local exercise](#exr-missing).\n", "CORE.PROFILE_REFERENCE_INTEGRITY"],
    [topic + task("task", undefined, "Condition\n\n::: {.grading-notes}\n::: {course-role=unknown}\nInvalid closed role\n:::\n:::"), "Неизвестная учебная роль course-role"],
    [topic + task("task", undefined, "Condition\n\n::: {.grading-notes}\n::: {.solution for=exr-missing}\nInvalid closed pairing\n:::\n:::"), "Атрибут for должен указывать"],
    [topic + task("hidden", 'course-role="control" difficulty="advanced" .content-visible when-profile=full') + "\n[Hidden](?v=1#exr-hidden).\n", "CORE.PROFILE_REFERENCE_INTEGRITY"],
  ];
  invalid.push(["---\ncourse:\n  adapters: [missing-adapter]\n---\n" + topic + task("task"), "CORE.ADAPTER_INVALID: Требуется ровно один установленный пакет адаптера"]);
  const failures: string[] = [];
  for (const [body, expected] of invalid) {
    await write("index.qmd", body);
    try {
      await render("student", "html", expected);
      console.log(`PASS native declaration refusal: ${expected}`);
    } catch (error) {
      failures.push(String(error));
      console.log(`FAIL native declaration refusal: ${expected}`);
    }
  }
  assert(failures.length === 0, failures.join("\n"));
  await write("index.qmd", "---\nassessment:\n  kind: test\n---\n" + topic + "::: {.task-items}\n1. @exr-external\n:::\n");
  await render();
  assert((await document("student")).assessment?.items[0] === "exr-external", "local assessment rejected deferred cross-document member");
  console.log("PASS local assessment preserves cross-document membership for full check");
  await write("index.qmd", topic + task("hidden", 'course-role="control" difficulty="advanced" .content-visible when-profile=full') + "\n[External document](retained.qmd#exr-hidden).\n");
  await render();
  console.log("PASS external document reference does not borrow same-named local hidden declaration");

  await write("index.qmd", "::: {.wrapper}\n## Sibling topic {#sec-sibling}\n:::\n\n::: {.wrapper}\n" + task("sibling") + ":::\n");
  await render("student", "html");
  await write("index.qmd", "## Sec actual native id\n\n" + task("automatic"));
  await render();
  assert((await document("student")).exercises[0].sourceTopic.id === "sec-actual-native-id", "actual automatic sec ID was rejected");
  await write("index.qmd", topic + "- List container\n\n  ## List topic {#sec-list}\n\n" + task("list").split("\n").map(line => "  " + line).join("\n"));
  await render();
  assert((await document("student")).exercises[0].sourceTopic.id === "sec-list", "native list topology lost nearest topic");
  console.log("PASS native topic IDs and distinct/list container topology");

  // Installed knitr generates canonical markup in the same native render.
  const knitr = await new Deno.Command("Rscript", { args: ["-e", 'packageVersion("knitr")'], stdout: "null", stderr: "piped" }).output();
  assert(knitr.success, "native generated-markup test requires installed knitr");
  await write("index.qmd", topic + "```{r}\n#| echo: false\n#| results: asis\ncat(':::: {#exr-generated course-role=demonstration difficulty=introductory}\\nGENERATED_CONDITION\\n\\n~~~{.yaml .answer-spec}\\ntype: numeric\\nkey: {value: 17, tolerance: {absolute: 0}}\\n~~~\\n::::\\n')\n```\n");
  await render();
  assert((await document("student")).exercises[0].id === "exr-generated", "current engine-generated declarations missing");
  console.log("PASS computed Course declaration from installed native knitr");
  console.log(JSON.stringify({ nativeRenderCommands: nativeCommands, elapsedMs: Math.round(performance.now() - started) }));
} finally {
  await Deno.remove(root, { recursive: true });
}
}
await main();
