import { fixtureAt, fixtureRecord, required } from "./helpers/required.ts";
import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url))),
  root = await Deno.makeTempDir({ prefix: "core9-default-" });
function assert(v: unknown, m: string): asserts v {
  if (!v) throw Error(m);
}
async function put(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
for (
  const name of ["course-core", "course-navigation", "course-presentation"]
) {
  await Deno.mkdir(join(root, "_extensions", name), { recursive: true });
  await copy(join(repo, "_extensions", name), join(root, "_extensions", name));
}
async function copy(from: string, to: string) {
  for await (const e of Deno.readDir(from)) {
    const a = join(from, e.name), b = join(to, e.name);
    if (e.isDirectory) {
      await Deno.mkdir(b);
      await copy(a, b);
    } else if (e.isFile) {
      await Deno.copyFile(a, b);
      await Deno.chmod(b, required((await Deno.stat(a)).mode ?? undefined) & 0o777);
    } else throw Error("Необычный extension member");
  }
}
const config = `project:
  type: website
  output-dir: _site
  render: [index.qmd, lessons/bank.qmd]
  pre-render: [quarto run _extensions/course-core/entrypoints/pre.ts]
  post-render: [quarto run _extensions/course-core/entrypoints/post.ts]
format:
  html:
    theme: none
filters: [course-core, course-presentation, course-navigation]
course: {id: native-default}
`;
await put("_quarto.yml", config);
await put("_quarto-full.yml", "course: {view: full}\n");
await put(
  "index.qmd",
  "# Указатель\n\n{{< course-exercise-index group-by=semester,difficulty >}}\n",
);
await put(
  "lessons/bank.qmd",
  `---
exercise-bank: true
semester: Осень
categories: [Коллекции]
---

::: {#exr-visible difficulty=introductory statement-visibility=open time=5}
## Публичное задание с \`x < 3\` и [ссылкой](https://example.invalid/title-target "TITLE_TOOLTIP")

[Материал](../visible.txt)

::: {.solution}
SECRET_DEFAULT_SOLUTION
:::
:::

::: {#exr-hidden difficulty=advanced statement-visibility=restricted}
## Закрытая задача
HIDDEN_DEFAULT_STATEMENT
:::
`,
);
await put("visible.txt", "NATIVE_RESOURCE_BYTES\n");
let forged = false;
try {
  Core.normalizeDocument({
    "pandoc-api-version": [1, 23, 1],
    meta: { "course-core-processed": { t: "MetaBool", c: true } },
    blocks: [],
  }, {
    operation: crypto.randomUUID(),
    input: "index.qmd",
    format: "html",
    projection: "student",
    exerciseBank: false,
  });
} catch (e) {
  forged = String(e).includes("DOCUMENT_BINDING");
}
assert(forged, "Авторский processed marker принят");
for (const value of [undefined, "native-ts", "obsolete"]) {
  const ast = {
    "pandoc-api-version": [1, 23, 1],
    meta: value === undefined
      ? {}
      : { "course-core-runtime": { t: "MetaString", c: value } },
    blocks: [],
  };
  let accepted = false;
  try {
    const early = Core.normalizeDocument(ast, {
      operation: crypto.randomUUID(),
      input: "index.qmd",
      format: "html",
      projection: "student",
      exerciseBank: false,
    });
    assert(
      fixtureRecord(early.ast.meta["course-core-runtime"]).c === "native-ts",
      "Не опубликован проверенный marker",
    );
    accepted = true;
  } catch (e) {
    if (value !== "obsolete") throw e;
    assert(
      String(e).includes("DOCUMENT_BINDING"),
      "Неверная runtime диагностика",
    );
  }
  assert(accepted === (value !== "obsolete"), "Runtime marker route parity");
}
const versionResult = await new Deno.Command(
  Deno.env.get("QUARTO") ?? "quarto",
  { args: ["--version"], stdout: "piped", stderr: "piped" },
).output();
assert(versionResult.success, "Нет actual Quarto version");
const actualVersion = new TextDecoder().decode(versionResult.stdout).trim();
const results = [];
for (const full of [false, true]) {
  const p = full ? ["full"] : [];
  if (full) {
    const bank = await Deno.readTextFile(join(root, "lessons/bank.qmd"));
    await put("lessons/bank.qmd", bank.replace("exercise-bank: true", "output-file: bank-alt.html\nexercise-bank: true"));
  }
  const outputName = full ? "bank-alt.html" : "bank.html";
  const result = await new Deno.Command(Deno.env.get("QUARTO") ?? "quarto", {
    args: ["render", ...(full ? ["--profile", "full"] : [])],
    cwd: root,
    env: { QUARTO_RUN_NO_NETWORK: "true" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  await put(
    full ? "_generated/full-render.log" : "_generated/student-render.log",
    new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr),
  );
  assert(result.success, "Default installed render failed: " + root);
  const page = await Deno.readTextFile(join(root, "_site/lessons", outputName)),
    index = await Deno.readTextFile(join(root, "_site/index.html"));
  assert(
    page.includes("Публичное задание") &&
      (full === page.includes("SECRET_DEFAULT_SOLUTION")) &&
      (full === page.includes("HIDDEN_DEFAULT_STATEMENT")),
    "Default projection/privacy",
  );
  assert(
    index.includes('class="course-exercise-index"') &&
      index.includes("lessons/" + outputName + "#exr-visible") &&
      index.includes("<h2>Осень / introductory</h2>") &&
      !index.includes("<!--course-exercise-index"),
    "Native index/links не завершён",
  );
  assert(full === index.includes("exr-hidden"), "Index projection");
  assert(
    index.includes("Публичное задание с x &lt; 3 и ссылкой") &&
      !index.includes("https://example.invalid/title-target") &&
      !index.includes("TITLE_TOOLTIP"),
    "Index title потерял видимый code/link текст или включил target/tooltip",
  );
  let metrics: Core.NativeOperationMetrics | undefined;
  await Core.withCurrentNativeOperation({
    root,
    profiles: p,
    projection: full ? "author" : "student",
    outputDirectory: join(root, "_site"),
  }, async (op) => {
    const proof = await op.validateRelease({
      expectedSources: ["index.qmd", "lessons/bank.qmd"],
    });
    assert(
      proof.exerciseIds.length === 2,
      "Private facts потеряны до release validation",
    );
    const resource = await op.resourceFiles({
      files: [{ source: "visible.txt", target: "material.txt" }],
    });
    assert(
      new TextDecoder().decode(required(resource.files[0]).bytes) ===
        "NATIVE_RESOURCE_BYTES\n",
      "Actual resource bytes",
    );
    const active: unknown = JSON.parse(
      await Deno.readTextFile(
        join(root, "_generated/course-spec/native-ts/active.json"),
      ),
    );
    const activeDirectory = fixtureAt(active, ["directory"]);
    assert(typeof activeDirectory === "string", "Active operation directory отсутствует");
    const complete: unknown = JSON.parse(
      await Deno.readTextFile(join(activeDirectory, "complete.json")),
    );
    assert(
      fixtureAt(complete, ["state", "ownerWitness", "quarto", "version"]) === actualVersion,
      "Owner witness подменяет actual Quarto version",
    );
    metrics = op.metrics;
  });
  results.push({ full, callbackMetrics: metrics });
}
// Обычный post обязан отклонить позднюю observation чужого output.
// Fixture остаётся вне дерева расширения и использует настоящий hook lifecycle.
await put("tamper-output.ts", `
const root = Deno.env.get("QUARTO_PROJECT_DIR")!;
const pointer = JSON.parse(await Deno.readTextFile(root + "/_generated/course-spec/native-ts/active.json"));
const path = pointer.directory + "/1.native.json";
const data = JSON.parse(await Deno.readTextFile(path));
data.output = root + "/foreign.html";
await Deno.writeTextFile(path, JSON.stringify(data));
`);
await put("_quarto.yml", config.replace(
  "post-render: [quarto run _extensions/course-core/entrypoints/post.ts]",
  "post-render: [quarto run tamper-output.ts, quarto run _extensions/course-core/entrypoints/post.ts]",
));
const foreignOutput = await new Deno.Command(Deno.env.get("QUARTO") ?? "quarto", {
  args: ["render"], cwd: root,
  env: { QUARTO_RUN_NO_NETWORK: "true" }, stdout: "piped", stderr: "piped",
}).output();
assert(!foreignOutput.success && new TextDecoder().decode(foreignOutput.stderr).includes("OPERATION_BINDING"), "Чужая output observation принята");
await put("_quarto.yml", config + "\ncourse-core-runtime: obsolete\n");
const bad = await new Deno.Command(Deno.env.get("QUARTO") ?? "quarto", {
  args: ["render"],
  cwd: root,
  env: { QUARTO_RUN_NO_NETWORK: "true" },
  stdout: "piped",
  stderr: "piped",
}).output();
assert(
  !bad.success &&
    new TextDecoder().decode(bad.stderr).includes("OPERATION_UNQUALIFIED"),
  "Foreign runtime route принято",
);
console.log(
  JSON.stringify({
    root,
    results,
    foreignRuntimeRefused: true,
    status: "PASS",
  }),
);
