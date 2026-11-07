// Полный собственный TS-граф через штатный Quarto stdlib и настоящий Performance companion.
import { dirname, fromFileUrl, join, resolve, toFileUrl } from "stdlib/path";
const root = dirname(dirname(fromFileUrl(import.meta.url)));
const tracked = await new Deno.Command("git", {
  args: ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  cwd: root,
  stdout: "piped",
  stderr: "piped",
}).output();
if (!tracked.success) throw Error(new TextDecoder().decode(tracked.stderr));
const own = new TextDecoder().decode(tracked.stdout).split("\0").filter((file) =>
  /\.(?:ts|js|cjs|mjs|py|lua|sh|fish)$/.test(file) && !file.split("/").includes("vendor")
).sort();
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item: unknown) => typeof item === "string");
const coverage: unknown = JSON.parse(await Deno.readTextFile(join(root, "typecheck/coverage.json")));
if (!record(coverage) || !strings(coverage.files)) throw Error("Неверный перечень собственного кода");
if (!strings(coverage.javascriptDeclarations)) throw Error("Неверный перечень JS/DOM declarations");
const javascriptDeclarations = coverage.javascriptDeclarations;
if (JSON.stringify(coverage.files) !== JSON.stringify(own)) {
  throw Error("Собственный код изменился: обновите конечный перечень typecheck/coverage.json");
}
const imports: Record<string, string> = {};
for (const key of ["stdlib/path", "stdlib/fs"]) {
  imports[key] = import.meta.resolve(key).replace(
    /^https:\/\/jsr\.io\/@std\/(path|fs)\/([^/]+)\/mod\.ts$/,
    "jsr:@std/$1@$2",
  );
}
const companion = await Deno.realPath(Deno.env.get("COURSE_PERFORMANCE_SOURCE") ??
  resolve(root, "..", "quarto-course-performance"));
imports["course-performance/"] = toFileUrl(companion + "/").href;
const config: unknown = JSON.parse(await Deno.readTextFile(join(root, "typecheck/deno.json")));
if (!record(config)) throw Error("Неверная конфигурация типов");
const publicContract = Deno.args.includes("--public-contract");
const temporary = await Deno.makeTempFile({ suffix: ".json" });
try {
  await Deno.writeTextFile(temporary, JSON.stringify({
    ...(publicContract ? { compilerOptions: { strict: true }, lock: false } : config),
    imports,
  }));
  const sources = publicContract ? ["tests/public-contract-types.ts"] :
    coverage.files.filter((file) => file.endsWith(".ts") &&
      !javascriptDeclarations.includes(file));
  const result = await new Deno.Command(Deno.execPath(), {
    args: ["check", "--no-lock", "--config", temporary, ...sources.map((file) => join(root, file))],
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!result.success) Deno.exitCode = result.code;
  else {
    if (!publicContract) {
      const ownScripts = coverage.files.filter((file) => /\.(?:ts|js|cjs|mjs)$/.test(file));
      const lint = await new Deno.Command(Deno.execPath(), {
        args: ["lint", "--no-config", "--rules-tags=", "--rules-include=no-explicit-any", ...ownScripts.map((file) => join(root, file))],
        cwd: root,
        stdout: "inherit",
        stderr: "inherit",
      }).output();
      if (!lint.success) {
        Deno.exitCode = lint.code;
        throw new Error("Собственный код содержит явные any");
      }
    }
    console.log(JSON.stringify({ checked: sources.length, strict: true, companion }));
  }
} finally {
  await Deno.remove(temporary);
}
