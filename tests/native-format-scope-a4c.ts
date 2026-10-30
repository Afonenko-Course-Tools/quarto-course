import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const extension = join(
  dirname(dirname(fromFileUrl(import.meta.url))),
  "_extensions/course-core",
);
const root = await Deno.makeTempDir({ prefix: "a4c-mixed-" });
const check = (ok: unknown, name: string) => {
  if (!ok) throw Error(name);
};
await Deno.writeTextFile(
  join(root, "_quarto.yml"),
  `project:
  type: website
  render: [index.qmd, slides.qmd]
  output-dir: _site
  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]
  post-render: [quarto run ${extension}/entrypoints/native-post.ts]
format:
  revealjs: {theme: simple}
course: {id: mixed-course, view: student}
course-core-runtime: native-ts
course-core-role: page
filters:
  - at: pre-ast
    path: ${extension}/native-ts/early-context.lua
  - at: post-quarto
    path: ${extension}/native-ts/late-kind.lua
  - at: post-render
    path: ${extension}/native-ts/late-filter.lua
`,
);
await Deno.writeTextFile(
  join(root, "index.qmd"),
  "---\nformat: html\n---\n# Страница\n\nОбычная страница.\n",
);
await Deno.writeTextFile(
  join(root, "slides.qmd"),
  "# Слайды\n\nNative revealjs.\n",
);
const render = await new Deno.Command("quarto", {
  args: ["render"],
  cwd: root,
  env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1" },
  stdout: "piped",
  stderr: "piped",
}).output();
const log = new TextDecoder().decode(render.stdout) +
  new TextDecoder().decode(render.stderr);
console.log(JSON.stringify({ root, render: render.code }));
check(
  render.success || (console.error(log), false),
  "actual mixed native render",
);
const expectation = {
  root,
  profiles: [],
  projection: "student" as const,
  outputDirectory: join(root, "_site"),
  expectedDocuments: [{ source: "index.qmd", format: "html" as const }, {
    source: "slides.qmd",
    format: "revealjs" as const,
  }],
};
await Core.withCurrentNativeOperation(expectation, async (op) => {
  check(!Object.hasOwn(op.identity, "format"), "generation has no format");
  check(
    op.catalog.documents.map((d) => d.source + ":" + d.format).join(",") ===
      "index.qmd:html,slides.qmd:revealjs",
    "actual catalog formats",
  );
  for (const d of op.catalog.documents) {
    check(
      op.document({ source: d.source }).context.format === d.format,
      "actual context format",
    );
  }
  const proof = await op.validateRelease({
    expectedSources: ["index.qmd", "slides.qmd"],
  });
  check(
    JSON.stringify(proof.documents) ===
      JSON.stringify(expectation.expectedDocuments),
    "per-document release proof",
  );
  check(
    !Object.hasOwn(proof, "format") && !Object.hasOwn(proof, "sources"),
    "proof has no scalar format",
  );
});
let entered = false, error = "";
try {
  await Core.withCurrentNativeOperation({
    ...expectation,
    expectedDocuments: [{ source: "index.qmd", format: "revealjs" }],
  }, async () => {
    entered = true;
  });
} catch (e) {
  error = String(e);
}
check(
  !entered && error.includes("OPERATION_BINDING"),
  "wrong exact documents refused before callback",
);
console.log("PASS actual mixed native formats");
