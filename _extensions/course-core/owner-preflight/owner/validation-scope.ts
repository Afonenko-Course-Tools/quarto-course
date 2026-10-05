/** Private, operation-local reuse of immutable source audits; no lifecycle imports. */
// @deno-types="./async-hooks.d.ts"
import { AsyncLocalStorage } from "node:async_hooks";

interface ValidationScope {
  open: boolean;
  sources: Map<string, Promise<unknown>>;
  guards: Map<string, () => Promise<void>>;
}
const scopes = new AsyncLocalStorage<ValidationScope>();

/** Each public operation owns a fresh scope; awaited nested operations share it. */
export async function withOwnerValidationScope<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const parent = scopes.getStore();
  if (parent?.open) {
    try {
      return await operation();
    } catch (error) {
      parent.sources.clear();
      throw error;
    }
  }
  const scope: ValidationScope = {
    open: true,
    sources: new Map(),
    guards: new Map(),
  };
  return await scopes.run(scope, async () => {
    try {
      const result = await operation();
      // Check even sources whose cached success was discarded by a caught failure.
      for (const verify of scope.guards.values()) await verify();
      return result;
    } finally {
      scope.open = false;
      scope.sources.clear();
      scope.guards.clear();
    }
  });
}

/** Rendering is a new native phase, even if a caller supplied a surrounding scope. */
export function invalidateOwnerSourceAudits() {
  scopes.getStore()?.sources.clear();
}

export async function validatedOwnerSource<T>(
  key: string,
  audit: () => Promise<T>,
  verify: () => Promise<void>,
  guardKey = key,
): Promise<T> {
  const scope = scopes.getStore();
  if (!scope?.open) return await audit();
  const cached = scope.sources.get(key);
  if (cached) {
    await verify();
    const value = await cached as T;
    if (scope.open) scope.guards.set(guardKey, verify);
    return value;
  }
  const pending = (async () => {
    const value = await audit();
    await verify();
    if (scope.open) scope.guards.set(guardKey, verify);
    return value;
  })();
  scope.sources.set(key, pending);
  try {
    return await pending;
  } catch (error) {
    scope.sources.clear();
    throw error;
  }
}
