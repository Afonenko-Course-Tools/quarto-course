import { dirname, fromFileUrl, join } from "stdlib/path";
import type { OwnerFailure } from "../_extensions/course-core/owner-preflight/owner/failure.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const output = Deno.env.get("OWNER_PREFLIGHT_TEST_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "owner-preflight-test-" });
const root = join(output, "consumer");
await Deno.mkdir(root, { recursive: true });
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function command(args: string[], env: Record<string, string> = {}) {
  const result = await new Deno.Command(quarto, {
    args,
    cwd: root,
    env,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    code: result.code,
    text: new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr),
  };
}
// Exercise the installed package rather than importing developer helpers.
const installed = await command(["add", repo, "--no-prompt"]);
assert(installed.code === 0, installed.text);
const extension = join(root, "_extensions/course-core");
const api = await import(
  new URL(`file://${extension}/owner-preflight/owner.ts`).href
);
console.log(`Owner preflight evidence: ${output}`);
async function exists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}
const write = (path: string, text: string) =>
  Deno.writeTextFile(join(root, path), text);
const base =
  `project:\n  type: default\n  output-dir: _site\n  render: [index.qmd]\n  resources: [starter.qmd]\n  pre-render:\n    - hook.ts\n    - _extensions/course-core/entrypoints/owner-freeze.ts\nformat:\n  html:\n    theme: none\ncourse:\n  id: owner-proof\nfilters: [course-core, course-presentation]\n`;
