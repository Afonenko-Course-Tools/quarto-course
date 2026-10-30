/** Публичный ограниченный native/TS договор Core; runtime-проверки обязательны. */
export {
  CoreContractError,
  ProjectContractSchema,
} from "./contracts/project.ts";
export type {
  ProjectContract,
  ProjectContractInput,
} from "./contracts/project.ts";
export {
  assertProjectContext,
  decodeProjectContract,
  readProjectContexts,
} from "./infrastructure/project-context.ts";
export type {
  NativeOrigin,
  ProjectContext,
  ProjectContextGroup,
  ProjectContextRequest,
} from "./infrastructure/project-context.ts";
export { normalizeDocument } from "./document/normalize.ts";
export { finalizeDocument } from "./document/finalize.ts";
export {
  DocumentContextSchema,
  EarlyDocumentSchema,
  ExerciseDeclarationSchema,
  FinalizedDocumentSchema,
  LateDocumentSchema,
} from "./document/contracts.ts";
export type {
  DocumentContext,
  EarlyDocument,
  ExerciseDeclaration,
  FinalizedDocument,
  LateDocument,
  ResolvedOccurrence,
} from "./document/contracts.ts";

export { selectCondition } from "./document/condition.ts";
export { planProject, projectPlanMetrics } from "./artifacts/plan.ts";
export {
  materializationClosure,
  materializeCondition,
  materializeProject,
  writeArtifactInventory,
} from "./artifacts/materialize.ts";
export {
  ArtifactDestinationSchema,
  ArtifactFileSchema,
  ArtifactInventorySchema,
  ArtifactWriteResultSchema,
  ConditionViewSchema,
  MaterializationBindingsSchema,
  MaterializationClosureSchema,
  ProjectPlanMetricsSchema,
  ProjectPlanSchema,
  ProjectSelectionSchema,
  ResolvedConditionSchema,
  SubmissionInstructionsSchema,
} from "./artifacts/contracts.ts";
export type {
  ArtifactFile,
  ArtifactInventory,
  ArtifactWriteResult,
  ConditionView,
  MaterializationBindings,
  MaterializationClosure,
  ProjectPlan,
  ProjectPlanMetrics,
  ProjectSelection,
  ResolvedCondition,
  SubmissionInstructions,
} from "./artifacts/contracts.ts";
export {
  withCurrentNativeOperation,
  withNativeCaptureScope,
  withPendingNativeOperation,
} from "./runtime/operation.ts";
export {
  NativeCaptureReservationSchema,
  NativeCaptureScopeOptionsSchema,
  NativeCatalogSchema,
  NativeConditionRequestSchema,
  NativeDocumentRequestSchema,
  NativeOperationExpectationSchema,
  NativeOperationIdentitySchema,
  NativeOperationMetricsSchema,
  NativePendingOperationExpectationSchema,
  NativePendingOperationSchema,
  NativePublicDocumentSchema,
  NativeResourceInventorySchema,
  NativeResourceRequestSchema,
  NativeWebFormatSchema,
} from "./runtime/contracts.ts";
export type {
  NativeCaptureReservation,
  NativeCaptureScopeOptions,
  NativeCatalog,
  NativeConditionRequest,
  NativeDocumentRequest,
  NativeOperationExpectation,
  NativeOperationIdentity,
  NativeOperationMetrics,
  NativePendingOperation,
  NativePendingOperationExpectation,
  NativePublicDocument,
  NativeResourceInventory,
  NativeResourceRequest,
} from "./runtime/contracts.ts";
export type { NativeOperation } from "./runtime/operation.ts";

export {
  AssessmentCompositionSchema,
  AssessmentSlotSchema,
  AssignmentSchema,
  NativeAdapterValidationInputSchema,
  NativeAdapterValidationResultSchema,
  NativeMetadataEnvelopeSchema,
  NativeMetadataReadSetSchema,
  NativeMetadataSlotSchema,
  NativeReleaseProofSchema,
  NativeReleaseRequestSchema,
} from "./release/contracts.ts";
export type {
  NativeAdapterValidationInput,
  NativeAdapterValidationResult,
  NativeAdapterValidator,
  NativeMetadataSlot,
  NativeReleaseProof,
  NativeReleaseRequest,
} from "./release/contracts.ts";

export {
  AnswerFactsSchema,
  AnswerSpecSchema,
} from "./document/answer-contracts.ts";
export type { AnswerFacts, AnswerSpec } from "./document/answer-contracts.ts";
