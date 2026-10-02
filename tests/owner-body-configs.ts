// Focused native config service regression. Static single-root owner: no engine
// cells and no replay of the computed body corpus. The frozen Template guard is
// tested as a byte/archive consumer only; this is not a PDF/ZIP integration claim.
import { dirname, fromFileUrl, join, relative, toFileUrl } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const templateRef = "2ce3a29cca93ca5a12a19f2210e5a79377ab9b23";
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function copy(source: string, target: string) {
  await Deno.mkdir(target, { recursive: true });
  for await (const entry of Deno.readDir(source)) {
    const from = join(source, entry.name), to = join(target, entry.name);
    if (entry.isDirectory) await copy(from, to);
    else if (entry.isFile) await Deno.copyFile(from, to);
    else throw new Error("Unsupported copy entry: " + from);
  }
}
async function command(executable: string, args: string[], cwd: string) {
  const r = await new Deno.Command(executable, {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const output = new TextDecoder().decode(r.stdout) +
    new TextDecoder().decode(r.stderr);
  assert(r.code === 0, executable + " exited " + r.code + ": " + output);
  return output;
}
async function refuses(
  label: string,
  fn: () => Promise<unknown>,
  code: string,
) {
  try {
    await fn();
  } catch (error) {
    assert(
      String(error).includes(code),
      label + ": unexpected refusal " + error,
    );
    console.log("PASS " + label);
    return;
  }
  throw new Error("Expected refusal: " + label);
}
let evidence: string, prepared: any, h: any, root: string, profile: string;
if (Deno.args[0] === "--existing-evidence") {
  evidence = Deno.args[1];
  h =
    JSON.parse(await Deno.readTextFile(join(evidence, "finished.json"))).report
      .body;
  root = h.root;
  profile = h.profile;
  prepared = {
    protocol: 1,
    root,
    attemptId: h.attemptId,
    profile,
    sessionId: h.sessionId,
    sessionPath: join(root, ".course-owner/session.json"),
    sessionHash: h.sessionHash,
  };
} else {
  profile = Deno.args[0] || "student";
  assert(["student", "full"].includes(profile), "Expected student/full");
  evidence = await Deno.makeTempDir({ prefix: "owner-body-configs-" });
  root = join(evidence, "consumer/tasks");
  await Deno.mkdir(root, { recursive: true });
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    `project:
  type: default
  output-dir: _site
  render: [config.qmd]
  pre-render:
    - _extensions/course-core/entrypoints/pre.ts
    - _extensions/course-core/entrypoints/owner-freeze.ts
  post-render:
    - _extensions/course-core/entrypoints/post.ts
format:
  html:
    theme: none
course:
  id: config-proof
  validate: true
filters: [course-core, course-presentation]
`,
  );
  for (const p of ["student", "full"]) {
    await Deno.writeTextFile(
      join(root, `_quarto-${p}.yml`),
      `course:\n  view: ${p}\n`,
    );
  }
  await Deno.writeTextFile(
    join(root, "config.qmd"),
    `---
assessment:
  kind: lab
---

# Config resource proof {#sec-config-work}

::: {#exr-config target="manual"}
## Explain this public data

Use the [ordinary public asset](public-data.txt).
:::

::: {.assessment-items}
1. @exr-config
:::
`,
  );
  await Deno.writeTextFile(
    join(root, "public-data.txt"),
    "ORDINARY_PUBLIC_CONFIG_CONTROL\n",
  );
  await Deno.writeTextFile(
    join(evidence, "install.log"),
    await command(quarto, ["add", repo, "--no-prompt"], root),
  );
  const api = await import(
    toFileUrl(join(root, "_extensions/course-core/owner-preflight/owner.ts"))
      .href
  );
  prepared = await api.prepareOwner(root, {
    attemptId: "config-service-" + profile,
    profile,
    body: { sources: ["config.qmd"] },
  });
  const metadata = join(root, ".course-owner/render-metadata.json");
  await Deno.writeTextFile(
    metadata,
    JSON.stringify(await api.activateOwner(prepared)),
  );
  await Deno.writeTextFile(
    join(evidence, "render.log"),
    await command(quarto, [
      "render",
      ".",
      "--profile",
      profile,
      "--to",
      "html",
      "--no-execute",
      "--no-cache",
      "--metadata-file",
      metadata,
    ], root),
  );
  const finished = await api.finishOwner(prepared);
  assert(
    finished.exitCode === 0 && finished.report.body,
    "Native static config attempt did not finish",
  );
  h = finished.report.body;
  await Deno.writeTextFile(
    join(evidence, "finished.json"),
    JSON.stringify(finished, null, 2),
  );
}
console.log("Config evidence: " + evidence + " profile=" + profile);
const api = await import(
  toFileUrl(join(root, "_extensions/course-core/owner-preflight/owner.ts")).href
);
await api.validateOwnerBodies(prepared, h);
const s = await api.preparedSession(prepared),
  index = await api.validateOwnerResources(prepared);
const configs = [
  ...new Set<string>(
    Object.values(s.audit.profiles).flatMap((info: any) =>
      info.files.config.map((path: string) =>
        relative(root, path).replaceAll("\\", "/")
      )
    ),
  ),
];
assert(
  configs.length === 3,
  "Native test did not recognize all active/inactive config files",
);
for (const path of configs) {
  const file = index.files.find((f: any) => f.path === path),
    policy = index.policy.files.find((f: any) => f.path === path);
  assert(
    file?.origin === "service" && !policy?.allowed &&
      policy.reasons.includes("service"),
    "Native config is deliverable: " + path + " " +
      JSON.stringify({ file, policy }),
  );
  await refuses(
    profile + " native config selection " + path,
    () => api.validateOwnerResources(prepared, { selections: [path] }),
    "RESOURCE.SELECTION_FORBIDDEN",
  );
}
const asset = s.audit.coverage["config.qmd"]
  ? "public-data.txt"
  : "tasks/data.txt";
await api.validateOwnerResources(prepared, { selections: [asset] });
console.log("PASS ordinary public asset stays allowed");
const resources = await import(
  toFileUrl(join(root, "_extensions/course-core/owner-preflight/resources.ts"))
    .href
);
const ordinaryFiles = await resources.sourceResourceFiles({
  ...s,
  body: undefined,
});
for (const path of configs) {
  assert(
    ordinaryFiles.find((f: any) => f.path === path)?.origin === "source",
    "Body-absent native config classification changed",
  );
}
console.log(
  "PASS body-absent config classification is unchanged (pure helper control)",
);
if (Deno.args[0] === "--existing-evidence") Deno.exit(0);

// Use immutable existing Template consumers, never a duplicate custom byte/ZIP
// policy or a mutable Template source snapshot. Core has already issued/validated
// this real native body/index; only malicious delivery carriers are authored here.
const template = Deno.env.get("BODY_CONFIG_TEMPLATE_REPO");
assert(
  template,
  "Set BODY_CONFIG_TEMPLATE_REPO to a checkout containing frozen Template2ce3",
);
const guard = join(evidence, "guard");
const paths = [
  "fixtures/probes/artifacts/common.ts",
  "fixtures/probes/resources/common.ts",
  "fixtures/probes/resources/verify.ts",
  "fixtures/probes/resources/audit.py",
  "fixtures/probes/resources/runtime.py",
];
for (const path of paths) {
  const output = await command("git", [
    "-C",
    template,
    "show",
    templateRef + ":" + path,
  ], repo);
  const target = join(guard, path);
  await Deno.mkdir(dirname(target), { recursive: true });
  await Deno.writeTextFile(target, output);
}
await copy(
  join(root, "_extensions/course-core"),
  join(guard, "fixtures/_extensions/Afonenko-Course-Tools/course-core"),
);
const common = await import(
  toFileUrl(join(guard, "fixtures/probes/resources/common.ts")).href
);
const verify = await import(
  toFileUrl(join(guard, "fixtures/probes/resources/verify.ts")).href
);
const sourceRoot = dirname(root),
  stage = join(evidence, "delivery"),
  probe = join(sourceRoot, "_probe");
await Deno.mkdir(stage, { recursive: true });
await Deno.mkdir(join(probe, "resources"), { recursive: true });
for (const name of ["audit.py", "runtime.py"]) {
  await Deno.copyFile(
    join(guard, "fixtures/probes/resources", name),
    join(probe, "resources", name),
  );
}
const packagePath = join(probe, "current-package.json");
await Deno.copyFile(h.publicPath, packagePath);
const attempt = {
  protocol: 1,
  timings: {},
  handle: prepared,
  body: [],
  services: [],
  runtimeProviders: [],
  packagePath,
  packageHash: await api.digestFile(packagePath),
  indexHash: index.indexHash,
  delivery: { printFiles: {}, archives: {}, archiveHashes: {} },
};
const ctx = {
  sourceRoot,
  stage,
  root: sourceRoot,
  attemptId: prepared.attemptId,
  profiles: [profile],
  members: [],
};
for (const [i, path] of configs.entries()) {
  const renamed = join(stage, `innocent-${i}.txt`);
  await Deno.copyFile(join(root, path), renamed);
  await refuses(
    profile + " renamed config bytes " + path,
    () => common.checkBytes([renamed], index, attempt),
    "DENIED_DELIVERY_RESOURCE",
  );
  await Deno.remove(renamed);
}
await Deno.copyFile(join(root, asset), join(stage, "ordinary-public.txt"));
await common.checkBytes([join(stage, "ordinary-public.txt")], index, attempt);
await Deno.remove(join(stage, "ordinary-public.txt"));
const carrier = join(stage, "picture.png");
await command("python3", [
  "-c",
  "import pathlib,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1],'w',compression=zipfile.ZIP_DEFLATED) as z:\n for i,p in enumerate(sys.argv[2:]): z.writestr('plain-'+str(i)+'.txt',pathlib.Path(p).read_bytes())",
  carrier,
  ...configs.map((p) => join(root, p)),
], repo);
await Deno.writeTextFile(
  join(probe, "resource-attempt.json"),
  JSON.stringify(attempt),
);
await refuses(
  profile + " renamed archive config entry",
  () => verify.default.finalize(ctx),
  "DENIED_ZIP_RESOURCE",
);
await api.validateOwnerBodies(prepared, h);
console.log(
  "PASS frozen Template " + templateRef +
    " byte/archive guards refuse native config SHA; current body remains valid; no engine cells",
);
