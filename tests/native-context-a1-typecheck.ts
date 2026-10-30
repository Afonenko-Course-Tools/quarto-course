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
    "public.ts",
    "native-ts/early-filter.ts",
  ].map((p) => join(root, "_extensions/course-core", p));
  sources.push(join(root, "tests/artifact-a2-types.ts"));
  sources.push(join(root, "tests/artifact-target-guards-a2.ts"));
  sources.push(join(root, "tests/condition-materialization-a2.ts"));
  sources.push(join(root, "tests/project-closure-a2.ts"));
  sources.push(join(root, "tests/artifact-inventory-policy-a3-fix.ts"));
  sources.push(join(root, "tests/native-operation-a3.ts"));
  sources.push(join(root, "tests/tool-cache-a3.ts"));
  sources.push(join(root, "tests/tool-cache-paths-a3.ts"));
  for (
    const name of [
      "native-format-scope-a4c",
      "native-metadata-a4c",
      "native-capture-scope-a4c",
      "native-capture-fences-a4c",
      "native-capture-transitions-a4c",
      "native-metadata-producer-a4c",
      "native-sp-index-a4c",
      "java-build-library-a4c",
      "answers-a4b",
      "metadata-a4b",
      "answers-native-a4b",
      "native-formats-a4b",
      "materialization-a4a",
      "native-full-a4a",
      "release-a4a",
      "release-semantics-a4a",
      "release-collection-a4a",
      "release-project-source-a4a",
      "pending-a4a",
      "generated-condition-a4a",
      "generated-policy-a4a",
      "early-layout-a4a",
    ]
  ) sources.push(join(root, `tests/${name}.ts`));
  const r = await new Deno.Command(Deno.execPath(), {
    args: [
      "check",
      "--no-lock",
      "--no-config",
      "--import-map",
      map,
      ...sources,
    ],
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!r.success) Deno.exit(r.code);
} finally {
  await Deno.remove(map);
}
