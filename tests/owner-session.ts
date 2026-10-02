import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const evidence = Deno.env.get("OWNER_SESSION_TEST_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "owner-session-test-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(v: unknown, m: string): asserts v {
  if (!v) throw new Error(m);
}
async function command(
  root: string,
  args: string[],
  env: Record<string, string> = {},
) {
  const r = await new Deno.Command(quarto, {
    cwd: root,
    args,
    env,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    code: r.code,
    text: new TextDecoder().decode(r.stdout) +
      new TextDecoder().decode(r.stderr),
  };
}
async function exists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}
if (Deno.args.includes("--locator-only")) {
  const root = join(evidence, "locator");
  await Deno.mkdir(root, { recursive: true });
  let r = await command(root, ["add", repo, "--no-prompt"]);
  assert(!r.code, r.text);
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: default\n  output-dir: _site\n  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts\nformat: html\nfilters: [course-core]\n",
  );
  await Deno.writeTextFile(join(root, "index.qmd"), "# Ordinary document\n");
  const api = await import(
    new URL(`file://${root}/_extensions/course-core/owner-preflight/owner.ts`)
      .href
  );
  assert(
    await api.activeOwner(root) === undefined,
    "true absence did not remain ordinary",
  );
  r = await command(root, ["render"]);
  assert(!r.code, r.text);
  await Deno.mkdir(join(root, ".course-owner"));
  await Deno.symlink(
    join(root, "missing-active-target"),
    join(root, ".course-owner/active.json"),
  );
  await rejects(() => api.activeOwner(root), "SOURCE.INVALID_ATTEMPT");
  await rejects(() => api.freezeOwner(root), "SOURCE.INVALID_ATTEMPT");
  r = await command(root, ["render"]);
  assert(
    r.code !== 0 && r.text.includes("SOURCE.INVALID_ATTEMPT"),
    "native freeze accepted dangling locator: " + r.text,
  );
  // The filter itself must reject the present unreadable locator without metadata or hooks.
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: default\n  output-dir: _site\nformat: html\nfilters: [course-core]\n",
  );
  r = await command(root, ["render"]);
  assert(
    r.code !== 0 && r.text.includes("SOURCE.INVALID_ATTEMPT"),
    "native Core accepted dangling locator: " + r.text,
  );
  console.log(
    "PASS true absence ordinary; dangling locator rejected by API, native freeze and native Core",
  );
  Deno.exit(0);
}
let sequence = 0;
async function fixture(profile = "student", chain = true) {
  const root = join(evidence, `owner-${sequence++}`);
  await Deno.mkdir(root, { recursive: true });
  let r = await command(root, ["add", repo, "--no-prompt"]);
  assert(!r.code, r.text);
  const download = Deno.env.get("PROJECT_DOWNLOAD_REPO");
  if (chain) {
    assert(
      download,
      "Set PROJECT_DOWNLOAD_REPO to the project-download checkout with public ownership.ts before running owner-session tests",
    );
    r = await command(root, ["add", download, "--no-prompt"]);
    assert(!r.code, r.text);
  }
  const write = (p: string, t: string) => Deno.writeTextFile(join(root, p), t);
  await write(
    "_quarto.yml",
    `project:\n  type: default\n  output-dir: _site\n  render: [index.qmd]\n  pre-render:\n    - _extensions/course-core/entrypoints/pre.ts\n${
      chain ? "    - _extensions/project-download/entrypoints/pre.ts\n" : ""
    }    - hook.ts\n    - _extensions/course-core/entrypoints/owner-freeze.ts\n  post-render:\n    - _extensions/course-core/entrypoints/post.ts\n${
      chain
        ? "    - _extensions/project-download/entrypoints/post.ts\n    - download-audit.ts\n"
        : ""
    }format:\n  html:\n    theme: none\nexecute:\n  freeze: false\n  cache: false\ncourse:\n  id: session-proof\n  validate: true\nfilters: [course-core, course-presentation${
      chain ? ", project-download" : ""
    }]\n${
      chain
        ? "project-download:\n  resources:\n    closed:\n      path: closed\n      profiles: [full]\n"
        : ""
    }`,
  );
  await write("_quarto-student.yml", "course:\n  view: student\n");
  await write("_quarto-full.yml", "course:\n  view: full\n");
  await Deno.mkdir(join(root, "closed"));
  await write("closed/payload.txt", "CLOSED_DOWNLOAD_PAYLOAD\n");
  await write(
    "hook.ts",
    `const a=JSON.parse(await Deno.readTextFile('.course-owner/active.json'));\nif(a.phase==='render' && Deno.env.get('SESSION_MUTATE')==='1') await Deno.writeTextFile('closed/payload.txt','changed');\nif(a.phase==='render' && Deno.env.get('SESSION_DROP_GUARD')==='1') await Deno.remove('.course-owner/active.json');\n`,
  );
  await write(
    "index.qmd",
    `---\nengine: knitr\n---\n# Owner\n\n::: {#exr-static}\nStatic task.\n\n\`\`\`{r}\nwrite('executed',file='.course-owner/engine-count',append=TRUE)\n42\n\`\`\`\n:::\n${
      chain ? "\n::: {.when-full}\n{{< project-download closed >}}\n:::\n" : ""
    }`,
  );
  if (chain) {
    await write(
      "download-audit.ts",
      `import {inspectOwnedRequests} from './_extensions/project-download/ownership.ts';
const a=JSON.parse(await Deno.readTextFile('.course-owner/active.json'));
if(a.phase==='capture') {
  const owned=await inspectOwnedRequests(a.root,['index.qmd']);if(owned.files.some(file=>file.resources.length))throw new Error('capture leaked Download request');
  try {await Deno.stat('_site/_downloads/closed.zip');throw new Error('capture materialized hidden Download archive');}catch(e){if(!(e instanceof Deno.errors.NotFound))throw e;}
}
`,
    );
  }
  // Native event markers modify only this fresh installed test consumer.
  for (
    const name of [
      "course-core",
      "course-presentation",
      ...(chain ? ["project-download"] : []),
    ]
  ) {
    const file = join(root, "_extensions", name, "filter.lua");
    const text = await Deno.readTextFile(file);
    await Deno.writeTextFile(
      file,
      text.replace(
        /(Pandoc\s*=\s*function\(doc\))/,
        `$1\n  local a=assert(io.open('.course-owner/active.json','r'));local current=pandoc.json.decode(a:read('*a'));a:close()\n  assert(io.open('.course-owner/guard-'..current.invocationId..'.json','r'),'freeze must precede filters')\n  local event=assert(io.open('.course-owner/events','a'));event:write(current.phase..(current.identity and '-identity' or '')..':'..current.profile..':${name}\\n');event:close()`,
      ),
    );
  }
  const api = await import(
    new URL(`file://${root}/_extensions/course-core/owner-preflight/owner.ts`)
      .href
  );
  assert(
    typeof api.prepareOwner === "function",
    "missing embeddable prepareOwner native API",
  );
  if (Deno.args.includes("--ownership-only")) {
    const helper = join(root, "_extensions/project-download/ownership.ts");
    const saved = await Deno.readTextFile(helper);
    await Deno.remove(helper);
    await rejects(
      () => api.auditOwner(root),
      "SOURCE.DOWNLOAD_OWNERSHIP_UNSUPPORTED",
    );
    await Deno.writeTextFile(helper, saved);
    assert(
      typeof api.inspectOwnerDownloads === "function",
      "missing typed public Download service accessor",
    );
    const audited = await api.auditOwner(root);
    assert(
      audited.download?.helper && audited.download?.directory,
      "missing public Download ownership descriptor",
    );
    console.log(
      "PASS missing provider seam fails closed; provider-owned directory descriptor accepted",
    );
    Deno.exit(0);
  }
  const prepared = await api.prepareOwner(root, {
    attemptId: `attempt-${sequence}`,
    profile,
  });
  assert(
    !await exists(join(root, ".course-owner/engine-count")),
    "prepare executed the R cell",
  );
  assert(
    !await exists(join(root, "_site")),
    "prepare retained private capture output",
  );
  return { root, api, prepared, write };
}
async function render(
  f: any,
  metadata: any,
  env: Record<string, string> = {},
  output?: string,
) {
  const path = join(f.root, ".course-owner/metadata.json");
  await Deno.writeTextFile(path, JSON.stringify(metadata));
  const r = await command(f.root, [
    "render",
    ".",
    "--profile",
    f.prepared.profile,
    "--to",
    "html",
    "--execute",
    "--no-cache",
    "--no-execute-daemon",
    "--metadata-file",
    path,
    ...(output ? ["--output-dir", output] : []),
  ], env);
  await Deno.writeTextFile(
    join(f.root, ".course-owner/test-render.log"),
    r.text,
  );
  return r;
}
async function rejects(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
  } catch (e) {
    assert(String(e).includes(code), `wanted ${code}, got ${e}`);
    return;
  }
  throw new Error(`expected rejection ${code}`);
}
console.log(`Owner session evidence: ${evidence}`);
if (Deno.args.includes("--public-service-only")) {
  const full = await fixture("full");
  const r = await render(full, await full.api.activateOwner(full.prepared));
  assert(!r.code, r.text);
  assert(
    (await full.api.finishOwner(full.prepared)).exitCode === 0,
    "full service finish failed",
  );
  const state = await full.api.inspectOwnerDownloads(full.prepared);
  assert(
    state?.protocol === 1 && state.root === full.root &&
      state.files.some((file: any) =>
        file.source === "index.qmd" && file.resources.includes("closed")
      ),
    "typed public Download service evidence missing",
  );
  console.log(
    "PASS typed public Download service accessor after installed native full render",
  );
  Deno.exit(0);
}
const f = await fixture();
const meta = await f.api.activateOwner(f.prepared);
assert(
  !Deno.env.get("COURSE_OWNER_SESSION"),
  "activation changed global environment",
);
let r = await render(f, meta);
assert(!r.code, r.text);
let result = await f.api.finishOwner(JSON.parse(JSON.stringify(f.prepared)));
assert(result.exitCode === 0, JSON.stringify(result));
assert(
  await Deno.readTextFile(join(f.root, ".course-owner/engine-count")) ===
    "executed\n",
  "ordinary render executed more than once",
);
assert(
  !await exists(join(f.root, "_site/_downloads/closed.zip")),
  "student leaked hidden full Download",
);
assert(
  await Deno.readTextFile(join(f.root, ".course-owner/events")) ===
    "capture:student:course-core\ncapture:student:course-presentation\ncapture:student:project-download\ncapture-identity:student:course-core\ncapture-identity:student:course-presentation\ncapture-identity:student:project-download\ncapture:full:course-core\ncapture:full:course-presentation\ncapture:full:project-download\ncapture-identity:full:course-core\ncapture-identity:full:course-presentation\ncapture-identity:full:project-download\nrender:student:course-core\nrender:student:course-presentation\nrender:student:project-download\n",
  "unexpected native freeze/filter event order",
);
console.log(
  "PASS installed three-filter student; zero capture executions; one ordinary R render; complete finish",
);
await rejects(
  () => f.api.activateOwner(f.prepared),
  "SOURCE.INVOCATION_REUSED",
);
const a = JSON.parse(
  await Deno.readTextFile(join(f.root, ".course-owner/active.json")),
);
const resultFiles = [];
for await (const entry of Deno.readDir(join(f.root, ".course-owner"))) {
  if (entry.name.startsWith("result-")) resultFiles.push(entry.name);
}
const resultPath = join(f.root, ".course-owner", resultFiles[0]);
const savedResult = await Deno.readTextFile(resultPath);
await Deno.writeTextFile(
  resultPath,
  JSON.stringify({
    ...JSON.parse(savedResult),
    invocationId: crypto.randomUUID(),
  }),
);
await rejects(() => f.api.finishOwner(f.prepared), "SOURCE.INVALID_ATTEMPT");
await Deno.writeTextFile(resultPath, savedResult);
// Locate the native raw observation independently of receipt filename (receipt hashes profile+source).
const actualFiles = [];
for await (
  const entry of Deno.readDir(join(f.root, ".course-owner/render/student"))
) actualFiles.push(entry.name);
const actual = join(f.root, ".course-owner/render/student", actualFiles[0]);
const savedActual = await Deno.readTextFile(actual);
await Deno.writeTextFile(actual, "{}");
await rejects(() => f.api.finishOwner(f.prepared), "SOURCE.INVALID_ATTEMPT");
await Deno.writeTextFile(actual, savedActual);
const rawDir = join(f.root, ".course-owner/render/student");
const savedDir = rawDir + "-saved";
await Deno.rename(rawDir, savedDir);
await Deno.symlink(savedDir, rawDir);
await rejects(() => f.api.finishOwner(f.prepared), "SOURCE.INVALID_ATTEMPT");
await Deno.remove(rawDir);
await Deno.rename(savedDir, rawDir);
const savedSession = await Deno.readTextFile(f.prepared.sessionPath);
await Deno.writeTextFile(f.prepared.sessionPath, savedSession + " ");
await rejects(() => f.api.finishOwner(f.prepared), "SOURCE.INVALID_ATTEMPT");
await Deno.writeTextFile(f.prepared.sessionPath, savedSession);
const receipt = join(f.root, ".course-owner", `guard-${a.invocationId}.json`);
await Deno.remove(receipt);
await rejects(
  () => f.api.finishOwner(f.prepared),
  "SOURCE.GUARD_RECEIPT_MISSING",
);
const full = await fixture("full");
r = await render(full, await full.api.activateOwner(full.prepared));
assert(!r.code, r.text);
assert(
  (await full.api.finishOwner(full.prepared)).exitCode === 0,
  "full finish failed",
);
assert(
  await exists(join(full.root, "_site/_downloads/closed.zip")),
  "full Download ZIP missing",
);
assert(
  await Deno.readTextFile(join(full.root, ".course-owner/engine-count")) ===
    "executed\n",
  "full native engine did not execute once",
);
const owned = await full.api.inspectOwnerDownloads(full.prepared);
assert(
  owned?.protocol === 1 && owned.root === full.root &&
    owned.files.some((file: any) =>
      file.source === "index.qmd" && file.resources.includes("closed")
    ),
  "typed public Download service evidence missing",
);
console.log("PASS full native Download projection and archive");
const fullConfig = await Deno.readTextFile(join(full.root, "_quarto.yml"));
await full.write("_quarto.yml", fullConfig + "lang: ru\n");
await rejects(
  () => full.api.finishOwner(full.prepared),
  "SOURCE.CONFIGURATION_CHANGED",
);
await full.write("_quarto.yml", fullConfig);
await Deno.writeTextFile(
  join(
    full.root,
    (await full.api.preparedSession(full.prepared)).audit.download.directory,
    "unknown.json",
  ),
  "{}",
);
await rejects(
  () => full.api.finishOwner(full.prepared),
  "SOURCE.INVALID_ATTEMPT",
);
await Deno.remove(
  join(
    full.root,
    (await full.api.preparedSession(full.prepared)).audit.download.directory,
    "unknown.json",
  ),
);
const activeText = await Deno.readTextFile(
  join(full.root, ".course-owner/active.json"),
);
await Deno.writeTextFile(join(full.root, ".course-owner/active.json"), "{");
await rejects(
  () => full.api.finishOwner(full.prepared),
  "SOURCE.INVALID_ATTEMPT",
);
await Deno.writeTextFile(
  join(full.root, ".course-owner/active.json"),
  activeText,
);
await Deno.remove(join(full.root, ".course-owner/active.json"));
await rejects(
  () => full.api.activateOwner(full.prepared),
  "SOURCE.INVOCATION_REUSED",
);
await Deno.writeTextFile(
  join(full.root, ".course-owner/active.json"),
  activeText,
);

