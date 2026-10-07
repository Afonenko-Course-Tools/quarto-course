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
  const fake = temp + "/fake-tool";
  await Deno.writeTextFile(fake, "#!/bin/sh\nprintf 'FOREIGN_OUT_ONCE\\n'\nprintf 'FOREIGN_ID_ONCE\\n' >&2\nexit 7\n");
  await Deno.chmod(fake, 0o755);
  await Deno.mkdir(temp + "/bank");
  const cli = await new Deno.Command(executable, {args: ["run", new URL("../_extensions/course-core/entrypoints/export.ts", import.meta.url).pathname,
    "--book", "bank", "--work", "chosen", "--output", "failed.json"], cwd: temp, env: {QUARTO: fake}, stdout: "piped", stderr: "piped"}).output();
  const log = new TextDecoder().decode(cli.stdout) + new TextDecoder().decode(cli.stderr);
  assert(!cli.success && !log.includes("Uncaught") && log.includes("кодом 7") && (log.match(/FOREIGN_OUT_ONCE/g) ?? []).length === 1 && (log.match(/FOREIGN_ID_ONCE/g) ?? []).length === 1,
    "CLI must preserve foreign exit and each stream once: " + log);
  let output = false;
  try { await Deno.stat(temp + "/failed.json"); output = true; } catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
  assert(!output, "failed CLI wrote its final export");
  console.log("PASS exit-zero native warning, external failure provenance and CLI stream boundary");
} finally { await Deno.remove(temp, {recursive: true}); }
