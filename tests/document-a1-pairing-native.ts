import { dirname, fromFileUrl, join } from "stdlib/path";
import { finalizeDocument } from "../_extensions/course-core/public.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "a1-pairing-native-" });
const assert = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const results: Record<string, unknown>[] = [];
const demo = (body = "PUBLIC_CONDITION") =>
  `::: {#exr-demo difficulty=introductory statement-visibility=open course-role=demonstration}\n${body}\n:::\n`;
const privateExercise = (body: string) =>
  `::: {#exr-private difficulty=introductory statement-visibility=open course-role=independent-study}\nPRIVATE_CONDITION\n\n${body}\n:::\n`;
const named = (id: string, body: string, extra = "") =>
  `::: {#sol-${id} .solution ${extra}}\n${body}\n:::\n`;
async function run(
  name: string,
  body: string,
  expected: "refuse" | "public" | "private",
  sourceIds: string[] = [],
) {
  const directory = join(root, name);
  await Deno.mkdir(directory);
  const extension = join(repo, "_extensions/course-core/native-ts");
  await Deno.writeTextFile(
    join(directory, "_quarto.yml"),
    `project:\n  type: book\n  output-dir: _site\nbook:\n  title: Проверка\n  chapters: [index.qmd]\nformat:\n  html:\n    theme: none\ncourse-core-projection: student\nfilters:\n  - at: pre-ast\n    path: ${extension}/early-context.lua\n  - at: post-quarto\n    path: ${extension}/late-kind.lua\n  - at: post-render\n    path: ${extension}/late-filter.lua\n`,
  );
  await Deno.writeTextFile(
    join(directory, "index.qmd"),
    "# Проверка\n\n" + body,
  );
  const context = {
    operation: crypto.randomUUID(),
    input: join(directory, "index.qmd"),
    format: "html",
    projection: "student",
    exerciseBank: true,
  };
  const capture = join(directory, "capture"),
    request = join(directory, "request.json");
  await Deno.writeTextFile(request, JSON.stringify({ context, capture }));
  const process = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
    args: ["render", "index.qmd", "--to", "html"],
    cwd: directory,
    env: { COURSE_CORE_TS_RUN: request, QUARTO_RUN_NO_NETWORK: "true" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const log = new TextDecoder().decode(process.stdout) +
    new TextDecoder().decode(process.stderr);
  await Deno.writeTextFile(join(directory, "render.log"), log);
  let html = "";
  try {
    html = await Deno.readTextFile(join(directory, "_site/index.html"));
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  const summary: Record<string, unknown> = {
    name,
    renderExit: process.code,
    privateSolutionInStudentHtml: html.includes("PRIVATE_SOLUTION_MISPAIRED"),
    privateBoundSolutionInStudentHtml: html.includes("PRIVATE_BOUND_SOLUTION"),
  };
  if (process.success) {
    const finalized = finalizeDocument(
      JSON.parse(await Deno.readTextFile(capture + ".early.json")),
      JSON.parse(await Deno.readTextFile(capture + ".late.json")),
    );
    summary.status = finalized.status;
    summary.hasPublicSolution = finalized.hasPublicSolution;
    assert(
      finalized.status === "complete",
      name + ": обязательное содержание потеряно",
    );
    if (expected === "public") {
      assert(
        finalized.hasPublicSolution["exr-demo"] === true &&
          html.includes("PUBLIC_BOUND_SOLUTION"),
        name + ": корректное публичное решение потеряно",
      );
    }
    if (expected === "private") {
      assert(
        !finalized.hasPublicSolution["exr-private"] &&
          !html.includes("PRIVATE_BOUND_SOLUTION"),
        name + ": private pairing изменил projection",
      );
    }
  }
  results.push(summary);
  const output = Deno.env.get("A1_PAIRING_RESULTS");
  if (output) {
    await Deno.writeTextFile(
      output,
      JSON.stringify({ root, results }, null, 2) + "\n",
    );
  }
  if (expected === "refuse") {
    assert(
      !process.success && log.includes("SOLUTION_PAIRING_INVALID"),
      name + ": ожидался адресный отказ pairing; " + JSON.stringify(summary),
    );
    assert(
      log.includes("index.qmd") && sourceIds.every((id) => log.includes(id)),
      name + ": диагностика потеряла источник/конфликтующие IDs",
    );
    for (const suffix of [".early.json", ".late.json"]) {
      let absent = false;
      try {
        await Deno.lstat(capture + suffix);
      } catch (error) {
        absent = error instanceof Deno.errors.NotFound;
      }
      assert(absent, name + ": зависимый sidecar создан при invalid pairing");
    }
    assert(!html, name + ": HTML создан при invalid pairing");
  } else assert(process.success, name + ": корректная связь отклонена");
}
await run(
  "nested-foreign-suffix",
  demo() + privateExercise(named("demo", "PRIVATE_SOLUTION_MISPAIRED")),
  "refuse",
  ["sol-demo", "exr-private", "exr-demo"],
);
await run(
  "nested-matching-suffix",
  demo(named("demo", "PUBLIC_BOUND_SOLUTION")),
  "public",
);
await run(
  "nested-anonymous",
  demo("::: {.solution}\nPUBLIC_BOUND_SOLUTION\n:::"),
  "public",
);
await run(
  "standalone-public",
  demo() + named("demo", "PUBLIC_BOUND_SOLUTION"),
  "public",
);
await run(
  "nested-private",
  privateExercise(named("private", "PRIVATE_BOUND_SOLUTION")),
  "private",
);
await run(
  "standalone-private",
  privateExercise("") + named("private", "PRIVATE_BOUND_SOLUTION"),
  "private",
);
await run(
  "reverse-conflict",
  privateExercise("") + demo(named("private", "PRIVATE_SOLUTION_MISPAIRED")),
  "refuse",
  ["sol-private", "exr-demo", "exr-private"],
);
await run(
  "unsupported-for",
  demo(named("demo", "PRIVATE_SOLUTION_MISPAIRED", "for=exr-private")),
  "refuse",
  ["sol-demo", "for"],
);
console.log(JSON.stringify({ status: "PASS", cases: results }));
