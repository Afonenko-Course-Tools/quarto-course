import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import type { Course } from "../_extensions/course-core/domain/model.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "core-example-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
const cue = Deno.env.get("CUE") || "cue";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function run(executable: string, args: string[], expectedError?: string) {
  const result = await new Deno.Command(executable, {
    args, cwd: root, stdout: "piped", stderr: "piped",
  }).output();
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  assert(expectedError ? !result.success && output.includes(expectedError) : result.success, output);
}

try {
  await copy(join(repo, "examples/course"), root, { overwrite: true });
  await run(quarto, ["add", repo, "--no-prompt"]);
  await run(quarto, ["render", "--fail-if-warnings"]);
  assert((await Deno.stat(join(root, "_book/index.html"))).isFile, "No rendered book");
  const modelPath = join(root, "_generated/course-spec/course.json");
  const model: Course = JSON.parse(await Deno.readTextFile(modelPath));
  assert(model.exercises.length === 1 && model.assessments.length === 1, "Example model is incomplete");
  const vet = ["vet", join(repo, "_extensions/course-core/spec/core.cue"), "-d", "#Course", "-c"];
  await run(cue, [...vet, modelPath]);

  const cases: { rule: string; mutate: (course: Course) => void }[] = [
    { rule: "CORE001", mutate: course => course.exercises.push(structuredClone(course.exercises[0])) },
    { rule: "CORE003", mutate: course => { course.exercises[0].target = "unregistered"; } },
    { rule: "CORE004", mutate: course => { course.assessments[0].items = ["exr-missing"]; } },
  ];
  for (const { rule, mutate } of cases) {
    const invalid = structuredClone(model);
    mutate(invalid);
    const input = join(root, "invalid-course.json");
    await Deno.writeTextFile(input, JSON.stringify(invalid));
    await run(cue, [...vet, input], rule);
  }
  console.log("PASS core example: local installation, rendered book, validated IR, duplicate IDs, unknown targets and missing members rejected by CUE");
} finally {
  await Deno.remove(root, { recursive: true });
}
