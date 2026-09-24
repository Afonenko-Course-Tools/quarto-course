import { join } from "stdlib/path";
import { enabled } from "../infrastructure/hooks.ts";
import { exists } from "../infrastructure/files.ts";
if (await enabled()) {
  const path = join(Deno.cwd(), "_generated/course-spec");
  if (await exists(path)) await Deno.remove(path, { recursive: true });
}
