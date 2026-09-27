import { command, quartoExecutable } from "./process.ts";
/** Installing the shared bundle does not activate Course Core in a project. */
export async function configured(): Promise<boolean> {
  const inspected = JSON.parse(await command(quartoExecutable(), ["inspect", "."], Deno.cwd()));
  return inspected.config.course != null;
}
export async function enabled(): Promise<boolean> {
  if (Deno.env.get("COURSE_CHECK_ACTIVE") === "1") return false;
  const inspected = JSON.parse(await command(quartoExecutable(), ["inspect", "."], Deno.cwd()));
  return inspected.config.course?.validate === true;
}
