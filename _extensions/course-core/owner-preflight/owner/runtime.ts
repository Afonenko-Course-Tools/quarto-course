/** Native process, filesystem and hash helpers; no owner lifecycle dependency. */
import { dirname, isAbsolute, relative, resolve } from "stdlib/path";
import { OwnerFailure } from "./failure.ts";
import { invalidateOwnerSourceAudits } from "./validation-scope.ts";

export const quarto = Deno.env.get("QUARTO") || "quarto";
const decoder = new TextDecoder();
export async function invoke(
  executable: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
) {
  const started = performance.now();
  let exitCode: number | null = null;
  if (args[0] === "render") invalidateOwnerSourceAudits();
  try {
    const r = await new Deno.Command(executable, {
      args,
      cwd,
      env,
      stdout: "piped",
      stderr: "piped",
    }).output();
    exitCode = r.code;
    return {
      exitCode: r.code,
      stdout: decoder.decode(r.stdout),
      stderr: decoder.decode(r.stderr),
    };
  } finally {
    if (args[0] === "render") invalidateOwnerSourceAudits();
    await traceNativeCall(
      executable,
      args,
      cwd,
      performance.now() - started,
      exitCode,
    );
  }
}
async function traceNativeCall(
  executable: string,
  args: string[],
  cwd: string,
  elapsedMs: number,
  exitCode: number | null,
) {
  try {
    const path = Deno.env.get("COURSE_BUILD_TRACE");
    if (
      !path || !isAbsolute(path) || !["inspect", "render"].includes(args[0])
    ) return;
    const safeArgs: string[] = [];
    if (args[1] && !args[1].startsWith("-")) safeArgs.push(args[1]);
    const profile = args.indexOf("--profile");
    if (profile >= 0 && /^[A-Za-z0-9_,.-]+$/.test(args[profile + 1] || "")) {
      safeArgs.push("--profile", args[profile + 1]);
    }
    await Deno.writeTextFile(
      path,
      JSON.stringify({
        kind: args[0],
        executable,
        cwd,
        args: safeArgs,
        elapsedMs: Math.round(elapsedMs * 1000) / 1000,
        exitCode,
      }) + "\n",
      { append: true, create: true },
    );
  } catch {
    // Opt-in diagnostics never replace a native result or a process-start failure.
  }
}
export function inside(root: string, path: string): string {
  const rel = relative(root, resolve(root, path));
  if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) {
    throw new OwnerFailure("SOURCE.OUTSIDE_OWNER", path);
  }
  return rel.replaceAll("\\", "/");
}
export async function exists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}
export async function inspect(root: string, profile: string) {
  const cwd = (await Deno.stat(root)).isDirectory ? root : dirname(root);
  const r = await invoke(quarto, ["inspect", root, "--profile", profile], cwd);
  if (r.exitCode) throw new OwnerFailure("SOURCE.INSPECT_FAILED", r);
  return JSON.parse(r.stdout);
}
/** Sharing belongs to one native audit, never arbitrary calls to public inspect. */
export function auditInspector() {
  const reads = new Map<string, Promise<any>>();
  return async (target: string, profile: string) => {
    const key = JSON.stringify([resolve(target), profile]);
    let read = reads.get(key);
    if (!read) {
      read = inspect(target, profile);
      reads.set(key, read);
    }
    // Keep callers from mutating another consumer's native envelope.
    return structuredClone(await read);
  };
}
export async function noLink(path: string) {
  if ((await Deno.lstat(path)).isSymlink) {
    throw new OwnerFailure("SOURCE.INVALID_ATTEMPT", "symlink: " + path);
  }
}
export async function digestFile(path: string) {
  await noLink(path);
  return digest(await Deno.readFile(path));
}
export async function digest(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
  ).map((n) => n.toString(16).padStart(2, "0")).join("");
}
export async function objectHash(value: unknown) {
  return digest(new TextEncoder().encode(JSON.stringify(value)));
}
export async function sha(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value)),
    ),
  ).map((n) => n.toString(16).padStart(2, "0")).join("");
}
export function insideOrUndefined(root: string, path: string) {
  try {
    return inside(root, path);
  } catch {
    return undefined;
  }
}
