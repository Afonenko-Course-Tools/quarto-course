import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const configured = Deno.env.get("COURSE_PERFORMANCE_SOURCE") ?? join(root, "dependencies/performance");
if (!isAbsolute(configured)) {
  throw new Error("COURSE_PERFORMANCE_SOURCE должен указывать абсолютный checkout Performance");
}
const companion = await Deno.realPath(configured);
// Штатный source dependency содержит общий движок проверки.
const engine = join(companion, "tools/check-lua.ts");
// Git перечисляет собственные tracked/untracked файлы без обхода submodules.
const discovered = await new Deno.Command("git", {
  args: ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  cwd: root,
  stdout: "piped",
  stderr: "piped",
}).output();
if (!discovered.success) throw Error(new TextDecoder().decode(discovered.stderr));
const scopes = [...new Set(new TextDecoder().decode(discovered.stdout).split("\0"))]
  .filter(
    (file) =>
      file.endsWith(".lua") &&
      !file.split("/").some((part) => ["vendor", "node_modules"].includes(part)) &&
      !file.startsWith("typecheck/") &&
      Deno.statSync(join(root, file)).isFile,
  )
  .sort();
if (!scopes.length) throw Error("Собственный Lua scope пуст");
const runtimePaths = [
  "_extensions/course-core/?.lua",
  "_extensions/course-core/native-ts/?.lua",
  "_extensions/course-navigation/?.lua",
  "_extensions/course-presentation/?.lua",
  "_extensions/course-presentation/modules/?.lua",
];
const forwarded: string[] = [];
for (let index = 0; index < Deno.args.length; index++) {
  const flag = Deno.args[index];
  if (flag === "--probe") forwarded.push(flag);
  else if (flag === "--server") {
    const server = Deno.args[++index];
    if (!server) throw new Error("--server: отсутствует значение");
    forwarded.push(flag, server);
  } else throw new Error("Неизвестный параметр: " + flag);
}
const result = await new Deno.Command(Deno.execPath(), {
  args: [
    "run",
    "--no-config",
    "--no-lock",
    "-A",
    engine,
    "--root",
    root,
    ...scopes.flatMap((scope) => ["--scope", scope]),
    "--library",
    join(root, "typecheck"),
    ...runtimePaths.flatMap((path) => ["--runtime-path", path]),
    ...forwarded,
  ],
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
}).output();
Deno.exitCode = result.code;
