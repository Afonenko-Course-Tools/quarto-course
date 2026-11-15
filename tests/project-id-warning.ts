import { CoreContractError, normalizeDocument } from "../_extensions/course-core/public.ts";
import { fromFileUrl } from "stdlib/path";
const context = {
  operation: crypto.randomUUID(),
  format: "html",
  projection: "student" as const,
  exerciseBank: true,
  defaults: { difficulty: "introductory" as const, "statement-visibility": "open" as const },
};
const div = (id: string, project?: string, difficulty?: string) => ({
  t: "Div",
  c: [
    [id, [], [...(project ? [["project", project]] : []), ...(difficulty ? [["difficulty", difficulty]] : [])]],
    [{ t: "Para", c: [{ t: "Str", c: "Условие" }] }],
  ],
});
const doc = (blocks: unknown[]) => ({ "pandoc-api-version": [1, 23, 1], meta: {}, blocks });
function check(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
if (Deno.args.includes("--emit")) {
  normalizeDocument(doc([div("exr-arrays-wrong", "/projects/arrays/reverse-array")]), {
    ...context,
    input: "mismatch-bank.qmd",
  });
  normalizeDocument(doc([div("exr-java-wrong", "/projects/java-text/buffer-tokenizer")]), {
    ...context,
    input: "composite-bank.qmd",
  });
  normalizeDocument(doc([div("exr-arrays-reverse-array", "/projects/arrays/reverse-array")]), {
    ...context,
    input: "good-bank.qmd",
  });
  normalizeDocument(doc([div("exr-without-project")]), { ...context, input: "no-project-bank.qmd" });
  let structuralError = "";
  try {
    normalizeDocument(
      doc([
        div("exr-arrays-reverse-array", "/projects/arrays/reverse-array", "introductory"),
        div("exr-arrays-reverse-array", "/projects/arrays/reverse-array", "advanced"),
      ]),
      { ...context, input: "conflict-bank.qmd" },
    );
  } catch (error) {
    if (error instanceof CoreContractError) structuralError = error.code;
    else throw error;
  }
  console.log(JSON.stringify({ structuralError }));
} else {
  const result = await new Deno.Command(Deno.env.get("QUARTO") ?? "quarto", {
    args: ["run", fromFileUrl(import.meta.url), "--emit"],
    stdout: "piped",
    stderr: "piped",
    env: { DENO_NO_PACKAGE_JSON: "1", QUARTO_RUN_NO_NETWORK: "true" },
  }).output();
  const stderr = new TextDecoder().decode(result.stderr),
    stdout = new TextDecoder().decode(result.stdout);
  check(result.success, "Диагностический producer завершился с ошибкой: " + stderr);
  const warnings = stderr.split(/\r?\n/).filter((line) => line.startsWith("WARNING: CORE.PROJECT_ID_MISMATCH:"));
  check(
    warnings.length === 2,
    "Нужны два project/ID WARNING в реальном stderr, получено " + warnings.length + ": " + stderr,
  );
  check(
    warnings.some(
      (line) =>
        line.includes("mismatch-bank.qmd") &&
        line.includes("exr-arrays-wrong") &&
        line.includes("project=/projects/arrays/reverse-array") &&
        line.includes("expected=exr-arrays-reverse-array"),
    ),
    "WARNING потерял known source/ID/project/expected",
  );
  check(
    warnings.some(
      (line) =>
        line.includes("composite-bank.qmd") &&
        line.includes("project=/projects/java-text/buffer-tokenizer") &&
        line.includes("expected=exr-java-text-buffer-tokenizer"),
    ),
    "Составные имена разрезаны обратно на каталоги",
  );
  check(
    !stderr.includes("good-bank.qmd") && !stderr.includes("no-project-bank.qmd"),
    "Ложный WARNING или выдуманный project",
  );
  check(!/(?:строка|line)=/.test(stderr), "Выдумана неизвестная source line");
  const data: unknown = JSON.parse(stdout.trim());
  check(
    data !== null &&
      typeof data === "object" &&
      "structuralError" in data &&
      data.structuralError === "DOCUMENT_DUPLICATE",
    "Структурный конфликт перестал быть ERROR",
  );
  console.log("PASS project→ID: stderr WARNING, composite names, no invented path/line, structural ERROR");
}
