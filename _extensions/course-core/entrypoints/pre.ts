import { join } from "stdlib/path";
import { exists } from "../infrastructure/files.ts";
import { clearDownloads } from "../infrastructure/archive.ts";
await clearDownloads(Deno.cwd(), Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") || ".");
// Invalidate all views even when CUE validation is disabled.
if (Deno.env.get("COURSE_CHECK_ACTIVE") !== "1") {
  const path = join(Deno.cwd(), "_generated/course-spec");
  if (await exists(path)) await Deno.remove(path, { recursive: true });
}
