import { fail } from "../contracts/project.ts";
// Callback-local guards attach to exact public values; serialized DTOs carry no capability.
const guards = new WeakMap<
  object,
  { root: string; assert: () => Promise<void> }
>();
export function bindNativeValue(
  value: object,
  root: string,
  assert: () => Promise<void>,
) {
  guards.set(value, { root, assert });
}
export function inheritNativeValue(source: object, target: object) {
  const guard = guards.get(source);
  if (guard) guards.set(target, guard);
}
export async function assertNativeValue(value: object, root: string) {
  const guard = guards.get(value);
  if (!guard) {
    fail(
      "CONDITION_AUTHORITY",
      "Материализация требует точное значение текущей native операции",
    );
  }
  if (guard.root !== root) {
    fail(
      "CONDITION_BINDING",
      "Native bank и code project принадлежат разным owner",
    );
  }
  await guard.assert();
}
