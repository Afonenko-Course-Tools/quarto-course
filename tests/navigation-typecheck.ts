// Typecheck the installed native graph through Quarto's public stdlib mapping.
import { dirname, fromFileUrl, join } from "stdlib/path";
const root = dirname(dirname(fromFileUrl(import.meta.url))),
  map = await Deno.makeTempFile({ suffix: ".json" });
try {
  await Deno.writeTextFile(
    map,
    JSON.stringify({
      imports: {
        "stdlib/path": import.meta.resolve("stdlib/path").replace(
          /^https:\/\/jsr\.io\/@std\/path\/([^/]+)\/mod\.ts$/,
          "jsr:@std/path@$1",
        ),
        "stdlib/fs": import.meta.resolve("stdlib/fs").replace(
          /^https:\/\/jsr\.io\/@std\/fs\/([^/]+)\/mod\.ts$/,
          "jsr:@std/fs@$1",
        ),
      },
    }),
  );
  const sources = [
    "domain/release.ts",
    "infrastructure/native-run.ts",
    "infrastructure/resources.ts",
    "infrastructure/validate.ts",
    "body-export/producer.ts",
    "body-export/collect.ts",
    "entrypoints/export.ts",
    "entrypoints/check.ts",
    "entrypoints/pre.ts",
    "entrypoints/post.ts",
  ].map((p) => join(root, "_extensions/course-core", p));
  const r = await new Deno.Command(Deno.execPath(), {
    args: ["check", "--no-config", "--import-map", map, ...sources],
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!r.success) Deno.exit(r.code);
} finally {
  await Deno.remove(map);
}
