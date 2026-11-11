import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const extension = join(dirname(dirname(fromFileUrl(import.meta.url))), "_extensions/course-core");
const checks: { name: string; passed: boolean }[] = [];
function check(name: string, passed: boolean) {
  checks.push({ name, passed });
  if (!passed) throw Error(name);
}
const documents = [
  { source: "index.qmd", format: "html" },
  { source: "slides.qmd", format: "revealjs" },
] as const;
for (const projection of ["student", "author"] as const) {
  const root = await Deno.makeTempDir({ prefix: "a4b-format-native-" });
  await Deno.writeTextFile(join(root, "_quarto.yml"), `project:
  type: website
  render: [index.qmd, slides.qmd]
  output-dir: _site
  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]
  post-render: [quarto run ${extension}/entrypoints/native-post.ts]
format:
  revealjs: {theme: simple}
course: {id: formats-course, view: ${projection === "student" ? "student" : "full"}}
course-core-runtime: native-ts
course-core-role: exercise-bank
default-exercise-difficulty: introductory
default-exercise-statement-visibility: open
filters:
  - at: pre-ast
    path: ${extension}/native-ts/early-context.lua
  - at: post-quarto
    path: ${extension}/native-ts/late-kind.lua
  - at: post-render
    path: ${extension}/native-ts/late-filter.lua
`);
  await Deno.writeTextFile(join(root, "fragment.qmd"), "Включённый **native текст**.\n");
  for (const { source, format } of documents) {
    await Deno.writeTextFile(join(root, source), `---
${format === "html" ? "format: html" : "title: Слайды"}
---
# Тест

::: {#exr-native-${format}}
## Условие

{{< include fragment.qmd >}}

::: {.content-visible when-format=${format}}
FORMAT_VISIBLE
:::

::: {.content-visible unless-format=${format}}
WRONG_FORMAT
:::

::: {.solution}
PRIVATE_SOLUTION
:::
:::
`);
  }
  const started = performance.now();
  const result = await new Deno.Command("quarto", {
    args: ["render"], cwd: root,
    env: { DENO_NO_PACKAGE_JSON: "1", QUARTO_RUN_NO_NETWORK: "true" },
    stdout: "piped", stderr: "piped",
  }).output();
  const log = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  check(`${projection}: actual mixed native render`, result.success || (console.error(log), false));
  const expectation = { root, projection, expectedDocuments: [...documents], profiles: [], outputDirectory: join(root, "_site") };
  await Core.withCurrentNativeOperation(expectation, async (op) => {
    check(`${projection}: generation has per-document formats`, !Object.hasOwn(op.identity, "format"));
    check(`${projection}: actual catalog formats`, JSON.stringify(op.catalog.documents.map(({ source, format }) => ({ source, format }))) === JSON.stringify(documents));
    for (const { source, format } of documents) {
      const document = op.document({ source });
      const condition = JSON.stringify(op.condition({ source, exerciseId: `exr-native-${format}`, view: projection }).body);
      check(`${format}/${projection}: native context format`, document.context.format === format);
      check(`${format}/${projection}: include and native format conditions`, condition.includes("Включённый") && condition.includes("FORMAT_VISIBLE") && !condition.includes("WRONG_FORMAT"));
      check(`${format}/${projection}: solution privacy`, JSON.stringify(document).includes("PRIVATE_SOLUTION") === (projection === "author"));
    }
    const proof = await op.validateRelease({ expectedSources: documents.map(({ source }) => source) });
    check(`${projection}: release has per-document formats`, !Object.hasOwn(proof, "format") && !Object.hasOwn(proof, "sources"));
    check(`${projection}: per-document release proof`, JSON.stringify(proof.documents) === JSON.stringify(documents));
  });
  // One refusal covers the binding boundary, before any callback can observe mismatched data.
  if (projection === "student") {
    let entered = false, error = "";
    try {
      await Core.withCurrentNativeOperation({ ...expectation, expectedDocuments: [{ source: "index.qmd", format: "revealjs" }] }, async () => { entered = true; });
    } catch (cause) { error = String(cause); }
    check("wrong exact format refused before callback", !entered && error.includes("OPERATION_BINDING"));
  }
  console.log(JSON.stringify({ projection, root, renders: 1, seconds: (performance.now() - started) / 1000 }));
}
console.log(JSON.stringify({ status: "PASS", checks }));
