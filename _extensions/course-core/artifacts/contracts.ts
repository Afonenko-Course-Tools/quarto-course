// @deno-types="../vendor/zod/v4/index.d.ts"
import { z } from "../vendor/zod/v4/index.js";
import { DocumentContextSchema } from "../document/contracts.ts";
export const ArtifactTargetSchema = z.string().min(1).max(1024).refine(
  (v) =>
    !/[\\\0:*?\[\]{}]/.test(v) && !v.startsWith("/") &&
    !v.split("/").some((p) => !p || p === "." || p === ".."),
  "Нужен нормализованный относительный target",
);
export const ConditionViewSchema = z.union([
  z.enum(["student", "author"]),
  z.strictObject({
    view: z.enum(["student", "author"]),
    occurrence: z.string().min(1).optional(),
  }),
]);
export const ResolvedConditionSchema = z.strictObject({
  context: DocumentContextSchema,
  exerciseId: z.string().regex(/^exr-[a-z0-9][a-z0-9-]*$/),
  occurrence: z.string().min(1),
  anchor: z.string().max(1024).default(""),
  project: z.string().min(1).optional(),
  view: z.enum(["student", "author"]),
  pandocApiVersion: z.array(z.number().int().nonnegative()).min(2).max(4),
  body: z.array(z.unknown()),
  links: z.array(z.string().min(1)).max(4096),
  resources: z.array(z.string().min(1)).max(4096),
});
export type ResolvedCondition = z.output<typeof ResolvedConditionSchema>;
export type ConditionView = z.input<typeof ConditionViewSchema>;
export const ProjectSelectionSchema = z.strictObject({
  audience: z.enum(["student", "full"]),
});
export type ProjectSelection = z.input<typeof ProjectSelectionSchema>;
export const ProjectPlanSchema = z.strictObject({
  id: z.uuid(),
  input: z.string().min(1),
  audience: z.enum(["student", "full"]),
  testsets: z.array(z.string()).max(256),
  components: z.array(z.string()).max(256),
  groups: z.array(z.string()).max(256),
});
export type ProjectPlan = z.output<typeof ProjectPlanSchema>;
// Neutral README envelope. PL remains owner of grading/submission transport.
export const SubmissionInstructionsSchema = z.strictObject({
  files: z.array(
    z.strictObject({
      name: ArtifactTargetSchema,
      starterPath: ArtifactTargetSchema.optional(),
    }),
  ).max(256),
  instructions: z.string().min(1).max(65536),
});
export type SubmissionInstructions = z.output<
  typeof SubmissionInstructionsSchema
>;
export const MaterializationBindingsSchema = z.strictObject({
  links: z.record(z.string().min(1), z.string().min(1).max(4096)).default({}),
  resources: z.record(
    z.string().min(1),
    z.strictObject({
      path: ArtifactTargetSchema,
      target: ArtifactTargetSchema,
    }),
  ).default({}),
  submission: SubmissionInstructionsSchema,
  submissionBase: ArtifactTargetSchema.optional(),
});
export type MaterializationBindings = z.input<
  typeof MaterializationBindingsSchema
>;
export const ArtifactFileSchema = z.strictObject({
  target: ArtifactTargetSchema,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().nonnegative().max(128 * 1024 * 1024),
  audience: z.enum(["student", "full"]),
  reason: z.string().min(1).max(1024),
  bytes: z.instanceof(Uint8Array).refine((v) =>
    v.byteLength <= 128 * 1024 * 1024
  ),
});
export const ArtifactInventorySchema = z.strictObject({
  schema: z.literal("course-artifact-inventory-v1"),
  operation: z.uuid(),
  exerciseId: z.string().min(1),
  audience: z.enum(["student", "full"]),
  files: z.array(ArtifactFileSchema).min(1).max(4096),
});
export type ArtifactInventory = z.output<typeof ArtifactInventorySchema>;
export type ArtifactFile = z.output<typeof ArtifactFileSchema>;

export const ProjectPlanMetricsSchema = z.strictObject({
  treeWalks: z.number().int().nonnegative(),
  fileReads: z.number().int().nonnegative(),
  hashReads: z.number().int().nonnegative(),
  pandocCalls: z.number().int().nonnegative(),
  cacheHits: z.number().int().nonnegative(),
});
export type ProjectPlanMetrics = z.output<typeof ProjectPlanMetricsSchema>;
export const ArtifactDestinationSchema = z.string().min(1).max(4096).refine(
  (v) => v.startsWith("/") && !v.includes("\0") && !v.split("/").includes(".."),
  "Нужен абсолютный destination",
);

export const ArtifactWriteResultSchema = z.strictObject({
  files: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  hashReads: z.number().int().nonnegative(),
});
export type ArtifactWriteResult = z.output<typeof ArtifactWriteResultSchema>;
