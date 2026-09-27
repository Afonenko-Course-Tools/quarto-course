import { command, quartoExecutable } from "./process.ts";
/** Вызов возможен только через явно подключённый обработчик проекта. */
export async function enabled(): Promise<boolean> {
  if (Deno.env.get("COURSE_CHECK_ACTIVE") === "1") return false;
  const inspected = JSON.parse(await command(quartoExecutable(), ["inspect", "."], Deno.cwd()));
  return inspected.config.course?.validate === true;
}