await write("_quarto.yml", base);
await write("_quarto-student.yml", "course:\n  view: student\n");
await write(
  "_quarto-full.yml",
  "project:\n  render: [index.qmd, full-only.qmd]\ncourse:\n  view: full\n",
);
await write(
  "full-only.qmd",
  "---\ntitle: Full chapter\n---\n\n## Full {#sec-full}\n\n::: {#exr-full-only course-role=independent-study difficulty=introductory}\nFull page.\n:::\n",
);
await write("_include.qmd", "::: {#exr-include course-role=independent-study difficulty=introductory}\nIncluded.\n:::\n");
await write("starter.qmd", "# Downloaded starter file\n");
await write(
  "index.qmd",
  "# Owner {#sec-owner}\n\n{{< include _include.qmd >}}\n\n::: {#exr-static course-role=independent-study difficulty=introductory}\nStatic.\n:::\n",
);
await write(
  "hook.ts",
  `if (Deno.env.get("OWNER_TEST_MUTATE") === "1" && Deno.env.get("COURSE_OWNER_PHASE") === "render") await Deno.writeTextFile("_include.qmd", "late mutation");\n`,
);
const audit = await api.auditOwner(root);
assert(
  audit.coverage["_include.qmd"].kind === "include",
  "include-only fragment not classified",
);
assert(
  audit.coverage["starter.qmd"].kind === "resource",
  "selected resource QMD not classified",
);
assert(
  audit.coverage["full-only.qmd"].kind === "root",
  "full-only page not covered",
);
await write("orphan.qmd", "# Orphan\n");
let refused = false;
try {
  await api.auditOwner(root);
} catch (error) {
  refused = String(error).includes("SOURCE.UNCOVERED_QMD") &&
    String(error).includes("orphan.qmd");
}
assert(refused, "orphan QMD did not fail closed");
await Deno.remove(join(root, "orphan.qmd"));
await write(
  "_quarto.yml",
  base.replace(
    "resources: [starter.qmd]",
    "resources: [starter.qmd, _include.qmd]",
  ),
);
const selectedInclude = await api.auditOwner(root);
assert(
  selectedInclude.coverage["_include.qmd"].kind === "include",
  "raw selection changed canonical include identity",
);
let canonicalSelection = false;
try {
  await api.prepareOwner(root, {
    attemptId: "canonical-selection",
    profile: "student",
  });
} catch (e: any) {
  canonicalSelection = e instanceof api.OwnerFailure &&
    e.code === "RESOURCE.POLICY_DENIED" &&
    e.cause.diagnostics.some((d: any) =>
      d.code === "RESOURCE.SELECTION_FORBIDDEN" &&
      d.path === "_include.qmd" && d.reasons.includes("canonical-source")
    );
}
assert(
  canonicalSelection,
  "canonical include raw selection escaped CUE policy",
);
assert(
  !await exists(join(root, ".course-owner/render-invocation.json")),
  "canonical raw selection reached ordinary render activation",
);
await Deno.remove(join(root, ".course-owner"), { recursive: true });
await write(
  "_quarto.yml",
  base.replace("render: [index.qmd]", "render: [index.qmd, _include.qmd]"),
);
let ambiguous = false;
try {
  await api.auditOwner(root);
} catch (e) {
  ambiguous = String(e).includes("SOURCE.AMBIGUOUS_QMD");
}
assert(ambiguous, "native root/include ambiguity escaped");
await write("_quarto.yml", base);
await Deno.mkdir(join(root, "_extensions/misc"), { recursive: true });
await write("_extensions/misc/orphan.qmd", "# Unknown payload\n");
let unknownExtension = false;
try {
  await api.auditOwner(root);
} catch (e) {
  unknownExtension = String(e).includes("SOURCE.UNCOVERED_QMD");
}
assert(unknownExtension, "unknown extension QMD was silently exempted");
await Deno.remove(join(root, "_extensions/misc"), { recursive: true });
const originalIndex = await Deno.readTextFile(join(root, "index.qmd"));
await write("late.lua", "return {{Pandoc=function(doc) return doc end}}\n");
await write("index.qmd", "---\nfilters: [late.lua]\n---\n" + originalIndex);
let documentFilter = false;
try {
  await api.auditOwner(root);
} catch (e) {
  documentFilter = String(e).includes("SOURCE.DOCUMENT_FILTERS_UNSUPPORTED");
}
assert(documentFilter, "document post-boundary filter was silently accepted");
await write("index.qmd", originalIndex);
await Deno.remove(join(root, "late.lua"));
// The deeper audit module must use the facade's installed hook locator, and
// must keep the same last-hook refusal instead of repairing author order.
await write(
  "_quarto.yml",
  base.replace(
    "    - hook.ts\n    - _extensions/course-core/entrypoints/owner-freeze.ts",
    "    - _extensions/course-core/entrypoints/owner-freeze.ts\n    - hook.ts",
  ),
);
let lastHook = false;
try {
  await api.auditOwner(root);
} catch (error) {
  lastHook = error instanceof api.OwnerFailure &&
    (error as OwnerFailure).code === "SOURCE.FREEZE_GUARD_NOT_LAST" &&
    (error as OwnerFailure & { cause: { expected: string } }).cause.expected ===
      "_extensions/course-core/entrypoints/owner-freeze.ts";
}
assert(lastHook, "installed facade hook locator or last-hook refusal changed");
await write("_quarto.yml", base);
if (Deno.args.includes("--coverage-only")) Deno.exit(0);
console.log(
  "PASS native source coverage: full-only, include, resource, rejected orphan",
);
function document(engine: string, mode: string) {
  const code = engine === "r"
    ? `write("executed", file=".course-owner/engine-count", append=TRUE)\n${
      mode === "new"
        ? 'cat("\\n::: {#exr-generated course-role=independent-study difficulty=introductory}\\nGenerated declaration.\\n:::\\n")'
        : mode === "duplicate"
        ? 'cat("\\n:::: {.when-full}\\n::: {#exr-static course-role=independent-study difficulty=introductory}\\nHidden duplicate.\\n:::\\n::::\\n")'
        : 'cat("\\n| Value |\\n|---|\\n| 42 |\\n")'
    }`
    : `from pathlib import Path\nfrom IPython.display import Markdown, display\nwith Path(".course-owner/engine-count").open("a") as counter: counter.write("executed\\n")\ndisplay(Markdown(${
      JSON.stringify(
        mode === "new"
          ? "\n::: {#exr-generated course-role=independent-study difficulty=introductory}\nGenerated declaration.\n:::\n"
          : "\n| Value |\n|---|\n| 42 |\n",
      )
    }))`;
  return `---\ntitle: Owner computation\n${
    engine === "r" ? "engine: knitr" : "jupyter: python3"
  }\n---\n\n# Owner {#sec-owner}\n\n{{< include _include.qmd >}}\n\n::: {#exr-static course-role=independent-study difficulty=introductory}\n## Static task\n\n\`\`\`{${
    engine === "r" ? "r" : "python"
  }}\n#| results: asis\n${code}\n\`\`\`\n${
    engine === "r" && mode === "body"
      ? "\n```{r plot-proof}\nplot(1:3)\n```\n"
      : ""
  }\n:::\n`;
}
async function checkBooks() {
  await write(
    "index.qmd",
    document("r", "body") + "\n::: {.when-full}\nBOOK_FULL_ONLY\n:::\n",
  );
  await write(
    "_quarto.yml",
    base.replace("type: default", "type: book") +
      "book:\n  title: Owner book\n  chapters: [index.qmd]\n",
  );
  await write(
    "_quarto-full.yml",
    "project:\n  render: [index.qmd, full-only.qmd]\nbook:\n  chapters: [full-only.qmd]\ncourse:\n  view: full\n",
  );
  const book = await api.runOwner(root, "full");
  assert(
    book.exitCode === 0,
    `native book capability failed: ${JSON.stringify(book)}`,
  );
  assert(
    await Deno.readTextFile(join(book.stage, ".course-owner/engine-count")) ===
      "executed\n",
    "book owner computation repeated",
  );
  assert(
    await exists(join(book.stage, "_site/full-only.html")),
    "native full book chapter missing",
  );
  await Deno.writeTextFile(
    join(output, "book.json"),
    JSON.stringify(book, null, 2),
  );
  assert(
    (await Deno.readTextFile(join(book.stage, "_site/index.html"))).includes(
      "BOOK_FULL_ONLY",
    ),
    "full book content projected away",
  );
  const studentBook = await api.runOwner(root, "student");
  assert(
    studentBook.exitCode === 0,
    `student book capability failed: ${JSON.stringify(studentBook)}`,
  );
  assert(
    await Deno.readTextFile(
      join(studentBook.stage, ".course-owner/engine-count"),
    ) === "executed\n",
    "student book computation repeated",
  );
  assert(
    !await exists(join(studentBook.stage, "_site/full-only.html")),
    "student book materialized full-only chapter",
  );
  assert(
    !(await Deno.readTextFile(join(studentBook.stage, "_site/index.html")))
      .includes("BOOK_FULL_ONLY"),
    "student book leaked full-only content",
  );
  await Deno.writeTextFile(
    join(output, "book-student.json"),
    JSON.stringify(studentBook, null, 2),
  );
  console.log(
    "PASS native full/student book renders; one real R execution each; chapter selection and visibility",
  );
  await write("_quarto.yml", base);
  await write(
    "_quarto-full.yml",
    "project:\n  render: [index.qmd, full-only.qmd]\ncourse:\n  view: full\n",
  );
}
if (Deno.args.includes("--book-only")) {
  await checkBooks();
  Deno.exit(0);
}
await write("index.qmd", document("r", "body"));
const fullSource = await Deno.readTextFile(join(root, "full-only.qmd"));
await write(
  "full-only.qmd",
  fullSource +
    "\n::: {#exr-static .when-full course-role=independent-study difficulty=introductory}\nHidden duplicate in full inventory.\n:::\n",
);
const preflightDuplicate = await api.runOwner(root, "student");
assert(
  preflightDuplicate.exitCode === 1 &&
    preflightDuplicate.report.code === "CORE.INVENTORY_INVALID",
  `full inventory duplicate escaped: ${JSON.stringify(preflightDuplicate)}`,
);
assert(
  !await exists(join(preflightDuplicate.stage, ".course-owner/engine-count")),
  "engine ran before invalid inventory was rejected",
);
console.log("PASS hidden full-inventory duplicate rejected before engine");
await write("full-only.qmd", fullSource);
await write("index.qmd", originalIndex);
if (Deno.args.includes("--inventory-only")) Deno.exit(0);
const presentation = join(root, "_extensions/course-presentation/filter.lua");
await Deno.writeTextFile(
  presentation,
  (await Deno.readTextFile(presentation)).replace(
    "return {{Pandoc = function(doc)",
    `return {{Pandoc = function(doc)
  if os.getenv('COURSE_OWNER_PHASE') == 'render' then local f=assert(io.open('.course-owner/presentation-ran','w'));f:write('ran');f:close() end`,
  ),
);
// Regression: existing Assessment identity comes from the first top-level Header.
await write(
  "index.qmd",
  `---
title: Assessment
engine: knitr
assessment:
  kind: test
---

\`\`\`{r}
#| results: asis
write("executed", file=".course-owner/engine-count", append=TRUE)
cat("\\n# Injected heading {#injected-assessment}\\n")
\`\`\`

# Static assessment {#sec-static-assessment}

{{< include _include.qmd >}}
`,
);
const heading = await api.runOwner(root, "student");
assert(
  heading.exitCode === 1 &&
    heading.report.diagnostics.some((d: any) =>
      d.code === "CORE.ASSESSMENT_IDENTITY_CHANGED"
    ),
  `computed heading identity escaped: ${JSON.stringify(heading)}`,
);
assert(
  await Deno.readTextFile(join(heading.stage, ".course-owner/engine-count")) ===
    "executed\n",
  "heading engine did not run once",
);
assert(
  !await exists(join(heading.stage, ".course-owner/presentation-ran")),
  "assessment heading reached Presentation",
);
console.log(
  "PASS computed first Header cannot replace existing Assessment identity",
);
await write(
  "index.qmd",
  `---
engine: knitr
assessment:
  kind: test
---

# Static assessment {#sec-static-assessment}

{{< include _include.qmd >}}

::: {.assessment-items}
\`\`\`{r}
#| results: asis
write("executed", file=".course-owner/engine-count", append=TRUE)
cat("\\n- @exr-include\\n")
\`\`\`
:::
`,
);
const members = await api.runOwner(root, "student");
assert(
  members.exitCode === 1 && members.report.code === "CORE.DECLARATION_DRIFT",
  `computed assessment membership escaped: ${JSON.stringify(members)}`,
);
assert(
  !await exists(join(members.stage, ".course-owner/presentation-ran")),
  "computed assessment membership reached Presentation",
);
console.log("PASS computed Assessment membership rejected before projection");
if (Deno.args.includes("--assessment-only")) Deno.exit(0);
await write("index.qmd", document("r", "new"));
const injected = await api.runOwner(root, "student");
assert(
  injected.exitCode === 1 && injected.report.code === "CORE.DECLARATION_DRIFT",
  `computed declaration was not rejected by CUE: ${JSON.stringify(injected)}`,
);
assert(
  await Deno.readTextFile(
    join(injected.stage, ".course-owner/engine-count"),
  ) === "executed\n",
  "real R engine did not execute once",
);
assert(
  injected.report.diagnostics.some((d: any) =>
    d.id === "exr-generated" && d.source.rootQmd === "index.qmd"
  ),
  "computed declaration diagnostic lost QMD/ID",
);
await Deno.writeTextFile(
  join(output, "injected.json"),
  JSON.stringify(injected, null, 2),
);
assert(
  !await exists(join(injected.stage, "_site/index.html")),
  "rejected declaration materialized HTML",
);
assert(
  !await exists(join(injected.stage, ".course-owner/presentation-ran")),
  "Presentation ran before rejection",
);
console.log("PASS real computed declaration rejected before projection");

