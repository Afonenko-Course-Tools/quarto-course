// @deno-types="../vendor/zod/v4/index.d.ts"
import { z } from "../vendor/zod/v4/index.js";
import {
  DocumentContextSchema,
  FinalizedDocumentSchema,
} from "../document/contracts.ts";
const path = z.string().min(1).max(4096).refine((s) =>
  !s.startsWith("/") && !s.includes("\\") && !s.includes("\0") &&
  s.split("/").every((p) => p && p !== "." && p !== "..")
);
export const NativeOperationExpectationSchema = z.strictObject({
  root: z.string().startsWith("/"),
  profiles: z.array(z.string().regex(/^[-a-z0-9]+$/)).max(16),
  format: z.literal("html"),
  projection: z.literal("student"),
  outputDirectory: z.string().startsWith("/"),
});
export const NativeOperationIdentitySchema = z.strictObject({
  operation: z.uuid(),
  profiles: z.array(z.string()),
  format: z.literal("html"),
  projection: z.literal("student"),
  runtime: z.literal("quarto-1.11.5"),
});
export const NativeDocumentRequestSchema = z.strictObject({ source: path });
export const NativeConditionRequestSchema = NativeDocumentRequestSchema.extend({
  exerciseId: z.string().regex(/^exr-[a-z0-9][a-z0-9-]*$/),
  view: z.union([
    z.literal("student"),
    z.strictObject({
      view: z.literal("student"),
      occurrence: z.string().min(1).optional(),
    }),
  ]),
});
export const NativeCatalogSchema = z.strictObject({
  identity: NativeOperationIdentitySchema,
  documents: z.array(z.strictObject({
    source: path,
    output: path,
    role: z.enum(["exercise-bank", "page"]),
    exercises: z.array(z.strictObject({
      id: z.string(),
      occurrence: z.string(),
      anchor: z.string(),
      hasPublicSolution: z.boolean(),
      project: path.optional(),
    })),
  })),
});
export const NativePublicDocumentSchema = FinalizedDocumentSchema.extend({
  status: z.literal("complete"),
  context: DocumentContextSchema.extend({
    input: path,
    format: z.literal("html"),
    projection: z.literal("student"),
  }),
});
export type NativePublicDocument = z.output<typeof NativePublicDocumentSchema>;
export const NativeResourceRequestSchema = z.strictObject({
  files: z.array(z.strictObject({ source: path, target: path })).min(1).max(
    4096,
  ),
});
export const NativeResourceInventorySchema = z.strictObject({
  schema: z.literal("course-native-resource-inventory-v1"),
  operation: z.uuid(),
  audience: z.literal("student"),
  files: z.array(z.strictObject({
    target: path,
    bytes: z.instanceof(Uint8Array),
    size: z.number().int().nonnegative().max(128 * 1024 * 1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    audience: z.literal("student"),
    reason: z.literal("native-resource"),
  })).min(1).max(4096),
});
export type NativeOperationExpectation = z.input<
  typeof NativeOperationExpectationSchema
>;
export type NativeOperationIdentity = z.output<
  typeof NativeOperationIdentitySchema
>;
export type NativeCatalog = z.output<typeof NativeCatalogSchema>;
export type NativeDocumentRequest = z.input<typeof NativeDocumentRequestSchema>;
export type NativeConditionRequest = z.input<
  typeof NativeConditionRequestSchema
>;
export type NativeResourceRequest = z.input<typeof NativeResourceRequestSchema>;
export type NativeResourceInventory = z.output<
  typeof NativeResourceInventorySchema
>;

export const NativeOperationMetricsSchema = z.strictObject({
  inspectCalls: z.number().int().nonnegative(),
  fullWalks: z.number().int().nonnegative(),
  sourceHashReads: z.number().int().nonnegative(),
  resourceHashReads: z.number().int().nonnegative(),
  nativeResourceHashReads: z.number().int().nonnegative(),
  resourceByteReads: z.number().int().nonnegative(),
  resourceCacheHits: z.number().int().nonnegative(),
  fullFences: z.number().int().nonnegative(),
  currentnessChecks: z.number().int().nonnegative(),
});
export type NativeOperationMetrics = z.output<
  typeof NativeOperationMetricsSchema
>;
