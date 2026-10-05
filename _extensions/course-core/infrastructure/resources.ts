import { dirname, extname, join, relative, resolve } from "stdlib/path";
import { child } from "./files.ts";
export interface ResourceFacts {
  source: string;
  format: string;
  view?: "student" | "full";
  effectiveBase: string;
  outputDirectory: string;
  outputFile: string;
  rawUses: string[];
  projectedUses: string[];
}
export interface ResourceFile {
  source: string;
  path: string;
  target: string;
  effectiveBase: string;
}
const local = (s: string) => s && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(s);
const clean = (s: string) => decodeURIComponent(s.split(/[?#]/)[0]);
const service = (s: string) =>
  /(^|\/)(?:\.[^/]+|_extensions|_freeze|_generated)(\/|$)/.test(s) ||
  /\.(?:qmd|rmd|ipynb|ya?ml|lua|ts|cue|r|py|sh|toml)$/i.test(s);
export async function evaluateResources(
  options: {
    facts: ResourceFacts[];
    selected: string[];
    availableFiles?: string[];
    projectRoot: string;
  },
): Promise<{ files: ResourceFile[]; diagnostics: string[] }> {
  const root = await Deno.realPath(options.projectRoot),
    raw = new Set<string>(),
    visible = new Set<string>();
  const resolveUse = (f: ResourceFacts, s: string) =>
    s.startsWith("/")
      ? resolve(root, clean(s).slice(1))
      : resolve(f.effectiveBase, clean(s));
  for (const f of options.facts) {
    for (const s of f.rawUses.filter(local)) raw.add(resolveUse(f, s));
    for (const s of f.projectedUses.filter(local)) {
      visible.add(resolveUse(f, s));
    }
  }
  const physical = async (paths: Set<string>) => {
    const result = new Set<string>();
    for (const path of paths) {
      try {
        result.add(await Deno.realPath(path));
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
      }
    }
    return result;
  };
  const rawPhysical = await physical(raw),
    visiblePhysical = await physical(visible);
  const files: ResourceFile[] = [];
  for (const selected of [...new Set(options.selected)]) {
    if (!local(selected)) continue;
    const path = child(
      root,
      selected.startsWith("/") ? selected.slice(1) : clean(selected),
    );
    const name = relative(root, path).replaceAll("\\", "/");
    if (service(name) || raw.has(path) && !visible.has(path)) {
      throw Error("RESOURCE.PRIVATE_OR_SOURCE: " + selected);
    }
    const real = await Deno.realPath(path);
    child(root, real);
    if (
      service(relative(root, real).replaceAll("\\", "/")) ||
      rawPhysical.has(real) && !visiblePhysical.has(real)
    ) throw Error("RESOURCE.PRIVATE_OR_SOURCE: " + selected);
    if (!(await Deno.stat(real)).isFile) {
      throw Error("RESOURCE.NOT_FILE: " + selected);
    }
    if (
      options.availableFiles &&
      !options.availableFiles.map((x) => resolve(root, x)).includes(path)
    ) throw Error("RESOURCE.NOT_AVAILABLE: " + selected);
    const fact = options.facts.find((f) =>
      f.projectedUses.some((u) => local(u) && resolveUse(f, u) === path)
    );
    files.push({
      source: fact?.source || name,
      path: real,
      target: name,
      effectiveBase: fact?.effectiveBase || dirname(path),
    });
  }
  return { files, diagnostics: [] };
}
