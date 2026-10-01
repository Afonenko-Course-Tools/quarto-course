// Standalone P0 proof. Run: deno run -A tests/probes/rich-content.ts
// No imports: this probe also runs without repository remote import resolution.
const fixture = new URL("./rich-content/", import.meta.url).pathname;
const output = Deno.env.get("RICH_PROBE_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "course-rich-" });
const owner = `${output}/owner`, consumer = `${output}/consumer`;
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
async function copyTree(from: string, to: string) {
  await Deno.mkdir(to, { recursive: true });
  for await (const entry of Deno.readDir(from)) {
    if (entry.isDirectory) {
      await copyTree(`${from}/${entry.name}`, `${to}/${entry.name}`);
    } else await Deno.copyFile(`${from}/${entry.name}`, `${to}/${entry.name}`);
  }
}
const commands: unknown[] = [];
async function run(args: string[], cwd: string, name: string, success = true) {
  commands.push({ executable: quarto, args, cwd, expectedSuccess: success });
  const start = performance.now();
  const p = await new Deno.Command(quarto, {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const log = new TextDecoder().decode(p.stdout) +
    new TextDecoder().decode(p.stderr);
  await Deno.writeTextFile(`${output}/${name}.log`, log);
  assert(p.success === success, `${name}: unexpected exit ${p.code}\n${log}`);
  return { seconds: (performance.now() - start) / 1000, code: p.code };
}
await Deno.mkdir(output, { recursive: true });
// Focused scope regression runs before any owner computation.
const scope = `${output}/scope`;
await Deno.mkdir(`${scope}/bundle`, { recursive: true });
await Deno.writeTextFile(
  `${scope}/bundle/manifest.json`,
  JSON.stringify({ canonicalUrl: "owner.html" }),
);
await run(
  [
    "pandoc",
    `${fixture}/namespace-scope.qmd`,
    "--lua-filter",
    `${fixture}/namespace.lua`,
    "--to",
    "html",
    "--output",
    "scope.html",
  ],
  scope,
  "namespace-scope",
);
const scopedHtml = await Deno.readTextFile(`${scope}/scope.html`);
assert(
  !scopedHtml.includes("probe-namespace-end"),
  "namespace scope: temporary exit marker leaked",
);
for (
  const id of ["before", "instance", "destination", "tail-div", "tail-span"]
) {
  assert(
    scopedHtml.includes(`id="${id}"`),
    `namespace scope: ordinary destination ${id} changed`,
  );
}
assert(
  scopedHtml.includes('id="detail-one"'),
  "namespace scope: instance destination not namespaced",
);
assert(
  scopedHtml.includes('href="owner.html#detail"') &&
    scopedHtml.includes('href="owner.html#fig-root"'),
  "namespace scope: instance links not rewritten",
);
for (const id of ["before", "destination", "detail"]) {
  assert(
    scopedHtml.includes(`href="#${id}"`),
    `namespace scope: ordinary local link ${id} changed`,
  );
}
assert(
  scopedHtml.includes('data-cites="fig-root"'),
  "namespace scope: ordinary trailing citation changed",
);
console.log(
  "PASS namespace scope: instance rewritten; ordinary before/trailing destinations, links and citation unchanged",
);
await copyTree(fixture, owner);
await Deno.mkdir(consumer, { recursive: true });
console.log(`Rich probe artifacts: ${output}`);
await run(["--version"], output, "quarto-version");
await run(["pandoc", "--version"], output, "pandoc-version");
const computation = Deno.env.get("RICH_COMPUTE") || "r";
assert(
  ["lua", "jupyter", "r"].includes(computation),
  "explicit supported computation mode",
);
if (computation !== "lua") {
  await Deno.copyFile(
    `${owner}/owner-${computation}.qmd`,
    `${owner}/owner.qmd`,
  );
}
await run(
  ["render", "owner.qmd", "--to", "html", "--fail-if-warnings"],
  owner,
  "owner",
);
await Deno.remove(`${owner}/owner.qmd`);
await Deno.remove(`${owner}/owner-jupyter.qmd`);
await Deno.remove(`${owner}/owner-r.qmd`);
await Deno.remove(`${owner}/fragments/task.qmd`);
const bundle = JSON.parse(
  await Deno.readTextFile(`${owner}/bundle/manifest.json`),
);
assert(
  bundle.canonical.exercises === 1 && bundle.canonical.solutions === 1,
  "one canonical exercise and solution",
);
await copyTree(`${owner}/bundle`, `${consumer}/bundle`);
await Deno.copyFile(`${fixture}/consume.lua`, `${consumer}/consume.lua`);
await Deno.copyFile(`${fixture}/namespace.lua`, `${consumer}/namespace.lua`);
await Deno.copyFile(
  `${fixture}/consume-late.lua`,
  `${consumer}/consume-late.lua`,
);
const cfg = (mode: string, format = "html") =>
  `---\ntitle: Rich ${mode}\nbibliography: bundle/refs.bib\nprobe-mode: ${mode}\nformat:\n  ${format}:\n    ${
    format === "typst" ? "keep-typ: true" : "embed-resources: false"
  }\nfilters:\n  - at: pre-ast\n    path: consume.lua\n  - at: post-ast\n    path: namespace.lua\n---\n\nConsumer context.\n`;
const results: Record<string, unknown> = {};
for (const mode of ["unsafe-inline", "links", "inline", "second"]) {
  await Deno.writeTextFile(`${consumer}/${mode}.qmd`, cfg(mode));
  results[mode] = await run(
    ["render", `${mode}.qmd`, "--no-execute", "--fail-if-warnings"],
    consumer,
    mode,
  );
  assert(
    !(await Deno.readTextFile(`${consumer}/${mode}.html`)).includes(
      "probe-namespace-end",
    ),
    `${mode}: temporary scope marker leaked`,
  );
}
const html = await Deno.readTextFile(`${consumer}/unsafe-inline.html`);
assert(
  (html.match(/PROMPT_SENTINEL/g) || []).length === 2,
  "two inline prompt instances",
);
assert(
  (html.match(/SOLUTION_SENTINEL/g) || []).length === 2,
  "two inline solution instances",
);
for (
  const id of ["fig-root", "fig-other", "fig-computed", "tbl-data", "detail"]
) {
  for (const instance of ["one", "two"]) {
    assert(
      html.includes(`id="${id}-${instance}"`),
      `instance anchor ${id}-${instance}`,
    );
    assert(
      html.includes(`href="#${id}-${instance}"`),
      `instance reference ${id}-${instance}`,
    );
  }
}
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
assert(
  ids.filter((id) => id === "eq-rule").length === 2,
  "negative: repeated equations retain duplicate labels",
);
assert(
  new Set(ids.filter((id) => id !== "eq-rule")).size === ids.length - 2,
  "other HTML IDs unique, including notes",
);
assert(
  html.includes("?@eq-rule-one") && html.includes("?@eq-rule-two"),
  "negative: equation references unresolved after namespacing",
);
await Deno.writeTextFile(`${consumer}/repeat.qmd`, cfg("repeat-inline"));
results.repeatedInline = await run(
  ["render", "repeat.qmd", "--no-execute"],
  consumer,
  "repeat-rejected",
  false,
);
assert(
  (await Deno.readTextFile(`${output}/repeat-rejected.log`)).includes(
    "ADAPTER owner.qmd/exr-rich: repeated inline display equations",
  ),
  "requested unsupported inline is diagnosed",
);
const inline = await Deno.readTextFile(`${consumer}/inline.html`);
assert(
  inline.includes('id="task-instance-inline-one"'),
  "technical inline anchor",
);
assert(
  (inline.match(/PROMPT_SENTINEL/g) || []).length === 1 &&
    (inline.match(/SOLUTION_SENTINEL/g) || []).length === 1,
  "full inline prompt and solution once",
);
assert(
  inline.includes('href="#fig-root-one"') && inline.includes('href="#eq-rule"'),
  "inline solution references native instance targets",
);
const inlineIds = [...inline.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
assert(
  new Set(inlineIds).size === inlineIds.length && !inline.includes("?@"),
  "full inline IDs unique and crossrefs resolved",
);
const second = await Deno.readTextFile(`${consumer}/second.html`);
assert(
  second.includes('id="task-instance-second-one"'),
  "second page has its own technical instance anchor",
);
const secondIds = [...second.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
assert(
  new Set(secondIds).size === secondIds.length,
  "single-instance HTML IDs are all unique",
);
assert(
  second.includes('href="#eq-rule"') && !second.includes("?@"),
  "single-instance second page has native equation reference",
);
for (const name of ["links", "inline", "second"]) {
  assert(
    !(await Deno.readTextFile(`${output}/${name}.log`)).includes("WARNING"),
    `${name} has no warnings`,
  );
}
for (
  const marker of [
    "callout-note",
    "CALLOUT_SENTINEL",
    "FOOTNOTE_SENTINEL",
    "Knuth",
    "The TeXbook",
  ]
) assert(html.includes(marker), `rich content ${marker}`);
assert(
  html.includes('href="https://example.org/reading"'),
  "ordinary body link remains a link",
);
assert(
  html.includes("Figure&nbsp;4") && html.includes("Table&nbsp;2"),
  "native compiler numbers later instances",
);
assert(
  !html.includes("WRONG INCLUDE BASE"),
  "include physical base is not resource base",
);
const links = await Deno.readTextFile(`${consumer}/links.html`);
assert(
  !links.includes("PROMPT_SENTINEL") && links.includes("SOLUTION_SENTINEL"),
  "links shows solution without prompt",
);
assert(
  links.includes('href="../owner/owner.html#fig-root"'),
  "links solution points to canonical figure",
);
assert(
  links.includes('href="../owner/owner.html#exr-rich"'),
  "links includes canonical condition",
);
assert(
  !html.includes('id="exr-rich"') && !html.includes('id="sol-rich"'),
  "instances are not canonical declarations",
);
assert(
  JSON.stringify(bundle.canonical) ===
    JSON.stringify(
      JSON.parse(await Deno.readTextFile(`${consumer}/bundle/manifest.json`))
        .canonical,
    ),
  "consumer does not mutate canonical counts",
);
assert(
  await Deno.readTextFile(`${owner}/execution-count.txt`) === "1",
  "owner computation executed once",
);
const canonicalHtml = await Deno.readTextFile(`${owner}/owner.html`);
for (const id of ["exr-rich", "fig-root", "eq-rule", "tbl-data"]) {
  assert(
    canonicalHtml.includes(`id="${id}"`),
    `canonical link target exists: ${id}`,
  );
}
assert(bundle.resources.length === 3, "three selected image resources");
assert(
  new Set(bundle.resources.map((r: { target: string }) => r.target)).size === 3,
  "resource target collision avoided",
);
for (const r of bundle.resources) {
  const bytes = await Deno.readFile(`${consumer}/bundle/${r.target}`);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-1", bytes)),
  ).map((x) => x.toString(16).padStart(2, "0")).join("");
  assert(hash === r.hash, `resource hash ${r.source}`);
}
assert(
  bundle.resources.some((r: { source: string; effectiveBase: string }) =>
    r.source === "assets/shared.svg" && r.effectiveBase === "owner.qmd"
  ),
  "resource root QMD base recorded",
);
await Deno.writeTextFile(`${consumer}/print.qmd`, cfg("print", "typst"));
results.print = await run(
  ["render", "print.qmd", "--no-execute", "--fail-if-warnings"],
  consumer,
  "print",
);
const typ = (await Deno.readTextFile(`${consumer}/print.typ`)).replaceAll(
  "\\_",
  "_",
);
assert(
  !typ.includes("probe-namespace-end"),
  "print: temporary scope marker leaked",
);
assert(
  typ.includes("PROMPT_SENTINEL") && typ.includes("Answer area"),
  "print contains prompt and answer field",
);
assert(!typ.includes("SOLUTION_SENTINEL"), "print excludes solution");
assert(
  (await Deno.stat(`${consumer}/print.pdf`)).size > 1000,
  "actual PDF compiled",
);
const pdfTextResult = await new Deno.Command("pdftotext", {
  args: [`${consumer}/print.pdf`, "-"],
  stdout: "piped",
  stderr: "piped",
}).output();
assert(pdfTextResult.success, "Poppler extracts actual PDF text");
const pdfText = new TextDecoder().decode(pdfTextResult.stdout);
await Deno.writeTextFile(`${output}/print.txt`, pdfText);
for (
  const marker of [
    "PROMPT_SENTINEL",
    "Answer area",
    "CALLOUT_SENTINEL",
    "FOOTNOTE_SENTINEL",
    "ROOT BLUE",
    "OTHER RED",
    "COMPUTED 42",
    "Equation 1",
    "Table 1",
  ]
) assert(pdfText.includes(marker), `PDF content: ${marker}`);
assert(
  !pdfText.includes("SOLUTION_SENTINEL") && !pdfText.includes("?@"),
  "PDF excludes solutions and unresolved references",
);
assert(
  await Deno.readTextFile(`${owner}/execution-count.txt`) === "1",
  "print did not repeat owner computation",
);
assert(
  await Deno.readTextFile(`${owner}/filter-count.txt`) === "1",
  "consumer did not repeat owner filter side effect",
);
assert(
  !(await Deno.readTextFile(`${output}/print.log`)).includes("WARNING"),
  "print has no unresolved crossref warning",
);
await Deno.writeTextFile(
  `${consumer}/late.qmd`,
  "---\nformat: html\nfilters:\n  - at: pre-ast\n    path: consume-late.lua\n---\nLate AST probe.\n",
);
results.late = await run(
  ["render", "late.qmd", "--no-execute"],
  consumer,
  "late",
  false,
);
assert(
  (await Deno.readTextFile(`${output}/late.log`)).includes("custom_data"),
  "late serialization fails specifically at missing custom-node state",
);
await Deno.writeTextFile(
  `${output}/commands.json`,
  JSON.stringify(commands, null, 2),
);
await Deno.writeTextFile(
  `${output}/results.json`,
  JSON.stringify(
    {
      status: "bounded-proof",
      richInline: "supported: one occurrence per target document",
      repeatedInline: "unsupported: same-page repeated equation labels",
      computation,
      canonical: bundle.canonical,
      resources: bundle.resources,
      results,
    },
    null,
    2,
  ),
);
console.log(
  "PASS bounded proof: links/inline/second/print, native figures/tables/callout/citation/footnote, isolated image IDs/resources, one owner computation (explicit mode in results). SAME-PAGE REPEAT BLOCKED: repeated equations; post-ast negative retained.",
);
