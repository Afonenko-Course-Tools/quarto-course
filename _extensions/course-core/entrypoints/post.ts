import { check } from "../application/check.ts";
import { enabled } from "../infrastructure/hooks.ts";
import { runtime } from "../infrastructure/runtime.ts";
if (await enabled()) {
  const result = await check(runtime(await Deno.realPath(Deno.cwd()), [], false));
  console.log(`Course: ${result.model.exercises.length} exercises, ${result.model.assessments.length} assessments`);
}
