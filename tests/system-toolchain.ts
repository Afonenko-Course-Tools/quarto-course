import {
  command,
  quartoExecutable,
} from "../_extensions/course-core/infrastructure/process.ts";
const executable = Deno.env.get("QUARTO") || "quarto";
if (quartoExecutable() !== executable) {
  throw Error("explicit/public PATH executable lost");
}
const version = await command(executable, ["--version"], Deno.cwd());
if (!version.trim()) throw Error("native version not reported");
console.log(
  "PASS installed public executable without version gate: " + version.trim(),
);

const temp = await Deno.makeTempDir({prefix: "course-command-"});
const assert = (value: unknown, message: string) => { if (!value) throw Error(message); };
try {
  let nativeInvalidArgument: unknown;
  try { await new Deno.Command("/bin/sh", {args: [String.fromCharCode(0)], cwd: temp, stdout: "piped", stderr: "piped"}).output(); }
  catch (error) { nativeInvalidArgument = error; }
  assert(nativeInvalidArgument instanceof TypeError,
    "actual bundled Deno invalid argument must produce TypeError: " + String(nativeInvalidArgument));
  console.log("PASS actual Deno " + Deno.version.deno + " rejects NUL argument as TypeError");
  let internalInvalidArgument: unknown;
  try { await command("/bin/sh", [String.fromCharCode(0)], temp); } catch (error) { internalInvalidArgument = error; }
  assert(internalInvalidArgument instanceof TypeError && internalInvalidArgument.stack?.includes("TypeError") && !(internalInvalidArgument as any).cause,
    "internal TypeError must keep native identity/type and stack, not become ExternalToolFailure: " + String(internalInvalidArgument));
  const internal = new TypeError("INTERNAL_COMMAND_SETUP");
  const stack = internal.stack;
  const invalidEnv = Object.defineProperty({}, "INTERNAL_SETUP", {enumerable: true, get() { throw internal; }});
  let observed: unknown;
  try { await command("/bin/sh", ["-c", "exit 0"], temp, invalidEnv); } catch (error) { observed = error; }
  assert(observed === internal && (observed as Error).stack === stack,
    "unknown startup exception must preserve the exact object and original stack");
  const {runCli} = await import("../_extensions/course-core/entrypoints/diagnostics.ts");
  let cliInternal: unknown;
  try { await runCli(() => command("/bin/sh", ["-c", "exit 0"], temp, invalidEnv)); } catch (error) { cliInternal = error; }
  assert(cliInternal === internal && (cliInternal as Error).stack === stack,
    "CLI must rethrow the same unknown internal error with its original stack");
  console.log("PASS operational-startup catch preserves internal TypeError identity and stack");
  const warning = await command("/bin/sh", ["-c", "printf 'child output'; printf 'WARNING: permitted native warning' >&2"], temp);
  assert(warning === "child output", "exit-zero WARNING must preserve successful stdout");
  let failure: any;
  try { await command("/bin/sh", ["-c", "printf 'FOREIGN_STDOUT'; printf 'FOREIGN_STDERR' >&2; exit 7"], temp); }
  catch (error) { failure = error; }
  assert(failure?.name === "ExternalToolFailure" && failure.tool === "/bin/sh" && failure.exitCode === 7 && failure.stdout === "FOREIGN_STDOUT" && failure.stderr === "FOREIGN_STDERR" && failure.cause,
    "external failure must preserve tool, exit, both streams and cause");
  let missing: any;
  try { await command(temp + "/missing-tool", [], temp); } catch (error) { missing = error; }
  assert(missing?.name === "ExternalToolFailure" && missing.tool.endsWith("missing-tool") && missing.cause instanceof Deno.errors.NotFound,
    "missing executable must retain tool and launch cause");
  const nonExecutable = temp + "/non-executable";
  await Deno.writeTextFile(nonExecutable, ["#!/bin/sh", "exit 0", ""].join(String.fromCharCode(10)));
  await Deno.chmod(nonExecutable, 0o400);
  let denied: any;
  try { await command(nonExecutable, [], temp); } catch (error) { denied = error; }
  assert(denied?.name === "ExternalToolFailure" && denied.tool === nonExecutable && denied.cause instanceof Deno.errors.PermissionDenied,
    "actual operational PermissionDenied startup error must retain external tool and cause");
  const fake = temp + "/fake-tool";
  await Deno.writeTextFile(fake, "#!/bin/sh\nprintf 'FOREIGN_OUT_ONCE\\n'\nprintf 'FOREIGN_ID_ONCE\\n' >&2\nexit 7\n");
  await Deno.chmod(fake, 0o755);
  await Deno.mkdir(temp + "/bank");
  const cli = await new Deno.Command(executable, {args: ["run", new URL("../_extensions/course-core/entrypoints/export.ts", import.meta.url).pathname,
    "--book", "bank", "--work", "chosen", "--output", "failed.json"], cwd: temp, env: {QUARTO: fake}, stdout: "piped", stderr: "piped"}).output();
  const log = new TextDecoder().decode(cli.stdout) + new TextDecoder().decode(cli.stderr);
  assert(!cli.success && !log.includes("Uncaught") && log.includes("кодом 7") && (log.match(/FOREIGN_OUT_ONCE/g) ?? []).length === 1 && (log.match(/FOREIGN_ID_ONCE/g) ?? []).length === 1,
    "CLI must preserve foreign exit and each stream once: " + log);
  const nestedCliSource = temp + "/answer-cli.ts";
  const answerModule = new URL("../_extensions/course-core/body-export/answer.ts", import.meta.url).href;
  const cliModule = new URL("../_extensions/course-core/entrypoints/diagnostics.ts", import.meta.url).href;
  await Deno.writeTextFile(nestedCliSource, [
    "import {validateAnswer} from " + JSON.stringify(answerModule) + ";",
    "import {runCli} from " + JSON.stringify(cliModule) + ";",
    "await runCli(() => validateAnswer(" + JSON.stringify(["type: manual", "submission: text", ""].join(String.fromCharCode(10))) +
      ", " + JSON.stringify({source: "question.qmd", id: "exr-answer"}) + "));",
  ].join(String.fromCharCode(10)));
  const nestedCli = await new Deno.Command(executable, {args: ["run", nestedCliSource], cwd: temp, env: {CUE: fake}, stdout: "piped", stderr: "piped"}).output();
  const nestedLog = new TextDecoder().decode(nestedCli.stdout) + new TextDecoder().decode(nestedCli.stderr);
  assert(!nestedCli.success && !nestedLog.includes("Uncaught") && nestedLog.includes("кодом 7") &&
    (nestedLog.match(/ANSWER_INVALID/g) ?? []).length === 1 &&
    (nestedLog.match(/FOREIGN_OUT_ONCE/g) ?? []).length === 1 && (nestedLog.match(/FOREIGN_ID_ONCE/g) ?? []).length === 1,
    "actual ANSWER_INVALID -> ExternalToolFailure cause chain must print each diagnostic/stream once: " + nestedLog);
  const unknownCliSource = temp + "/unknown-cause-cli.ts";
  const diagnosticModule = new URL("../_extensions/course-core/domain/diagnostics.ts", import.meta.url).href;
  await Deno.writeTextFile(unknownCliSource, [
    "import {diagnostic} from " + JSON.stringify(diagnosticModule) + ";",
    "import {runCli} from " + JSON.stringify(cliModule) + ";",
    "function nestedCauseOrigin() { return new TypeError('UNKNOWN_NESTED_CAUSE'); }",
    "const cause = nestedCauseOrigin();",
    "const wrapper = diagnostic('ANSWER_INVALID', 'Контекст: ' + cause.message, {}, cause);",
    "if (Deno.args.includes('--cycle')) { Object.defineProperty(cause, 'cause', {value: wrapper}); console.error('CYCLE_FIXTURE_ACTIVE'); }",
    "await runCli(async () => { throw wrapper; });",
  ].join(String.fromCharCode(10)));
  const unknownCli = await new Deno.Command(executable, {args: ["run", unknownCliSource], cwd: temp, stdout: "piped", stderr: "piped"}).output();
  const unknownLog = new TextDecoder().decode(unknownCli.stdout) + new TextDecoder().decode(unknownCli.stderr);
  assert(!unknownCli.success && unknownLog.includes("TypeError: UNKNOWN_NESTED_CAUSE") && unknownLog.includes("at nestedCauseOrigin") &&
    (unknownLog.match(/ANSWER_INVALID/g) ?? []).length === 1,
    "known wrapper must preserve the nested unknown stack even when it quotes cause.message: " + unknownLog);
  const cyclicCli = await new Deno.Command(executable, {args: ["run", unknownCliSource, "--", "--cycle"], cwd: temp, stdout: "piped", stderr: "piped"}).output();
  const cyclicLog = new TextDecoder().decode(cyclicCli.stdout) + new TextDecoder().decode(cyclicCli.stderr);
  assert(!cyclicCli.success && cyclicLog.includes("CYCLE_FIXTURE_ACTIVE") && (cyclicLog.match(/ANSWER_INVALID/g) ?? []).length === 1 &&
    (cyclicLog.match(/at nestedCauseOrigin/g) ?? []).length === 1,
    "cyclic Error cause links must terminate with each original object printed once: " + cyclicLog);
  console.log("PASS nested unknown stack and finite Error-identity cause traversal");
  let output = false;
  try { await Deno.stat(temp + "/failed.json"); output = true; } catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
  assert(!output, "failed CLI wrote its final export");
  console.log("PASS exit-zero native warning, external failure provenance and CLI stream boundary");
} finally { await Deno.remove(temp, {recursive: true}); }

const checkMain = (await import("../_extensions/course-core/entrypoints/check.ts")).main;
const exportMain = (await import("../_extensions/course-core/entrypoints/export.ts")).main;
for (const [run, code] of [
  [() => checkMain([".", "unknown"]), "CORE.ARGUMENTS_INVALID"],
  [() => exportMain(["--unexpected", "bank"]), "EXPORT.ARGUMENTS_INVALID"],
  [() => exportMain(["--book", "bank"]), "EXPORT.BOOK_WORK_OUTPUT_REQUIRED"],
] as const) {
  let error: any;
  try { await run(); } catch (value) { error = value; }
  assert(error?.name === "ExtensionDiagnostic" && error.code === code && error.message.includes("arguments"),
    "CLI argument guard lost its stable context: " + String(error));
}
console.log("PASS named CLI argument diagnostics");
