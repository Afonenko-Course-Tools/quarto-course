// Opt-in internal owner attempt. Public Course/Fragment remain unchanged.
import {
  dirname,
  fromFileUrl,
  isAbsolute,
  join,
  relative,
  resolve,
} from "stdlib/path";
export class OwnerFailure extends Error {
  constructor(public code: string, public override cause: unknown) {
    super(`${code}: ${JSON.stringify(cause)}`);
  }
}
export const quarto = Deno.env.get("QUARTO") || "quarto";
const here = dirname(fromFileUrl(import.meta.url));
const decoder = new TextDecoder();
export async function invoke(
  executable: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
) {
  const r = await new Deno.Command(executable, {
    args,
    cwd,
    env,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    exitCode: r.code,
    stdout: decoder.decode(r.stdout),
    stderr: decoder.decode(r.stderr),
  };
}
function inside(root: string, path: string): string {
  const rel = relative(root, resolve(root, path));
  if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) {
    throw new OwnerFailure("SOURCE.OUTSIDE_OWNER", path);
  }
  return rel.replaceAll("\\", "/");
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
export async function inspect(root: string, profile: string) {
  const cwd = (await Deno.stat(root)).isDirectory ? root : dirname(root);
  const r = await invoke(quarto, ["inspect", root, "--profile", profile], cwd);
  if (r.exitCode) throw new OwnerFailure("SOURCE.INSPECT_FAILED", r);
  return JSON.parse(r.stdout);
}
export interface Coverage {
  kind: "root" | "include" | "resource";
  profiles?: string[];
  evidence: unknown;
}
export interface Audit {
  root: string;
  profiles: Record<string, any>;
  coverage: Record<string, Coverage>;
  excluded: string[];
  dependencies: Record<string, string>;
}
async function fileList(root: string, excluded: string[]): Promise<string[]> {
  const paths: string[] = [];
  async function visit(dir: string) {
    for await (const entry of Deno.readDir(dir)) {
      const path = join(dir, entry.name), rel = inside(root, path);
      if (excluded.some((x) => rel === x || rel.startsWith(x + "/"))) continue;
      if (entry.isSymlink) {
        throw new OwnerFailure("SOURCE.SYMLINK_UNSUPPORTED", rel);
      }
      if (entry.isDirectory) await visit(path);
      else if (entry.isFile) paths.push(rel);
    }
  }
  await visit(root);
  return paths.sort();
}
export async function auditOwner(
  input: string,
  delivery?: string,
): Promise<Audit> {
  const root = await Deno.realPath(input);
  const profiles: Record<string, any> = {},
    coverage: Record<string, Coverage> = {};
  const excluded = [
    ".git",
    ".quarto",
    "_freeze",
    ".course-owner",
    "_generated/course-spec",
  ];
  for (const profile of ["student", "full"]) {
    if (!await exists(join(root, `_quarto-${profile}.yml`))) {
      throw new OwnerFailure("SOURCE.MISSING_PROFILE", profile);
    }
    const info = await inspect(root, profile);
    profiles[profile] = info;
    const project = info.config.project;
    if (!["default", "website", "book"].includes(project.type || "default")) {
      throw new OwnerFailure("SOURCE.PROJECT_TYPE_UNSUPPORTED", project.type);
    }
    if (project["output-dir"]) {
      const out = inside(root, project["output-dir"]);
      if (!out) throw new OwnerFailure("SOURCE.UNISOLATED_OUTPUT", out);
      excluded.push(out);
    } else throw new OwnerFailure("SOURCE.OUTPUT_DIR_REQUIRED", profile);
    const hooks = project["pre-render"] || [];
    const guard = delivery
      ? delivery + "/entrypoints/owner-freeze.ts"
      : relative(root, join(here, "../entrypoints/owner-freeze.ts")).replaceAll(
        "\\",
        "/",
      );
    // In an installed consumer `here` is inside that owner. Never add/reorder hooks silently.
    if (
      hooks.at(-1) !== guard ||
      hooks.filter((x: string) => x === guard).length !== 1
    ) {
      throw new OwnerFailure("SOURCE.FREEZE_GUARD_NOT_LAST", {
        profile,
        expected: guard,
        hooks,
      });
    }
    const filters = info.config.filters || [];
    if (
      JSON.stringify(filters) !==
        JSON.stringify(["course-core", "course-presentation"]) &&
      JSON.stringify(filters) !== JSON.stringify(["course-core"])
    ) throw new OwnerFailure("SOURCE.FILTER_ORDER_UNSUPPORTED", filters);
    for (const path of info.files.input) {
      const rel = inside(root, path);
      if (!rel.endsWith(".qmd")) {
        throw new OwnerFailure("SOURCE.INPUT_FORMAT_UNSUPPORTED", rel);
      }
      const resolvedDocument = await inspect(path, profile);
      const documentFilters = resolvedDocument.formats?.html?.pandoc?.filters;
      if (JSON.stringify(documentFilters) !== JSON.stringify(filters)) {
        throw new OwnerFailure("SOURCE.DOCUMENT_FILTERS_UNSUPPORTED", {
          source: rel,
          profile,
          filters: documentFilters,
        });
      }
      const previous = coverage[rel];
      if (previous && previous.kind !== "root") {
        throw new OwnerFailure("SOURCE.AMBIGUOUS_QMD", rel);
      }
      coverage[rel] = {
        kind: "root",
        profiles: [...(previous?.profiles || []), profile],
        evidence: "quarto inspect files.input",
      };
    }
  }
  // Register all roots first; then resolve only native inspect include/resource edges.
  for (const [profile, info] of Object.entries(profiles)) {
    for (const facts of Object.values(info.fileInformation) as any[]) {
      for (const edge of facts.includeMap || []) {
        const source = resolve(root, edge.source),
          target = resolve(dirname(source), edge.target),
          rel = inside(root, target);
        if (!await exists(target)) {
          throw new OwnerFailure("SOURCE.INCLUDE_NOT_RESOLVED", edge);
        }
        if (coverage[rel]?.kind === "root") {
          throw new OwnerFailure("SOURCE.AMBIGUOUS_QMD", {
            path: rel,
            roles: ["root", "include"],
          });
        }
        coverage[rel] = { kind: "include", evidence: { profile, edge } };
      }
    }
    for (const path of info.files.resources || []) {
      const rel = inside(root, path), actual = join(root, rel);
      if (!await exists(actual)) {
        throw new OwnerFailure("SOURCE.RESOURCE_NOT_RESOLVED", path);
      }
      const entries = (await Deno.stat(actual)).isDirectory
        ? await fileList(actual, [])
        : [""];
      for (const child of entries) {
        const resource = child ? inside(root, join(actual, child)) : rel;
        if (!resource.endsWith(".qmd")) continue;
        if (coverage[resource] && coverage[resource].kind !== "resource") {
          throw new OwnerFailure("SOURCE.AMBIGUOUS_QMD", {
            path: resource,
            roles: [coverage[resource].kind, "resource"],
          });
        }
        coverage[resource] = { kind: "resource", evidence: { profile, path } };
      }
    }
  }
  // Freeze every externally located file exposed by the public inspect dependency list.
  // Runtime packages and arbitrary dynamic reads are outside this finite dependency proof.
  const dependencies: Record<string, string> = {};
  for (const info of Object.values(profiles)) {
    for (const path of info.files.config || []) inside(root, path);
    for (const path of info.files.configResources || []) {
      const actual = resolve(root, path);
      if (!(await Deno.stat(actual)).isFile) {
        throw new OwnerFailure("SOURCE.DEPENDENCY_NOT_FILE", actual);
      }
      dependencies[actual] = await digestFile(actual);
    }
  }
  const installedPayloads: string[] = [];
  for (const info of Object.values(profiles)) {
    for (const extension of info.extensions || []) {
      const rel = relative(root, resolve(root, extension.path));
      if (rel && rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel)) {
        installedPayloads.push(rel.replaceAll("\\", "/"));
      }
    }
  }
  const uniqueExcluded = [...new Set(excluded)];
  for (const path of await fileList(root, uniqueExcluded)) {
    if (installedPayloads.some((p) => path.startsWith(p + "/"))) continue; // native installed payload, frozen by bytes below
    if (path.endsWith(".qmd") && !coverage[path]) {
      throw new OwnerFailure("SOURCE.UNCOVERED_QMD", path);
    }
  }
  return { root, profiles, coverage, excluded: uniqueExcluded, dependencies };
}
export async function fingerprint(audit: Audit) {
  const files: Record<string, string> = {};
  for (const path of await fileList(audit.root, audit.excluded)) {
    files[path] = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          await Deno.readFile(join(audit.root, path)),
        ),
      ),
    ).map((n) => n.toString(16).padStart(2, "0")).join("");
  }
  return files;
}
export interface Session {
  root: string;
  extension: string;
  audit: Audit;
  files: Record<string, string>;
  validated: boolean;
  captures: Record<string, string>;
  captureHashes: Record<string, string>;
}
export async function sessionAt(path: string): Promise<Session> {
  try {
    const s = JSON.parse(await Deno.readTextFile(path));
    if (
      !s.root || !s.files || !s.audit || !s.extension || !s.captures ||
      !s.captureHashes || typeof s.validated !== "boolean"
    ) throw new Error("missing fields");
    if (
      await Deno.realPath(s.root) !== s.root ||
      resolve(s.root, ".course-owner/session.json") !== resolve(path)
    ) throw new Error("wrong owner session path");
    return s;
  } catch (error) {
    throw new OwnerFailure("SOURCE.INVALID_ATTEMPT", String(error));
  }
}
async function digestFile(path: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await Deno.readFile(path)),
    ),
  ).map((n) => n.toString(16).padStart(2, "0")).join("");
}
async function assertCaptures(s: Session) {
  if (!s.validated) return;
  for (const [key, path] of Object.entries(s.captures)) {
    if (
      !s.captureHashes[key] || !await exists(path) ||
      await digestFile(path) !== s.captureHashes[key]
    ) throw new OwnerFailure("SOURCE.BASELINE_CHANGED", key);
  }
}
export async function assertFrozen(path: string) {
  const s = await sessionAt(path);
  await assertCaptures(s);
  const audit = await auditOwner(s.root, s.extension);
  if (JSON.stringify(audit) !== JSON.stringify(s.audit)) {
    throw new OwnerFailure("SOURCE.CONFIGURATION_CHANGED", s.root);
  }
  const files = await fingerprint(audit);
  const changed = [...new Set([...Object.keys(s.files), ...Object.keys(files)])]
    .filter((p) => s.files[p] !== files[p]);
  if (changed.length) {
    throw new OwnerFailure("SOURCE.FROZEN_INPUT_CHANGED", changed);
  }
}
async function sha(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value)),
    ),
  ).map((n) => n.toString(16).padStart(2, "0")).join("");
}
export async function evaluate(
  input: unknown,
  directory: string,
  schema = join(here, "reconcile.cue"),
) {
  const path = join(directory, `cue-${crypto.randomUUID()}.json`);
  await Deno.writeTextFile(path, JSON.stringify({ input }));
  const cue = Deno.env.get("CUE") || "cue";
  const vet = await invoke(
    cue,
    ["vet", schema, path, "-d", "#Transport", "-c"],
    directory,
  );
  if (vet.exitCode) throw new OwnerFailure("SOURCE.INVALID_ATTEMPT_FACTS", vet);
  const exported = await invoke(cue, [
    "export",
    schema,
    path,
    "-e",
    "report",
    "--out",
    "json",
  ], directory);
  if (exported.exitCode) {
    throw new OwnerFailure("SOURCE.RECONCILIATION_TOOL_FAILED", exported);
  }
  return JSON.parse(exported.stdout);
}
export async function reconcile(sessionPath: string, actualPath: string) {
  const s = await sessionAt(sessionPath);
  if (!s.validated) {
    throw new OwnerFailure("SOURCE.UNVALIDATED_ATTEMPT", sessionPath);
  }
  await assertCaptures(s);
  const actual = JSON.parse(await Deno.readTextFile(actualPath));
  const profile = Deno.env.get("COURSE_OWNER_PROFILE") || "";
  const key = profile + ":" + actual.source, baseline = s.captures[key];
  if (!baseline) throw new OwnerFailure("SOURCE.BASELINE_MISSING", key);
  const before = JSON.parse(await Deno.readTextFile(baseline));
  const report = await evaluate({
    mode: "reconcile",
    before: [before],
    after: [actual],
  }, join(s.root, ".course-owner"));
  const result = report.diagnostics.length
    ? { status: "failure", code: "CORE.DECLARATION_DRIFT", ...report }
    : { status: "ok", source: actual.source };
  await Deno.writeTextFile(
    join(s.root, ".course-owner", `result-${await sha(key)}.json`),
    JSON.stringify(result),
  );
  return result;
}
export async function runOwner(
  input: string,
  profile: "student" | "full",
  options: { env?: Record<string, string> } = {},
) {
  let stage = "";
  try {
    if (!["student", "full"].includes(profile)) {
      throw new OwnerFailure("SOURCE.PROFILE_UNSUPPORTED", profile);
    }
    const original = await auditOwner(input);
    const extension = inside(original.root, dirname(here));
    stage = join(
      await Deno.makeTempDir({ prefix: "course-owner-attempt-" }),
      "owner",
    );
    await Deno.mkdir(stage, { recursive: true });
    for (const path of await fileList(original.root, original.excluded)) {
      await Deno.mkdir(dirname(join(stage, path)), { recursive: true });
      await Deno.copyFile(join(original.root, path), join(stage, path));
    }
    const audit = await auditOwner(stage, extension);
    const state = join(stage, ".course-owner");
    await Deno.mkdir(state);
    const sessionPath = join(state, "session.json");
    const session: Session = {
      root: stage,
      extension,
      audit,
      files: await fingerprint(audit),
      validated: false,
      captures: {},
      captureHashes: {},
    };
    const save = () => Deno.writeTextFile(sessionPath, JSON.stringify(session));
    await save();
    const env = {
      ...options.env,
      COURSE_CHECK_ACTIVE: "1",
      COURSE_OWNER_SESSION: sessionPath,
      COURSE_OWNER_QUARTO: quarto,
      COURSE_OWNER_HELPER: join(
        stage,
        extension,
        "entrypoints/owner-reconcile.ts",
      ),
    };
    const captures: any[] = [];
    for (const audience of ["student", "full"]) {
      for (const sourcePath of audit.profiles[audience].files.input) {
        const source = inside(stage, sourcePath), key = audience + ":" + source;
        const r = await invoke(
          quarto,
          [
            "render",
            source,
            "--profile",
            audience,
            "--to",
            "html",
            "--no-execute",
            "--no-cache",
          ],
          stage,
          {
            ...env,
            COURSE_OWNER_PHASE: "capture",
            COURSE_OWNER_PROFILE: audience,
          },
        );
        await Deno.writeTextFile(
          join(state, `capture-${await sha(key)}.log`),
          JSON.stringify(r),
        );
        if (r.exitCode) {
          throw new OwnerFailure("SOURCE.CAPTURE_FAILED", r);
        }
        const capture = join(
          state,
          "capture",
          audience,
          await sha(source) + ".json",
        );
        if (!await exists(capture)) {
          throw new OwnerFailure("SOURCE.CAPTURE_MISSING", {
            source,
            audience,
          });
        }
        session.captures[key] = capture;
        const raw = JSON.parse(await Deno.readTextFile(capture));
        if (!captures.some((d) => d.source === raw.source)) captures.push(raw);
        else {
          const matching = captures.find((d) => d.source === raw.source);
          const same = await evaluate(
            { mode: "reconcile", before: [matching], after: [raw] },
            state,
            join(stage, extension, "owner-preflight/reconcile.cue"),
          );
          if (same.diagnostics.length) {
            throw new OwnerFailure("SOURCE.PROFILE_DECLARATIONS_DIFFER", same);
          }
        }
        await assertFrozen(sessionPath);
      }
    }
    const checked = await evaluate(
      { mode: "inventory", before: captures, after: [] },
      state,
      join(stage, extension, "owner-preflight/reconcile.cue"),
    );
    if (checked.diagnostics.length) {
      return {
        exitCode: 1,
        stage,
        report: { code: "CORE.INVENTORY_INVALID", ...checked },
      };
    }
    // Freeze capture artifacts as well; final guard checks the validated baseline bytes.
    for (const [key, path] of Object.entries(session.captures)) {
      session.captureHashes[key] = await digestFile(path);
    }
    session.validated = true;
    await save();
    for (
      const out of new Set(
        Object.values(audit.profiles).map((x: any) =>
          x.config.project["output-dir"]
        ),
      )
    ) {
      if (await exists(join(stage, out))) {
        await Deno.remove(join(stage, out), { recursive: true });
      }
    }
    await assertFrozen(sessionPath);
    const rendered = await invoke(
      quarto,
      [
        "render",
        ".",
        "--profile",
        profile,
        "--to",
        "html",
        "--execute",
        "--no-cache",
        "--no-execute-daemon",
      ],
      stage,
      { ...env, COURSE_OWNER_PHASE: "render", COURSE_OWNER_PROFILE: profile },
    );
    await Deno.writeTextFile(
      join(state, "render.log"),
      JSON.stringify(rendered),
    );
    const reports = [];
    for await (const entry of Deno.readDir(state)) {
      if (entry.name.startsWith("result-")) {
        reports.push(
          JSON.parse(await Deno.readTextFile(join(state, entry.name))),
        );
      }
    }
    const failure = reports.find((r) => r.status !== "ok");
    if (failure) return { exitCode: 1, stage, report: failure };
    if (await exists(join(state, "guard-failure.json"))) {
      return {
        exitCode: 2,
        stage,
        report: JSON.parse(
          await Deno.readTextFile(join(state, "guard-failure.json")),
        ),
      };
    }
    if (rendered.exitCode) {
      throw new OwnerFailure("SOURCE.RENDER_FAILED", rendered);
    }
    for (const source of audit.profiles[profile].files.input) {
      if (!reports.some((r) => r.source === inside(stage, source))) {
        throw new OwnerFailure("SOURCE.RECONCILIATION_MISSING", source);
      }
    }
    await assertFrozen(sessionPath);
    return {
      exitCode: 0,
      stage,
      report: {
        status: "ok",
        profile,
        coverage: audit.coverage,
        outputs: audit.profiles[profile].config.project["output-dir"],
      },
    };
  } catch (error) {
    return {
      exitCode: 2,
      stage,
      report: {
        status: "failure",
        code: error instanceof OwnerFailure
          ? error.code
          : "INTERNAL.OWNER_PREFLIGHT",
        cause: error instanceof OwnerFailure ? error.cause : String(error),
      },
    };
  }
}
