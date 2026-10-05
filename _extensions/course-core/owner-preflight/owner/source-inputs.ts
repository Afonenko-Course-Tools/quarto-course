/** Transient finite native input closure. Opaque inputs retain full native audits. */
import { dirname, isAbsolute, join, relative, resolve } from "stdlib/path";
import { isAlias, parseDocument } from "../../body-export/vendor/libraries.js";
import {
  NativeListingProviderFailure,
  resolveNativeListingProvider,
} from "../native-listing-provider.ts";
import { OwnerFailure } from "./failure.ts";
import { digestFile, objectHash, quarto } from "./runtime.ts";
import { fileList } from "./source-audit.ts";
import type { Audit } from "./protocol.ts";

class OpaqueInput extends Error {}
function opaque(detail = "unclosed native input"): never {
  throw new OpaqueInput(detail);
}
const contains = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel);
};
function yaml(source: string): unknown {
  const doc = parseDocument(source, { uniqueKeys: true, version: "1.2" });
  if (!doc || doc.errors.length || doc.warnings.length) {
    opaque("ambiguous YAML");
  }
  const inspect = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (isAlias(node) || node.tag) opaque("YAML alias/tag");
    for (const item of node.items || []) {
      inspect(item);
      inspect(item.key);
      inspect(item.value);
    }
  };
  inspect(doc.contents);
  return doc.toJS({ maxAliasCount: 0 });
}
async function manifest(audit: Audit) {
  const envelopes = [
    ...Object.values(audit.profiles),
    ...(audit.navigation?.members || []).map((member) => member.native),
    ...(audit.navigation?.dormant || []).map((member) => member.native),
  ];
  if (
    envelopes.some((info: any) =>
      !Array.isArray(info.engines) ||
      info.engines.some((engine: unknown) => engine !== "markdown")
    )
  ) opaque("non-markdown engine");
  if (
    envelopes.some((info: any) =>
      Object.values(info.fileInformation || {}).some((file: any) =>
        file.codeCells?.length
      )
    )
  ) opaque("nonempty executable code cells");
  const environment = Deno.env.toObject();
  if (Deno.build.os !== "linux") opaque("unproved host temp/launcher platform");
  if (
    Object.keys(environment).some((name) =>
      [
        "BASH_ENV",
        "ENV",
        "SHELLOPTS",
        "BASHOPTS",
        "LD_PRELOAD",
        "LD_LIBRARY_PATH",
        "LD_AUDIT",
      ].includes(name) ||
      name.startsWith("BASH_FUNC_") || name.startsWith("DYLD_")
    )
  ) opaque("shell/loader execution override");
  if (
    [
      "QUARTO_LOG",
      "QUARTO_REPORT_PERFORMANCE_METRICS_FILE",
      "QUARTO_COMBINED_LUA_PROFILE",
    ].some((name) => environment[name] !== undefined)
  ) {
    opaque("native diagnostic path override");
  }
  const provider = await resolveNativeListingProvider(quarto, {
    cwd: audit.root,
  });
  if (!["1.10.18", "1.11.5"].includes(provider.version)) {
    opaque("native version outside proved optimization class");
  }
  const facts: Record<string, string> = {};
  const kindMode = (kind: string, info: Deno.FileInfo) =>
    kind + ":" + info.mode + ":" + info.uid + ":" + info.gid;
  const tempRoot = environment.TMPDIR === undefined
    ? "/tmp"
    : environment.TMPDIR;
  if (!isAbsolute(tempRoot)) opaque("noncanonical native temp root");
  const temp = await Deno.lstat(tempRoot);
  if (
    !temp.isDirectory || temp.isSymlink ||
    await Deno.realPath(tempRoot) !== resolve(tempRoot)
  ) opaque("noncanonical native temp root");
  facts[tempRoot] = kindMode("temp-directory", temp);
  for (const file of provider.files) {
    facts[file.path] = "runtime:" + file.sha256 + ":" +
      kindMode("file", await Deno.lstat(file.path));
    let path = dirname(file.path);
    while (path !== dirname(path)) {
      facts[path] = kindMode("directory", await Deno.lstat(path));
      path = dirname(path);
    }
  }
  facts[audit.root] = kindMode("directory", await Deno.lstat(audit.root));
  const visited = new Set<string>();
  const parsed = new Set<string>();
  const nativeConfigs = new Set(
    envelopes.flatMap((info: any) =>
      (info.files?.config || []).map((path: string) =>
        resolve(info.dir || audit.root, path)
      )
    ),
  );
  async function metadataFile(path: string, bases: string[]) {
    bases = [...new Set([dirname(path), ...bases])].sort();
    const context = JSON.stringify([path, bases]);
    if (parsed.has(context)) return;
    parsed.add(context);
    if (/^_environment(?:[.-]|$)/.test(path.split("/").at(-1)!)) {
      opaque("project dotenv input");
    }
    await metadata(yaml(await Deno.readTextFile(path)), bases);
  }
  const excluded = (path: string) =>
    audit.excluded.some((entry) => {
      const target = resolve(audit.root, entry);
      return path === target || contains(target, path);
    });
  for (const name of ["env", "bash", "dirname", "basename", "uname"]) {
    const candidates = name === "env"
      ? ["/usr/bin/env"]
      : (environment.PATH || "").split(":").map((entry) =>
        resolve(audit.root, entry || ".", name)
      );
    let selected: string | undefined;
    for (const candidate of candidates) {
      try {
        const info = await Deno.stat(candidate);
        if (info.isFile && info.mode !== null && (info.mode & 0o111)) {
          selected = candidate;
          break;
        }
      } catch (error) {
        if (
          !(error instanceof Deno.errors.NotFound) &&
          !(error instanceof Deno.errors.NotADirectory)
        ) throw error;
      }
    }
    if (
      !selected ||
      await Deno.realPath(selected) !== await Deno.realPath("/usr/bin/" + name)
    ) opaque("unknown host launcher command: " + name);
    const actual = await Deno.realPath(selected);
    const stat = await Deno.lstat(actual);
    if (!stat.isFile || stat.isSymlink) {
      opaque("unknown host executable: " + name);
    }
    facts[selected] = "host:" + actual + ":" + kindMode("file", stat) + ":" +
      await digestFile(actual);
    for (const start of [selected, actual]) {
      let path = dirname(start);
      while (path !== dirname(path)) {
        const info = await Deno.lstat(path);
        facts[path] = kindMode(info.isSymlink ? "link" : "directory", info) +
          (info.isSymlink ? ":" + await Deno.readLink(path) : "");
        path = dirname(path);
      }
    }
  }
  async function tree(root: string, omit: boolean) {
    for await (const entry of Deno.readDir(root)) {
      const path = join(root, entry.name);
      if (omit && excluded(path)) continue;
      if (entry.isSymlink) {
        if (omit || !contains(provider.sharePath, path)) {
          opaque("noncanonical tree entry: " + path);
        }
        const target = await Deno.realPath(path);
        if (
          !contains(provider.sharePath, target) ||
          !(await Deno.lstat(target)).isFile
        ) opaque("unclosed stock link: " + path);
        facts[path] = kindMode("link", await Deno.lstat(path)) + ":" +
          await Deno.readLink(path) + ":" + target + ":" +
          await digestFile(target);
        continue;
      }
      if (entry.isDirectory) {
        facts[path] = kindMode("directory", await Deno.lstat(path));
        await tree(path, omit);
      } else if (entry.isFile) {
        // Source bytes have the independent frozen file verifier. Stock defaults
        // are outside Source, so bind their complete inventory and content too.
        facts[path] = kindMode("file", await Deno.lstat(path)) +
          (omit ? "" : ":" + await digestFile(path));
      } else opaque("nonregular input: " + path);
    }
  }
  await tree(audit.root, true);
  await tree(provider.sharePath, false);
  const projects = [
    ...Object.values(audit.profiles).map((info: any) => info.dir || audit.root),
    ...(audit.navigation?.members || []).map((member) =>
      resolve(audit.root, member.path)
    ),
    ...(audit.navigation?.dormant || []).map((member) =>
      resolve(audit.root, member.path)
    ),
  ];
  const projectRoots = [...new Set(projects)];
  const basesFor = (
    path: string,
  ) => [
    dirname(path),
    ...projectRoots.filter((root) => contains(root, path)).sort((a, b) =>
      b.length - a.length
    ).slice(0, 1),
  ];
  async function external(path: string, bases: string[]) {
    bases = [...new Set([dirname(path), ...bases])].sort();
    const context = JSON.stringify([path, bases]);
    if (visited.has(context)) return;
    visited.add(context);
    // Bind every traversed ancestor's kind; symlink or nonregular path semantics
    // are deliberately not admitted by this finite closure.
    let ancestor = dirname(path);
    while (ancestor !== dirname(ancestor)) {
      try {
        const info = await Deno.lstat(ancestor);
        if (info.isSymlink) opaque("noncanonical reference: " + path);
        facts[ancestor] = kindMode(
          info.isDirectory ? "directory" : "other",
          info,
        );
      } catch (error) {
        if (
          !(error instanceof Deno.errors.NotFound) &&
          !(error instanceof Deno.errors.NotADirectory)
        ) throw error;
        facts[ancestor] = "absent";
      }
      ancestor = dirname(ancestor);
    }
    let info: Deno.FileInfo;
    try {
      info = await Deno.lstat(path);
    } catch (error) {
      if (
        !(error instanceof Deno.errors.NotFound) &&
        !(error instanceof Deno.errors.NotADirectory)
      ) throw error;
      facts[path] = "absent";
      return;
    }
    if (info.isSymlink) opaque("noncanonical reference: " + path);
    if (info.isFile) {
      facts[path] = kindMode("file", info) + ":" + await digestFile(path);
      if (/\.ya?ml$/i.test(path)) {
        await metadataFile(path, bases);
      } // Imported external styles/templates are an opaque dependency class.
      else if (
        /\.(?:css|scss|sass|html|tex)$/i.test(path) &&
        /@(?:import|use|forward)|url\s*\(|\{\{|\$\{|\\(?:input|include)\b/.test(
          await Deno.readTextFile(path),
        )
      ) opaque("external style/template references: " + path);
    } else if (info.isDirectory) {
      facts[path] = kindMode("directory", await Deno.lstat(path));
      await tree(path, false);
    } else opaque("nonregular input: " + path);
  }
  async function metadata(
    value: unknown,
    bases: string[],
    keys: string[] = [],
  ) {
    if (keys.at(-1) === "engine") opaque("explicit engine declaration");
    if (keys.at(-1) === "engines") {
      const builtin = join(
        provider.sharePath,
        "extension-subtrees/julia-engine/_extensions/julia-engine/julia-engine.js",
      );
      if (
        !Array.isArray(value) || value.length !== 1 ||
        JSON.stringify(value[0]) !== JSON.stringify({ path: builtin })
      ) opaque("custom engine declaration");
      const expected = provider.version === "1.10.18"
        ? "67e58a4d11c26af5c5f03cb2b957ece51c8684aab512cd9ef9c50663e7077d34"
        : "102441ca08084ea1eccc23be860ee6d3487a950a866052f7632829ec92d50df6";
      if (await digestFile(builtin) !== expected) {
        opaque("changed builtin engine module");
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) await metadata(item, bases, keys);
      return;
    }
    if (value && typeof value === "object") {
      for (const [name, item] of Object.entries(value)) {
        await metadata(item, bases, [...keys, name]);
      }
      return;
    }
    if (
      typeof value !== "string" ||
      JSON.stringify(keys) === '["project","output-dir"]'
    ) return;
    if (/\{\{|\$\{|\x00/.test(value)) {
      opaque("dynamic metadata scalar: " + keys.join("."));
    }
    for (const base of bases) {
      const path = resolve(base, value);
      if (excluded(path)) opaque("reference into mutable exclusion: " + path);
      if (contains(audit.root, path)) {
        if (
          /\.ya?ml$/i.test(path) ||
          ["metadata-file", "metadata-files"].includes(keys.at(-1) || "")
        ) {
          try {
            if ((await Deno.lstat(path)).isFile) {
              await metadataFile(path, bases);
            }
          } catch (error) {
            if (
              !(error instanceof Deno.errors.NotFound) &&
              !(error instanceof Deno.errors.NotADirectory)
            ) throw error;
          }
        }
        continue;
      }
      if (contains(provider.sharePath, path)) continue;
      if (/[*?\[\]{}]/.test(value)) opaque("external glob: " + path);
      await external(path, bases);
    }
  }
  const files = await fileList(audit.root, audit.excluded);
  for (const file of files) {
    const path = join(audit.root, file);
    if (/\.(?:css|scss|sass)$/i.test(file)) {
      const source = await Deno.readTextFile(path);
      const references = [
        ...source.matchAll(
          /url\s*\(\s*([^)]*?)\s*\)|@(?:import|use|forward)\s+["']([^"']*)["']/gi,
        ),
      ];
      for (const reference of references) {
        const target = (reference[1] || reference[2]).trim().replace(
          /^["']|["']$/g,
          "",
        );
        if (/^(?:https?:|data:|#)/i.test(target)) continue;
        if (/\$|#\{|\{\{/.test(target)) {
          opaque("dynamic stylesheet reference: " + path);
        }
        const actual = resolve(dirname(path), target);
        if (
          (!contains(audit.root, actual) &&
            !contains(provider.sharePath, actual)) || excluded(actual)
        ) opaque("unclosed stylesheet reference: " + actual);
      }
    }
    const basename = file.split("/").at(-1)!;
    if (
      nativeConfigs.has(path) ||
      /^_(?:quarto.*|metadata|variables|language.*|brand|extension)\.ya?ml$/i
        .test(basename) ||
      /^_environment(?:[.-]|$)/.test(basename)
    ) {
      await metadataFile(path, basesFor(path));
    } else if (file.endsWith(".qmd")) {
      const source = await Deno.readTextFile(path);
      const front =
        /^(?:\uFEFF)?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/
          .exec(source);
      if (front) {
        await metadata(yaml(front[1]), basesFor(path));
      } else if (/^(?:\uFEFF)?---/.test(source)) {
        opaque("external style/template references: " + path);
      }
    }
  }
  for (const envelope of envelopes) {
    const project = (envelope as any).dir || audit.root;
    await metadata((envelope as any).config, [
      project,
    ]);
    for (
      const [file, information] of Object.entries(
        (envelope as any).fileInformation || {},
      )
    ) {
      await metadata((information as any).metadata, [
        dirname(resolve(project, file)),
        project,
      ]);
    }
    for (const path of (envelope as any).files?.config || []) {
      if (
        !contains(audit.root, resolve(path)) &&
        !contains(provider.sharePath, resolve(path))
      ) {
        await external(resolve((envelope as any).dir || audit.root, path), [
          (envelope as any).dir || audit.root,
        ]);
      }
    }
  }
  return {
    provider: provider.sha256,
    denoPath: provider.denoPath,
    facts: Object.fromEntries(
      Object.entries(facts).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}

/** Undefined means full native revalidation, not unsupported Source. */
export interface SourceInputGuard {
  sha256: string;
  denoPath: string;
  verify: () => Promise<void>;
}
export async function sourceInputGuard(
  audit: Audit,
  onOpaque?: (detail: string) => void,
): Promise<SourceInputGuard | undefined> {
  let expected: string;
  let denoPath: string;
  try {
    const initial = await manifest(audit);
    expected = await objectHash(initial);
    denoPath = initial.denoPath;
  } catch (error) {
    onOpaque?.(String(error));
    return;
  }
  return {
    sha256: expected,
    denoPath,
    verify: async () => {
      let current: string;
      try {
        current = await objectHash(await manifest(audit));
      } catch (error) {
        if (
          error instanceof OpaqueInput ||
          error instanceof NativeListingProviderFailure
        ) {
          throw new OwnerFailure(
            "SOURCE.CONFIGURATION_CHANGED",
            "native input closure changed",
          );
        }
        throw error;
      }
      if (current !== expected) {
        throw new OwnerFailure(
          "SOURCE.CONFIGURATION_CHANGED",
          "native input closure changed",
        );
      }
    },
  };
}

/** Actual pinned stock KV initialization semantics; unknown classes use native audits. */
export async function nativeCacheInputs(
  audit: Audit,
  guard: SourceInputGuard | undefined,
): Promise<string | undefined> {
  if (
    !guard || Deno.execPath() !== guard.denoPath ||
    Deno.version.deno !== "2.7.14" ||
    typeof (Deno as any).openKv !== "function"
  ) return;
  const projects = [
    ...new Set([
      ...Object.values(audit.profiles).map((info: any) =>
        info.dir || audit.root
      ),
      ...(audit.navigation?.members || []).map((member) =>
        resolve(audit.root, member.path)
      ),
      ...(audit.navigation?.dormant || []).map((member) =>
        resolve(audit.root, member.path)
      ),
    ]),
  ];
  const facts: Record<string, unknown> = {};
  try {
    for (const root of projects) {
      const paths = [
        root,
        join(root, ".quarto"),
        join(root, ".quarto/project-cache"),
        join(root, ".quarto/project-cache/deno-kv-file"),
      ];
      const pathFacts = async () => {
        const result = [];
        const binding = [];
        for (const path of paths) {
          const info = await Deno.lstat(path);
          if (
            info.isSymlink || await Deno.realPath(path) !== path ||
            (path === paths.at(-1) ? !info.isFile : !info.isDirectory)
          ) opaque("unknown native cache path");
          result.push([path, info.mode, info.uid, info.gid]);
          binding.push([path, info.dev, info.ino]);
        }
        return { signature: result, binding };
      };
      const before = await pathFacts();
      const kv = await (Deno as any).openKv(paths.at(-1));
      try {
        // Both pinned stock constructors return without reading lazy memoized
        // rows for this recognized version. No Sass path runs during inspect.
        const version = await kv.get(["version"]);
        if (version.value !== "1") return;
        facts[root] = { paths: before.signature, version: version.value };
      } finally {
        kv.close();
      }
      if (JSON.stringify(before) !== JSON.stringify(await pathFacts())) return;
    }
  } catch {
    return;
  }
  return await objectHash(
    Object.fromEntries(
      Object.entries(facts).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}
