// Capability-only native audit: adapter behavior remains each adapter's contract.
// These local declarative filters exercise native configuration merging, not export.
import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "owner-source-filters-" });
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
try {
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  for (const name of ["course-cloud", "course-prairielearn", "other"]) {
    await Deno.mkdir(join(root, "_extensions", name));
    await Deno.writeTextFile(
      join(root, "_extensions", name, "_extension.yml"),
      `title: ${name}\nversion: 0.0.0\ncontributes:\n  filters: [filter.lua]\n`,
    );
    await Deno.writeTextFile(
      join(root, "_extensions", name, "filter.lua"),
      "return {}\n",
    );
  }
  for (const profile of ["student", "full"]) {
    await Deno.writeTextFile(
      join(root, `_quarto-${profile}.yml`),
      `course:\n  view: ${profile}\n`,
    );
  }
  const api = await import(
    toFileUrl(join(root, "_extensions/course-core/owner-preflight/owner.ts"))
      .href
  );
  async function audit(
    filters: string[],
    adapters: string[],
    expected?: string,
    documentFilters?: string[],
  ) {
    await Deno.writeTextFile(
      join(root, "_quarto.yml"),
      `project:\n  type: default\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: [_extensions/course-core/entrypoints/owner-freeze.ts]\nformat: html\ncourse:\n  id: filter-proof\n  adapters: ${
        JSON.stringify(adapters)
      }\nfilters: ${JSON.stringify(filters)}\n`,
    );
    await Deno.writeTextFile(
      join(root, "index.qmd"),
      (documentFilters
        ? `---\nfilters: ${JSON.stringify(documentFilters)}\n---\n`
        : "") + "## Topic {#sec-topic}\n\nOrdinary content.\n",
    );
    let failure: any;
    try {
      await api.auditOwner(root);
    } catch (error) {
      failure = error;
    }
    assert(
      expected ? failure?.code === expected : !failure,
      `${
        JSON.stringify({ filters, adapters, expected, documentFilters })
      }: ${failure}`,
    );
    console.log(
      "PASS source filter capability: " +
        JSON.stringify({ filters, adapters, expected }),
    );
  }
  for (
    const [filter, adapter] of [["course-cloud", "cloud"], [
      "course-prairielearn",
      "prairielearn",
    ]]
  ) {
    await audit(["course-core", filter], [adapter]);
    await audit(["course-core", filter, "course-presentation"], [adapter]);
    for (
      const [filters, selected] of [
        [["course-core", filter], []],
        [["course-core", filter], [
          adapter === "cloud" ? "prairielearn" : "cloud",
        ]],
        [["course-core", filter], [adapter, "other"]],
        [["course-core", filter], [adapter, adapter]],
        [[filter, "course-core"], [adapter]],
        [["course-core", filter, filter], [adapter]],
        [["course-core", "course-presentation", filter], [adapter]],
        [["course-core", filter, "other"], [adapter]],
      ]
    ) await audit(filters, selected, "SOURCE.FILTER_ORDER_UNSUPPORTED");
  }
  await audit(
    ["course-core", "other"],
    ["other"],
    "SOURCE.FILTER_ORDER_UNSUPPORTED",
  );
  await audit(["course-core", "course-cloud", "course-prairielearn"], [
    "cloud",
    "prairielearn",
  ], "SOURCE.FILTER_ORDER_UNSUPPORTED");
  await audit(
    ["course-core", "course-cloud"],
    ["cloud"],
    "SOURCE.DOCUMENT_FILTERS_UNSUPPORTED",
    ["other"],
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
