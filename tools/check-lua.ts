import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const configured = Deno.env.get("COURSE_PERFORMANCE_SOURCE");
if (!configured || !isAbsolute(configured)) {
  throw new Error("COURSE_PERFORMANCE_SOURCE должен указывать абсолютный закреплённый checkout Performance");
}
const companion = await Deno.realPath(configured);
// Движок принят на 05803ba; CI закрепляет Performance checkout с этим договором.
const engine = join(companion, "tools/check-lua.ts");
const scopes = [
  "_extensions/course-core/diagnostics.lua",
  "_extensions/course-core/native-resources.lua",
  "_extensions/course-core/native-ts/early-context.lua",
  "_extensions/course-core/native-ts/late-filter.lua",
  "_extensions/course-core/native-ts/late-kind.lua",
  "_extensions/course-core/native-ts/request.lua",
  "_extensions/course-core/runtime-filter.lua",
  "_extensions/course-navigation/filter.lua",
  "_extensions/course-navigation/shortcodes.lua",
  "_extensions/course-presentation/filter.lua",
  "_extensions/course-presentation/modules/answers.lua",
  "_extensions/course-presentation/modules/config.lua",
  "_extensions/course-presentation/modules/metadata.lua",
  "_extensions/course-presentation/modules/vocabulary.lua",
  "tests/native-resource-ast.lua",
  "tests/performance-context.lua",
  // Делегированные канонические копии тоже проверяются как реальные imports.
  "_extensions/course-core/observability/bridge.lua",
  "_extensions/course-navigation/observability/bridge.lua",
  "_extensions/course-presentation/observability/bridge.lua",
];
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
    "run", "--no-config", "--no-lock", "-A", engine,
    "--root", root,
    ...scopes.flatMap((scope) => ["--scope", scope]),
    "--library", join(root, "typecheck"),
    ...runtimePaths.flatMap((path) => ["--runtime-path", path]),
    ...forwarded,
  ],
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
}).output();
Deno.exitCode = result.code;
