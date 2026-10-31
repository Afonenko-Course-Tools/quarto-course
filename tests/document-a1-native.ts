import { dirname, fromFileUrl, join } from "stdlib/path";
import { copy } from "stdlib/fs";
import { finalizeDocument } from "../_extensions/course-core/public.ts";
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const repo = dirname(dirname(fromFileUrl(import.meta.url))),
  root = await Deno.makeTempDir({ prefix: "a1-document-native-" });
await copy(
  join(repo, "_extensions/course-core"),
  join(root, "_extensions/course-core"),
);
await Deno.writeTextFile(
  join(root, "_quarto.yml"),
  `project:\n  type: book\n  output-dir: _site\nbook:\n  title: Проверка\n  chapters: [index.qmd]\nformat:\n  html:\n    theme: none\ncourse-core-projection: student\nfilters:\n  - at: pre-ast\n    path: _extensions/course-core/native-ts/early-context.lua\n  - at: post-quarto\n    path: _extensions/course-core/native-ts/late-kind.lua\n  - at: post-render\n    path: _extensions/course-core/native-ts/late-filter.lua\n`,
);
await Deno.writeTextFile(
  join(root, "fragment.qmd"),
  "Включённый **текст**.\n\n- список\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nСноска[^one].\n\n[^one]: Сохранённая сноска.\n",
);
await Deno.writeTextFile(
  join(root, "index.qmd"),
  `# Тест\n\n::: {#exr-native difficulty=introductory statement-visibility=open course-role=demonstration}\n## Заголовок\n\n{{< include fragment.qmd >}}\n\n[Span]{#keep .foreign}\n\n::: {.solution .content-visible when-format=latex}\nLATEX_ONLY_SOLUTION\n:::\n:::\n\n::: {#exr-private difficulty=introductory statement-visibility=open}\nPRIVATE_CONDITION\n\n::: {.solution}\nPRIVATE_SOLUTION\n:::\n:::\n\n::: {#exr-restricted difficulty=introductory statement-visibility=restricted}\nCLOSED_STATEMENT\n:::\n\n::: {.callout-note}\nОбычная native разметка.\n:::\n`,
);
const context = {
  operation: crypto.randomUUID(),
  input: join(root, "index.qmd"),
  format: "html",
  projection: "student" as const,
  exerciseBank: true,
};
const capture = join(root, "capture");
const run = join(root, "run.json");
await Deno.writeTextFile(run, JSON.stringify({ context, capture }));
const p = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
  args: ["render", "index.qmd", "--to", "html"],
  cwd: root,
  env: { COURSE_CORE_TS_RUN: run, QUARTO_RUN_NO_NETWORK: "true" },
  stdout: "piped",
  stderr: "piped",
}).output();
const log = new TextDecoder().decode(p.stdout) +
  new TextDecoder().decode(p.stderr);
assert(p.success, "Native render failed\n" + log);
const early = JSON.parse(await Deno.readTextFile(capture + ".early.json")),
  late = JSON.parse(await Deno.readTextFile(capture + ".late.json"));
