import { dirname, fromFileUrl, join, resolve } from "stdlib/path";
import type { Adapter, Contract } from "../domain/model.ts";
import { child, exists } from "./files.ts";
async function packages(directory: string): Promise<string[]> {
  if (!await exists(directory)) return [];
  const result: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    if (!entry.isDirectory) continue;
    const path = join(directory, entry.name);
    if (await exists(join(path, "contract.json"))) result.push(path);
    else if (!await exists(join(path, "_extension.yml"))) {
      for await (const nested of Deno.readDir(path)) {
        if (nested.isDirectory && await exists(join(path, nested.name, "contract.json"))) result.push(join(path, nested.name));
      }
    }
  }
  return result.sort();
}
export async function adapters(root: string, explicit: string[]): Promise<Adapter[]> {
  const corePath = join(dirname(dirname(fromFileUrl(import.meta.url))), "contract.json");
  const core = JSON.parse(await Deno.readTextFile(corePath));
  const [major, minor] = core.version.split(".").map(Number);
  const paths: string[] = [];
  if (!explicit.length) paths.push(...await packages(join(root, "_extensions")));
  for (const argument of explicit) {
    const path = resolve(argument);
    if (await exists(join(path, "contract.json"))) paths.push(path);
    else paths.push(...await packages(join(path, "_extensions")));
  }
  const result: Adapter[] = [];
  for (const path of paths) {
    const contract: Contract = JSON.parse(await Deno.readTextFile(join(path, "contract.json")));
    if (contract.name === "course-core" || contract.name === "reference-catalog") continue;
    if (!/^[a-z][a-z0-9-]*$/.test(contract.name) || contract.name === "manual") throw new Error(`Invalid adapter name: ${contract.name}`);
    const requested = /^(\d+)\.(\d+)$/.exec(contract.requires_core);
    if (!requested || Number(requested[1]) !== major || Number(requested[2]) > minor) {
      throw new Error(`Adapter ${contract.name} requires core API ${contract.requires_core}; installed ${core.version}`);
    }
    child(path, contract.rules);
    if (result.some(a => a.contract.name === contract.name)) throw new Error(`Duplicate adapter: ${contract.name}`);
    result.push({ directory: path, contract, fragments: new Map() });
  }
  if (explicit.length && !result.length) throw new Error("No adapter contracts found at the supplied paths");
  return result;
}
