/** The two stock node:async_hooks methods used here; no npm ambient type package. */
export declare class AsyncLocalStorage<T> {
  getStore(): T | undefined;
  run<R>(store: T, callback: () => R): R;
}
