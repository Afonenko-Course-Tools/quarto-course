// Check the production navigation graph with Quarto's public stdlib resolution.
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";

const root = dirname(dirname(fromFileUrl(import.meta.url)));
// Deno checks JSR packages through their published jsr: type graph, while
// Quarto may resolve the same pinned public module to its HTTPS source URL.
const pathModule = import.meta.resolve("stdlib/path").replace(
  /^https:\/\/jsr\.io\/@std\/path\/([^/]+)\/mod\.ts$/,
  "jsr:@std/path@$1",
);
const directory = await Deno.makeTempDir({ prefix: "navigation-typecheck-" });
let code = 1;
try {
  const vendor = join(root, "_extensions/course-core/owner-preflight/vendor");
  const map = join(directory, "import-map.json");
  await Deno.writeTextFile(
    map,
    JSON.stringify({
      imports: {
        "stdlib/path": pathModule,
        ...(Deno.args.includes("--main-ci")
          ? {
            "stdlib/fs": import.meta.resolve("stdlib/fs").replace(
              /^https:\/\/jsr\.io\/@std\/fs\/([^/]+)\/mod\.ts$/,
              "jsr:@std/fs@$1",
            ),
          }
          : {}),
        "entities/decode": toFileUrl(
          join(vendor, "entities/dist/esm/decode.js"),
        ).href,
        "entities/escape": toFileUrl(
          join(vendor, "entities/dist/esm/escape.js"),
        ).href,
      },
    }),
  );
  const result = await new Deno.Command(Deno.execPath(), {
    cwd: root,
    args: [
      "check",
      "--import-map",
      map,
      ...(Deno.args.includes("--root-addresses")
        ? [join(root, "tests/navigation-root-addresses.ts")]
        : []),
      ...(Deno.args.includes("--main-ci")
        ? [
          "visibility",
          "example",
          "pedagogy",
          "core-activation",
          "presentation",
          "owner-source-filters",
          "capture-marker",
          "adapter-service-files",
          "adapter-owner",
          "display-examples",
          "canonical-core",
          "canonical-review-regressions",
        ].map((name) => join(root, "tests", name + ".ts"))
        : []),
      join(root, "tests/owner-protocol.ts"),
      join(root, "tests/owner-protocol-current.ts"),
      join(root, "tests/owner-structure.ts"),
      join(root, "_extensions/course-core/owner-preflight/navigation.ts"),
      join(
        root,
        "_extensions/course-core/owner-preflight/publication-resources.ts",
      ),
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  await Deno.stdout.write(result.stdout);
  await Deno.stderr.write(result.stderr);
  code = result.code;
} finally {
  await Deno.remove(directory, { recursive: true });
}
Deno.exit(code);