await write("index.qmd", document("r", "duplicate"));
const duplicate = await api.runOwner(root, "student");
assert(
  duplicate.exitCode === 1 &&
    duplicate.report.diagnostics.some((d: any) => d.id === "exr-static"),
  `hidden computed duplicate escaped: ${JSON.stringify(duplicate)}`,
);
assert(
  !await exists(join(duplicate.stage, ".course-owner/presentation-ran")),
  "hidden duplicate reached Presentation",
);
console.log(
  "PASS hidden computed duplicate preserves multiplicity before student projection",
);
await write("index.qmd", document("r", "body"));
const frozen = await api.runOwner(root, "student", {
  env: { OWNER_TEST_MUTATE: "1" },
});
assert(
  frozen.exitCode === 2 && frozen.report.code === "SOURCE.FROZEN_INPUT_CHANGED",
  `last hook guard did not reject mutation: ${JSON.stringify(frozen)}`,
);
assert(
  !await exists(join(frozen.stage, ".course-owner/engine-count")),
  "engine ran after late hook mutation",
);
console.log(
  "PASS last participating pre-render guard rejects late mutation before engine",
);
const positive = await api.runOwner(root, "student");
assert(
  positive.exitCode === 0,
  `ordinary computed body rejected: ${JSON.stringify(positive)}`,
);
assert(
  await Deno.readTextFile(
    join(positive.stage, ".course-owner/engine-count"),
  ) === "executed\n",
  "owner computation repeated",
);
assert(
  await exists(join(positive.stage, ".course-owner/presentation-ran")),
  "Presentation not reached for valid body",
);
assert(
  (await Deno.readTextFile(join(positive.stage, "_site/index.html"))).includes(
    "<td>42</td>",
  ),
  "computed table lost",
);
assert(
  (await Deno.readTextFile(join(positive.stage, "_site/index.html"))).includes(
    "figure-html",
  ),
  "native computed figure missing from HTML",
);
console.log(
  "PASS ordinary computed table and figure accepted; actual engine ran once; Presentation reached",
);
const sessionPath = join(positive.stage, ".course-owner/session.json");
const saved = await Deno.readTextFile(sessionPath), session = JSON.parse(saved);
const firstCapture = Object.values(session.captures)[0] as string;
await Deno.remove(firstCapture);
let missing = false;
try {
  await api.assertFrozen(sessionPath);
} catch (e) {
  missing = String(e).includes("SOURCE.BASELINE_CHANGED");
}
assert(missing, "missing baseline remained usable");
await Deno.writeTextFile(firstCapture, "{}");
let corrupt = false;
try {
  await api.assertFrozen(sessionPath);
} catch (e) {
  corrupt = String(e).includes("SOURCE.BASELINE_CHANGED");
}
assert(corrupt, "corrupt baseline remained usable");
await Deno.writeTextFile(sessionPath, "{");
corrupt = false;
try {
  await api.assertFrozen(sessionPath);
} catch (e) {
  corrupt = String(e).includes("SOURCE.INVALID_ATTEMPT");
}
assert(corrupt, "corrupt session remained usable");
console.log("PASS corrupted baseline/session rejected");
await checkBooks();
if (Deno.args.includes("--require-python")) {
  await write("index.qmd", document("python", "new"));
  const python = await api.runOwner(root, "student");
  assert(
    python.exitCode === 1 && python.report.code === "CORE.DECLARATION_DRIFT",
    `real Python injection evidence missing: ${JSON.stringify(python)}`,
  );
  assert(
    await Deno.readTextFile(
      join(python.stage, ".course-owner/engine-count"),
    ) === "executed\n",
    "Python did not execute exactly once",
  );
  assert(
    !await exists(join(python.stage, ".course-owner/presentation-ran")),
    "Python injection reached Presentation",
  );
  await Deno.writeTextFile(
    join(output, "python.json"),
    JSON.stringify(python, null, 2),
  );
  console.log(
    "PASS actual Jupyter Markdown declaration rejected before Presentation",
  );
} else {console.log(
    "NOT RUN Jupyter injection: use --require-python in native CI (local kernel socket restriction)",
  );}
console.log(
  "PASS installed opt-in owner preflight; public Course/Fragment unchanged",
);
