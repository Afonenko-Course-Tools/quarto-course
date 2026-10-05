// Pure finite collision cases plus current-byte checks against an actual completed native fixture.
import { join } from "stdlib/path";
import {
  type CaptureProjection,
  sameSourceProjectionArtifact,
} from "../_extensions/course-core/owner-preflight/capture-projections.ts";
import {
  assertCurrentCaptureProjectionMetadata,
  coreServiceResourceFiles,
  type OwnerResourceFile,
  type ResourceFilePolicy,
} from "../_extensions/course-core/owner-preflight/resources.ts";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const hash = "a".repeat(64);
const projection = {
  root: "/owner/book",
  source: "index.qmd",
  sha256: hash,
  native: { artifact: "index.html" },
} as CaptureProjection;
const artifact = {
  format: "html",
  member: "/owner/book",
  source: "index.qmd",
  native: { path: "index.html", sha256: hash },
  stage: { path: "book/index.html", sha256: hash },
};
const match = (
  p = projection,
  a = artifact,
  path = artifact.stage.path,
  sha = hash,
) => sameSourceProjectionArtifact(p, "/owner/book", "index.qmd", a, path, sha);
assert(
  match(),
  "same-source current finite artifact collision predicate refuses exact canonical case",
);
for (
  const [name, a] of [
    ["PDF selection", { ...artifact, format: "pdf" }],
    ["Reveal selection", { ...artifact, format: "revealjs" }],
    ["foreign member", { ...artifact, member: "/owner/foreign" }],
    ["different source", { ...artifact, source: "other.qmd" }],
    ["different writer", {
      ...artifact,
      native: { ...artifact.native, path: "elsewhere/index.html" },
    }],
    ["native substitution", {
      ...artifact,
      native: { ...artifact.native, sha256: "b".repeat(64) },
    }],
    ["stage substitution", {
      ...artifact,
      stage: { ...artifact.stage, sha256: "b".repeat(64) },
    }],
  ] as const
) assert(!match(projection, a), name + " acquired projection exception");
assert(
  !match(projection, artifact, "alias.html"),
  "renamed projection acquired digest grant",
);
assert(
  !match(projection, artifact, "book/site_libs/runtime.js"),
  "runtime alias acquired projection grant",
);
assert(
  !match({ ...projection, root: "/owner/foreign" }),
  "foreign registry acquired projection grant",
);
console.log(
  "PASS pure finite projection collision: exact source/current native+stage/destination only; no alias/member/runtime digest grant (no native provenance claim)",
);
const canonical = {
  path: ".course-owner/capture-projections/student/real-ordinary.html",
  actualPath:
    "/owner/book/.course-owner/capture-projections/student/real-ordinary.html",
  sha256: hash,
  origin: "service",
  producer: "Core native owner session producer",
  role: "other",
  captureProjection: projection,
} as OwnerResourceFile;
const deniedCanonical = [{
  path: canonical.path,
  sha256: hash,
  allowed: false,
  reasons: ["service"],
}] as ResourceFilePolicy[];
assertCurrentCaptureProjectionMetadata(
  [canonical],
  [canonical],
  deniedCanonical,
);
for (
  const forged of [
    {
      ...canonical,
      path: "_extensions/course-core/private-module.ts",
      actualPath: "/owner/book/_extensions/course-core/private-module.ts",
    },
    { ...canonical, path: "private-source.qmd", origin: "source" },
    { ...canonical, captureProjection: { ...projection, source: "other.qmd" } },
    { ...canonical, producer: "caller" },
  ]
) {
  let refused = false;
  try {
    assertCurrentCaptureProjectionMetadata([forged as OwnerResourceFile], [
      canonical,
    ], deniedCanonical);
  } catch (e) {
    refused = String(e).includes(
      "RESOURCE.CAPTURE_PROJECTION_METADATA_CHANGED",
    );
  }
  assert(
    refused,
    "index-supplied projection marker became exception authority",
  );
}
for (
  const policy of [[], [{ ...deniedCanonical[0], allowed: true }], [{
    ...deniedCanonical[0],
    reasons: [],
  }]] as ResourceFilePolicy[][]
) {
  let refused = false;
  try {
    assertCurrentCaptureProjectionMetadata([canonical], [canonical], policy);
  } catch (e) {
    refused = String(e).includes("RESOURCE.CAPTURE_PROJECTION_POLICY_CHANGED");
  }
  assert(refused, "current projection denial replaced by caller policy");
}
console.log(
  "PASS pure current registry tag closure: forged module/source/producer/provenance markers refuse; no native authority claim",
);
const root = Deno.env.get("OWNER_CAPTURE_CONTRACT_ROOT");
if (root) {
  const api = await import(
    `file://${root}/_extensions/course-core/owner-preflight/owner.ts`
  );
  const pub = await import(
    `file://${root}/_extensions/course-core/owner-preflight/publication-resources.ts`
  );
  const childApi = await import(
    `file://${root}/book/_extensions/course-core/owner-preflight/owner.ts`
  );
  async function prepared(owner: string) {
    const f = JSON.parse(
      await Deno.readTextFile(join(owner, ".course-owner/finished.json")),
    );
    return Object.fromEntries(
      [
        "protocol",
        "root",
        "attemptId",
        "profile",
        "sessionId",
        "sessionPath",
        "sessionHash",
      ].map((k) => [k, f[k]]),
    );
  }
  const p = await prepared(root), child = await prepared(join(root, "book"));
  const s = await childApi.preparedSession(child);
  const parentIndex = await api.validateOwnerResources(p),
    childIndex = await childApi.validateOwnerResources(child);
  for (const cp of Object.values(s.captureProjections) as CaptureProjection[]) {
    for (
      const [prefix, index] of [["", childIndex], [
        "book/",
        parentIndex,
      ]] as const
    ) {
      const path = prefix + cp.retainedPath.slice(s.root.length + 1);
      const file = index.files.find((f: any) => f.path === path);
      assert(
        file?.origin === "service" && file.sha256 === cp.sha256 &&
          JSON.stringify(file.captureProjection) === JSON.stringify(cp),
        "current real private projection absent from canonical child/parent index: " +
          path,
      );
      assert(
        index.policy.files.some((f: any) =>
          f.path === path && !f.allowed && f.reasons.includes("service")
        ),
        "private projection became allowed owner resource: " + path,
      );
    }
  }
  // Final source-bound validator reads the same real native/current registry input.
  const sourceCurrent = await coreServiceResourceFiles(
    s,
    [],
    await childApi.activeOwner(s.root),
  );
  assertCurrentCaptureProjectionMetadata(
    childIndex.files,
    sourceCurrent,
    childIndex.policy.files,
  );
  const canonicalCurrent = sourceCurrent.find((f) => f.captureProjection)!;
  const moduleRow = childIndex.files.find((f: any) =>
    f.path === "_extensions/course-core/owner-preflight/capture-projections.ts"
  );
  let forgedCurrentRefused = false;
  try {
    assertCurrentCaptureProjectionMetadata(
      [
        ...childIndex.files.map((f: any) =>
          f === moduleRow
            ? { ...f, captureProjection: canonicalCurrent.captureProjection }
            : f
        ),
      ],
      sourceCurrent,
      childIndex.policy.files,
    );
  } catch (e) {
    forgedCurrentRefused = String(e).includes(
      "RESOURCE.CAPTURE_PROJECTION_METADATA_CHANGED",
    );
  }
  assert(
    forgedCurrentRefused,
    "same actual current index input accepted forged imported-module projection marker",
  );
  const current = () => pub.validateNavigationPublicationResources(p);
  await current();
  const failures: { name: string; failure: string }[] = [];
  async function mutation(
    name: string,
    path: string,
    mutate: (bytes: Uint8Array) => Uint8Array | undefined,
    codes: string[],
  ) {
    const original = await Deno.readFile(path);
    try {
      const changed = mutate(original);
      if (changed) await Deno.writeFile(path, changed);
      else await Deno.remove(path);
      try {
        await current();
      } catch (e) {
        assert(codes.some((c) => String(e).includes(c)), name + ": " + e);
        failures.push({ name, failure: String(e) });
        console.log(
          "PASS current mutation " + name + ": " +
              String(e).match(/[A-Z]+\.[A-Z_]+/)?.[0] || String(e),
        );
        return;
      }
      throw new Error("current publication accepted " + name);
    } finally {
      await Deno.writeFile(path, original);
    }
  }
  const cp = Object.values(s.captureProjections)[0] as CaptureProjection;
  const encode = (s: string) => new TextEncoder().encode(s);
  await mutation(
    "missing retained projection",
    cp.retainedPath,
    () => undefined,
    ["SOURCE.CAPTURE_PROJECTION_CHANGED", "RESOURCE.BYTES_CHANGED"],
  );
  const extra = join(
    s.root,
    ".course-owner/capture-projections",
    "unknown.html",
  );
  try {
    await Deno.writeTextFile(extra, "unknown capture projection");
    let refused = false;
    try {
      await current();
    } catch (e) {
      refused = String(e).includes("SOURCE.CAPTURE_PROJECTION_CHANGED");
    }
    assert(
      refused,
      "unknown retained producer artifact escaped exact finite registry",
    );
  } finally {
    await Deno.remove(extra);
  }
  await mutation(
    "mutated retained projection",
    cp.retainedPath,
    () => encode("changed projection"),
    ["SOURCE.CAPTURE_PROJECTION_CHANGED", "RESOURCE.BYTES_CHANGED"],
  );
  await mutation(
    "manifest substitution",
    join(s.root, ".course-owner/capture-projections.json"),
    () => encode("{}"),
    ["SOURCE.CAPTURE_PROJECTION_CHANGED", "RESOURCE.BYTES_CHANGED"],
  );
  await mutation(
    "new imported helper module",
    join(
      s.root,
      "_extensions/course-core/owner-preflight/capture-projections.ts",
    ),
    () => encode("// changed helper"),
    ["SOURCE.FROZEN_INPUT_CHANGED"],
  );
  await mutation("raw reader AST changed", cp.capturePath, () => encode("{}"), [
    "SOURCE.BASELINE_CHANGED",
    "SOURCE.HEADER_IDENTITY_CHANGED",
    "RESOURCE.BYTES_CHANGED",
  ]);
  for (
    const field of [
      "source",
      "profile",
      "channel",
      "invocationId",
      "native",
      "emitted",
      "capturePath",
    ] as const
  ) {
    await mutation(
      "session projection " + field,
      child.sessionPath as string,
      (bytes) => {
        const changed = JSON.parse(new TextDecoder().decode(bytes));
        const record = Object.values(changed.captureProjections)[0] as any;
        record[field] = field === "native"
          ? { ...record.native, outputDirectory: "/foreign" }
          : field === "emitted"
          ? []
          : "foreign";
        return encode(JSON.stringify(changed));
      },
      [
        "SOURCE.CAPTURE_PROJECTION_CHANGED",
        "SOURCE.INVALID_ATTEMPT",
        "RESOURCE.BYTES_CHANGED",
      ],
    );
  }
  await current();
  console.log(
    "PASS exact current real retained projections denied in both indexes; missing/hash/manifest/helper/raw/session provenance mutations refuse and restore without engines",
  );
  const report = Deno.env.get("OWNER_CAPTURE_CONTRACT_REPORT");
  if (report) {
    await Deno.writeTextFile(
      report,
      JSON.stringify({
        schema: "actual-capture-projection-current-contract-v1",
        root,
        p,
        child,
        projections: s.captureProjections,
        parentIndexHash: parentIndex.indexHash,
        childIndexHash: childIndex.indexHash,
        failures,
        restoredCurrent: true,
        finalSourceMarkerGuardSameActualInput: forgedCurrentRefused,
      }),
    );
  }
}
