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
