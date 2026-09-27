import { join } from "stdlib/path";
import { exists } from "../infrastructure/files.ts";
import { clearDownloads } from "../infrastructure/archive.ts";
import { configured } from "../infrastructure/hooks.ts";
if (await configured()) {
  await clearDownloads(Deno.cwd(), Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") || ".");
  // Invalidate configured courses even when CUE validation is disabled. The
  // independently activated navigation/theme packages must not clear files.
  if (Deno.env.get("COURSE_CHECK_ACTIVE") !== "1") {
    const path = join(Deno.cwd(), "_generated/course-spec");
    if (await exists(path)) await Deno.remove(path, { recursive: true });
  }
}
