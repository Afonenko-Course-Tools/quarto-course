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
  const warning = await command("/bin/sh", ["-c", "printf 'child output'; printf 'WARNING: permitted native warning' >&2"], temp);
  assert(warning === "child output", "exit-zero WARNING must preserve successful stdout");
  let failure: any;
  try { await command("/bin/sh", ["-c", "printf 'FOREIGN_STDOUT'; printf 'FOREIGN_STDERR' >&2; exit 7"], temp); }
  catch (error) { failure = error; }
  assert(failure?.name === "ExternalToolFailure" && failure.tool === "/bin/sh" && failure.exitCode === 7 && failure.stdout === "FOREIGN_STDOUT" && failure.stderr === "FOREIGN_STDERR" && failure.cause,
    "external failure must preserve tool, exit, both streams and cause");
  let missing: any;
  try { await command(temp + "/missing-tool", [], temp); } catch (error) { missing = error; }
  assert(missing?.name === "ExternalToolFailure" && missing.tool.endsWith("missing-tool") && missing.cause,
    "missing executable must retain tool and launch cause");
  console.log("PASS exit-zero native warning and external failure provenance");
} finally { await Deno.remove(temp, {recursive: true}); }
