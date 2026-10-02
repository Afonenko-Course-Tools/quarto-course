import { dirname, fromFileUrl, join } from "stdlib/path";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const output = Deno.env.get("OWNER_IDENTITIES_TEST_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "owner-identities-test-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
const selected = Deno.args[0] || "all";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function command(root: string, args: string[]) {
  const result = await new Deno.Command(quarto, {
    args,
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    code: result.code,
    text: new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr),
  };
}
async function exists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}
async function fixture(name: string, document: string, fullOnly?: string) {
  const root = join(output, name);
  await Deno.mkdir(root, { recursive: true });
  const installed = await command(root, ["add", repo, "--no-prompt"]);
  assert(installed.code === 0, installed.text);
  const write = (path: string, text: string) =>
    Deno.writeTextFile(join(root, path), text);
  await write(
    "_quarto.yml",
    `project:\n  type: default\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: [_extensions/course-core/entrypoints/owner-freeze.ts]\nformat:\n  html:\n    theme: none\ncourse:\n  id: header-proof\nfilters: [course-core]\n`,
  );
  await write("_quarto-student.yml", "course:\n  view: student\n");
  await write(
    "_quarto-full.yml",
    (fullOnly ? "project:\n  render: [index.qmd, full-only.qmd]\n" : "") +
      "course:\n  view: full\n",
  );
  await write("index.qmd", document);
  if (fullOnly) await write("full-only.qmd", fullOnly);
  const api = await import(
    new URL(
      `file://${
        join(root, "_extensions/course-core/owner-preflight/owner.ts")
      }`,
    ).href
  );
  return { root, api, write };
}

