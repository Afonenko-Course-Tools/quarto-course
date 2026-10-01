// Standalone capability probe, not the production coordinator or contract.
import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join, relative } from "stdlib/path";
const source = join(dirname(fromFileUrl(import.meta.url)), "inventory");
const root = await Deno.makeTempDir({ prefix: "inventory-proof-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
const cue = Deno.env.get("CUE") || "cue";
const commands: unknown[] = [];
const results: Record<string, unknown> = {};
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function exists(path: string) {
  try {
    await Deno.stat(join(root, path));
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}
async function run(
  args: string[],
  env: Record<string, string> = {},
  command = quarto,
) {
  const output = await new Deno.Command(command, {
    args,
    cwd: root,
    env,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const stdout = new TextDecoder().decode(output.stdout),
    stderr = new TextDecoder().decode(output.stderr);
  commands.push({ command, args, env, code: output.code, stdout, stderr });
  return { success: output.success, stdout, stderr };
}
async function inspect(profile: string) {
  const r = await run(["inspect", ".", "--profile", profile]);
  assert(r.success, r.stderr);
  return JSON.parse(r.stdout);
}
async function render(
  file: string,
  extra: string[] = [],
  env: Record<string, string> = { INVENTORY_ACTIVE: "1" },
) {
  return await run([
    "render",
    file,
    "--no-execute",
    "--profile",
    file === "index.qmd" ? "student" : "full",
    ...extra,
  ], { ...env, INVENTORY_SOURCE: file });
}
type Occurrence = {
  id: string;
  kind: string;
  text: string;
  classes: string[];
  attributes: Record<string, string>;
  ancestors: { classes: string[]; attributes: Record<string, string> }[];
};
async function inventory(
  file: string,
): Promise<{ source: string; occurrences: Occurrence[] }> {
  return JSON.parse(
    await Deno.readTextFile(join(root, `${file}.inventory.json`)),
  );
}
async function snapshot() {
  const files: Record<string, string> = {};
  async function walk(dir: string) {
    for await (const entry of Deno.readDir(dir)) {
      if (
        [".quarto", "_private"].includes(entry.name) ||
        entry.name.endsWith("_files")
      ) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory) await walk(path);
      else if (
        entry.isFile && /\.(qmd|yml|yaml|lua|ts|cue)$/.test(entry.name)
      ) {
        files[relative(root, path)] = Array.from(
          new Uint8Array(
            await crypto.subtle.digest("SHA-256", await Deno.readFile(path)),
          ),
          (n) => n.toString(16).padStart(2, "0"),
        ).join("");
      }
    }
  }
  await walk(root);
  return JSON.stringify({
    files: Object.fromEntries(Object.entries(files).sort()),
    student: await inspect("student"),
    full: await inspect("full"),
  });
}
await copy(source, root, { overwrite: true });
console.log(`Evidence directory: ${root}`);
try {
  results.quarto = (await run(["--version"])).stdout.trim();
  results.pandoc = (await run(["pandoc", "--version"])).stdout.split("\n")[0];
  results.deno = Deno.version;
  results.cue = (await run(["version"], {}, cue)).stdout;
  // No-execute is deliberately unguarded first: these are positive side-effect controls.
  let r = await render("index.qmd", [], {});
  assert(r.success, r.stderr);
  for (const side of ["hook", "post", "shortcode"]) {
    assert(
      await exists(`${side}-side-effect`),
      `${side} did not run during --no-execute`,
    );
  }
  results.noExecuteSideEffects = ["pre-render", "post-render", "shortcode"];
  const normal = await inventory("index.qmd");
  const ids = normal.occurrences.map((x) => x.id);
  assert(
    ids.filter((id) => id === "exr-duplicate").length === 2,
    "hidden duplicate discarded",
  );
  for (const id of ["exr-included", "exr-private", "sec-included"]) {
    assert(ids.includes(id), `lost ${id}`);
  }
  assert(!ids.includes("exr-literal"), "code block mistaken for declaration");
  assert(
    normal.occurrences.some((x) => x.attributes["when-profile"] === "full"),
    "native visibility condition lost",
  );
  assert(
    normal.occurrences.filter((x) => x.id === "exr-duplicate").some((x) =>
      x.ancestors.some((a) => a.attributes["when-profile"] === "full")
    ),
    "hidden occurrence lost ancestor visibility",
  );
  results.hiddenInventory = normal;
  for (const side of ["hook", "post", "shortcode"]) {
    await Deno.remove(join(root, `${side}-side-effect`));
  }
  const before = await snapshot();
  r = await render("index.qmd");
  assert(r.success, r.stderr);
  assert(
    before === await snapshot(),
    "guarded collector mutated source/configuration",
  );
  for (const side of ["hook", "post", "shortcode"]) {
    assert(!await exists(`${side}-side-effect`), `guard failed: ${side}`);
  }
  assert(
    (await Deno.readTextFile(join(root, "_private/index.html"))).includes(
      "NATIVE_SHORTCODE_EXPANDED",
    ),
    "native shortcode was disabled",
  );
  results.guards =
    "source/config stable; hooks and shortcode cooperate; output stays in private temp project";
  const student = await inspect("student"), full = await inspect("full");
  assert(
    !student.files.input.some((x: string) => x.endsWith("full-only.qmd")),
    "fixture student render-set wrong",
  );
  assert(
    full.files.input.some((x: string) => x.endsWith("full-only.qmd")),
    "full inventory omits hidden page",
  );
  assert(
    student.fileInformation["index.qmd"].includeMap.some((
      x: { target: string },
    ) => x.target === "_included.qmd"),
    "native include provenance missing",
  );
  r = await render("full-only.qmd");
  assert(r.success, r.stderr);
  assert(
    (await inventory("full-only.qmd")).occurrences.some((x) =>
      x.id === "exr-full-only"
    ),
    "page outside student set not collected",
  );
  results.profiles = {
    student: student.files.input,
    full: full.files.input,
    includeMap: student.fileInformation["index.qmd"].includeMap,
  };
  // Retain the failed CLI route, then use the documented Quarto format option.
  r = await render("index.qmd", ["--from", "markdown-auto_identifiers"]);
  results.directFrom = { success: r.success, diagnostic: r.stderr };
  r = await render("index.qmd", ["-M", "from:markdown-auto_identifiers"]);
  assert(r.success, r.stderr);
  const explicit = await inventory("index.qmd");
  const headers = explicit.occurrences.filter((x) => x.kind === "Header");
  assert(
    headers.find((x) => x.text === "Explicit title")?.id === "sec-explicit",
    "explicit ID lost",
  );
  assert(
    headers.find((x) => x.text === "Included topic")?.id === "sec-included",
    "included explicit ID lost",
  );
  for (const title of ["Automatic title", "sec-looks-explicit"]) {
    assert(
      headers.find((x) => x.text === title)?.id === "",
      `auto ID mistaken for explicit: ${title}`,
    );
  }
  assert(
    JSON.stringify(explicit.occurrences.map((x) => [x.kind, x.text])) ===
      JSON.stringify(normal.occurrences.map((x) => [x.kind, x.text])),
    "identity pass changed corpus structure",
  );
  results.explicitIds = headers;
  // CUE owns the duplicate predicate. Only a successful validation can authorize computation.
  const validation = await run(
    ["vet", "unique.cue", "index.qmd.inventory.json", "-d", "#Inventory", "-c"],
    {},
    cue,
  );
  assert(
    !validation.success && validation.stderr.includes("_unique"),
    "duplicate did not block CUE validation",
  );
  let ordinaryRenderInvoked = false;
  if (validation.success) {
    ordinaryRenderInvoked = true;
    await run(["render", "python.qmd"]);
  }
  assert(
    !ordinaryRenderInvoked && !await exists("python-executed") &&
      !await exists("r-executed"),
    "preflight allowed engine execution",
  );
  results.preflight = { cueRejected: true, ordinaryRenderInvoked };
  for (const engine of ["python", "r"]) {
    r = await render(`${engine}.qmd`);
    assert(
      !await exists(`${engine}-executed`),
      `${engine} ran under --no-execute`,
    );
    if (r.success) {
      assert(
        (await inventory(`${engine}.qmd`)).occurrences.some((x) =>
          x.id === `exr-${engine}`
        ),
        `${engine} static declaration lost`,
      );
      await Deno.remove(join(root, `${engine}.qmd.inventory.json`));
      const control = await run([
        "render",
        `${engine}.qmd`,
        "--profile",
        "full",
        "--execute",
        "--no-execute-daemon",
      ], { INVENTORY_ACTIVE: "1", INVENTORY_SOURCE: `${engine}.qmd` });
      const fired = await exists(`${engine}-executed`);
      assert(
        !control.success,
        `${engine} sentinel should stop ordinary execution`,
      );
      assert(
        !await exists(`${engine}.qmd.inventory.json`),
        `${engine} pre-ast collector unexpectedly ran before failing execution`,
      );
      results[engine] = {
        noExecuteCaptured: true,
        positiveControlFired: fired,
        positiveControlDiagnostic: control.stderr,
      };
      if (fired) await Deno.remove(join(root, `${engine}-executed`));
    } else results[engine] = { noExecuteCaptured: false, blocked: r.stderr };
  }
  // A hook ignoring the guard changes metadata, render-set and author sources.
  const stable = await snapshot();
  r = await render("index.qmd", [], {
    INVENTORY_ACTIVE: "1",
    INVENTORY_HOOK_MODE: "mutate",
  });
  assert(r.success, r.stderr);
  let mutationRejected = false;
  try {
    assert(stable === await snapshot(), "SOURCE_MUTATED");
  } catch (error) {
    if (error instanceof Error && error.message === "SOURCE_MUTATED") {
      mutationRejected = true;
    } else throw error;
  }
  assert(mutationRejected, "late mutation escaped snapshot check");
  assert(await exists("late.qmd"), "late-file mutation fixture did not run");
  assert(
    (await inspect("full")).files.input.some((x: string) =>
      x.endsWith("late.qmd")
    ),
    "late render-set mutation missing",
  );
  results.lateMutation =
    "rejected by file hashes and re-inspected profile render-set";
  // Explicit preparation before snapshot is accepted; the collection pass is guarded.
  r = await run(["run", "hook.ts"], { INVENTORY_HOOK_MODE: "mutate" });
  assert(r.success, r.stderr);
  const prepared = await snapshot();
  r = await render("late.qmd");
  assert(r.success, r.stderr);
  assert(
    prepared === await snapshot(),
    "prepared sources changed during guarded collection",
  );
  assert(
    (await inventory("late.qmd")).occurrences.some((x) => x.id === "exr-late"),
    "prepared declaration lost",
  );
  results.preparation =
    "metadata/new source/render-set included before snapshot";
  results.gate = ["python", "r"].every((engine) => {
      const result = results[engine] as {
        noExecuteCaptured: boolean;
        positiveControlFired?: boolean;
      };
      return result.noExecuteCaptured && result.positiveControlFired;
    })
    ? "CONFIRMED_WITH_LIMITS"
    : "BLOCKED_ENGINE_EVIDENCE";
  console.log(
    "PASS: tested native hidden/include/profile inventory, explicit IDs, guards, CUE preflight and mutation assertions",
  );
  console.log(`A1 capability verdict: ${results.gate}`);
  console.log(
    JSON.stringify({ python: results.python, r: results.r }, null, 2),
  );
} finally {
  await Deno.writeTextFile(
    join(root, "evidence.json"),
    JSON.stringify({ results, commands }, null, 2),
  );
}

if (
  Deno.args.includes("--require-gate") &&
  results.gate !== "CONFIRMED_WITH_LIMITS"
) throw new Error("A1 gate blocked: see evidence.json engine results");
