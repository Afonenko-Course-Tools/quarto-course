import {
  dirname,
  fromFileUrl,
  isAbsolute,
  join,
  relative,
  resolve,
} from "stdlib/path";
import {
  activeOwner,
  assertFrozen,
  digestFile,
  evaluate,
  exists,
  inspectOwnerDownloads,
  type Invocation,
  OwnerFailure,
  type PreparedOwner,
  preparedSession,
  type Session,
  sha,
} from "./owner.ts";
export interface ResourceUse {
  kind: "Link" | "Image";
  target: string;
  order: number;
  nativePlot?: boolean;
}
export interface ResourceObservation {
  source: string;
  profile: "student" | "full";
  phase: "capture" | "render";
  effectiveBase: string;
  outputDirectory?: string;
  outputFile?: string;
  raw: ResourceUse[];
  projected: ResourceUse[];
  opaque?: string[];
}
export interface ResolvedResourceUse extends ResourceUse {
  source: string;
  profile: "student" | "full";
  phase: "capture" | "render";
  projection: "raw" | "projected";
  path: string;
  effectiveBase: string;
}
export interface OwnerResourceFile {
  path: string;
  sha256: string;
  origin: "source" | "generated" | "service";
  actualPath: string;
  producer: string;
  role: "root" | "include" | "resource" | "other";
}
export interface ResourceFilePolicy {
  path: string;
  sha256: string;
  allowed: boolean;
  reasons: string[];
  baselinePublic: boolean;
  baselineSeen: boolean;
  baselineClosedOnly: boolean;
  actualPublic: boolean;
}
export interface ResourceDiagnostic {
  code: string;
  path: string;
  reasons: string[];
}
export interface RuntimeDeclaration {
  source: string;
  sourceSha256: string;
  producer: string;
  dependency: string;
  version: string;
  asset: string;
  kind: "script" | "stylesheet";
  descriptorPath: string;
  descriptorSha256: string;
  registrationPath: string;
  registrationSha256: string;
  markerProvider: string;
  markerAsset: string;
}
export interface RuntimeEligibility
  extends Omit<RuntimeDeclaration, "markerProvider" | "markerAsset"> {
  eligible: boolean;
  reasons: string[];
}
interface ResourcePolicyResult {
  files: ResourceFilePolicy[];
  diagnostics: ResourceDiagnostic[];
  runtimeEligibility: RuntimeEligibility[];
}
export interface OwnerResourceIndex {
  protocol: 1;
  root: string;
  attemptId: string;
  profile: "student" | "full";
  sessionId: string;
  sessionHash: string;
  invocationId: string;
  files: OwnerResourceFile[];
  evidence: { baseline: ResolvedResourceUse[]; actual: ResolvedResourceUse[] };
  policy: { files: ResourceFilePolicy[]; diagnostics: ResourceDiagnostic[] };
  runtimeEligibility: RuntimeEligibility[];
  indexHash: string;
}
const here = dirname(fromFileUrl(import.meta.url));
function fail(code: string, cause: unknown): never {
  throw new OwnerFailure(code, cause);
}
export function resourceRelative(root: string, path: string): string {
  const rel = relative(root, resolve(root, path)).replaceAll("\\", "/");
  if (!rel || rel === ".." || rel.startsWith("../") || isAbsolute(rel)) {
    fail("RESOURCE.OUTSIDE_OWNER", path);
  }
  return rel;
}
export async function resourceNoLinks(root: string, path: string) {
  const rel = resourceRelative(root, path);
  let current = root;
  for (const part of rel.split("/")) {
    current = join(current, part);
    try {
      if ((await Deno.lstat(current)).isSymlink) {
        fail("RESOURCE.SYMLINK_UNSUPPORTED", current);
      }
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) return;
      throw e;
    }
  }
}
export async function resolveResourceTarget(
  root: string,
  observation: ResourceObservation,
  use: ResourceUse,
): Promise<{ path: string; actualPath: string } | undefined> {
  const target = use.target;
  if (
    target.startsWith("#") || target.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(target)
  ) return;
  let decoded: string;
  try {
    decoded = decodeURIComponent(target.split(/[?#]/, 1)[0]);
  } catch {
    fail("RESOURCE.INVALID_URI", target);
  }
  if (!decoded || decoded.includes("\0") || decoded.includes("\\")) {
    fail("RESOURCE.INVALID_URI", target);
  }
  resourceRelative(root, observation.effectiveBase);
  const actualPath = decoded.startsWith("/")
    ? resolve(root, "." + decoded)
    : resolve(root, dirname(observation.effectiveBase), decoded);
  const path = resourceRelative(root, actualPath);
  await resourceNoLinks(root, actualPath);
  if (await exists(actualPath)) {
    if (!(await Deno.stat(actualPath)).isFile) fail("RESOURCE.NOT_FILE", path);
    if (await Deno.realPath(actualPath) !== actualPath) {
      fail("RESOURCE.SYMLINK_UNSUPPORTED", path);
    }
  }
  return { path, actualPath };
}
export async function resourceHash(value: unknown) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(value)),
      ),
    ),
  ).map((n) => n.toString(16).padStart(2, "0")).join("");
}
export async function resourcePolicy(
  profile: "student" | "full",
  baseline: ResolvedResourceUse[],
  actual: ResolvedResourceUse[],
  files: OwnerResourceFile[],
  selections: string[],
  directory: string,
  schema = join(here, "resource-policy.cue"),
  runtime: RuntimeDeclaration[] = [],
  filters: string[] = [],
) {
  const compact = (uses: ResolvedResourceUse[]) =>
    uses.map((
      { source, profile, phase, projection, kind, target, order, path },
    ) => ({ source, profile, phase, projection, kind, target, order, path }));
  return await evaluate(
    {
      profile,
      baseline: compact(baseline),
      actual: compact(actual),
      files: files.map(({ path, sha256, origin, role }) => ({
        path,
        sha256,
        origin,
        role,
      })),
      selections,
      runtime,
      filters,
    },
    directory,
    schema,
  ) as ResourcePolicyResult;
}
export async function runtimeDeclarations(
  s: Session,
): Promise<RuntimeDeclaration[]> {
  const providers = (s.audit.profiles[s.profile].extensions || []).filter((
    extension: any,
  ) => extension.id?.name === "course-presentation");
  if (providers.length > 1) {
    fail(
      "RESOURCE.RUNTIME_PROVIDER_AMBIGUOUS",
      providers.map((x: any) => x.path),
    );
  }
  const result: RuntimeDeclaration[] = [];
  for (const extension of providers) {
    const base = resolve(s.root, extension.path);
    const descriptorPath = resourceRelative(
      s.root,
      join(base, "html-dependency.json"),
    );
    const registrationPath = resourceRelative(s.root, join(base, "filter.lua"));
    if (!s.files[descriptorPath] || !s.files[registrationPath]) {
      fail("RESOURCE.RUNTIME_DECLARATION_UNSUPPORTED", descriptorPath);
    }
    await resourceNoLinks(s.root, join(s.root, descriptorPath));
    const descriptor = JSON.parse(
      await Deno.readTextFile(join(s.root, descriptorPath)),
    );
    if (
      typeof descriptor.name !== "string" ||
      typeof descriptor.version !== "string" ||
      !Array.isArray(descriptor.scripts) ||
      !Array.isArray(descriptor.stylesheets) ||
      Object.keys(descriptor).some((key) =>
        !["name", "version", "scripts", "stylesheets"].includes(key)
      )
    ) fail("RESOURCE.RUNTIME_DECLARATION_UNSUPPORTED", descriptorPath);
    for (
      const [key, kind] of [["scripts", "script"], [
        "stylesheets",
        "stylesheet",
      ]] as const
    ) {
      for (const asset of descriptor[key]) {
        if (
          !asset || typeof asset.path !== "string" || !asset.attribs ||
          typeof asset.attribs["data-course-runtime-provider"] !== "string" ||
          typeof asset.attribs["data-course-runtime-asset"] !== "string"
        ) fail("RESOURCE.RUNTIME_DECLARATION_UNSUPPORTED", asset);
        const path = resourceRelative(base, resolve(base, asset.path));
        if (path !== asset.path) {
          fail("RESOURCE.RUNTIME_DECLARATION_UNSUPPORTED", asset.path);
        }
        const source = resourceRelative(s.root, join(base, path));
        if (!s.files[source]) {
          fail("RESOURCE.RUNTIME_SOURCE_UNPROVEN", source);
        }
        await resourceNoLinks(s.root, join(s.root, source));
        result.push({
          source,
          sourceSha256: s.files[source],
          producer: extension.id.name,
          dependency: descriptor.name,
          version: descriptor.version,
          asset: asset.path,
          kind,
          descriptorPath,
          descriptorSha256: s.files[descriptorPath],
          registrationPath,
          registrationSha256: s.files[registrationPath],
          markerProvider: asset.attribs["data-course-runtime-provider"],
          markerAsset: asset.attribs["data-course-runtime-asset"],
        });
      }
    }
  }
  return result;
}
export async function sourceResourceFiles(
  s: Session,
): Promise<OwnerResourceFile[]> {
  const files: OwnerResourceFile[] = [];
  const producers = new Map<string, string>([[
    s.extension,
    "Core installed extension",
  ]]);
  for (const info of Object.values(s.audit.profiles)) {
    for (const extension of info.extensions || []) {
      const nativePath = resolve(s.root, extension.path);
      const rel = relative(s.root, nativePath).replaceAll("\\", "/");
      if (rel && rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel)) {
        producers.set(rel, "native inspect installed extension");
      }
    }
  }
  for (const [path, sha256] of Object.entries(s.files)) {
    const actualPath = join(s.root, path);
    await resourceNoLinks(s.root, actualPath);
    if (await digestFile(actualPath) !== sha256) {
      fail("RESOURCE.BYTES_CHANGED", path);
    }
    const producer = [...producers].find(([directory]) =>
      path === directory || path.startsWith(directory + "/")
    )?.[1];
    const service = producer !== undefined;
    files.push({
      path,
      sha256,
      actualPath,
      origin: service ? "service" : "source",
      producer: producer || "frozen owner source",
      role: s.audit.coverage[path]?.kind || "other",
    });
  }
  return files;
}
export async function resolveResourceEvidence(
  s: Session,
  observations: ResourceObservation[],
): Promise<ResolvedResourceUse[]> {
  const result: ResolvedResourceUse[] = [];
  for (const observation of observations) {
    if (
      observation.effectiveBase !== observation.source ||
      !s.audit.coverage[observation.source]?.profiles?.includes(
        observation.profile,
      )
    ) fail("RESOURCE.INVALID_OBSERVATION_BASE", observation);
    if (observation.opaque?.length) {
      fail("RESOURCE.OPAQUE_CARRIER_UNSUPPORTED", observation.opaque);
    }
    for (const projection of ["raw", "projected"] as const) {
      for (const use of observation[projection]) {
        const local = await resolveResourceTarget(s.root, observation, use);
        if (!local) {
          continue;
        }
        result.push({
          ...use,
          source: observation.source,
          profile: observation.profile,
          phase: observation.phase,
          projection,
          effectiveBase: observation.effectiveBase,
          path: local.path,
        });
      }
    }
  }
  return result;
}
export async function resourceObservations(
  s: Session,
): Promise<ResourceObservation[]> {
  const result: ResourceObservation[] = [];
  for (const path of Object.values(s.captures)) {
    const doc = JSON.parse(await Deno.readTextFile(path));
    if (!doc.resources) fail("RESOURCE.OBSERVATION_MISSING", path);
    result.push(doc.resources);
  }
  return result;
}
export async function sealGeneratedResources(
  s: Session,
  observation: ResourceObservation,
  output: string,
): Promise<OwnerResourceFile[]> {
  const files: OwnerResourceFile[] = [];
  if (observation.phase !== "render") return files;
  const stem = observation.source.replace(/\.qmd$/, "");
  const expected = stem + "_files/figure-html/";
  for (const use of observation.raw) {
    const local = await resolveResourceTarget(s.root, observation, use);
    if (
      !local || s.files[local.path] || files.some((f) => f.path === local.path)
    ) continue;
    if (!await exists(local.actualPath)) {
      fail("RESOURCE.ACTUAL_TARGET_MISSING", local.path);
    }
    if (
      use.kind !== "Image" || !use.nativePlot ||
      s.audit.profiles[observation.profile]?.fileInformation
          ?.[observation.source]?.metadata?.engine !== "knitr" ||
      !s.audit.profiles[observation.profile]?.fileInformation
        ?.[observation.source]?.codeCells?.some((cell: any) =>
          cell.language === "r"
        ) ||
      !local.path.startsWith(expected) ||
      !/^[-a-zA-Z0-9_.]+\.(png|svg|jpg|jpeg|webp)$/.test(
        local.path.slice(expected.length),
      )
    ) fail("RESOURCE.GENERATED_PRODUCER_UNSUPPORTED", local.path);
    const sha256 = await digestFile(local.actualPath);
    files.push({
      path: local.path,
      sha256,
      origin: "generated",
      role: "other",
      actualPath: resolve(output, local.path),
      producer: "native cell-output-display figure-html",
    });
  }
  return files;
}
export async function nativeResourceSelections(s: Session): Promise<string[]> {
  const paths: string[] = [];
  async function add(path: string) {
    const actualPath = resolve(s.root, path);
    await resourceNoLinks(s.root, actualPath);
    const info = await Deno.stat(actualPath);
    if (info.isDirectory) {
      for await (const entry of Deno.readDir(actualPath)) {
        await add(join(actualPath, entry.name));
      }
    } else if (info.isFile) paths.push(resourceRelative(s.root, actualPath));
    else fail("RESOURCE.NOT_FILE", path);
  }
  for (const path of s.audit.profiles[s.profile].files.resources || []) {
    await add(path);
  }
  return [...new Set(paths)].sort();
}
export async function earlyResourceGate(s: Session) {
  const baseline = await resolveResourceEvidence(
    s,
    await resourceObservations(s),
  );
  const files = [
    ...await sourceResourceFiles(s),
    ...await coreServiceResourceFiles(s),
  ];
  const policy = await resourcePolicy(
    s.profile,
    baseline,
    [],
    files,
    await nativeResourceSelections(s),
    join(s.root, ".course-owner"),
    join(s.root, s.extension, "owner-preflight/resource-policy.cue"),
  );
  if (policy.diagnostics.length) fail("RESOURCE.POLICY_DENIED", policy);
}
export async function sealResourceObservation(
  s: Session,
  identity: Invocation,
  observation: ResourceObservation,
) {
  const baseline = await resolveResourceEvidence(
    s,
    await resourceObservations(s),
  );
  const actual = await resolveResourceEvidence(s, [observation]);
  const generated = await sealGeneratedResources(
    s,
    observation,
    identity.output,
  );
  const files = [
    ...await sourceResourceFiles(s),
    ...await coreServiceResourceFiles(s, [], identity),
    ...generated,
  ];
  for (const use of actual) {
    if (!files.some((f) => f.path === use.path)) {
      fail("RESOURCE.GENERATED_PRODUCER_UNSUPPORTED", use.path);
    }
  }
  const policy = await resourcePolicy(
    s.profile,
    baseline,
    actual,
    files,
    [],
    join(s.root, ".course-owner"),
    join(s.root, s.extension, "owner-preflight/resource-policy.cue"),
  );
  if (policy.diagnostics.length) fail("RESOURCE.POLICY_DENIED", policy);
  return {
    protocol: 1,
    invocationId: identity.invocationId,
    source: observation.source,
    generated,
    actual,
  };
}
export async function coreServiceResourceFiles(
  s: Session,
  ownedRequests: { path: string; sha256: string }[] = [],
  invocation?: Invocation,
): Promise<OwnerResourceFile[]> {
  const paths = [
    "_generated/course-spec/course.json",
    "_generated/course-spec/course-candidate.json",
    ".course-owner/session.json",
    ".course-owner/preparation.json",
    ...Object.values(s.captures).map((path) => resourceRelative(s.root, path)),
  ];
  for (const [path, role] of Object.entries(s.audit.coverage)) {
    if (role.kind === "root") {
      paths.push(`_generated/course-spec/core/${await sha(path)}.json`);
      if (invocation && role.profiles?.includes(invocation.profile)) {
        const key = await sha(invocation.profile + ":" + path);
        paths.push(
          `.course-owner/render/${invocation.profile}/${await sha(path)}.json`,
          `.course-owner/result-${key}.json`,
          `.course-owner/resource-seal-${key}.json`,
        );
      }
    }
  }
  if (invocation) {
    paths.push(
      ".course-owner/active.json",
      ".course-owner/render-invocation.json",
      `.course-owner/guard-${invocation.invocationId}.json`,
    );
  }
  const known = new Set(paths);
  async function checkProducerArea(directory: string) {
    if (!await exists(directory)) return;
    await resourceNoLinks(s.root, directory);
    for await (const entry of Deno.readDir(directory)) {
      const absolute = join(directory, entry.name);
      await resourceNoLinks(s.root, absolute);
      if (entry.isDirectory) await checkProducerArea(absolute);
      else if (
        !entry.isFile || !known.has(resourceRelative(s.root, absolute))
      ) {
        fail(
          "RESOURCE.SERVICE_PRODUCER_UNSUPPORTED",
          resourceRelative(s.root, absolute),
        );
      }
    }
  }
  await checkProducerArea(join(s.root, "_generated/course-spec"));
  const files: OwnerResourceFile[] = [];
  for (const path of paths) {
    const actualPath = join(s.root, path);
    if (await exists(actualPath)) {
      await resourceNoLinks(s.root, actualPath);
      files.push({
        path,
        sha256: await digestFile(actualPath),
        origin: "service",
        actualPath,
        producer: path.startsWith(".course-owner/")
          ? "Core native owner session producer"
          : "Core native model producer",
        role: "other",
      });
    }
  }
  for (const request of ownedRequests) {
    const path = resourceRelative(s.root, request.path);
    await resourceNoLinks(s.root, request.path);
    if (await digestFile(request.path) !== request.sha256) {
      fail("RESOURCE.BYTES_CHANGED", path);
    }
    files.push({
      path,
      sha256: request.sha256,
      origin: "service",
      actualPath: request.path,
      producer:
        "Download public inspectOwnerDownloads/inspectOwnedRequests ownership API",
      role: "other",
    });
  }
  return files;
}
export async function checkResourceFiles(
  files: OwnerResourceFile[],
  root: string,
  output: string,
) {
  for (const file of files) {
    const base = file.origin === "generated" ? output : root;
    if (await Deno.realPath(base) !== base) {
      fail("RESOURCE.SYMLINK_UNSUPPORTED", base);
    }
    await resourceNoLinks(base, file.actualPath);
    if (
      !await exists(file.actualPath) ||
      await digestFile(file.actualPath) !== file.sha256
    ) fail("RESOURCE.BYTES_CHANGED", file.path);
  }
}
export interface ResourceSeal {
  protocol: 1;
  invocationId: string;
  source: string;
  generated: OwnerResourceFile[];
  actual: ResolvedResourceUse[];
}
export async function writeResourceIndex(
  p: PreparedOwner,
  s: Session,
  a: Invocation,
  seals: ResourceSeal[],
  ownedRequests: { path: string; sha256: string }[] = [],
): Promise<OwnerResourceIndex> {
  const baseline = await resolveResourceEvidence(
    s,
    await resourceObservations(s),
  );
  const actual = seals.flatMap((seal) => seal.actual);
  const byPath = new Map<string, OwnerResourceFile>();
  for (
    const file of [
      ...await sourceResourceFiles(s),
      ...await coreServiceResourceFiles(s, ownedRequests, a),
      ...seals.flatMap((seal) => seal.generated),
    ]
  ) {
    const previous = byPath.get(file.path);
    if (previous && previous.sha256 !== file.sha256) {
      fail("RESOURCE.CONFLICTING_BYTES", file.path);
    }
    byPath.set(file.path, file);
  }
  const files = [...byPath.values()].sort((a, b) =>
    a.path.localeCompare(b.path)
  );
  await checkResourceFiles(files, s.root, a.output);
  const checked = await resourcePolicy(
    s.profile,
    baseline,
    actual,
    files,
    await nativeResourceSelections(s),
    join(s.root, ".course-owner"),
    join(s.root, s.extension, "owner-preflight/resource-policy.cue"),
    await runtimeDeclarations(s),
    s.audit.profiles[s.profile].config.filters,
  );
  const { runtimeEligibility, ...policy } = checked;
  if (policy.diagnostics.length) fail("RESOURCE.POLICY_DENIED", policy);
  const body = {
    protocol: 1 as const,
    root: p.root,
    attemptId: p.attemptId,
    profile: p.profile,
    sessionId: p.sessionId,
    sessionHash: p.sessionHash,
    invocationId: a.invocationId,
    files,
    evidence: { baseline, actual },
    policy,
    runtimeEligibility,
  };
  const index: OwnerResourceIndex = {
    ...body,
    indexHash: await resourceHash(body),
  };
  await Deno.writeTextFile(
    join(p.root, ".course-owner/resources.json"),
    JSON.stringify(index),
    { createNew: true },
  );
  await Deno.writeTextFile(
    join(p.root, ".course-owner/finished.json"),
    JSON.stringify({
      ...p,
      invocationId: a.invocationId,
      indexHash: index.indexHash,
      output: a.output,
    }),
    { createNew: true },
  );
  return index;
}
export async function validateOwnerResources(
  p: PreparedOwner,
  options: { selections?: string[] } = {},
): Promise<OwnerResourceIndex> {
  const s = await preparedSession(p), a = await activeOwner(p.root);
  const marker = join(p.root, ".course-owner/finished.json"),
    path = join(p.root, ".course-owner/resources.json");
  if (
    !a || a.phase !== "render" || !await exists(marker) || !await exists(path)
  ) fail("RESOURCE.FINISH_REQUIRED", p.sessionId);
  await resourceNoLinks(p.root, marker);
  await resourceNoLinks(p.root, path);
  const finished = JSON.parse(await Deno.readTextFile(marker));
  if (
    Object.keys(p).some((key) =>
      finished[key] !== p[key as keyof PreparedOwner]
    ) || finished.invocationId !== a.invocationId ||
    finished.output !== a.output
  ) fail("RESOURCE.INVALID_INDEX", finished);
  await assertFrozen(p.sessionPath);
  const index = JSON.parse(await Deno.readTextFile(path)) as OwnerResourceIndex;
  const { indexHash, ...body } = index;
  if (
    indexHash !== finished.indexHash ||
    await resourceHash(body) !== indexHash ||
    ["root", "attemptId", "profile", "sessionId", "sessionHash"].some((key) =>
      (body as any)[key] !== p[key as keyof PreparedOwner]
    ) || body.invocationId !== a.invocationId
  ) fail("RESOURCE.INDEX_CHANGED", path);
  await checkResourceFiles(index.files, s.root, a.output);
  const downloads = await inspectOwnerDownloads(p);
  for (
    const current of await coreServiceResourceFiles(
      s,
      downloads?.files || [],
      a,
    )
  ) {
    if (
      !index.files.some((file) =>
        file.path === current.path && file.sha256 === current.sha256 &&
        file.origin === "service"
      )
    ) fail("RESOURCE.SERVICE_SET_CHANGED", current.path);
  }
  const selections = (options.selections || []).map((selection) => {
    if (
      isAbsolute(selection) || resourceRelative(s.root, selection) !== selection
    ) fail("RESOURCE.INVALID_SELECTION", selection);
    return selection;
  });
  const policy = await resourcePolicy(
    s.profile,
    index.evidence.baseline,
    index.evidence.actual,
    index.files,
    selections,
    join(s.root, ".course-owner"),
    join(s.root, s.extension, "owner-preflight/resource-policy.cue"),
    await runtimeDeclarations(s),
    s.audit.profiles[s.profile].config.filters,
  );
  if (
    await resourceHash(policy.runtimeEligibility) !==
      await resourceHash(index.runtimeEligibility)
  ) fail("RESOURCE.RUNTIME_ELIGIBILITY_CHANGED", path);
  if (policy.diagnostics.length) fail("RESOURCE.POLICY_DENIED", policy);
  return index;
}
