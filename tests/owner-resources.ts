import { dirname, fromFileUrl, join } from "stdlib/path";
import {
  digestFile,
  evaluate,
} from "../_extensions/course-core/owner-preflight/owner.ts";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const state = await Deno.makeTempDir({ prefix: "owner-resources-policy-" });
const schema = join(
  repo,
  "_extensions/course-core/owner-preflight/resource-policy.cue",
);
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const hash = "a".repeat(64);
const file = (path: string, origin = "source", role = "other") => ({
  path,
  sha256: hash,
  origin,
  role,
});
const use = (
  path: string,
  projection = "raw",
  profile = "student",
  phase = "capture",
  source = "index.qmd",
) => ({
  source,
  profile,
  phase,
  projection,
  kind: "Image",
  target: path,
  order: 1,
  path,
});
async function policy(
  baseline: unknown[],
  actual: unknown[],
  files: unknown[],
  selections: string[] = [],
  profile = "student",
) {
  return evaluate(
    { profile, baseline, actual, files, selections },
    state,
    schema,
  );
}
// Changing the public union to last-use/ordinal matching would fail this proof.
let r = await policy(
  [
    use("shared.svg"),
    use("shared.svg", "projected", "student", "capture", "nested/index.qmd"),
    use("closed.svg"),
    use("normal-sol.svg"),
    use("normal-sol.svg", "projected"),
  ],
  [],
  [file("shared.svg"), file("closed.svg"), file("normal-sol.svg")],
);
assert(
  r.files.find((x: any) => x.path === "shared.svg").allowed,
  "public+closed union must permit shared bytes",
);
assert(
  !r.files.find((x: any) => x.path === "closed.svg").allowed,
  "closed-only must deny bytes",
);
assert(
  r.files.find((x: any) => x.path === "normal-sol.svg").allowed,
  "ordinary solution must remain public",
);
r = await policy([use("closed.svg")], [
  use("closed.svg", "projected", "student", "render"),
], [file("closed.svg")]);
assert(
  !r.files[0].allowed &&
    r.diagnostics.some((d: any) =>
      d.code === "RESOURCE.CLOSED_BASELINE_PUBLIC_REFERENCE"
    ),
  "late computed use must not promote closed baseline",
);
r = await policy([], [use("plot.png", "projected", "student", "render")], [
  file("plot.png", "generated"),
  file("starter.qmd", "source", "resource"),
  file("index.qmd", "source", "root"),
  file("package.json", "service"),
], ["starter.qmd"]);
assert(
  r.files[0].allowed && r.files[1].allowed,
  "generated image and unlinked starter resource QMD must pass",
);
assert(
  !r.files[2].allowed && !r.files[3].allowed,
  "canonical source and producer-known service are not raw starter files",
);
r = await policy([], [], [
  file("index.qmd", "source", "root"),
  file("package.json", "service"),
], ["index.qmd", "package.json"]);
assert(
  r.diagnostics.length === 2,
  "canonical/service concrete selections must fail",
);
r = await policy(
  [use("closed.svg"), use("closed.svg", "projected", "full")],
  [use("closed.svg", "projected", "full", "render")],
  [file("closed.svg")],
  ["closed.svg"],
  "full",
);
assert(
  r.files[0].allowed && !r.diagnostics.length,
  "full projection must permit known closed content",
);
r = await policy([], [use("late-hidden.svg", "raw", "student", "render")], [
  file("late-hidden.svg", "generated"),
], ["late-hidden.svg"]);
assert(!r.files[0].allowed, "actual-only hidden output must remain forbidden");
r = await policy(
  [use("student-only.svg"), use("student-only.svg", "projected")],
  [],
  [file("student-only.svg")],
  ["student-only.svg"],
  "full",
);
assert(
  !r.files[0].allowed && r.diagnostics.length,
  "full must use actual full projection of known baseline",
);
r = await policy(
  [],
  [use("unproven.svg", "projected", "student", "render")],
  [],
);
assert(
  r.diagnostics.some((d: any) => d.code === "RESOURCE.ACTUAL_FILE_UNPROVEN"),
  "actual resource without current byte proof was accepted",
);
r = await policy([], [], [file("duplicate.svg"), file("duplicate.svg")]);
assert(
  r.diagnostics.some((d: any) => d.code === "RESOURCE.DUPLICATE_FILE_IDENTITY"),
  "duplicate canonical resource identity accepted",
);
r = await policy([], [use("service.json", "projected", "student", "render")], [
  file("service.json", "service"),
]);
assert(
  r.diagnostics.some((d: any) =>
    d.code === "RESOURCE.SERVICE_PUBLIC_REFERENCE"
  ),
  "public service reference was silently approved",
);
const runtimeDeclaration = {
  source: "_extensions/course-presentation/disclosure.js",
  sourceSha256: hash,
  producer: "course-presentation",
  dependency: "course-presentation",
  version: "0.1.0",
  asset: "disclosure.js",
  kind: "script",
  descriptorPath: "_extensions/course-presentation/html-dependency.json",
  descriptorSha256: hash,
  registrationPath: "_extensions/course-presentation/filter.lua",
  registrationSha256: hash,
  markerProvider: "course-presentation",
  markerAsset: "disclosure.js",
};
const runtimeFiles = [
  file(runtimeDeclaration.source, "service"),
  file(runtimeDeclaration.descriptorPath, "service"),
  file(runtimeDeclaration.registrationPath, "service"),
];
r = await evaluate(
  {
    profile: "student",
    baseline: [],
    actual: [],
    files: runtimeFiles,
    selections: [],
    filters: ["course-core", "course-presentation"],
    runtime: [runtimeDeclaration],
  },
  state,
  schema,
);
assert(
  r.runtimeEligibility[0].eligible && !r.files[0].allowed,
  "runtime eligibility must not promote raw source service",
);
for (
  const overrides of [{ producer: "arbitrary-provider" }, {
    markerAsset: "other.js",
  }, { sourceSha256: "b".repeat(64) }]
) {
  const invalid = await evaluate(
    {
      profile: "student",
      baseline: [],
      actual: [],
      files: runtimeFiles,
      selections: [],
      filters: ["course-core", "course-presentation"],
      runtime: [{ ...runtimeDeclaration, ...overrides }],
    },
    state,
    schema,
  );
  assert(
    !invalid.runtimeEligibility[0].eligible,
    "unverified producer/marker/source runtime eligibility accepted",
  );
}
const inactive = await evaluate(
  {
    profile: "student",
    baseline: [],
    actual: [],
    files: runtimeFiles,
    selections: [],
    filters: ["course-core"],
    runtime: [runtimeDeclaration],
  },
  state,
  schema,
);
assert(
  !inactive.runtimeEligibility[0].eligible,
  "inactive provider granted runtime exception",
);
console.log("owner resource CUE matrix passed");
const resources = await import(
  "../_extensions/course-core/owner-preflight/resources.ts"
);
const owner = await Deno.makeTempDir({ prefix: "owner-resources-paths-" });
await Deno.mkdir(join(owner, "nested"));
await Deno.mkdir(join(owner, "assets"));
await Deno.writeTextFile(join(owner, "assets", "shared.svg"), "ROOT_BYTES");
await Deno.writeTextFile(join(owner, "nested", "shared.svg"), "NESTED_BYTES");
const u = (target: string) => ({ kind: "Image" as const, target, order: 1 });
const obs = {
  source: "nested/index.qmd",
  profile: "student" as const,
  phase: "capture" as const,
  effectiveBase: "nested/index.qmd",
  raw: [],
  projected: [],
};
assert(
  (await resources.resolveResourceTarget(owner, obs, u("shared.svg?x=1#frag")))
    ?.path === "nested/shared.svg",
  "effective base must be root QMD directory",
);
assert(
  (await resources.resolveResourceTarget(owner, obs, u("/assets/shared.svg")))
    ?.path === "assets/shared.svg",
  "root-relative native target must stay inside owner",
);
for (
  const target of [
    "https://host/a.png",
    "//host/a.png",
    "data:image/png;base64,AA",
    "#anchor",
  ]
) {
  assert(
    await resources.resolveResourceTarget(owner, obs, u(target)) === undefined,
    "non-local URI became file",
  );
}
for (const target of ["../../escape.svg", "%2e%2e/%2e%2e/escape.svg"]) {
  let rejected = false;
  try {
    await resources.resolveResourceTarget(owner, obs, u(target));
  } catch {
    rejected = true;
  }
  assert(rejected, "escaped local target accepted");
}
await Deno.symlink(join(owner, "assets"), join(owner, "nested", "linked"));
let rejected = false;
try {
  await resources.resolveResourceTarget(owner, obs, u("linked/shared.svg"));
} catch {
  rejected = true;
}
assert(rejected, "symlink dependency accepted");
console.log("owner resource path matrix passed");
const collector = join(
  repo,
  "_extensions/course-core/owner-preflight/resources.lua",
);
const lua = join(state, "collector.lua");
await Deno.writeTextFile(
  lua,
  `package.path=${
    JSON.stringify(join(repo, "_extensions/course-core/owner-preflight/?.lua"))
  }..';'..${
    JSON.stringify(join(repo, "_extensions/course-core/?.lua"))
  }..';'..package.path
local resources=require('resources')
local grading=require('grading');local visibility=require('visibility')
return {{Pandoc=function(doc)
local observed=resources.collect(doc,{source='nested/index.qmd',profile='student',phase='capture',effectiveBase='nested/index.qmd'},function(doc) return visibility.prepare(grading.prepare(doc)) end)
local f=assert(io.open(${
    JSON.stringify(join(state, "native-facts.json"))
  },'w'));f:write(pandoc.json.encode(observed));f:close()
return doc
end}}
`,
);
const input = join(state, "collector.qmd");
await Deno.writeTextFile(
  input,
  `---\ncourse:\n  id: native\n  view: student\n---\n::: {#exr-manual target="manual"}\n## Manual\n\n![Shared](shared.svg)\n\n::: {.grading-notes}\n![Shared](shared.svg)\n![Closed](closed.svg)\n:::\n:::\n\n::: {#sol-ordinary}\n![Normal](ordinary.svg)\n:::\n\n[Navigation](index.qmd)\n`,
);
let cmd = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
  args: ["pandoc", input, "--lua-filter", lua, "--to", "json"],
  env: { QUARTO_PROFILE: "student" },
  stdout: "piped",
  stderr: "piped",
}).output();
assert(cmd.success, new TextDecoder().decode(cmd.stderr));
const native = JSON.parse(
  await Deno.readTextFile(join(state, "native-facts.json")),
);
assert(
  native.raw.filter((x: any) => x.target === "shared.svg").length === 2,
  "native collector lost duplicate raw uses",
);
assert(
  native.projected.some((x: any) => x.target === "ordinary.svg") &&
    !native.projected.some((x: any) => x.target === "closed.svg"),
  "native projection must use existing grading semantics",
);
assert(
  native.effectiveBase === "nested/index.qmd",
  "native effective base missing",
);
console.log("owner resource native collector passed");
if (Deno.env.get("OWNER_RESOURCES_NATIVE") === "1") {
  const root = await Deno.makeTempDir({ prefix: "owner-resources-native-" });
  const quarto = Deno.env.get("QUARTO") || "quarto";
  const failure = Deno.env.get("OWNER_RESOURCES_FAILURE");
  const command = async (args: string[]) => {
    const r = await new Deno.Command(quarto, {
      cwd: root,
      args,
      env: {
        RESOURCE_LATE: failure === "late" ? "1" : "0",
        RESOURCE_EXTRA: failure === "extra" ? "1" : "0",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    return {
      code: r.code,
      text: new TextDecoder().decode(r.stdout) +
        new TextDecoder().decode(r.stderr),
    };
  };
  let r = await command(["add", repo, "--no-prompt"]);
  assert(!r.code, r.text);
  const write = async (p: string, t: string) => {
    await Deno.mkdir(dirname(join(root, p)), { recursive: true });
    await Deno.writeTextFile(join(root, p), t);
  };
  await write(
    "_quarto.yml",
    `project:\n  type: default\n  output-dir: _site\n  render: [index.qmd, nested/index.qmd]\n  resources: [starter.qmd]\n  pre-render:\n    - _extensions/course-core/entrypoints/pre.ts\n    - _extensions/course-core/entrypoints/owner-freeze.ts\n  post-render:\n    - _extensions/course-core/entrypoints/post.ts\n    - service-package.ts\nformat:\n  html:\n    theme: none\nexecute:\n  freeze: false\n  cache: false\ncourse:\n  id: resources-proof\n  validate: true\nfilters: [course-core, course-presentation]\n`,
  );
  await write("_quarto-student.yml", "course:\n  view: student\n");
  await write("_quarto-full.yml", "course:\n  view: full\n");
  const svg = (marker: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><title>${marker}</title></svg>`;
  for (
    const [p, v] of [
      ["shared.svg", "ROOT"],
      ["closed.svg", "CLOSED"],
      ["ordinary.svg", "ORDINARY"],
      ["nested/shared.svg", "NESTED"],
      ["nested/fragments/shared.svg", "WRONG_BASE"],
    ]
  ) await write(p, svg(v));
  await write(
    "starter.qmd",
    "Plain starter resource, intentionally unlinked.\n",
  );
  await write(
    "nested/fragments/task.qmd",
    "![Included root base](shared.svg)\n",
  );
  await write(
    "nested/index.qmd",
    "# Nested\n\n{{< include fragments/task.qmd >}}\n",
  );
  await write(
    "index.qmd",
    `---\nengine: knitr\n---\n# Resources\n\n::: {#exr-manual target="manual"}\n## Manual\n\n![Shared](shared.svg)\n\n::: {.grading-notes}\n![Shared](shared.svg)\n![Closed](closed.svg)\n:::\n:::\n\n::: {#sol-manual}\n![Ordinary](ordinary.svg)\n:::\n\n[Navigate](nested/index.qmd)\n\n\`\`\`{r plot-proof}\nwrite('executed',file='.course-owner/engine-count',append=TRUE)\nplot(1:3)\n\`\`\`\n\n\`\`\`{r results='asis'}\nif(Sys.getenv('RESOURCE_LATE')=='1')cat('[Late computed](closed.svg)\\n')\nif(Sys.getenv('RESOURCE_EXTRA')=='1')write('unsupported',file='extra-authored.txt')\n\`\`\`\n`,
  );
  await write(
    "service-package.ts",
    `import { activeOwner } from "./_extensions/course-core/owner-preflight/owner.ts";
import { check } from "./_extensions/course-core/application/check.ts";
import { runtime } from "./_extensions/course-core/infrastructure/runtime.ts";
const root=await Deno.realPath(Deno.cwd());const active=await activeOwner(root);
if(active?.phase==="render")await check(runtime(root,[],false));
`,
  );
  const api = await import(
    new URL(`file://${root}/_extensions/course-core/owner-preflight/owner.ts`)
      .href
  );
  assert(
    typeof api.validateOwnerResources === "function",
    "missing exported post-finish resource API",
  );
  const profile = Deno.env.get("OWNER_RESOURCES_PROFILE") === "full"
    ? "full"
    : "student";
  if (failure?.startsWith("early")) {
    const config = await Deno.readTextFile(join(root, "_quarto.yml"));
    await write(
      "_quarto.yml",
      config.replace(
        "resources: [starter.qmd]",
        failure === "early-canonical"
          ? "resources: [index.qmd]"
          : "resources: [closed.svg]",
      ),
    );
    await Deno.remove(join(root, "starter.qmd"));
    let refused = false;
    let earlyError = "";
    try {
      await api.prepareOwner(root, { attemptId: "resources-early", profile });
    } catch (error) {
      earlyError = String(error);
      refused = earlyError.includes("RESOURCE.POLICY_DENIED");
    }
    assert(
      refused,
      "native selected forbidden bytes were not rejected before engine: " +
        earlyError,
    );
    try {
      await Deno.stat(join(root, ".course-owner/engine-count"));
      throw new Error("early resource gate executed engine");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    console.log("owner resource native early gate passed");
    Deno.exit(0);
  }
  const prepared = await api.prepareOwner(root, {
    attemptId: "resources-native",
    profile,
  });
  let denied = false;
  try {
    await api.validateOwnerResources(prepared);
  } catch {
    denied = true;
  }
  assert(denied, "resource index was available before finish");
  const output = await Deno.makeTempDir({ prefix: "owner-resources-output-" });
  const metadata = await api.activateOwner(prepared, { output });
  await write(".course-owner/render-meta.json", JSON.stringify(metadata));
  r = await command([
    "render",
    ".",
    "--profile",
    profile,
    "--to",
    "html",
    "--execute",
    "--no-cache",
    "--no-execute-daemon",
    "--metadata-file",
    join(root, ".course-owner/render-meta.json"),
    "--output-dir",
    output,
  ]);
  await write(".course-owner/native-render.log", r.text);
  if (failure === "late") {
    assert(r.code && r.text.includes("RESOURCE.POLICY_DENIED"), r.text);
    let refused = false;
    try {
      await api.validateOwnerResources(prepared);
    } catch {
      refused = true;
    }
    assert(refused, "failed late public reference yielded resource index");
    assert(
      (await Deno.readTextFile(join(root, ".course-owner/engine-count")))
        .trim() === "executed",
      "late gate repeated engine",
    );
    console.log("owner resource native late closed baseline passed");
    Deno.exit(0);
  }
  assert(!r.code, r.text);
  if (failure === "extra") {
    let refused = false;
    try {
      await api.finishOwner(prepared);
    } catch (error) {
      refused = String(error).includes("SOURCE.FROZEN_INPUT_CHANGED");
    }
    assert(refused, "arbitrary new authored-dir bytes passed finish");
    console.log("owner resource native unsupported authored write passed");
    Deno.exit(0);
  }
  assert(
    (await Deno.readTextFile(join(root, ".course-owner/engine-count")))
      .trim() === "executed",
    "engine executed other than once",
  );
  const finished = await api.finishOwner(prepared);
  assert(finished.exitCode === 0, JSON.stringify(finished));
  const index = await api.validateOwnerResources(prepared, {
    selections: ["starter.qmd"],
  });
  assert(
    index.indexHash.length === 64 && index.invocationId,
    "index identity missing",
  );
  const policies = new Map(index.policy.files.map((x: any) => [x.path, x]));
  assert(
    (policies.get("shared.svg") as any).allowed &&
      (policies.get("ordinary.svg") as any).allowed,
    "public union/normal solution refused",
  );
  assert(
    (policies.get("closed.svg") as any).allowed === (profile === "full"),
    "closed/full policy mismatch",
  );
  const generated = index.files.find((x: any) => x.origin === "generated");
  assert(
    generated && generated.actualPath.startsWith(output + "/") &&
      await digestFile(generated.actualPath) === generated.sha256,
    "native generated destination missing",
  );
  assert(
    await resources.resolveResourceTarget(root, {
      ...obs,
      effectiveBase: "nested/index.qmd",
    }, u("shared.svg")),
    "nested source base unresolved",
  );
  assert(
    index.evidence.actual.some((x: any) =>
      x.source === "nested/index.qmd" && x.path === "nested/shared.svg"
    ),
    "include relative to physical fragment instead of root QMD",
  );
  for (
    const selection of [
      "index.qmd",
      "_generated/course-spec/course.json",
      ...(profile === "student" ? ["closed.svg"] : []),
    ]
  ) {
    let refused = false;
    try {
      await api.validateOwnerResources(prepared, { selections: [selection] });
    } catch {
      refused = true;
    }
    assert(refused, `raw forbidden selection accepted: ${selection}`);
  }
  const service = index.files.find((x: any) =>
    x.path === "_generated/course-spec/course.json"
  );
  assert(
    service?.origin === "service",
    "Core producer-owned package proof missing",
  );
  const serviceBytes = await Deno.readFile(service.actualPath);
  await Deno.writeTextFile(service.actualPath, "service-mutated");
  let serviceRefused = false;
  try {
    await api.validateOwnerResources(prepared);
  } catch {
    serviceRefused = true;
  }
  assert(serviceRefused, "producer-owned service hash mutation accepted");
  await Deno.writeFile(service.actualPath, serviceBytes);
  assert(
    index.runtimeEligibility.length === 3 &&
      index.runtimeEligibility.every((row: any) => row.eligible),
    "missing CUE native runtime eligibility",
  );
  for (const row of index.runtimeEligibility) {
    assert(
      !index.policy.files.find((file: any) => file.path === row.source).allowed,
      "runtime eligibility promoted raw source bytes",
    );
  }
  const runtimeProof = join(state, "runtime-proof.py");
  const proofInput = join(state, "runtime-proof.json");
  await Deno.writeTextFile(
    proofInput,
    JSON.stringify({
      root,
      output,
      html: join(output, "index.html"),
      rows: index.runtimeEligibility,
    }),
  );
  await Deno.writeTextFile(
    runtimeProof,
    `import hashlib,json,sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit,unquote
x=json.load(open(sys.argv[1]));root=Path(x['root']);output=Path(x['output']);html=Path(x['html']);rows={(r['producer'],r['asset']):r for r in x['rows'] if r['eligible']};seen={}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
class Witness(HTMLParser):
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  assert tag!='base','base URI is unsupported'
  p=a.get('data-course-runtime-provider');asset=a.get('data-course-runtime-asset')
  if p is None and asset is None:return
  assert (p,asset) in rows and (p,asset) not in seen,'unproved/duplicate native marker'
  row=rows[(p,asset)];attribute='src' if row['kind']=='script' else 'href'
  assert tag==('script' if row['kind']=='script' else 'link'),'wrong native tag kind'
  if tag=='link':assert 'stylesheet' in a.get('rel','').split()
  uri=urlsplit(a[attribute]);assert not uri.scheme and not uri.netloc and not uri.path.startswith('/'),'non-local runtime target'
  destination=html.parent/unquote(uri.path);destination=Path(str(destination))
  assert destination.resolve().is_relative_to(output.resolve()),'runtime escaped current output'
  for path in [destination,*destination.parents]:
   if path==output.parent:break
   assert not path.is_symlink(),'runtime symlink'
  for path,digest in [(root/row['source'],row['sourceSha256']),(root/row['descriptorPath'],row['descriptorSha256']),(root/row['registrationPath'],row['registrationSha256'])]:assert sha(path)==digest,'provider source mutation'
  assert sha(destination)==row['sourceSha256'],'runtime output mutation'
  seen[(p,asset)]=str(destination.resolve())
Witness().feed(html.read_text());assert len(seen)==len(rows),'missing native runtime witness'
print(json.dumps(list(seen.values())))
`,
  );
  const proof = () =>
    new Deno.Command("python3", {
      args: [runtimeProof, proofInput],
      stdout: "piped",
      stderr: "piped",
    }).output();
  const proved = await proof();
  assert(proved.success, new TextDecoder().decode(proved.stderr));
  const runtimePaths = JSON.parse(new TextDecoder().decode(proved.stdout));
  const originalRuntime = await Deno.readFile(runtimePaths[0]);
  await Deno.writeTextFile(runtimePaths[0], "mutated-runtime-output");
  assert(
    !(await proof()).success,
    "native runtime output hash mutation granted exception",
  );
  await Deno.writeFile(runtimePaths[0], originalRuntime);
  console.log("owner native marked runtime destination/hash proof passed");
  const originalGenerated = await Deno.readFile(generated.actualPath);
  await Deno.writeTextFile(generated.actualPath, "mutated");
  let refused = false;
  try {
    await api.validateOwnerResources(prepared);
  } catch {
    refused = true;
  }
  assert(refused, "late generated byte mutation accepted");
  await Deno.writeFile(generated.actualPath, originalGenerated);
  await Deno.writeTextFile(join(root, "shared.svg"), "source-mutated");
  refused = false;
  try {
    await api.validateOwnerResources(prepared);
  } catch {
    refused = true;
  }
  assert(refused, "late source byte mutation accepted");
  console.log(`owner resource installed native ${profile} passed: ${root}`);
}
// Rejecting every new file would fail the native-plot positive; trusting a new path
// without native cell evidence would fail the neighboring authored-write negative.
const generatedRoot = await Deno.makeTempDir({
  prefix: "owner-resources-seal-",
});
await Deno.mkdir(join(generatedRoot, "index_files/figure-html"), {
  recursive: true,
});
await Deno.writeTextFile(
  join(generatedRoot, "index_files/figure-html/plot-1.png"),
  "CURRENT_GENERATED_BYTES",
);
await Deno.writeTextFile(
  join(generatedRoot, "arbitrary.svg"),
  "UNSUPPORTED_AUTHOR_DIR_WRITE",
);
const generatedSession = {
  root: generatedRoot,
  files: {},
  audit: {
    profiles: {
      student: {
        fileInformation: {
          "index.qmd": {
            metadata: { engine: "knitr" },
            codeCells: [{ language: "r" }],
          },
        },
      },
    },
    coverage: { "index.qmd": { kind: "root", profiles: ["student", "full"] } },
  },
} as any;
const generatedObservation = {
  source: "index.qmd",
  profile: "student" as const,
  phase: "render" as const,
  effectiveBase: "index.qmd",
  raw: [{
    kind: "Image" as const,
    target: "index_files/figure-html/plot-1.png",
    order: 1,
    nativePlot: true,
  }],
  projected: [],
};
const generatedOutput = await Deno.makeTempDir({
  prefix: "owner-resource-current-output-",
});
const sealed = await resources.sealGeneratedResources(
  generatedSession,
  generatedObservation,
  generatedOutput,
);
assert(
  sealed[0].sha256.length === 64 &&
    sealed[0].actualPath ===
      join(generatedOutput, "index_files/figure-html/plot-1.png"),
  "native plot bytes/destination not sealed",
);
for (
  const raw of [[{ ...generatedObservation.raw[0], nativePlot: false }], [{
    ...generatedObservation.raw[0],
    target: "arbitrary.svg",
  }]]
) {
  let refused = false;
  try {
    await resources.sealGeneratedResources(generatedSession, {
      ...generatedObservation,
      raw,
    }, generatedOutput);
  } catch {
    refused = true;
  }
  assert(refused, "arbitrary generated author-dir bytes accepted");
}
let unknownEngineRefused = false;
try {
  await resources.sealGeneratedResources(
    {
      ...generatedSession,
      audit: {
        ...generatedSession.audit,
        profiles: {
          student: {
            fileInformation: {
              "index.qmd": { metadata: { engine: "opaque" }, codeCells: [] },
            },
          },
        },
      },
    },
    generatedObservation,
    generatedOutput,
  );
} catch {
  unknownEngineRefused = true;
}
assert(unknownEngineRefused, "unproved engine generated bytes accepted");
console.log("owner resource generated producer matrix passed");
let opaqueRefused = false;
try {
  await resources.resolveResourceEvidence(generatedSession, [{
    ...generatedObservation,
    opaque: ["RawInline:html"],
  }]);
} catch (error) {
  opaqueRefused = String(error).includes("RESOURCE.OPAQUE_CARRIER_UNSUPPORTED");
}
assert(
  opaqueRefused,
  "unproved raw HTML resource carrier silently became public",
);
console.log("owner resource opaque-carrier gate passed");
const extensionRoot = await Deno.makeTempDir({
  prefix: "owner-resource-installed-proof-",
});
const installedFile = "_extensions/native-filter/asset.js",
  unclaimedFile = "_extensions/unclaimed/asset.js";
for (const path of [installedFile, unclaimedFile]) {
  await Deno.mkdir(dirname(join(extensionRoot, path)), { recursive: true });
  await Deno.writeTextFile(join(extensionRoot, path), "PUBLIC_SOURCE_BYTES");
}
const extensionSession = {
  root: extensionRoot,
  extension: "_extensions/course-core",
  files: {
    [installedFile]: await digestFile(join(extensionRoot, installedFile)),
    [unclaimedFile]: await digestFile(join(extensionRoot, unclaimedFile)),
  },
  audit: {
    coverage: {},
    profiles: {
      student: {
        extensions: [{
          path: join(extensionRoot, "_extensions/native-filter"),
        }],
      },
    },
  },
} as any;
const extensionFiles = await resources.sourceResourceFiles(extensionSession);
assert(
  extensionFiles.find((x) => x.path === installedFile)?.origin === "service",
  "native installed producer payload was offered as raw starter source",
);
assert(
  extensionFiles.find((x) => x.path === unclaimedFile)?.origin === "source",
  "directory name fabricated producer ownership",
);
console.log("owner resource native installed provenance passed");
const serviceRoot = await Deno.makeTempDir({
  prefix: "owner-resource-service-area-",
});
await Deno.mkdir(join(serviceRoot, "_generated/course-spec"), {
  recursive: true,
});
await Deno.writeTextFile(
  join(serviceRoot, "_generated/course-spec/arbitrary.svg"),
  "NOT_A_CORE_PRODUCER",
);
let unknownServiceRefused = false;
try {
  await resources.coreServiceResourceFiles(
    {
      root: serviceRoot,
      captures: {},
      identities: {},
      readerInputs: {},
      audit: { coverage: {} },
    } as any,
  );
} catch (error) {
  unknownServiceRefused = String(error).includes(
    "RESOURCE.SERVICE_PRODUCER_UNSUPPORTED",
  );
}
assert(
  unknownServiceRefused,
  "unknown write in native Core service area silently exempted",
);
console.log("owner resource unknown service producer gate passed");
