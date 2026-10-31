import { AsyncLocalStorage } from "node:async_hooks";
import { fail } from "../contracts/project.ts";
import type { AssignmentProducerProfile } from "./assignment-producer-profiles.ts";
// Callback-local only; ordinary commands retain their existing environment path.
const current = new AsyncLocalStorage<
  { profile: AssignmentProducerProfile; beforeChild?: () => Promise<void> }
>();
export function withAssignmentExecution<T>(
  profile: AssignmentProducerProfile,
  use: () => Promise<T>,
  beforeChild?: () => Promise<void>,
) {
  return current.run({ profile, beforeChild }, use);
}
export async function assignmentBeforeChild() {
  await current.getStore()?.beforeChild?.();
}
export function assignmentQuarto() {
  return current.getStore()?.profile.native.executable;
}
export function assignmentChild(
  executable: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
) {
  const profile = current.getStore()?.profile;
  if (!profile) return undefined;
  const target = executable === "quarto"
    ? profile.native.executable
    : executable === "cue"
    ? profile.native.environment.CUE
    : executable;
  if (
    !target || !target.startsWith("/") ||
    !profile.runtime.files.some((row) => row.path === target)
  ) {
    fail(
      "BODY.PRODUCER_INPUT_CHANGED",
      "Внешний executable вне квалифицированного closure",
    );
  }
  if (cwd !== profile.root && !cwd.startsWith(profile.root + "/")) {
    fail("BODY.PRODUCER_INPUT_CHANGED", "Неизвестный assignment cwd");
  }
  const fixed = { ...profile.native.environment };
  for (const [key, value] of Object.entries(env)) {
    if (key === "QUARTO_PROFILE") {
      const actual = value.split(",").filter(Boolean),
        base = profile.native.actualProfiles;
      if (
        JSON.stringify(actual.slice(0, base.length)) !== JSON.stringify(base) ||
        actual.length > base.length + 1 ||
        actual.length > base.length &&
          !/^course-a1-[a-f0-9-]{36}$/.test(actual.at(-1)!)
      ) {
        fail(
          "BODY.PRODUCER_INPUT_CHANGED",
          "Неквалифицированный child profiles",
        );
      }
    } else if (key === "COURSE_CORE_CAPTURE_TOKEN") {
      if (!/^[a-f0-9-]{36}$/.test(value)) {
        fail("BODY.PRODUCER_INPUT_CHANGED", "Неверный child correlation");
      }
    } else if (fixed[key] !== value) {
      fail(
        "BODY.PRODUCER_INPUT_CHANGED",
        "Неквалифицированный child environment " + key,
      );
    }
    fixed[key] = value;
  }
  return {
    executable: target,
    options: { args, cwd, env: fixed, clearEnv: true as const },
  };
}
/** Existing helper scratch data stays in an approved service area before child fences. */
export async function assignmentServiceDirectory(
  root: string,
  kind: "citations" | "validation",
) {
  const profile = current.getStore()?.profile;
  if (!profile) return undefined;
  if (root !== profile.root) {
    fail("BODY.PRODUCER_INPUT_CHANGED", "Чужой assignment service owner");
  }
  const { safeParent } = await import("../artifacts/files.ts");
  const directory = root + "/_generated/course-spec/assignment-work/" + kind;
  await safeParent(directory);
  await Deno.mkdir(directory, { recursive: true, mode: 0o700 });
  return directory;
}
