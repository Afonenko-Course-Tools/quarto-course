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
  ProjectPlan,
  ProjectPlanMetrics,
  ProjectSelection,
  ResolvedCondition,
  SubmissionInstructions,
} from "./artifacts/contracts.ts";