console.log(`Header identity evidence: ${output}`);
if (selected === "all" || selected === "duplicate") {
  // Break caught: ignoring authored Header duplicates permits execution.
  const f = await fixture(
    "duplicate",
    `---\nengine: knitr\n---\n# First {#sec-same}\n\n\`\`\`{r}\ncat('executed\\n', file='.course-owner/engine-count', append=TRUE)\n\`\`\`\n`,
    "# Hidden second {#sec-same}\n",
  );
  const result = await f.api.runOwner(f.root, "student");
  assert(
    result.exitCode === 1 && result.report.code === "CORE.INVENTORY_INVALID",
    `authored Header duplicate must fail in preflight: ${
      JSON.stringify(result)
    }`,
  );
  assert(
    result.report.diagnostics.some((d: any) =>
      d.code === "CORE.DUPLICATE_HEADER_ID" && d.id === "sec-same"
    ),
    `authored Header duplicate diagnostic missing: ${
      JSON.stringify(result.report)
    }`,
  );
  assert(
    !await exists(join(result.stage, ".course-owner/engine-count")),
    "duplicate Header allowed the real engine to run",
  );
  console.log("PASS explicit Header duplicate across full union blocks engine");
}
if (selected === "all" || selected === "reader") {
  // Break caught: replacing author reader options changes non-Header native content.
  const f = await fixture(
    "reader",
    "---\nformat:\n  html:\n    from: markdown+hard_line_breaks\n---\n# Explicit {#sec-reader}\n\nFirst line\nsecond line.\n",
  );
  const p = await f.api.prepareOwner(f.root, {
    attemptId: "reader-proof",
    profile: "student",
  });
  const session = await f.api.preparedSession(p);
  assert(
    session.identityReaders["student:index.qmd"] ===
      "markdown+hard_line_breaks-auto_identifiers",
    `native author reader modifiers lost: ${
      JSON.stringify(session.identityReaders)
    }`,
  );
  const normal = JSON.parse(
    await Deno.readTextFile(session.captures["student:index.qmd"]),
  );
  const identity = JSON.parse(
    await Deno.readTextFile(session.identities["student:index.qmd"]),
  );
  assert(
    normal.readerShape.includes('"t":"LineBreak"') &&
      normal.readerShape === identity.readerShape,
    "native reader's hard line break was changed by identity capture",
  );
  const path = session.identities["student:index.qmd"];
  await Deno.writeTextFile(path, "{}");
  let corrupt = false;
  try {
    await f.api.activateOwner(p);
  } catch (error) {
    corrupt = error instanceof f.api.OwnerFailure &&
      error.code === "SOURCE.HEADER_IDENTITY_CHANGED";
  }
  assert(
    corrupt,
    "corrupt identity evidence silently fell back to native slugs",
  );
  await Deno.remove(path);
  let missing = false;
  try {
    await f.api.activateOwner(p);
  } catch (error) {
    missing = error instanceof f.api.OwnerFailure &&
      error.code === "SOURCE.HEADER_IDENTITY_CHANGED";
  }
  assert(
    missing,
    "missing identity evidence silently fell back to native slugs",
  );
  console.log(
    "PASS native custom reader preserved; corrupt and missing identity evidence block activation",
  );
}
if (selected === "all" || selected === "multiroot") {
  const f = await fixture("multiroot", "# Corpus {#sec-corpus}\n");
  await f.write("work-one.qmd", "# One {#sec-one}\n");
  await f.write("work-two.qmd", "# Two {#sec-two}\n");
  for (const profile of ["student", "full"]) {
    await f.write(
      `_quarto-${profile}.yml`,
      `project:\n  render: [index.qmd, work-one.qmd, work-two.qmd]\ncourse:\n  view: ${profile}\n`,
    );
  }
  const p = await f.api.prepareOwner(f.root, {
    attemptId: "multiroot-proof",
    profile: "student",
  });
  const session = await f.api.preparedSession(p);
  assert(
    Object.keys(session.captures).length === 6 &&
      Object.keys(session.identities).length === 6 &&
      session.headers.length === 3 && session.headers.every((h: any) =>
        h.topLevel
      ) &&
      JSON.stringify(session.headers.map((h: any) => h.id).sort()) ===
        JSON.stringify(["sec-corpus", "sec-one", "sec-two"]),
    "native three-root preparation lost profile capture or Header identity",
  );
  assert(
    !await exists(join(f.root, ".course-owner/active.json")),
    "completed preparation retained a capture activation",
  );
  console.log(
    "PASS direct native three-root/two-profile preparation with sealed identities and no active capture",
  );
}
if (selected === "all" || selected === "include") {
  const f = await fixture(
    "include",
    "# Root {#sec-root}\n\n{{< include _included.qmd >}}\n\n{{< include _included.qmd >}}\n",
  );
  await f.write("_included.qmd", "## Included {#sec-included}\n");
  const result = await f.api.runOwner(f.root, "student");
  assert(
    result.exitCode === 1 && result.report.code === "CORE.INVENTORY_INVALID" &&
      result.report.diagnostics.some((d: any) =>
        d.code === "CORE.DUPLICATE_HEADER_ID" && d.id === "sec-included"
      ),
    `repeated include lost Header multiplicity: ${JSON.stringify(result)}`,
  );
  console.log(
    "PASS repeated native include retains duplicate authored Header occurrences",
  );
}
if (selected === "all" || selected === "mismatch") {
  const f = await fixture(
    "mismatch",
    "# Root {#sec-root}\n\n## Automatic label\n\n[Automatic label]\n",
  );
  const result = await f.api.runOwner(f.root, "student");
  assert(
    result.exitCode !== 0 &&
      JSON.stringify(result.report).includes(
        "SOURCE.HEADER_IDENTITY_UNSUPPORTED",
      ),
    `native implicit Header reference mismatch was guessed away: ${
      JSON.stringify(result)
    }`,
  );
  console.log(
    "PASS native implicit automatic Header reference is unsupported before ordinary render",
  );
}
if (selected === "all" || selected === "topology") {
  const f = await fixture(
    "topology",
    "# sec-first\n\n> # Nested {#sec-quote}\n\n+-------------------------------------+\n| # Cell {#sec-cell}                   |\n+-------------------------------------+\n\n# sec-first {#sec-first}\n",
  );
  const result = await f.api.runOwner(f.root, "student");
  assert(
    result.exitCode === 0,
    `native Header topology corpus failed: ${JSON.stringify(result)}`,
  );
  const session = JSON.parse(
    await Deno.readTextFile(join(result.stage, ".course-owner/session.json")),
  );
  assert(
    JSON.stringify(
      session.headers.map((h: any) => [h.id, h.ordinal, h.topLevel]),
    ) ===
      JSON.stringify([["sec-quote", 2, false], ["sec-cell", 3, false], [
        "sec-first",
        4,
        true,
      ]]),
    `exact native Header topology/provenance missing: ${
      JSON.stringify(session.headers)
    }`,
  );
  const raw = JSON.parse(
    await Deno.readTextFile(session.captures["student:index.qmd"]),
  );
  const normal = raw.occurrences.filter((h: any) => h.kind === "Header");
  assert(
    normal[0].id === "sec-first" && normal[0].topLevel === true &&
      normal[3].id === "sec-first" && session.headers.find((h: any) =>
          h.id === "sec-first"
        ).ordinal !== 1,
    "automatic first work slug was falsely proved by later authored ID",
  );
  console.log(
    "PASS native direct, BlockQuote and Table Header topology; automatic first collision stays unproved",
  );
  const identical = await fixture(
    "topology-identical",
    "# Same {#sec-identical}\n\n> # Same {#sec-identical}\n",
  );
  const rejected = await identical.api.runOwner(identical.root, "student");
  assert(
    rejected.exitCode === 1 &&
      rejected.report.code === "CORE.INVENTORY_INVALID" &&
      rejected.report.diagnostics.some((d: any) =>
        d.code === "CORE.DUPLICATE_HEADER_ID"
      ),
    `identical native Header duplicate escaped: ${JSON.stringify(rejected)}`,
  );
  const preparation = JSON.parse(
    await Deno.readTextFile(
      join(rejected.stage, ".course-owner/preparation.json"),
    ),
  );
  const before = JSON.parse(
    await Deno.readTextFile(preparation.captures["student:index.qmd"]),
  );
  assert(
    JSON.stringify(
      before.occurrences.filter((h: any) => h.kind === "Header").map((h: any) =>
        h.topLevel
      ),
    ) ===
      JSON.stringify([true, false]),
    "structurally identical nested Header was confused with native top-level Header",
  );
  console.log(
    "PASS identical Header shapes retain native topology and duplicate invalidity",
  );
}
if (selected === "all" || selected === "notes") {
  const f = await fixture(
    "notes",
    "# Parent[^n] {#sec-parent}\n\n[^n]:\n    # Nested note {#sec-note}\n",
  );
  const result = await f.api.runOwner(f.root, "student");
  assert(
    result.exitCode === 0,
    `native Header Note corpus failed: ${JSON.stringify(result)}`,
  );
  const session = JSON.parse(
    await Deno.readTextFile(join(result.stage, ".course-owner/session.json")),
  );
  assert(
    JSON.stringify(
      session.headers.map((h: any) => [h.id, h.ordinal, h.topLevel]),
    ) ===
      JSON.stringify([["sec-parent", 1, true], ["sec-note", 2, false]]),
    `Header inside native Note was falsely top-level: ${
      JSON.stringify(session.headers)
    }`,
  );
  console.log("PASS Header in direct Header's native Note remains nested");
}
function computedDocument(mode: string, python = false) {
  const markdown = mode === "explicit"
    ? "\n## New {#sec-new}\n"
    : mode === "automatic"
    ? "\n## sec-static\n"
    : mode === "duplicate"
    ? "\n# Static {#sec-static}\n"
    : "\n| Value |\n|---|\n| 42 |\n";
  const code = python
    ? `from pathlib import Path\nfrom IPython.display import Markdown, display\nwith Path('.course-owner/engine-count').open('a') as f: f.write('executed\\n')\ndisplay(Markdown(${
      JSON.stringify(markdown)
    }))`
    : `cat('executed\\n', file='.course-owner/engine-count', append=TRUE)\ncat(${
      JSON.stringify(markdown)
    })`;
  return `---\n${
    python ? "jupyter: python3" : "engine: knitr"
  }\n---\n# Static {#sec-static}\n\n\`\`\`{${
    python ? "python" : "r"
  }}\n#| results: asis\n${code}\n\`\`\`\n`;
}
if (selected === "all" || selected === "computed" || selected === "python") {
  if (selected === "python") {
    assert(
      Deno.args.includes("--require-python"),
      "python case requires --require-python; no skip permitted",
    );
  }
  for (
    const mode of selected === "python"
      ? []
      : ["explicit", "automatic", "duplicate", "table"]
  ) {
    const f = await fixture("computed-" + mode, computedDocument(mode));
    const result = await f.api.runOwner(f.root, "student");
    if (mode === "table") {
      assert(
        result.exitCode === 0,
        `computed table rejected: ${JSON.stringify(result)}`,
      );
      assert(
        (await Deno.readTextFile(join(result.stage, "_site/index.html")))
          .includes("<table"),
        "computed table missing",
      );
    } else {
      assert(
        result.exitCode === 1 &&
          result.report.code === "CORE.DECLARATION_DRIFT" &&
          result.report.diagnostics.some((d: any) =>
            d.code === "CORE.HEADER_SKELETON_CHANGED"
          ),
        `computed ${mode} Header escaped reconciliation: ${
          JSON.stringify(result)
        }`,
      );
      assert(
        !await exists(join(result.stage, "_site/index.html")),
        "computed Header materialized HTML before refusal",
      );
    }
    assert(
      await Deno.readTextFile(
        join(result.stage, ".course-owner/engine-count"),
      ) === "executed\n",
      `computed ${mode} Header caused zero or repeated engine execution`,
    );
    console.log(`PASS real R ${mode}: one execution, current Header boundary`);
  }
  if (Deno.args.includes("--require-python")) {
    const f = await fixture(
      "computed-python",
      computedDocument("explicit", true),
    );
    const result = await f.api.runOwner(f.root, "student");
    assert(
      result.exitCode === 1 &&
        result.report.code === "CORE.DECLARATION_DRIFT" &&
        result.report.diagnostics.some((d: any) =>
          d.code === "CORE.HEADER_SKELETON_CHANGED"
        ),
      `native Jupyter Header escaped: ${JSON.stringify(result)}`,
    );
    assert(
      await Deno.readTextFile(
        join(result.stage, ".course-owner/engine-count"),
      ) === "executed\n",
      "Jupyter executed more than once",
    );
    assert(
      !await exists(join(result.stage, "_site/index.html")),
      "Jupyter Header materialized HTML",
    );
    console.log("PASS required native Jupyter Header reconciliation");
  } else {console.log(
      "NOT RUN Jupyter Header case: use --require-python in strict native CI",
    );}
}
if (selected === "all" || selected === "provenance") {
  // Break caught: using output slugs as authored identities causes a false duplicate.
  const f = await fixture(
    "provenance",
    "# Root {#sec-root}\n\n## sec-same\n\n## Natural title {#natural-title}\n\n:::: {.when-full}\n### Hidden *rich* title {#sec-hidden flag=kept}\n::::\n",
    "# Explicit other {#sec-same}\n",
  );
  const result = await f.api.runOwner(f.root, "student");
  assert(
    result.exitCode === 0,
    `automatic slug became authored: ${JSON.stringify(result)}`,
  );
  const session = JSON.parse(
    await Deno.readTextFile(join(result.stage, ".course-owner/session.json")),
  );
  assert(
    Array.isArray(session.headers),
    "sealed authored Header inventory missing",
  );
  assert(
    JSON.stringify(
      session.headers.map((h: any) => [h.source.rootQmd, h.id]),
    ) ===
      JSON.stringify([
        ["index.qmd", "sec-root"],
        ["index.qmd", "natural-title"],
        ["index.qmd", "sec-hidden"],
        ["full-only.qmd", "sec-same"],
      ]),
    `wrong authored Header inventory: ${JSON.stringify(session.headers)}`,
  );
  const hidden = session.headers.find((h: any) => h.id === "sec-hidden");
  assert(
    hidden.level === 3 && hidden.title === "Hidden rich title" &&
      hidden.ordinal === 4 && hidden.titleJson.includes('"t":"Emph"') &&
      hidden.attributes.some((a: any) =>
        a.key === "flag" && a.value === "kept"
      ) &&
      hidden.ancestors.some((p: any) => p.classes.includes("when-full")),
    `native Header level/title/visibility missing: ${JSON.stringify(hidden)}`,
  );
  const html = await Deno.readTextFile(join(result.stage, "_site/index.html"));
  assert(
    html.includes('id="sec-same"') && html.includes('id="natural-title"'),
    "identity capture changed ordinary publication anchors",
  );
  assert(
    !html.includes('id="sec-hidden"'),
    "hidden Header leaked from inventory into student output",
  );
  console.log(
    "PASS authored IDs distinguish identical automatic slugs; hidden native facts sealed",
  );
}
