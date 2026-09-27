import { dirname, fromFileUrl, join } from "stdlib/path";
import { copy } from "stdlib/fs";

// Rendering-level contract: native identities, portable PDF structure, and no
// mandatory Core/branding/navigation dependency for the presentation adapter.
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const temporary = await Deno.makeTempDir({ prefix: "course-presentation-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
async function render(format: string, output: string, metadata: string[] = []) {
  const result = await new Deno.Command(quarto, {cwd: temporary,
    args: ["render", "fixture.qmd", "--to", format, "--output", output, "--fail-if-warnings", ...metadata], stdout: "piped", stderr: "piped"}).output();
  assert(result.success, new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr));
  return await Deno.readTextFile(join(temporary, output));
}
try {
  await Deno.mkdir(join(temporary, "_extensions"));
  await copy(join(repo, "_extensions/course-presentation"), join(temporary, "_extensions/course-presentation"));
  await copy(join(repo, "tests/presentation/fixture.qmd"), join(temporary, "fixture.qmd"));
  const html = await render("html", "study.html");
  assert(html.includes('class="course-answer course-answer-solution callout'), "HTML answer is not a native callout");
  assert(html.includes('data-course-for="exr-predict"') && !html.includes(' for="exr-predict"'), "Relation leaked as an HTML for attribute");
  assert(html.includes("Средний") && html.includes("15 мин") && html.includes("В паре"), "Document defaults were not displayed");
  assert(html.includes("Рекомендуется"), "Reading requirement label absent");
  assert(!html.includes('data-course-course-role'), "Unnormalized data role");
  for (const id of ["exr-predict", "sol-predict"]) {
    assert(html.match(new RegExp(`id="${id}"`, "g"))?.length === 1, `Duplicate/lost identity ${id}`);
  }
  const slides = await render("revealjs", "lecture.html");
  assert(slides.includes('class="course-answer course-answer-solution fragment"'), "Lecture answer is not a native fragment");
  assert((slides.match(/course-answer-hint/g) || []).length === 1, "Explicit reading role was reinterpreted as a hint");
  assert(slides.includes('class="course-answer course-answer-hint fragment"'), "Nested hint missing native fragment");
  await Deno.writeTextFile(join(temporary, "study.yml"), "course-presentation:\n  mode: study\n");
  const studySlides = await render("revealjs", "study-slides.html", ["--metadata-file", "study.yml"]);
  assert(studySlides.includes("<details><summary>Показать решение</summary>"), "Reveal study disclosure absent");
  assert(!studySlides.includes('course-answer-solution fragment'), "Study answer unexpectedly needs Next");
  await Deno.writeTextFile(join(temporary, "expanded.yml"), "course-presentation:\n  answers: expanded\n");
  const expanded = await render("revealjs", "expanded.html", ["--metadata-file", "expanded.yml"]);
  assert(!expanded.includes('course-answer-solution fragment') && !expanded.includes("<details>"), "Expanded answers still hidden");
  const latex = await render("latex", "handout.tex");
  assert(latex.includes("SOLUTION\\_MARKER") && latex.includes("Nested hint marker"), "PDF writer lost answer/hint content");
  assert(!latex.includes("<details>") && !latex.includes("presentation.js"), "HTML disclosure leaked to PDF writer");
  for (const [name, config] of Object.entries({type: "true", false: "false", unknown: "\n  answres: expanded", mode: "\n  mode: unsupported"})) {
    await Deno.writeTextFile(join(temporary, "invalid.yml"), `course-presentation: ${config}\n`);
    const invalid = await new Deno.Command(quarto, {cwd: temporary, args: ["render", "fixture.qmd", "--to", "html", "--metadata-file", "invalid.yml"], stdout: "piped", stderr: "piped"}).output();
    assert(!invalid.success, `Invalid presentation ${name} accepted`);
  }
  // Core extraction must happen before presentation consumes author attributes.
  await copy(join(repo, "_extensions/course-core"), join(temporary, "_extensions/course-core"));
  await Deno.writeTextFile(join(temporary, "_quarto.yml"), 'project:\n  type: default\ncourse:\n  id: presentation-test\n  schema: "1.1"\n  view: student\n  validate: false\n');
  const original = await Deno.readTextFile(join(temporary, "fixture.qmd"));
  await Deno.writeTextFile(join(temporary, "fixture.qmd"), original.replace("filters: [course-presentation]", "filters: [course-presentation, course-core]"));
  const wrongOrder = await new Deno.Command(quarto, {cwd: temporary, args: ["render", "fixture.qmd", "--to", "html"], stdout: "piped", stderr: "piped"}).output();
  assert(!wrongOrder.success && new TextDecoder().decode(wrongOrder.stderr).includes("course-core must precede course-presentation"), "Wrong filter order silently accepted");
  await Deno.writeTextFile(join(temporary, "fixture.qmd"), original.replace("filters: [course-presentation]", "filters: [course-core, course-presentation]"));
  await render("html", "integrated.html");
  const fragments = [];
  for await (const entry of Deno.readDir(join(temporary, "_generated/course-spec/core"))) {
    if (entry.name.endsWith(".json")) fragments.push(JSON.parse(await Deno.readTextFile(join(temporary, "_generated/course-spec/core", entry.name))));
  }
  assert(fragments.length === 1, "Missing Core semantic fragment");
  const prediction = fragments[0].pedagogy.elements.find((element: {kind: string}) => element.kind === "prediction");
  assert(prediction?.metadata?.difficulty === "intermediate" && prediction.metadata.time === 15, "Renderer consumed semantic role/defaults before Core extraction");
  assert(!JSON.stringify(fragments[0]).includes("course-metadata"), "Rendered badges leaked into semantic IR");
  console.log("Presentation: HTML disclosure, lecture/study Reveal, metadata defaults, native IDs/crossrefs and PDF-writer content passed.");
} finally { await Deno.remove(temporary, {recursive: true}); }