const result = finalizeDocument(early, late);
assert(
  result.status === "complete",
  "Required binding lost: " + JSON.stringify(result),
);
assert(
  late.occurrences.some((row: any) => row.nativeKind === "Theorem"),
  "Настоящий native custom node не наблюдён",
);
const body = JSON.stringify(result);
assert(
  body.includes("Включённый") && body.includes('"Table"') &&
    body.includes('"Note"') && body.includes('"Span"'),
  "Структура include повреждена: " + body,
);
assert(
  !result.hasPublicSolution["exr-native"],
  "Отсутствующий conditional solution ошибочно объявлен публичным",
);
assert(
  !body.includes("PRIVATE_SOLUTION") && !body.includes("CLOSED_STATEMENT"),
  "Private solution утёк",
);
const html = await Deno.readTextFile(join(root, "_site/index.html"));
assert(
  !html.includes("PRIVATE_SOLUTION") && !html.includes("CLOSED_STATEMENT") &&
    !html.includes("data-course-core-occurrence") &&
    !html.includes("LATEX_ONLY_SOLUTION"),
  "Публичная проекция/внутренний marker утекли",
);
console.log(
  JSON.stringify({
    status: "PASS",
    root,
    occurrences: late.occurrences.map((r: any) => ({
      key: r.key,
      nativeKind: r.nativeKind,
    })),
    conditionalSolutionAbsent: true,
  }),
);
const positive = await Deno.readTextFile(join(root, "index.qmd"));
await Deno.writeTextFile(
  join(root, "index.qmd"),
  positive +
    `\n::: {#exr-marker}\n\n~~~~{.yaml .course-exercise}\ndifficulty: intermediate\nstatement-visibility: open\ncourse-role: demonstration\n~~~~\n\nPUBLIC_MARKER_CONDITION\n\n::: {.solution}\nPUBLIC_POSITIVE_SOLUTION\n:::\n:::\n`,
);
const positiveContext = { ...context, operation: crypto.randomUUID() };
const positiveCapture = join(root, "positive");
await Deno.writeTextFile(
  run,
  JSON.stringify({ context: positiveContext, capture: positiveCapture }),
);
const positiveRun = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
  args: ["render", "index.qmd", "--to", "html"],
  cwd: root,
  env: { COURSE_CORE_TS_RUN: run, QUARTO_RUN_NO_NETWORK: "true" },
  stdout: "piped",
  stderr: "piped",
}).output();
assert(positiveRun.success, new TextDecoder().decode(positiveRun.stderr));
const positiveResult = finalizeDocument(
  JSON.parse(await Deno.readTextFile(positiveCapture + ".early.json")),
  JSON.parse(await Deno.readTextFile(positiveCapture + ".late.json")),
);
assert(
  positiveResult.status === "complete" &&
    positiveResult.hasPublicSolution["exr-marker"] === true,
  "Нет положительного позднего public solution witness",
);
assert(
  JSON.stringify(positiveResult).includes("PUBLIC_POSITIVE_SOLUTION"),
  "Публичное решение потеряно",
);
await Deno.writeTextFile(
  join(root, "index.qmd"),
  `# Hidden\n\n::: {.content-visible when-format=latex}\n::: {#exr-invalid difficulty=impossible statement-visibility=open}\nHIDDEN_INVALID\n:::\n:::\n`,
);
await Deno.writeTextFile(
  run,
  JSON.stringify({
    context: { ...context, operation: crypto.randomUUID() },
    capture: join(root, "invalid"),
  }),
);
const invalid = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
  args: ["render", "index.qmd", "--to", "html"],
  cwd: root,
  env: { COURSE_CORE_TS_RUN: run, QUARTO_RUN_NO_NETWORK: "true" },
  stdout: "piped",
  stderr: "piped",
}).output();
const invalidLog = new TextDecoder().decode(invalid.stdout) +
  new TextDecoder().decode(invalid.stderr);
assert(
  !invalid.success && invalidLog.includes("EXERCISE_CONTRACT") &&
    invalidLog.includes("index.qmd"),
  "Hidden invalid обошёл early schema\n" + invalidLog,
);
console.log(
  "PASS native marker decoder, late positive solution, hidden invalid before conditions",
);

let wroteLock = false;
try {
  await Deno.lstat(join(root, "_extensions/course-core/deno.lock"));
  wroteLock = true;
} catch (e) {
  if (!(e instanceof Deno.errors.NotFound)) throw e;
}
assert(!wroteLock, "Render изменил dependency lock расширения");
// Повторное использование sidecar prefix не должно подменять текущий проход.
await Deno.writeTextFile(join(root, "index.qmd"), positive);
await Deno.writeTextFile(
  run,
  JSON.stringify({ context: positiveContext, capture: positiveCapture }),
);
const originalSidecar = await Deno.readTextFile(
  positiveCapture + ".early.json",
);
const stale = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
  args: ["render", "index.qmd", "--to", "html"],
  cwd: root,
  env: { COURSE_CORE_TS_RUN: run, QUARTO_RUN_NO_NETWORK: "true" },
  stdout: "piped",
  stderr: "piped",
}).output();
const staleLog = new TextDecoder().decode(stale.stdout) +
  new TextDecoder().decode(stale.stderr);
assert(
  !stale.success && staleLog.includes("DOCUMENT_BINDING"),
  "Старый capture не получил binding refusal\n" + staleLog,
);
assert(
  await Deno.readTextFile(positiveCapture + ".early.json") === originalSidecar,
  "Старый sidecar перезаписан",
);
console.log("PASS native stale capture refusal without overwrite");
