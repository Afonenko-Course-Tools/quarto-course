import { fromFileUrl } from "stdlib/path";
import { command, quartoExecutable } from "../_extensions/course-core/infrastructure/process.ts";
const executable = Deno.env.get("QUARTO") || "quarto";
if (quartoExecutable() !== executable) {
  throw Error("explicit/public PATH executable lost");
}
const version = await command(executable, ["--version"], Deno.cwd());
if (!version.trim()) throw Error("native version not reported");
console.log("PASS installed public executable without version gate: " + version.trim());

const temp = await Deno.makeTempDir({ prefix: "course-command-" });
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
try {
  let nativeInvalidArgument: unknown;
  try {
    await new Deno.Command("/bin/sh", {
      args: [String.fromCharCode(0)],
      cwd: temp,
      stdout: "piped",
      stderr: "piped",
    }).output();
  } catch (error) {
    nativeInvalidArgument = error;
  }
  assert(
    nativeInvalidArgument instanceof TypeError,
    "actual bundled Deno invalid argument must produce TypeError: " + String(nativeInvalidArgument),
  );
  console.log("PASS actual Deno " + Deno.version.deno + " rejects NUL argument as TypeError");
  let internalInvalidArgument: unknown;
  try {
    await command("/bin/sh", [String.fromCharCode(0)], temp);
  } catch (error) {
    internalInvalidArgument = error;
  }
  assert(
    internalInvalidArgument instanceof TypeError &&
      internalInvalidArgument.stack?.includes("TypeError") &&
      !internalInvalidArgument.cause,
    "internal TypeError must keep native identity/type and stack, not become ExternalToolFailure: " +
      String(internalInvalidArgument),
  );
  const internal = new TypeError("INTERNAL_COMMAND_SETUP");
  const stack = internal.stack;
  const invalidEnv = Object.defineProperty({}, "INTERNAL_SETUP", {
    enumerable: true,
    get() {
      throw internal;
    },
  });
  let observed: unknown;
  try {
    await command("/bin/sh", ["-c", "exit 0"], temp, invalidEnv);
  } catch (error) {
    observed = error;
  }
  assert(
    observed === internal && (observed instanceof Error && observed.stack) === stack,
    "unknown startup exception must preserve the exact object and original stack",
  );
  console.log("PASS operational-startup catch preserves internal TypeError identity and stack");
  const warning = await command(
    "/bin/sh",
    ["-c", "printf 'child output'; printf 'WARNING: permitted native warning' >&2"],
    temp,
  );
  assert(warning === "child output", "exit-zero WARNING must preserve successful stdout");
  let failure: unknown;
  try {
    await command("/bin/sh", ["-c", "printf 'FOREIGN_STDOUT'; printf 'FOREIGN_STDERR' >&2; exit 7"], temp);
  } catch (error) {
    failure = error;
  }
  assert(
    failure instanceof Error &&
      failure.name === "ExternalToolFailure" &&
      "tool" in failure &&
      failure.tool === "/bin/sh" &&
      "exitCode" in failure &&
      failure.exitCode === 7 &&
      "stdout" in failure &&
      failure.stdout === "FOREIGN_STDOUT" &&
      "stderr" in failure &&
      failure.stderr === "FOREIGN_STDERR" &&
      failure.cause,
    "external failure must preserve tool, exit, both streams and cause",
  );
  let missing: unknown;
  try {
    await command(temp + "/missing-tool", [], temp);
  } catch (error) {
    missing = error;
  }
  assert(
    missing instanceof Error &&
      missing.name === "ExternalToolFailure" &&
      "tool" in missing &&
      typeof missing.tool === "string" &&
      missing.tool.endsWith("missing-tool") &&
      missing.cause instanceof Deno.errors.NotFound,
    "missing executable must retain tool and launch cause",
  );
  const nonExecutable = temp + "/non-executable";
  await Deno.writeTextFile(nonExecutable, ["#!/bin/sh", "exit 0", ""].join(String.fromCharCode(10)));
  await Deno.chmod(nonExecutable, 0o400);
  let denied: unknown;
  try {
    await command(nonExecutable, [], temp);
  } catch (error) {
    denied = error;
  }
  assert(
    denied instanceof Error &&
      denied.name === "ExternalToolFailure" &&
      "tool" in denied &&
      denied.tool === nonExecutable &&
      denied.cause instanceof Deno.errors.PermissionDenied,
    "actual operational PermissionDenied startup error must retain external tool and cause",
  );
  const fake = temp + "/fake-tool";
  await Deno.writeTextFile(fake, "#!/bin/sh\nprintf 'FOREIGN_OUT_ONCE\\n'\nprintf 'FOREIGN_ID_ONCE\\n' >&2\nexit 7\n");
  await Deno.chmod(fake, 0o755);
  // Exercise the installed entrypoints, including the native aliases Quarto uses.
  async function entry(name: string, env: Record<string, string>) {
    const source = fromFileUrl(new URL(`../_extensions/course-core/entrypoints/${name}.ts`, import.meta.url));
    const result = await new Deno.Command(executable, {
      args: ["run", source],
      cwd: temp,
      env: {
        QUARTO_PROJECT_DIR: temp,
        QUARTO_PROJECT_OUTPUT_DIR: temp + "/_site",
        QUARTO_PROFILE: "",
        QUARTO_PROJECT_SCRIPT_QUIET: "1",
        QUARTO_PROJECT_INPUT_FILES: "",
        QUARTO_PROJECT_OUTPUT_FILES: "",
        QUARTO_USE_FILE_FOR_PROJECT_INPUT_FILES: "",
        QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES: "",
        ...env,
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    return { ...result, log: new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr) };
  }
  for (const name of ["pre", "post", "native-pre", "native-post"]) {
    const idle = await entry(name, {});
    assert(idle.success, `${name}: explicit no-work hook must succeed: ${idle.log}`);
  }
  await Deno.writeTextFile(temp + "/index.qmd", "# Native CLI boundary\n");
  // A real pre-hook invokes owner inspection, preserving the foreign failure streams.
  const failedPre = await entry("pre", {
    QUARTO: fake,
    QUARTO_PROJECT_INPUT_FILES: "index.qmd",
    QUARTO_PROJECT_OUTPUT_DIR: temp + "/_site",
  });
  assert(
    !failedPre.success &&
      !failedPre.log.includes("Uncaught") &&
      failedPre.log.includes("кодом 7") &&
      (failedPre.log.match(/FOREIGN_OUT_ONCE/g) ?? []).length === 1 &&
      (failedPre.log.match(/FOREIGN_ID_ONCE/g) ?? []).length === 1,
    "actual pre-hook must print external tool streams once: " + failedPre.log,
  );
  // A malformed pointer reaches the real post-hook's primary diagnostic.
  const state = temp + "/_generated/course-spec/native-ts";
  await Deno.mkdir(state, { recursive: true });
  await Deno.writeTextFile(state + "/active.json", "{}");
  const failedPost = await entry("post", { QUARTO_PROJECT_OUTPUT_FILES: "index.html" });
  assert(
    !failedPost.success &&
      !failedPost.log.includes("Uncaught") &&
      (failedPost.log.match(/OPERATION_BINDING/g) ?? []).length === 1,
    "actual post-hook must print its primary diagnostic once: " + failedPost.log,
  );
  // Unknown exceptions belong to the native CLI, with their original stack.
  await Deno.writeTextFile(state + "/active.json", "{broken");
  const unknownPost = await entry("native-post", { QUARTO_PROJECT_OUTPUT_FILES: "index.html" });
  assert(
    !unknownPost.success &&
      unknownPost.log.includes("SyntaxError") &&
      unknownPost.log.includes("JSON.parse") &&
      unknownPost.log.includes("Uncaught"),
    "unknown post-hook parsing failure must preserve native stack: " + unknownPost.log,
  );
  const unknownPre = await entry("native-pre", {
    QUARTO_USE_FILE_FOR_PROJECT_INPUT_FILES: temp + "/missing-native-inputs.txt",
  });
  assert(
    !unknownPre.success && unknownPre.log.includes("NotFound") && unknownPre.log.includes("Uncaught"),
    "unknown pre-hook filesystem failure must preserve native stack: " + unknownPre.log,
  );
  // Cause graphs are constructed here because filesystem/tool failures cannot create cycles.
  const cliModule = new URL("../_extensions/course-core/entrypoints/diagnostics.ts", import.meta.url).href;
  const unknownCliSource = temp + "/unknown-cause-cli.ts";
  const diagnosticModule = new URL("../_extensions/course-core/domain/diagnostics.ts", import.meta.url).href;
  await Deno.writeTextFile(
    unknownCliSource,
    [
      "import {diagnostic} from " + JSON.stringify(diagnosticModule) + ";",
      "import {runCli} from " + JSON.stringify(cliModule) + ";",
      "function nestedCauseOrigin() { return new TypeError('UNKNOWN_NESTED_CAUSE'); }",
      "const cause = nestedCauseOrigin();",
      "const wrapper = diagnostic('ANSWER_INVALID', 'Контекст: ' + cause.message, {}, cause);",
      "if (Deno.args.includes('--cycle')) { Object.defineProperty(cause, 'cause', {value: wrapper}); console.error('CYCLE_FIXTURE_ACTIVE'); }",
      "await runCli(async () => { throw wrapper; });",
    ].join(String.fromCharCode(10)),
  );
  const cyclicCli = await new Deno.Command(executable, {
    args: ["run", unknownCliSource, "--", "--cycle"],
    cwd: temp,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const cyclicLog = new TextDecoder().decode(cyclicCli.stdout) + new TextDecoder().decode(cyclicCli.stderr);
  assert(
    !cyclicCli.success &&
      cyclicLog.includes("CYCLE_FIXTURE_ACTIVE") &&
      (cyclicLog.match(/ANSWER_INVALID/g) ?? []).length === 1 &&
      (cyclicLog.match(/at nestedCauseOrigin/g) ?? []).length === 1 &&
      cyclicLog.includes("TypeError: UNKNOWN_NESTED_CAUSE"),
    "cyclic Error cause links must terminate with each original object printed once: " + cyclicLog,
  );
  console.log("PASS nested unknown stack and finite Error-identity cause traversal");
  console.log("PASS actual pre/post hooks: no-work, primary diagnostics, external streams and unknown stacks");
} finally {
  await Deno.remove(temp, { recursive: true });
}
