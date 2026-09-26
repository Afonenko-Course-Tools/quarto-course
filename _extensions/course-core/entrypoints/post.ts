import { check } from "../application/check.ts";
import { publishDownloads } from "../infrastructure/archive.ts";
import { enabled } from "../infrastructure/hooks.ts";
import { runtime } from "../infrastructure/runtime.ts";
if (await enabled()) {
  const result = await check(runtime(await Deno.realPath(Deno.cwd()), [], false));
  await publishDownloads(await Deno.realPath(Deno.cwd()), Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") || ".", result.model);
  console.log(`Course: ${result.model.exercises.length} exercises, ${result.model.assessments.length} assessments`);
}
