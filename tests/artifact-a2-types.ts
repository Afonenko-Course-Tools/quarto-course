import {
  type ArtifactInventory,
  ArtifactInventorySchema,
  type MaterializationBindings,
  MaterializationBindingsSchema,
  type ProjectPlan,
  type ResolvedCondition,
  ResolvedConditionSchema,
  type SubmissionInstructions,
} from "../_extensions/course-core/public.ts";
const expectType = <T>(_value: T) => {};
const summary: SubmissionInstructions = {
  files: [{
    name: "grade/Main.java",
    starterPath: "src/main/java/grade/Main.java",
  }],
  instructions: "Сдайте исходник.",
};
expectType<MaterializationBindings>(
  MaterializationBindingsSchema.parse({ submission: summary }),
);
function consumer(value: unknown) {
  const inventory: ArtifactInventory = ArtifactInventorySchema.parse(value);
  for (const file of inventory.files) {
    expectType<Uint8Array>(file.bytes);
    expectType<string>(file.target);
    expectType<"student" | "full">(file.audience);
  }
  return inventory;
}
function condition(value: unknown) {
  const resolved: ResolvedCondition = ResolvedConditionSchema.parse(value);
  expectType<string>(resolved.occurrence);
  return resolved;
}
expectType<SubmissionInstructions>({
  // @ts-expect-error Logical submitted name is required.
  files: [{ starterPath: "src/Main.java" }],
  instructions: "test",
});
expectType<ProjectPlan>({
  id: crypto.randomUUID(),
  input: "code/input.qmd",
  // @ts-expect-error Only student/full are accepted by the executable schema.
  audience: "grading",
  testsets: [],
  components: [],
  groups: [],
});
void consumer;
void condition;
console.log(
  "PASS A2 public executable schemas and inferred producer/consumer types",
);
