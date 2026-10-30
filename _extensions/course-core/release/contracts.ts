// @deno-types="../vendor/zod/v4/index.d.ts"
import { z } from "../vendor/zod/v4/index.js";
export const CourseIdentitySchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
  view: z.enum(["student", "full"]).optional(),
  adapters: z.array(z.string().min(1)).max(32).refine(
    (values) => new Set(values).size === values.length,
    "Повторный adapter",
  ).default([]),
});
export const AssignmentSchema = z.strictObject({
  stage: z.enum(["demonstration", "classroom", "homework"]).optional(),
  requirement: z.enum(["required", "optional"]),
  workMode: z.enum(["individual", "pair", "group"]),
});
const exerciseId = z.string().regex(/^exr-[a-z0-9][a-z0-9-]*$/);
export const AssessmentSlotSchema = z.strictObject({
  id: z.string().regex(/^(exr|alt)-[a-z0-9][a-z0-9-]*$/),
  selection: z.enum(["fixed", "random", "choice"]),
  candidates: z.array(exerciseId).min(1).max(4096),
  assignment: AssignmentSchema,
}).superRefine((s, c) => {
  if (
    s.selection === "fixed"
      ? (s.candidates.length !== 1 || s.id !== s.candidates[0])
      : (!s.id.startsWith("alt-") || s.candidates.length < 2)
  ) {
    c.addIssue({
      code: "custom",
      message: "Некорректная cardinality/id позиции",
    });
  }
  if (s.selection === "choice" && s.assignment.requirement !== "required") {
    c.addIssue({ code: "custom", message: "choice требует required" });
  }
});
export const AssessmentCompositionSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  title: z.string().min(1),
  kind: z.enum(["lab", "seminar", "practical", "test"]),
  slots: z.array(AssessmentSlotSchema).min(1).max(4096),
  theoryTime: z.number().positive().finite().optional(),
  relatedExercise: exerciseId.optional(),
  memberContainers: z.number().int().positive(),
  memberKinds: z.array(z.enum(["BulletList", "OrderedList"])).min(1),
  memberSizes: z.array(z.literal(1)).min(1),
}).superRefine((a, c) => {
  if (
    a.memberKinds.length !== a.memberContainers ||
    a.memberSizes.length !== a.slots.length
  ) c.addIssue({ code: "custom", message: "Некорректная форма task-items" });
  const ids = new Set<string>(), members = new Set<string>();
  for (const s of a.slots) {
    if (ids.has(s.id)) {
      c.addIssue({ code: "custom", message: "Повторный slot id" });
    }
    ids.add(s.id);
    for (const id of s.candidates) {
      if (members.has(id)) {
        c.addIssue({ code: "custom", message: "Повторный кандидат" });
      }
      members.add(id);
    }
  }
});
export const NativeReleaseFactsSchema = z.strictObject({
  course: CourseIdentitySchema,
  assessment: AssessmentCompositionSchema.optional(),
  declarations: z.array(z.strictObject({
    id: exerciseId,
    hasSolution: z.boolean(),
    head: z.strictObject({ level: z.number().int(), title: z.string() })
      .optional(),
    target: z.string().min(1).optional(),
    project: z.string().min(1).optional(),
    check: z.string().min(1).optional(),
    attributes: z.record(z.string(), z.string()),
  })).max(4096),
});
export type NativeReleaseFacts = z.output<typeof NativeReleaseFactsSchema>;
export const NativeAdapterValidationInputSchema = z.strictObject({
  origin: z.strictObject({
    operation: z.uuid(),
    captureWitness: z.uuid(),
    source: z.string().min(1),
    format: z.literal("html"),
    projection: z.enum(["student", "author"]),
    profiles: z.array(z.string()),
  }),
  course: CourseIdentitySchema,
  declarations: z.array(
    z.strictObject({
      id: exerciseId,
      attributes: z.record(z.string(), z.string()),
    }),
  ),
  assessment: AssessmentCompositionSchema.optional(),
});
export type NativeAdapterValidationInput = z.output<
  typeof NativeAdapterValidationInputSchema
>;
export const NativeReleaseRequestSchema = z.strictObject({
  expectedSources: z.array(z.string().min(1)).min(1).max(4096),
  courseId: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
});
export type NativeReleaseRequest = z.input<typeof NativeReleaseRequestSchema>;
export const NativeAdapterValidationResultSchema = z.strictObject({
  sources: z.array(z.strictObject({
    path: z.string().min(1).refine((s) =>
      !s.startsWith("/") && !s.includes("\\") && !s.includes("\0") &&
      s.split("/").every((p) => p && p !== "." && p !== "..")
    ),
    kind: z.enum(["file", "directory"]),
  })).max(4096),
});
export type NativeAdapterValidationResult = z.output<
  typeof NativeAdapterValidationResultSchema
>;
export type NativeAdapterValidator = {
  readonly name: string;
  readonly validate: (
    input: NativeAdapterValidationInput,
  ) => NativeAdapterValidationResult | Promise<NativeAdapterValidationResult>;
};
export const NativeReleaseProofSchema = z.strictObject({
  schema: z.literal("course-native-release-proof-v1"),
  operation: z.uuid(),
  course: CourseIdentitySchema,
  projection: z.enum(["student", "author"]),
  format: z.literal("html"),
  profiles: z.array(z.string()),
  sources: z.array(z.string()).min(1),
  exerciseIds: z.array(exerciseId),
  assessmentIds: z.array(z.string()),
  validatedAdapters: z.array(z.string()),
});
export type NativeReleaseProof = z.output<typeof NativeReleaseProofSchema>;
