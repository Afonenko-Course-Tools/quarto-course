// Exact composer code-path regression with PURE injected owner/native authority.
// Disk paths, bytes/SHA, parser, runtime witnesses and denial loops remain real.
// This test does not manufacture a native receipt or claim a completed engine.
import { dirname, fromFileUrl, join } from "stdlib/path";
import {
  digestFile,
  OwnerFailure,
} from "../_extensions/course-core/owner-preflight/owner.ts";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const provider = join(repo, "_extensions/course-core/owner-preflight");
const input = Deno.env.get("CAPTURE_COLLISION_SOURCE") ||
  join(provider, "publication-resources.ts");
const matcherInput = Deno.env.get("CAPTURE_COLLISION_MATCHER_SOURCE") ||
  join(provider, "capture-projections.ts");
const output = Deno.env.get("CAPTURE_COLLISION_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "capture-collision-authority-" });
await Deno.mkdir(output, { recursive: true });
const original = await Deno.readTextFile(input);
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const start = original.indexOf("async function build("),
  end = original.indexOf("\nfunction receiptPath(", start),
  exactBuild = original.slice(start, end);
assert(start >= 0 && end > start, "private composer boundary missing");
let patched = original;
for (
  const [module, names] of [
    ["owner.ts", ["activeOwner", "inspect", "preparedSession"]],
    ["resources.ts", ["runtimeDeclarations", "validateOwnerResources"]],
    ["native-listing-addresses.ts", ["nativeListingPublicationGrants"]],
  ] as const
) {
  const importBlock = new RegExp(
    `import \\{[\\s\\S]*?\\} from "\\./${module.replace(".", "\\.")}";`,
  );
  const matched = patched.match(importBlock)?.[0];
  assert(matched, `import seam missing: ${module}`);
  // Change imported names only. Every production function body stays intact.
  const replaced = names.reduce(
    (block, name) =>
      block.replace(
        new RegExp(`\\b${name}(?=\\s*[,}])`),
        `${name} as original_${name}`,
      ),
    matched,
  );
  for (const name of names) {
    assert(replaced.includes(`as original_${name}`), `missing seam ${name}`);
  }
  patched = patched.replace(matched, replaced);
}
patched = patched.replace(
  /from "(\.\/[^"\n]+)"/g,
  (_all, path) => `from "file://${join(provider, path)}"`,
);
if (Deno.env.get("CAPTURE_COLLISION_MATCHER_SOURCE")) {
  const matcherPath = join(output, "exact-collision-matcher-snapshot.ts");
  await Deno.writeTextFile(
    matcherPath,
    (await Deno.readTextFile(matcherInput)).replace(
      /from "(\.\/[^"\n]+)"/g,
      (_all, path) => `from "file://${join(provider, path)}"`,
    ),
  );
  patched = patched.replace(
    `from "file://${join(provider, "capture-projections.ts")}"`,
    `from "file://${matcherPath}"`,
  );
}
patched +=
  `\nconst { activeOwner, inspect, preparedSession, runtimeDeclarations, validateOwnerResources, nativeListingPublicationGrants } = (globalThis as any).__captureCollisionPure;
export { build as pureBuild };\n`;
assert(
  patched.slice(
    patched.indexOf("async function build("),
    patched.indexOf("\nfunction receiptPath("),
  ) === exactBuild,
  "test rewrote production builder conditionals",
);
const loadedPath = join(output, "exact-composer-with-pure-import-seams.ts");
await Deno.writeTextFile(loadedPath, patched);
// The unchanged public manifest reader resolves this provider schema beside its
// module. Keep that resource byte-for-byte beside the test-only relocated copy.
await Deno.copyFile(
  join(provider, "navigation-runtime.cue"),
  join(output, "navigation-runtime.cue"),
);

