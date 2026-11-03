// Реальные Deno CommandOutput getters: inherit/null нельзя читать как piped stderr.
import { CoreContractError } from "../_extensions/course-core/contracts/project.ts";
import {
  runAssignmentCaptureChild,
  withAssignmentExecution,
} from "../_extensions/course-core/runtime/assignment-execution.ts";
const runtime = {
  executable: Deno.execPath(),
  profiles: ["full"],
  environment: {},
  outputDirectory: "/tmp/_generated/out",
  inputs: ["index.qmd"],
  implementationFiles: [],
};
const failures: string[] = [];
for (const stderr of ["piped", "inherit", "null"] as const) {
  let error: unknown;
  try {
    // Этот argv для Deno не имеет входного module render: настоящий child возвращает ненулевой code.
    await withAssignmentExecution(
      runtime,
      "/tmp",
      () =>
        runAssignmentCaptureChild(crypto.randomUUID(), {
          args: ["render", "--output-dir", "_generated/out"],
          stdout: "null",
          stderr,
        }),
    );
  } catch (cause) {
    error = cause;
  }
  if (
    !(error instanceof CoreContractError) ||
    error.code !== "OPERATION_INCOMPLETE" ||
    !/Native capture child failed: [1-9][0-9]*/.test(error.message)
  ) failures.push(stderr + ": " + String(error));
  if (
    stderr === "piped" && error instanceof Error &&
    !error.message.includes("render")
  ) failures.push("Нет buffered stderr");
}
if (failures.length) throw Error(failures.join("\n"));
console.log(
  "PASS actual nonzero child stderr piped/inherit/null сохраняет OPERATION_INCOMPLETE и code",
);
