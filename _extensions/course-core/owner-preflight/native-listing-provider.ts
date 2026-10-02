// Internal stock constructor binding. This is never Source or resource permission.
import { dirname, isAbsolute, join, relative, resolve } from "stdlib/path";
import pinned from "./native-listing-providers.json" with { type: "json" };

export type NativeListingProviderVersion = "1.10.18" | "1.11.5";
export interface NativeListingProviderFileFact {
  relative: string;
  bytes: number;
  sha256: string;
}
export interface NativeListingProviderFile
  extends NativeListingProviderFileFact {
  path: string;
}
export interface NativeListingProviderCatalog {
  id: string;
  version: NativeListingProviderVersion;
  archive: { assetId: number; url: string; bytes: number; sha256: string };
  reader: {
    explicitDataDir: boolean;
    dataDirConstruction: "inline" | "helper";
  };
  files: NativeListingProviderFileFact[];
}
export interface NativeListingProviderPaths {
  executable: string;
  binPath: string;
  sharePath: string;
  denoPath: string;
  pandocPath: string;
  domPath: string;
}
export interface NativeListingProviderAsset extends NativeListingProviderFile {
  librarySubpath: string;
}
export interface NativeListingProviderBinding
  extends NativeListingProviderPaths {
  schema: "course-native-listing-provider-v1";
  version: NativeListingProviderVersion;
  files: NativeListingProviderFile[];
  reader: {
    path: string;
    dataDir: string;
    explicitDataDir: boolean;
    dataDirConstruction: "inline" | "helper";
  };
  assets: {
    listMin: NativeListingProviderAsset;
    listingJS: NativeListingProviderAsset;
    htmlJS: NativeListingProviderAsset;
  };
  launchEnvironment: Record<string, string>;
  sha256: string;
}
export interface NativeListingProviderOptions {
  cwd?: string;
  // Actual child-command overrides, never an assertion of provider identity.
  env?: Record<string, string>;
}
export class NativeListingProviderFailure extends Error {
  readonly code = "LISTING.NATIVE_PROVIDER_UNSUPPORTED";
  constructor(detail: string) {
    super(`LISTING.NATIVE_PROVIDER_UNSUPPORTED: ${detail}`);
    this.name = "NativeListingProviderFailure";
  }
}
const catalogs = pinned.providers as NativeListingProviderCatalog[];
function refuse(detail: string): never {
  throw new NativeListingProviderFailure(detail);
}

// A pure catalog classification is not a binding or native provenance witness.
export function matchNativeListingProviderCatalog(
  facts: readonly NativeListingProviderFileFact[],
): NativeListingProviderCatalog {
  const byName = new Map<string, NativeListingProviderFileFact>();
  for (const fact of facts) {
    if (
      !fact || typeof fact.relative !== "string" ||
      !Number.isSafeInteger(fact.bytes) || fact.bytes < 0 ||
      typeof fact.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(fact.sha256) ||
      byName.has(fact.relative)
    ) refuse("ambiguous or malformed critical file set");
    byName.set(fact.relative, fact);
  }
  const matches = catalogs.filter((catalog) =>
    facts.length === catalog.files.length && catalog.files.every((expected) => {
      const actual = byName.get(expected.relative);
      return actual?.bytes === expected.bytes &&
        actual.sha256 === expected.sha256;
    })
  );
  if (matches.length !== 1) {
    refuse("unknown or changed stock critical file set");
  }
  return structuredClone(matches[0]);
}

const pathEnvironment = {
  QUARTO_BIN_PATH: "binPath",
  QUARTO_SHARE_PATH: "sharePath",
  QUARTO_DENO: "denoPath",
  QUARTO_PANDOC: "pandocPath",
  QUARTO_DENO_DOM: "domPath",
} as const;
// Paths here have already been resolved independently by the filesystem loader.
export function assertNativeListingProviderEnvironment(
  paths: NativeListingProviderPaths,
  env: Record<string, string | undefined>,
): void {
  for (const [key, field] of Object.entries(pathEnvironment)) {
    const value = env[key];
    // A defined empty SHARE redirects the release launcher. Empty tool vars do not.
    if (
      value !== undefined && (value !== "" || key === "QUARTO_SHARE_PATH") &&
      value !== paths[field as keyof NativeListingProviderPaths]
    ) {
      refuse(`mixed or redirected ${key}`);
    }
  }
  if (env.QUARTO_DEV_MODE === "true") refuse("development execution mode");
  for (
    const key of [
      "QUARTO_FORCE_VERSION",
      "QUARTO_IMPORT_MAP_ARG",
      "QUARTO_DENO_EXTRA_OPTIONS",
      "QUARTO_DENO_V8_OPTIONS",
      "QUARTO_TS_PROFILE",
      "QUARTO_LUA_CPATH",
    ]
  ) {
    if (env[key]) refuse(`unsupported effective execution override ${key}`);
  }
  // Release launcher replaces TARGET/ACTION/DENO_OPTIONS, so their inherited
  // presence is not a redirect. Generated canonical stock child vars are allowed.
}

function canonicalJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${
      Object.keys(value).sort().map((key) =>
        `${JSON.stringify(key)}:${
          canonicalJSON((value as Record<string, unknown>)[key])
        }`
      ).join(",")
    }}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) refuse("non-JSON binding fact");
  return encoded;
}
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(bytes).buffer,
  );
  return Array.from(
    new Uint8Array(digest),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
async function presentFile(path: string): Promise<boolean> {
  try {
    return (await Deno.stat(path)).isFile;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}
async function selectedExecutable(
  executable: string,
  cwd: string,
  env: Record<string, string>,
): Promise<string> {
  if (!executable || /[\0\r\n]/.test(executable)) {
    refuse("invalid executable token");
  }
  const candidates = isAbsolute(executable) || executable.includes("/")
    ? [resolve(cwd, executable)]
    : (env.PATH || "").split(":").map((dir) =>
      join(resolve(cwd, dir || "."), executable)
    );
  for (const candidate of candidates) {
    let info: Deno.FileInfo;
    try {
      info = await Deno.stat(candidate);
    } catch (error) {
      if (
        error instanceof Deno.errors.NotFound ||
        error instanceof Deno.errors.NotADirectory
      ) continue;
      throw error;
    }
    if (!info.isFile || !info.mode || (info.mode & 0o111) === 0) continue;
    // Choose the first executable, then validate it. Never search past an unknown one.
    return await Deno.realPath(candidate);
  }
  refuse("requested executable is unavailable");
}
async function fileFact(
  root: string,
  name: string,
): Promise<NativeListingProviderFile> {
  const path = join(root, name);
  const info = await Deno.lstat(path);
  if (!info.isFile || info.isSymlink) {
    refuse(`nonregular critical file ${name}`);
  }
  const real = await Deno.realPath(path);
  const rel = relative(root, real);
  if (
    rel === ".." || rel.startsWith("../") || isAbsolute(rel) || real !== path
  ) {
    refuse(`noncanonical or outside critical file ${name}`);
  }
  const bytes = await Deno.readFile(real);
  if (bytes.byteLength !== info.size) {
    refuse(`critical file changed during read ${name}`);
  }
  return {
    relative: name,
    path: real,
    bytes: bytes.byteLength,
    sha256: await sha256(bytes),
  };
}
async function canonicalEnvironment(
  paths: NativeListingProviderPaths,
  env: Record<string, string>,
  cwd: string,
): Promise<Record<string, string>> {
  const normalized = { ...env };
  for (const key of Object.keys(pathEnvironment)) {
    if (!env[key]) continue;
    let path = resolve(cwd, env[key]);
    if (key === "QUARTO_PANDOC" && (await Deno.stat(path)).isDirectory) {
      path = join(path, "pandoc");
    }
    normalized[key] = await Deno.realPath(path);
  }
  assertNativeListingProviderEnvironment(paths, normalized);
  const effective: Record<string, string> = {};
  for (const [key, field] of Object.entries(pathEnvironment)) {
    effective[key] = paths[field as keyof NativeListingProviderPaths];
  }
  return effective;
}
function asset(
  files: NativeListingProviderFile[],
  name: string,
  librarySubpath: string,
): NativeListingProviderAsset {
  const fact = files.find((file) => file.relative === name);
  if (!fact) refuse(`missing asset ${name}`);
  return { ...fact, librarySubpath };
}

async function resolveStockNativeListingProvider(
  executable: string,
  options: NativeListingProviderOptions = {},
): Promise<NativeListingProviderBinding> {
  if (Deno.build.os !== "linux" || Deno.build.arch !== "x86_64") {
    refuse("only pinned stock Linux amd64 providers are supported");
  }
  const cwd = resolve(options.cwd || Deno.cwd());
  const env = { ...Deno.env.toObject(), ...options.env };
  const selected = await selectedExecutable(executable, cwd, env);
  const binPath = dirname(selected);
  if (selected !== join(binPath, "quarto") || !binPath.endsWith("/bin")) {
    refuse("unknown stock launcher layout");
  }
  const root = await Deno.realPath(dirname(binPath));
  const paths: NativeListingProviderPaths = {
    executable: selected,
    binPath,
    sharePath: join(root, "share"),
    denoPath: join(binPath, "tools/x86_64/deno"),
    pandocPath: join(binPath, "tools/x86_64/pandoc"),
    domPath: join(binPath, "tools/x86_64/deno_dom/libplugin.so"),
  };
  const launcher = await fileFact(root, "bin/quarto");
  const expectedLauncher = catalogs[0].files.find((file) =>
    file.relative === "bin/quarto"
  )!;
  if (
    launcher.bytes !== expectedLauncher.bytes ||
    launcher.sha256 !== expectedLauncher.sha256
  ) {
    refuse("unknown stock launcher bytes");
  }
  // Exactly the launcher filesystem branch, before calling any public CLI command.
  if (await presentFile(resolve(binPath, "../../../src/quarto.ts"))) {
    refuse("development source fallback");
  }
  const launchEnvironment = await canonicalEnvironment(paths, env, cwd);
  const bundle = await fileFact(root, "bin/quarto.js");
  const candidates = catalogs.filter((catalog) =>
    catalog.files.some((file) =>
      file.relative === bundle.relative && file.bytes === bundle.bytes &&
      file.sha256 === bundle.sha256
    )
  );
  if (candidates.length !== 1) refuse("unknown stock constructor bundle");
  const files: NativeListingProviderFile[] = [];
  for (const expected of candidates[0].files) {
    const actual = expected.relative === launcher.relative
      ? launcher
      : expected.relative === bundle.relative
      ? bundle
      : await fileFact(root, expected.relative);
    if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
      refuse(`changed stock critical file ${expected.relative}`);
    }
    files.push(actual);
  }
  const catalog = matchNativeListingProviderCatalog(files);
  const result = await new Deno.Command(selected, {
    args: ["--paths"],
    cwd,
    env: options.env,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const decoder = new TextDecoder();
  if (
    !result.success || decoder.decode(result.stderr) !== "" ||
    decoder.decode(result.stdout) !== `${binPath}\n${paths.sharePath}\n`
  ) {
    refuse("public --paths disagrees with actual selected filesystem provider");
  }
  // Cross-check path/source facts once more after the subprocess, never --version.
  if (
    await Deno.realPath(selected) !== selected ||
    await presentFile(resolve(binPath, "../../../src/quarto.ts"))
  ) refuse("launcher branch changed");
  for (const file of files) {
    const current = await fileFact(root, file.relative);
    if (
      current.path !== file.path || current.bytes !== file.bytes ||
      current.sha256 !== file.sha256
    ) {
      refuse(`critical file changed after --paths ${file.relative}`);
    }
  }
  const record = {
    schema: "course-native-listing-provider-v1" as const,
    version: catalog.version,
    ...paths,
    files,
    launchEnvironment,
    reader: {
      path: join(paths.sharePath, "filters/qmd-reader.lua"),
      dataDir: join(paths.sharePath, "pandoc/datadir"),
      ...catalog.reader,
    },
    assets: {
      listMin: asset(
        files,
        "share/projects/website/listing/list.min.js",
        "quarto-listing/list.min.js",
      ),
      listingJS: asset(
        files,
        "share/projects/website/listing/quarto-listing.js",
        "quarto-listing/quarto-listing.js",
      ),
      htmlJS: asset(
        files,
        "share/formats/html/quarto.js",
        "quarto-html/quarto.js",
      ),
    },
  };
  return {
    ...record,
    sha256: await sha256(new TextEncoder().encode(canonicalJSON(record))),
  };
}
export async function resolveNativeListingProvider(
  executable: string,
  options: NativeListingProviderOptions = {},
): Promise<NativeListingProviderBinding> {
  try {
    return await resolveStockNativeListingProvider(executable, options);
  } catch (error) {
    if (error instanceof NativeListingProviderFailure) throw error;
    throw new NativeListingProviderFailure(
      `provider filesystem or public CLI failure: ${String(error)}`,
    );
  }
}
export async function validateNativeListingProviderBinding(
  binding: NativeListingProviderBinding,
  options: NativeListingProviderOptions = {},
): Promise<void> {
  if (
    !binding || binding.schema !== "course-native-listing-provider-v1" ||
    typeof binding.executable !== "string" || !isAbsolute(binding.executable)
  ) {
    refuse("malformed internal binding");
  }
  const current = await resolveNativeListingProvider(
    binding.executable,
    options,
  );
  if (canonicalJSON(current) !== canonicalJSON(binding)) {
    refuse("current provider binding differs");
  }
}