let model: any;
let actualAuthority: any;
const calls: unknown[] = [];
(globalThis as any).__captureCollisionPure = {
  async preparedSession(p: any) {
    if (actualAuthority) return await actualAuthority.preparedSession(p);
    calls.push({ seam: "preparedSession", root: p.root });
    if (p.root === model.root) return model.session;
    assert(p.root === model.book, "unexpected pure owner root");
    return model.childSession;
  },
  async validateOwnerResources(p: any) {
    if (actualAuthority) return await actualAuthority.validateOwnerResources(p);
    calls.push({ seam: "validateOwnerResources", root: p.root });
    if (p.root === model.root) return model.navIndex;
    assert(p.root === model.book, "unexpected pure resource owner root");
    if (!model.complete) {
      throw new OwnerFailure("RESOURCE.INCOMPLETE_RENDER", "PURE fixture");
    }
    return model.childIndex;
  },
  async activeOwner(root: string) {
    if (actualAuthority) return await actualAuthority.activeOwner(root);
    calls.push({ seam: "activeOwner", root, output: model.actualOutput });
    assert(root === model.book, "unexpected pure active owner");
    return { output: model.actualOutput };
  },
  async inspect(source: string, profile: string) {
    if (actualAuthority) return await actualAuthority.inspect(source, profile);
    calls.push({ seam: "inspect", source, profile });
    assert(source === join(model.book, "index.qmd"), "unexpected pure input");
    return model.document;
  },
  async runtimeDeclarations(s: any) {
    if (actualAuthority) return await actualAuthority.runtimeDeclarations(s);
    calls.push({ seam: "runtimeDeclarations", root: s.root });
    return s.root === model.book ? [model.runtime] : [];
  },
  async nativeListingPublicationGrants(p: any) {
    if (actualAuthority) {
      return await actualAuthority.nativeListingPublicationGrants(p);
    }
    calls.push({ seam: "nativeListingPublicationGrants", root: p.root });
    assert(p.root === model.book, "unexpected pure Listing owner root");
    assert(
      model.childSession.nativeListingPlans === undefined,
      "PURE no-Listing fixture unexpectedly supplied Listing plans",
    );
    // These existing PURE fixtures model no Listing producer or grant.
    return [];
  },
};
const { pureBuild } = await import(`file://${loadedPath}`);
async function write(path: string, text: string) {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, text);
}
async function fixture(name: string, options: {
  owner?: boolean;
  alternate?: boolean;
  format?: string;
  collision?: boolean;
  complete?: boolean;
  oldVeto?: boolean;
  portalCollision?: boolean;
  childDenialOnly?: boolean;
}) {
  const base = join(output, name),
    root = join(base, "source"),
    book = join(root, "book"),
    actual = join(base, "actual-output"),
    alternate = join(base, "copied-alternate-output"),
    stage = join(base, "stage"),
    portal = join(base, "actual-portal");
  for (const p of [book, actual, alternate, stage, portal]) {
    await Deno.mkdir(p, { recursive: true });
  }
  const script = "console.log('PURE registered runtime fixture');\n";
  const marked =
    '<script src="site_libs/presentation.js" data-course-runtime-provider="course-presentation" data-course-runtime-asset="presentation.js"></script>';
  const selected = `<html><body>PURE selected HTML ${marked}</body></html>\n`;
  const full = `<html><body>PURE retained full HTML ${marked}</body></html>\n`;
  const projected = options.collision === false ? selected : full;
  for (const dir of [actual, alternate]) {
    await write(join(dir, "index.html"), projected);
    await write(join(dir, "site_libs/presentation.js"), script);
  }
  await write(join(book, "index.qmd"), "# PURE input\n");
  await write(
    join(book, ".course-owner/capture-projections/full/index.html"),
    full,
  );
  await write(join(stage, "book/index.html"), projected);
  await write(join(stage, "book/site_libs/presentation.js"), script);
  const portalBytes = "<html>PURE completed portal fixture</html>\n";
  await write(join(root, "index.qmd"), "# PURE portal input\n");
  await write(join(portal, "index.html"), portalBytes);
  await write(join(stage, "index.html"), portalBytes);
  for (const p of [root, book]) {
    for (const file of ["resources.json", "finished.json"]) {
      await write(join(p, ".course-owner", file), `PURE ${p} ${file}\n`);
    }
  }
  const hash = await digestFile(
    join(book, ".course-owner/capture-projections/full/index.html"),
  );
  const runtimeHash = await digestFile(
    join(actual, "site_libs/presentation.js"),
  );
  const projection = {
    root: book,
    source: "index.qmd",
    sha256: hash,
    native: { artifact: "index.html" },
  };
  const projectionPath = ".course-owner/capture-projections/full/index.html";
  const runtimeSource =
    "_extensions/course-presentation/runtime/presentation.js";
  const runtime = {
    source: runtimeSource,
    sourceSha256: runtimeHash,
    producer: "course-presentation",
    dependency: "course-presentation",
    version: "PURE",
    asset: "presentation.js",
    kind: "script",
    markerProvider: "course-presentation",
    markerAsset: "presentation.js",
  };
  const policy = (path: string, sha256: string) => ({
    path,
    sha256,
    allowed: false,
    reasons: ["service"],
  });
  const childIndex: any = {
    indexHash: "PURE child index",
    invocationId: "PURE complete child invocation",
    files: [
      { path: projectionPath, sha256: hash, captureProjection: projection },
      { path: runtimeSource, sha256: runtimeHash },
    ],
    policy: {
      files: [policy(projectionPath, hash), policy(runtimeSource, runtimeHash)],
    },
  };
  const navIndex: any = {
    indexHash: "PURE navigation index",
    files: childIndex.files.map((f: any) => ({ ...f, path: "book/" + f.path })),
    policy: {
      files: childIndex.policy.files.map((p: any) => ({
        ...p,
        path: "book/" + p.path,
      })),
    },
  };
  if (options.childDenialOnly) {
    navIndex.files = navIndex.files.filter((f: any) => !f.captureProjection);
    navIndex.policy.files = navIndex.policy.files.filter((p: any) =>
      p.sha256 !== hash
    );
  }
  if (options.oldVeto) {
    navIndex.files.push({ path: "closed-answer.qmd", sha256: hash });
    navIndex.policy.files.push({
      ...policy("closed-answer.qmd", hash),
      reasons: ["closed"],
    });
  }
  if (options.portalCollision) {
    const portalHash = await digestFile(join(portal, "index.html")),
      portalProjection = {
        root,
        source: "index.qmd",
        sha256: portalHash,
        native: { artifact: "index.html" },
      };
    navIndex.files.push({
      path: ".course-owner/capture-projections/student/index.html",
      sha256: portalHash,
      captureProjection: portalProjection,
    });
    navIndex.policy.files.push(policy(
      ".course-owner/capture-projections/student/index.html",
      portalHash,
    ));
  }
  const format = options.format || "html";
  const native = {
    files: { input: [join(book, "index.qmd")] },
    extensions: [],
    config: { filters: ["course-core", "course-presentation"] },
  };
  const prepared = {
    root,
    attemptId: "PURE attempt",
    profile: "student",
    sessionId: "PURE root",
    sessionHash: "PURE root hash",
  };
  const child = { ...prepared, root: book, sessionId: "PURE child" };
  model = {
    root,
    book,
    actualOutput: actual,
    complete: options.complete !== false,
    runtime,
    navIndex,
    childIndex,
    document: {
      formats: { [format]: { pandoc: { "output-file": "index.html" } } },
    },
    session: {
      ...prepared,
      files: {},
      audit: {
        profiles: { student: { extensions: [], config: {} } },
        navigation: {
          scope: {
            portal: { input: join(root, "index.qmd"), output: portal },
            members: [{ path: book, mount: "book", format }],
          },
          members: [{ path: "book", native }],
          dormant: [],
        },
      },
    },
    childSession: { ...child, files: {} },
  };
  await write(
    join(root, ".course-owner/navigation-addresses.json"),
    JSON.stringify({
      publicationOutput: stage,
      portalOutput: portal,
      portalArtifact: {
        path: join(portal, "index.html"),
        sha256: await digestFile(join(portal, "index.html")),
      },
    }),
  );
  return {
    prepared,
    stage,
    book,
    hash,
    runtimeHash,
    selected,
    options: {
      output: stage,
      members: [{
        path: book,
        mount: "book",
        format,
        output: options.alternate ? alternate : actual,
        ...(options.owner ? { owner: child } : {}),
      }],
    },
  };
}
const results: unknown[] = [], failures: string[] = [];
for (
  const [name, options, expected] of [
    [
      "omitted-owner-copied-alternate",
      { alternate: true },
      "RESOURCE.PUBLICATION_DENIED_BYTES",
    ],
    [
      "supplied-owner-wrong-actual-output",
      { owner: true, alternate: true },
      "RESOURCE.PUBLICATION_OWNER_CONTEXT_INVALID",
    ],
    [
      "non-html-reveal-selection",
      { owner: true, format: "revealjs" },
      "RESOURCE.PUBLICATION_DENIED_BYTES",
    ],
    [
      "non-html-child-index-denial",
      { owner: true, format: "revealjs", childDenialOnly: true },
      "RESOURCE.PUBLICATION_DENIED_BYTES",
    ],
    [
      "incomplete-child-owner",
      { owner: true, complete: false },
      "RESOURCE.INCOMPLETE_RENDER",
    ],
    ["exact-current-selected-html-model", { owner: true }, "PASS"],
    ["ordinary-runtime-optional-owner", { collision: false }, "PASS"],
    [
      "older-closed-source-veto",
      { owner: true, oldVeto: true },
      "RESOURCE.PUBLICATION_DENIED_BYTES",
    ],
    [
      "root-completed-html-portal-model",
      { owner: true, portalCollision: true },
      "PASS",
    ],
  ] as const
) {
  calls.length = 0;
  const f = await fixture(name, options);
  let observed = "PASS", detail: unknown;
  try {
    const body = await pureBuild(f.prepared, f.options);
    const runtime = body.grants.find((g: any) => g.kind === "runtime");
    assert(
      runtime?.path === "book/site_libs/presentation.js" &&
        runtime.sha256 === f.runtimeHash &&
        runtime.proof.nativeTarget === "site_libs/presentation.js" &&
        runtime.proof.nativeHtmlSha256 === await digestFile(join(
            f.options.members[0].output,
            "index.html",
          )),
      "real parser/native+stage runtime witness missing",
    );
    detail = {
      artifacts: body.artifacts,
      grants: body.grants,
      upstream: body.upstream,
      files: body.files,
    };
  } catch (error) {
    if (!(error instanceof OwnerFailure)) throw error;
    observed = error.code;
    detail = String(error);
  }
  if (observed !== expected) {
    failures.push(`${name}: expected ${expected}, got ${observed}`);
  }
  results.push({ name, expected, observed, calls: [...calls], detail });
  console.log(
    `PURE code-path ${name}: expected=${expected} observed=${observed}`,
  );
}
await Deno.writeTextFile(
  join(output, "pure-code-path-results.json"),
  JSON.stringify(
    {
      evidence:
        "PURE imported authority seams; no actual native invocation or receipt claim",
      source: input,
      sourceHash: await digestFile(input),
      exactBuilderPreserved: true,
      matcherSource: matcherInput,
      matcherHash: await digestFile(matcherInput),
      runtimeAndDiskChecks:
        "unchanged production parser, runtimeWitnesses, canonical paths, no-links and file SHA",
      results,
      failures,
    },
    null,
    2,
  ) + "\n",
);
assert(!failures.length, failures.join("\n"));
console.log(
  "PASS exact-source PURE collision authority code paths; no native-provenance claim",
);

