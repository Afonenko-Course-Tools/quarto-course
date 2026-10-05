// Reproduces real native directory, negative external-path and runtime determinant drift.
// Real native inspect counts and current source bytes, with no fabricated completed proofs.
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const evidence = Deno.env.get("OWNER_VALIDATION_TEST_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "owner-validation-scope-" });
await Deno.mkdir(evidence, { recursive: true });
const native = Deno.env.get("QUARTO") || "quarto";
const selected = Deno.args[0];
if (
  selected === "stock-mode" && Deno.env.get("OWNER_STOCK_MODE_CHILD") !== "1"
) {
  const stock = join(evidence, "stock");
  await copy(dirname(dirname(native)), stock, true);
  const bin = join(stock, "bin");
  const result = await new Deno.Command(join(bin, "quarto"), {
    args: ["run", import.meta.filename!, "stock-mode"],
    env: {
      OWNER_STOCK_MODE_CHILD: "1",
      QUARTO: join(bin, "quarto"),
      QUARTO_BIN_PATH: bin,
      QUARTO_SHARE_PATH: join(stock, "share"),
      QUARTO_DENO: join(bin, "tools/x86_64/deno"),
      QUARTO_PANDOC: join(bin, "tools/x86_64/pandoc"),
      QUARTO_DENO_DOM: join(bin, "tools/x86_64/deno_dom/libplugin.so"),
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  await Deno.stdout.write(result.stdout);
  await Deno.stderr.write(result.stderr);
  Deno.exit(result.code);
}
const calls = join(evidence, "native-calls.txt");
const wrapper = join(evidence, "quarto-counted");
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
await Deno.writeTextFile(
  wrapper,
  `#!/bin/sh\nprintf '%s\\n' "$*" >> ${quote(calls)}\nexec ${
    quote(native)
  } "$@"\n`,
);
await Deno.chmod(wrapper, 0o755);
Deno.env.set(
  "QUARTO",
  ["runtime", "runtime-mode"].includes(Deno.args[0]) ? wrapper : native,
);
const api = await import(
  toFileUrl(join(repo, "_extensions/course-core/owner-preflight/owner.ts")).href
);
// Missing API still executes real repeated validation to expose the RED count.
const scope = api.withOwnerValidationScope ||
  ((operation: () => Promise<unknown>) => operation());

async function copy(source: string, target: string, stock = false) {
  await Deno.mkdir(target, { recursive: true });
  for await (const entry of Deno.readDir(source)) {
    const from = join(source, entry.name), to = join(target, entry.name);
    if (entry.isDirectory) await copy(from, to, stock);
    else if (entry.isFile) await Deno.copyFile(from, to);
    else if (stock && entry.isSymlink) {
      await Deno.symlink(await Deno.readLink(from), to);
    } else throw new Error("nonregular package fixture: " + from);
  }
}
let sequence = 0;
async function fixture(profile = "student") {
  const root = join(evidence, "owner-" + sequence++);
  await Deno.mkdir(root);
  await copy(
    join(repo, "_extensions"),
    join(root, "_extensions"),
  );
  const dependency = join(evidence, "external-" + sequence + ".css");
  await Deno.writeTextFile(dependency, "body { color: black; }\n");
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  resources: [assets/**]\n  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts\nformat:\n  html:\n    theme: none\n    css: ${
      JSON.stringify(
        Deno.args[0] === "local-css" ? [dependency, "local.css"] : dependency,
      )
    }\nfilters: [course-core]\ncourse:\n  id: scoped-audit\nreview-absent: ${
      JSON.stringify(join(evidence, "appeared-later.css"))
    }\n`,
  );
  for (const view of ["student", "full"]) {
    await Deno.writeTextFile(
      join(root, `_quarto-${view}.yml`),
      `course:\n  view: ${view}\n`,
    );
  }
  await Deno.writeTextFile(join(root, "index.qmd"), "# Current source\n");
  if (Deno.args[0] === "local-css") {
    await Deno.writeTextFile(
      join(root, "local.css"),
      "body { background: url(../external-child.css); }\n",
    );
  }
  const audit = await api.auditOwner(root, "_extensions/course-core");
  assert(audit.dependencies[dependency], "external native dependency omitted");
  const session = {
    protocol: 1,
    root,
    attemptId: "attempt-" + sequence,
    profile,
    sessionId: "session-" + sequence,
    extension: "_extensions/course-core",
    quarto: Deno.env.get("QUARTO")!,
    audit,
    files: await api.fingerprint(audit),
    validated: false,
    captures: {},
    captureHashes: {},
    captureProjections: {},
    captureProjectionHash: "",
    identities: {},
    identityHashes: {},
    identityReaders: {},
    identityReplays: {},
    readerInputs: {},
    readerInputHashes: {},
    headers: [],
  };
  await Deno.mkdir(join(root, ".course-owner"));
  const path = join(root, ".course-owner/preparation.json");
  await Deno.writeTextFile(path, JSON.stringify(session));
  return { root, path, session, dependency };
}
async function inspectCount() {
  return (await Deno.readTextFile(calls)).split("\n")
    .filter((line) => line.startsWith("inspect ")).length;
}
async function refuses(operation: () => Promise<unknown>, code?: string) {
  try {
    await operation();
  } catch (error) {
    assert(
      (selected === "runtime-mode" &&
        error instanceof Deno.errors.PermissionDenied) ||
        (error instanceof api.OwnerFailure &&
          (!code || (error as { code: string }).code === code)),
      "unexpected refusal: " + error,
    );
    return;
  }
  throw new Error("accepted mutation" + (code ? ": " + code : ""));
}

if (!selected) {
  for (
    const name of [
      "directory",
      "external",
      "runtime",
      "runtime-mode",
      "native-cache",
      "cache-version",
      "local-css",
      "stock-mode",
    ]
  ) {
    const r = await new Deno.Command(native, {
      args: ["run", import.meta.filename!, name],
      env: {
        OWNER_VALIDATION_TEST_OUTPUT: join(evidence, name),
        QUARTO: native,
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    await Deno.stdout.write(r.stdout);
    await Deno.stderr.write(r.stderr);
    assert(r.code === 0, "determinant case failed: " + name);
  }
  Deno.exit(0);
}
assert(
  [
    "directory",
    "external",
    "runtime",
    "runtime-mode",
    "native-cache",
    "cache-version",
    "local-css",
    "stock-mode",
  ].includes(selected),
  "unknown determinant case",
);
const f = await fixture();
const target = selected === "stock-mode"
  ? join(dirname(native), "tools/x86_64/deno")
  : ["native-cache", "cache-version"].includes(selected)
  ? join(f.root, ".quarto/project-cache/deno-kv-file")
  : selected === "directory"
  ? join(f.root, "assets")
  : selected === "local-css"
  ? join(evidence, "external-child.css")
  : selected === "external"
  ? join(evidence, "appeared-later.css")
  : wrapper;
const original =
  selected === "runtime" || ["native-cache", "cache-version"].includes(selected)
    ? await Deno.readFile(target)
    : undefined;
const code = ["runtime-mode", "stock-mode"].includes(selected)
  ? undefined
  : selected === "runtime" || selected === "local-css" ||
      ["native-cache", "cache-version"].includes(selected)
  ? "SOURCE.INSPECT_FAILED"
  : "SOURCE.CONFIGURATION_CHANGED";
async function mutate() {
  if (["runtime-mode", "stock-mode"].includes(selected)) {
    await Deno.chmod(target, 0o644);
  } else if (selected === "cache-version") {
    const kv = await (Deno as any).openKv(target);
    try {
      await kv.set(["version"], 7);
    } finally {
      kv.close();
    }
  } else if (selected === "native-cache") {
    await Deno.remove(target);
    await Deno.mkdir(target);
  } else if (selected === "directory") await Deno.mkdir(target);
  else {await Deno.writeTextFile(
      target,
      selected === "local-css"
        ? "body { background: url(external-child.css); }\n"
        : selected === "external"
        ? "body { color: red; }\n"
        : "#!/bin/sh\nprintf RUNTIME_REPLACED\nexit 77\n",
    );}
}
async function restore() {
  if (["runtime-mode", "stock-mode"].includes(selected)) {
    await Deno.chmod(target, 0o755);
  } else if (["native-cache", "cache-version"].includes(selected)) {
    await Deno.remove(target, { recursive: true });
    await Deno.writeFile(target, original!);
  } else if (original) await Deno.writeFile(target, original);
  else await Deno.remove(target);
}
for (const boundary of ["reuse", "closure"]) {
  try {
    await refuses(() =>
      scope(async () => {
        await api.assertFrozen(f.path);
        await mutate();
        if (boundary === "reuse") await api.assertFrozen(f.path);
        return "changed determinant must not escape";
      }), code);
    await refuses(() => api.assertFrozen(f.path), code);
    console.log("PASS " + selected + " " + boundary + " and fresh refusal");
  } finally {
    await restore();
  }
  await api.assertFrozen(f.path);
}
