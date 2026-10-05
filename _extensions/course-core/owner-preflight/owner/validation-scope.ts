/** Private, operation-local reuse of immutable source audits; no lifecycle imports. */
// @deno-types="./async-hooks.d.ts"
import { AsyncLocalStorage } from "node:async_hooks";

interface ValidationScope<Inputs> {
  open: boolean;
  epoch: number;
  sources: Map<string, Promise<unknown>>;
  guards: Map<string, () => Promise<void>>;
  inputs: Map<string, Promise<Inputs | undefined>>;
}
let nativePhase = 0;

/** Rendering invalidates native success; this writer can never create authority. */
export function invalidateOwnerSourceAudits() {
  nativePhase++;
}

/** Each instance has separate context and closure; only Owner holds its instance. */
export function createOwnerValidationService<Inputs = unknown>() {
  const scopes = new AsyncLocalStorage<ValidationScope<Inputs>>();
  function state(): ValidationScope<Inputs> | undefined {
    const scope = scopes.getStore();
    if (!scope?.open) return;
    if (scope.epoch !== nativePhase) {
      scope.sources.clear();
      scope.inputs.clear();
      scope.epoch = nativePhase;
    }
    return scope;
  }
  async function withScope<T>(operation: () => Promise<T>): Promise<T> {
    const parent = state();
    if (parent) {
      try {
        return await operation();
      } catch (error) {
        parent.sources.clear();
        throw error;
      }
    }
    const scope: ValidationScope<Inputs> = {
      open: true,
      epoch: nativePhase,
      sources: new Map(),
      guards: new Map(),
      inputs: new Map(),
    };
    return await scopes.run(scope, async () => {
      try {
        const result = await operation();
        state(); // Invalidate pending success if a render crossed this operation.
        // Caller-created services cannot insert callbacks into this closure.
        for (const verify of scope.guards.values()) await verify();
        return result;
      } finally {
        scope.open = false;
        scope.sources.clear();
        scope.guards.clear();
        scope.inputs.clear();
      }
    });
  }
  async function inputs(
    key: string,
    create: () => Promise<Inputs | undefined>,
  ): Promise<Inputs | undefined> {
    const scope = state();
    if (!scope) return await create();
    let pending = scope.inputs.get(key);
    if (!pending) {
      pending = create();
      scope.inputs.set(key, pending);
    }
    return await pending;
  }
  function guard(key: string, verify: () => Promise<void>) {
    state()?.guards.set(key, verify);
  }
  async function source<T>(
    key: string,
    audit: () => Promise<T>,
    verify: () => Promise<void>,
    guardKey = key,
    reusable = true,
  ): Promise<T> {
    const scope = state();
    if (!scope) return await audit();
    if (!reusable) {
      // Unknown input classes retain full native audits at reuse and closure.
      scope.sources.delete(key);
      try {
        const value = await audit();
        await verify();
        if (scope.open) {
          scope.guards.set(guardKey, async () => {
            await audit();
            await verify();
          });
        }
        return value;
      } catch (error) {
        scope.sources.clear();
        throw error;
      }
    }
    const cached = scope.sources.get(key);
    if (cached) {
      await verify();
      const value = await cached as T;
      if (scope.open) scope.guards.set(guardKey, verify);
      return value;
    }
    const started = nativePhase;
    const pending = (async () => {
      const value = await audit();
      await verify();
      if (scope.open) scope.guards.set(guardKey, verify);
      return value;
    })();
    scope.sources.set(key, pending);
    try {
      const value = await pending;
      // A pre-render audit completing late cannot seed post-render success.
      if (nativePhase !== started && scope.sources.get(key) === pending) {
        scope.sources.delete(key);
      }
      return value;
    } catch (error) {
      scope.sources.clear();
      throw error;
    }
  }
  return Object.freeze({ withScope, inputs, guard, source });
}