const override = await fixture();
const out = join(evidence, "trusted-output");
r = await render(
  override,
  await override.api.activateOwner(override.prepared, { output: out }),
  {},
  out,
);
assert(!r.code, r.text);
assert(
  (await override.api.finishOwner(override.prepared)).exitCode === 0,
  "override finish failed",
);
assert(await exists(join(out, "index.html")), "trusted output missing");
if (Deno.args.includes("--positive-only")) Deno.exit(0);
const bad = await fixture();
r = await render(bad, await bad.api.activateOwner(bad.prepared), {
  SESSION_MUTATE: "1",
});
assert(r.code !== 0, "mutation passed freeze");
assert(
  !await exists(join(bad.root, ".course-owner/engine-count")),
  "mutation reached R engine",
);
const missing = await fixture();
await missing.api.activateOwner(missing.prepared);
r = await render(missing, {});
assert(r.code !== 0, "armed locator without metadata escaped");
await rejects(
  () => missing.api.finishOwner(missing.prepared),
  "SOURCE.RECONCILIATION_MISSING",
);
const noLocator = await fixture();
const noLocatorMeta = await noLocator.api.activateOwner(noLocator.prepared);
r = await render(noLocator, noLocatorMeta, { SESSION_DROP_GUARD: "1" });
assert(r.code !== 0, "metadata without locator escaped");
await rejects(
  () => noLocator.api.finishOwner(noLocator.prepared),
  "SOURCE.ACTIVE_INVOCATION_MISSING",
);
const stale = await fixture();
await stale.api.activateOwner(stale.prepared);
await rejects(
  () => stale.api.finishOwner(stale.prepared),
  "SOURCE.GUARD_RECEIPT_MISSING",
);
await rejects(
  () =>
    stale.api.prepareOwner(stale.root, {
      attemptId: "bad",
      profile: "student,full",
    }),
  "SOURCE.PROFILE_UNSUPPORTED",
);
await rejects(
  () =>
    stale.api.prepareOwner(stale.root, { attemptId: "bad", profile: "review" }),
  "SOURCE.PROFILE_UNSUPPORTED",
);
await rejects(
  () =>
    stale.api.prepareOwner(stale.root, {
      attemptId: "reused",
      profile: "student",
    }),
  "SOURCE.ATTEMPT_REUSED",
);
const wrong = await fixture();
await rejects(
  () => wrong.api.activateOwner({ ...wrong.prepared, profile: "full" }),
  "SOURCE.INVALID_ATTEMPT",
);
console.log(
  "PASS reuse, both handoff directions, complete receipts, profile identity, trusted override, frozen mutation",
);
