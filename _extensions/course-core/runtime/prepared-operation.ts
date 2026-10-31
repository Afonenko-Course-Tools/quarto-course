// @deno-types="../vendor/zod/v4/index.d.ts"
import { z } from "../vendor/zod/v4/index.js";
import { NativeOperationIdentitySchema } from "./contracts.ts";
import { decode } from "../document/contracts.ts";
import { immutable } from "../document/condition.ts";
import { fail } from "../contracts/project.ts";
export const NativePreparedOperationSchema = z.strictObject({
  schema: z.literal("course-native-prepared-operation-v1"),
  root: z.string().startsWith("/"),
  outputDirectory: z.string().startsWith("/"),
  identity: NativeOperationIdentitySchema,
  inputs: z.array(
    z.strictObject({ source: z.string().min(1), captureWitness: z.uuid() }),
  ).min(1).max(4096),
  assessments: z.array(
    z.strictObject({ source: z.string().min(1), id: z.string().min(1) }),
  ).min(1).max(4096),
});
export type NativePreparedOperation = z.output<
  typeof NativePreparedOperationSchema
>;
export type NativePreparedLease = Readonly<{
  descriptor: NativePreparedOperation;
  assert(expected: NativePreparedOperation): Promise<void>;
  captureInputs<R>(
    expected: NativePreparedOperation,
    sources: readonly string[],
    runNative: (token: string) => Promise<R>,
  ): Promise<R>;
}>;
/** Internal factory: production guard/capture are the existing live scope closures. */
export async function withPreparedLease<T>(
  value: NativePreparedOperation,
  guard: () => Promise<void>,
  capture: <R>(
    sources: readonly string[],
    run: (token: string) => Promise<R>,
  ) => Promise<R>,
  onFailure: () => Promise<void>,
  use: (lease: NativePreparedLease) => Promise<T>,
): Promise<T> {
  const descriptor = immutable(
    decode(NativePreparedOperationSchema, value, "OPERATION_BINDING"),
  );
  let live = true, failed = false;
  async function assert(expected: NativePreparedOperation) {
    if (!live) fail("OPERATION_EXPIRED", "Prepared lease callback завершён");
    if (failed) fail("OPERATION_BINDING", "Prepared lease failed");
    try {
      const candidate = decode(
        NativePreparedOperationSchema,
        structuredClone(expected),
        "OPERATION_BINDING",
      );
      if (JSON.stringify(candidate) !== JSON.stringify(descriptor)) {
        fail(
          "OPERATION_BINDING",
          "Expected prepared correlation отличается от genuine generation",
        );
      }
      await guard();
      if (!live) fail("OPERATION_EXPIRED", "Prepared lease истёк");
    } catch (e) {
      failed = true;
      await onFailure();
      throw e;
    }
  }
  const lease: NativePreparedLease = Object.freeze({
    descriptor,
    assert,
    async captureInputs(expected, sources, run) {
      await assert(expected);
      return await capture(sources, run);
    },
  });
  try {
    await guard();
    const result = await use(lease);
    if (failed) {
      fail("OPERATION_BINDING", "Prepared lease swallowed failed correlation");
    }
    await guard();
    return result;
  } finally {
    live = false;
  }
}

export type NativeCaptureScope = Readonly<{
  captureInputs<R>(
    sources: readonly string[],
    runNative: (token: string) => Promise<R>,
  ): Promise<R>;
  withPreparedOperation<T>(
    use: (lease: NativePreparedLease) => Promise<T>,
  ): Promise<T>;
}>;
