import { command, quartoExecutable } from "./process.ts";
/** Установка общего набора пакетов сама по себе не включает ядро курса. */
export async function configured(): Promise<boolean> {
  const inspected = JSON.parse(await command(quartoExecutable(), ["inspect", "."], Deno.cwd()));
  return inspected.config.course != null;
}
export async function enabled(): Promise<boolean> {
  if (Deno.env.get("COURSE_CHECK_ACTIVE") === "1") return false;
  const inspected = JSON.parse(await command(quartoExecutable(), ["inspect", "."], Deno.cwd()));
  return inspected.config.course?.validate === true;
}
