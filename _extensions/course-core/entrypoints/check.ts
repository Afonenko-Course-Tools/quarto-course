import { resolve } from "stdlib/path";
import { check } from "../application/check.ts";
import { publishDownloads } from "../infrastructure/archive.ts";
import { command, quartoExecutable } from "../infrastructure/process.ts";
import { runtime } from "../infrastructure/runtime.ts";
export async function main(args: string[] = Deno.args): Promise<void> {
  let project = ".", seenProject = false;
  const adapters: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--adapter" && args[i + 1]) adapters.push(args[++i]);
    else if (args[i] === "--help") { console.log("quarto run check.ts [PROJECT] [--adapter PATH ...]"); return; }
    else if (args[i].startsWith("-") || seenProject) throw new Error(`Unexpected argument: ${args[i]}`);
    else { project = args[i]; seenProject = true; }
  }
  const root = await Deno.realPath(resolve(project));
  const result = await check(runtime(root, adapters));
  const inspected = JSON.parse(await command(quartoExecutable(), ["inspect", root], root));
  await publishDownloads(root, inspected.config.project?.["output-dir"] || ".", result.model);
  console.log(`Course: ${result.model.exercises.length} exercises, ${result.model.assessments.length} assessments\n${result.path}`);
}
if (import.meta.main) await main();