// Optional read-only source-bound compatibility check against retained real
// completed evidence. It neither installs this candidate nor creates a seal.
const currentRoot = Deno.env.get("CAPTURE_COLLISION_CURRENT_ROOT");
if (currentRoot) {
  const roots = [currentRoot, join(currentRoot, "book")];
  const installed = new Map<
    string,
    { owner: any; resources: any; nativeListing: any }
  >();
  for (const root of roots) {
    const base = `file://${root}/_extensions/course-core/owner-preflight/`;
    installed.set(root, {
      owner: await import(base + "owner.ts"),
      resources: await import(base + "resources.ts"),
      nativeListing: await import(base + "native-listing-addresses.ts"),
    });
  }
  const select = (root: string) => {
    const api = installed.get(root);
    assert(api, "unknown actual completed owner root");
    return api;
  };
  actualAuthority = {
    preparedSession: (p: any) => select(p.root).owner.preparedSession(p),
    validateOwnerResources: (p: any) =>
      select(p.root).resources.validateOwnerResources(p),
    activeOwner: (root: string) => select(root).owner.activeOwner(root),
    inspect: (source: string, profile: string) =>
      select(currentRoot).owner.inspect(source, profile),
    runtimeDeclarations: (s: any) =>
      (installed.get(s.root) || select(currentRoot)).resources
        .runtimeDeclarations(s),
    nativeListingPublicationGrants: (p: any) =>
      select(p.root).nativeListing.nativeListingPublicationGrants(p),
  };
  const finished = JSON.parse(
    await Deno.readTextFile(
      join(currentRoot, ".course-owner/finished.json"),
    ),
  );
  const prepared = Object.fromEntries([
    "protocol",
    "root",
    "attemptId",
    "profile",
    "sessionId",
    "sessionPath",
    "sessionHash",
  ].map((k) => [k, finished[k]]));
  const receiptPath = join(
    currentRoot,
    ".course-owner/publication-resources.json",
  );
  const receiptBefore = await digestFile(receiptPath),
    { receiptHash, ...body } = JSON.parse(await Deno.readTextFile(receiptPath));
  const { resourceHash } = select(currentRoot).resources;
  assert(
    await resourceHash(body) === receiptHash,
    "stored actual receipt hash invalid",
  );
  const rebuilt = await pureBuild(prepared, body.options);
  assert(
    await resourceHash(rebuilt) === receiptHash,
    "corrected source-bound builder changed completed transport body",
  );
  assert(
    await digestFile(receiptPath) === receiptBefore,
    "source-bound current compatibility check wrote a new receipt",
  );
  const currentOwners = [];
  for (const member of body.options.members.filter((m: any) => m.owner)) {
    const api = select(member.path),
      index = await api.resources.validateOwnerResources(member.owner),
      active = await api.owner.activeOwner(member.path);
    assert(
      member.format === "html" && active?.output === member.output,
      "actual retained selected HTML output authority absent",
    );
    currentOwners.push({
      member: member.path,
      format: member.format,
      actualOutput: active.output,
      invocationId: index.invocationId,
      indexHash: index.indexHash,
    });
  }
  await Deno.writeTextFile(
    join(output, "actual-current-reflection.json"),
    JSON.stringify(
      {
        evidence:
          "corrected exact source builder over genuine installed completed callbacks; no engine/install/receipt write",
        root: currentRoot,
        sourceHash: await digestFile(input),
        receiptHash,
        receiptFileHash: receiptBefore,
        currentOwners,
        artifacts: rebuilt.artifacts,
        grants: rebuilt.grants,
        versionBoundary:
          "retained previous native transport installation, not a final-tree native transport",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "PASS source-bound corrected composer preserves genuine completed current receipt body; no new engine/install/seal",
  );
}
