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
