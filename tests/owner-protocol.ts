// Run against source or the exact installed extension used by a native smoke.
import { dirname, fromFileUrl, join, resolve, toFileUrl } from "stdlib/path";
import type { Assessment } from "../_extensions/course-core/domain/model.ts";
import type { PreparedOwner } from "../_extensions/course-core/owner-preflight/owner.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
// The generated domain vocabulary must reject values outside its contract.
const assessmentKind: Assessment["kind"] = "exam";
// @ts-expect-error Assessment kinds come from the generated vocabulary.
const invalidAssessmentKind: Assessment["kind"] = "quiz";
const profile: PreparedOwner["profile"] = "student";
// @ts-expect-error Owner profiles come from the generated view vocabulary.
const invalidProfile: PreparedOwner["profile"] = "teacher";
void [assessmentKind, invalidAssessmentKind, profile, invalidProfile];

const root = dirname(dirname(fromFileUrl(import.meta.url)));
const extension = Deno.args[0]
  ? resolve(Deno.args[0])
  : join(root, "_extensions/course-core");
const ownerLeaves = [
  "failure.ts",
  "protocol.ts",
  "runtime.ts",
  "source-audit.ts",
  "session.ts",
];
for (const file of ownerLeaves) {
  let exists = false;
  try {
    exists =
      (await Deno.stat(join(extension, "owner-preflight/owner", file))).isFile;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  assert(exists, "Missing owner leaf module: " + file);
}
const facade = await import(
  toFileUrl(join(extension, "owner-preflight/owner.ts")).href
);
const failure = await import(
  toFileUrl(join(extension, "owner-preflight/owner/failure.ts")).href
);
const runtime = await import(
  toFileUrl(join(extension, "owner-preflight/owner/runtime.ts")).href
);
assert(
  facade.OwnerFailure === failure.OwnerFailure,
  "Facade must preserve the leaf failure constructor identity",
);
for (
  const name of ["invoke", "quarto", "exists", "inspect", "digestFile", "sha"]
) {
  assert(
    facade[name] === runtime[name],
    "Facade compatibility export changed: " + name,
  );
}
const dir = await Deno.makeTempDir({ prefix: "owner-protocol-" });
try {
  const file = join(dir, "abc.txt"), link = join(dir, "link.txt");
  await Deno.writeTextFile(file, "abc");
  assert(
    await runtime.exists(file) && !await runtime.exists(join(dir, "missing")),
    "File existence semantics changed",
  );
  assert(
    await runtime.digestFile(file) ===
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "File digest changed",
  );
  assert(
    await runtime.sha("abc") === "a9993e364706816aba3e25717850c26c9cd0d89d",
    "Capture identity hash changed",
  );
  await Deno.symlink(file, link);
  try {
    await runtime.digestFile(link);
    throw new Error("Symlink accepted");
  } catch (error) {
    assert(
      error instanceof facade.OwnerFailure &&
        (error as { code?: string }).code === "SOURCE.INVALID_ATTEMPT",
      "Runtime refusal lost the public error identity/code",
    );
  }
  try {
    runtime.inside(dir, "../outside");
    throw new Error("Escaping owner path accepted");
  } catch (error) {
    assert(
      error instanceof facade.OwnerFailure &&
        (error as { code?: string }).code === "SOURCE.OUTSIDE_OWNER",
      "Path refusal lost the public error identity/code",
    );
  }
  const result = await runtime.invoke(
    Deno.execPath(),
    [
      "eval",
      'console.log(Deno.env.get("OWNER_PROTOCOL_CHECK"));console.error("stderr");Deno.exit(7);',
    ],
    dir,
    { OWNER_PROTOCOL_CHECK: "stdout" },
  );
  assert(
    result.exitCode === 7 && result.stdout === "stdout\n" &&
      result.stderr === "stderr\n",
    "Native command output/exit contract changed",
  );
  const map = join(dir, "import-map.json");
  await Deno.writeTextFile(
    map,
    JSON.stringify({
      imports: {
        "stdlib/path": import.meta.resolve("stdlib/path").replace(
          /^https:\/\/jsr\.io\/@std\/path\/([^/]+)\/mod\.ts$/,
          "jsr:@std/path@$1",
        ),
        "entities/decode": toFileUrl(
          join(
            extension,
            "owner-preflight/vendor/entities/dist/esm/decode.js",
          ),
        ).href,
        "entities/escape": toFileUrl(
          join(
            extension,
            "owner-preflight/vendor/entities/dist/esm/escape.js",
          ),
        ).href,
      },
    }),
  );
  for (const leaf of ownerLeaves) {
    const info = await runtime.invoke(Deno.execPath(), [
      "info",
      "--json",
      "--no-config",
      "--no-lock",
      "--no-npm",
      "--import-map",
      map,
      join(extension, "owner-preflight/owner", leaf),
    ], dir);
    assert(info.exitCode === 0, leaf + " import graph failed: " + info.stderr);
    const graph = JSON.parse(info.stdout);
    if (leaf === "runtime.ts") {
      assert(
        graph.modules.every((module: { specifier: string }) =>
          !module.specifier.endsWith("/owner-preflight/owner.ts")
        ),
        "Runtime imports the lifecycle facade",
      );
    }
    // Deno info includes type dependencies. Follow runtime edges explicitly;
    // the shared protocol still references service types in its type graph.
    const modules = new Map(
      graph.modules.map((module: any) => [module.specifier, module]),
    );
    const visited = new Set<string>();
    function visit(specifier: string) {
      if (visited.has(specifier)) return;
      visited.add(specifier);
      const module: any = modules.get(specifier);
      for (const dependency of module?.dependencies || []) {
        if (dependency.code) visit(dependency.code.specifier);
      }
    }
    for (const root of graph.roots) visit(root);
    for (const root of graph.roots) {
      const module: any = modules.get(root);
      assert(
        (module?.dependencies || []).every((dependency: any) =>
          !dependency.type?.specifier.endsWith("/owner-preflight/owner.ts")
        ),
        leaf + " imports facade types directly",
      );
    }
    assert(
      [...visited].every((specifier) =>
        !specifier.endsWith("/owner-preflight/owner.ts")
      ),
      leaf + " imports the lifecycle facade at runtime",
    );
  }
  if (Deno.args[0]) {
    async function completeMap(base: string) {
      const files: Record<
        string,
        { sha256: string; bytes: number; mode: number | null }
      > = {};
      async function walk(directory: string) {
        for await (const entry of Deno.readDir(directory)) {
          const path = join(directory, entry.name);
          assert(!entry.isSymlink, "Package contains a symlink: " + path);
          if (entry.isDirectory) await walk(path);
          else {
            assert(entry.isFile, "Package contains a nonregular file: " + path);
            const stat = await Deno.stat(path);
            files[path.slice(base.length + 1)] = {
              sha256: await runtime.digestFile(path),
              bytes: stat.size,
              mode: stat.mode === null ? null : stat.mode & 0o777,
            };
          }
        }
      }
      await walk(base);
      return Object.fromEntries(
        Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    const source = await completeMap(join(root, "_extensions"));
    const installed = await completeMap(dirname(extension));
    assert(
      JSON.stringify(source) === JSON.stringify(installed),
      "Whole installed package differs from source files, bytes or modes",
    );
    if (Deno.args[1]) {
      await Deno.writeTextFile(
        Deno.args[1],
        JSON.stringify({ source, installed }, null, 2),
      );
    }
    const check = await runtime.invoke(Deno.execPath(), [
      "check",
      "--no-config",
      "--no-lock",
      "--no-npm",
      "--import-map",
      map,
      join(extension, "owner-preflight/owner.ts"),
    ], dir);
    assert(
      check.exitCode === 0,
      "Installed owner graph failed: " + check.stderr,
    );
    console.log(
      "PASS complete installed package bytes/modes/files and installed owner type graph",
    );
  }
  console.log(
    "PASS source/installed leaf graph, public constructor identity, runtime refusals and compatibility exports",
  );
} finally {
  await Deno.remove(dir, { recursive: true });
}
