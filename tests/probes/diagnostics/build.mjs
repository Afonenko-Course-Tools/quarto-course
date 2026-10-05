// Build-time only; the checked-in bundles run in Deno with no npm cache/network.
import { build } from "esbuild";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
process.chdir(dirname(new URL(import.meta.url).pathname));
await mkdir("vendor/licenses", {recursive: true});
await copyFile("node_modules/@dagrejs/graphlib/dist/graphlib.esm.js", "vendor/graphlib.mjs");
const bundle = await build({
  entryPoints: ["node_modules/markdownlint/lib/exports-sync.mjs"],
  bundle: true, format: "esm", platform: "neutral", mainFields: ["module", "main"],
  conditions: ["markdownlint-imports-browser"],
  external: ["node:module", "node:path", "node:fs"],
  outfile: "vendor/markdownlint.mjs", metafile: true,
});
const packageDirs = new Set(["node_modules/@dagrejs/graphlib"]);
for (const input of Object.keys(bundle.metafile.inputs)) {
  if (!input.startsWith("node_modules/")) continue;
  const components = input.split("/");
  packageDirs.add(components.slice(0, components[1].startsWith("@") ? 3 : 2).join("/"));
}
const packages = [];
for (const directory of [...packageDirs].sort()) {
  const pkg = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  const licenses = (await readdir(directory)).filter(f => /^licen[cs]e|^copying/i.test(f));
  if (!licenses.length) throw new Error(`Missing license for ${pkg.name}`);
  const files = [];
  for (const license of licenses) {
    const destination = `vendor/licenses/${pkg.name.replaceAll("/", "_")}-${license}`;
    await copyFile(join(directory, license), destination);
    files.push(destination);
  }
  packages.push({name: pkg.name, version: pkg.version, license: pkg.license, files});
}
const artifacts = {};
for (const file of ["vendor/graphlib.mjs", "vendor/markdownlint.mjs"]) {
  artifacts[file] = createHash("sha256").update(await readFile(file)).digest("hex");
}
await writeFile("vendor/manifest.json", JSON.stringify({buildTool: "esbuild@0.25.12", packages, sha256: artifacts}, null, 2) + "\n");
