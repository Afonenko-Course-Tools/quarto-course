// Проверяет actual operation methods без native producer/Quarto/render.
import { fail } from "../_extensions/course-core/contracts/project.ts";

const modulePath = new URL(
  "../_extensions/course-core/runtime/.assignment-validation-boundary-test.ts",
  import.meta.url,
);
const source = await Deno.readTextFile(
  Deno.env.get("CORE_TEST_OPERATION_SOURCE") ??
    new URL("../_extensions/course-core/runtime/operation.ts", import.meta.url),
);
await Deno.writeTextFile(
  modulePath,
  source.replace(
    "function publicOperation(",
    "export function publicOperation(",
  ),
  { createNew: true },
);
const root = await Deno.makeTempDir({
  prefix: "assignment-validation-boundary-",
});
async function refuses(use: () => Promise<unknown>, code: string) {
  let observed = "";
  try {
    await use();
  } catch (error) {
    observed = String(error);
  }
  if (!observed.includes(code)) {
    throw Error(`Ожидался ${code}; получено: ${observed || "успех"}`);
  }
}
try {
  const { publicOperation } = await import(modulePath.href);
  function fixture() {
    const identity = {
      operation: crypto.randomUUID(),
      profiles: ["full"],
      projection: "author" as const,
      runtime: "quarto-1.11.5" as const,
    };
    const context = {
      ...identity,
      captureWitness: crypto.randomUUID(),
      input: root + "/bank.qmd",
      format: "html" as const,
      exerciseBank: true,
      defaults: {},
    };
    const { runtime: _runtime, ...documentContext } = context;
    return {
      state: {
        schema: "course-native-operation-private-v2" as const,
        operation: identity.operation,
        root,
        directory: root + "/_generated/operation",
        outputDirectory: root + "/_generated/output",
        profiles: identity.profiles,
        projection: identity.projection,
        captureWitnesses: { "bank.qmd": context.captureWitness },
        inputs: ["bank.qmd"],
        ownerInputs: ["bank.qmd"],
        assignment: {
          assessments: [{ source: "bank.qmd", id: "work" }],
          runtime: {
            executable: "/fixture/quarto",
            environment: {},
            profiles: identity.profiles,
            outputDirectory: root + "/_generated/output",
            inputs: ["bank.qmd"],
          },
        },
        ownerWitness: {
          quarto: { version: "1.11.5" },
          dir: root,
          config: {},
          files: { input: [root + "/bank.qmd"], config: [] },
        },
        metrics: { inspectCalls: 1, nativeMetadataBytes: 0, childRenders: 0 },
      },
      catalog: {
        identity,
        documents: [{
          source: "bank.qmd",
          output: "bank.html",
          format: "html" as const,
          role: "exercise-bank" as const,
          exercises: [],
        }],
      },
      documents: [],
      resources: [],
      outputs: [],
      releaseDocuments: [{
        source: "bank.qmd",
        early: {
          context: documentContext,
          definitions: {},
          release: {
            course: { id: "boundary", view: "full" as const, adapters: [] },
            declarations: [],
            nativeMetadata: { adapters: {} },
          },
        },
        final: { hasPublicSolution: {} },
        projectFacts: {
          schema: "course-native-project-facts-v1" as const,
          context: structuredClone(documentContext),
          source: "bank.qmd",
          projects: [],
          projectMaterializations: {},
          collectCalls: 1 as const,
        },
      }],
    };
  }
  let live = true;
  const guard = () => {
    if (!live) fail("OPERATION_EXPIRED", "Fixture callback завершён");
  };
  const operation = (complete: ReturnType<typeof fixture>) =>
    publicOperation(
      complete,
      guard,
      async () => guard(),
      complete.state.metrics,
      { active: 0, failed: false },
      guard,
      guard,
    );
  const request = { expectedSources: ["bank.qmd"] };
  // Отсутствующий validation check пропускает неполный owner scope до API consumer.
  const incomplete = fixture();
  incomplete.state.ownerInputs.push("missing.qmd");
  const incompleteOperation = operation(incomplete);
  const foreign = fixture();
  foreign.releaseDocuments[0].projectFacts.context.captureWitness = crypto
    .randomUUID();
  const missing = fixture();
  Reflect.deleteProperty(missing.releaseDocuments[0], "projectFacts");
  const orphan = fixture();
  Reflect.set(
    orphan.releaseDocuments[0].projectFacts.projectMaterializations,
    "exr-orphan",
    { commonFiles: [] },
  );
  const boundaryFailures: string[] = [];
  for (
    const [op, code] of [
      [incompleteOperation, "BODY.PROVENANCE_COVERAGE"],
      [operation(foreign), "BODY.PROVENANCE_UNQUALIFIED"],
      [operation(missing), "BODY.PROVENANCE_UNQUALIFIED"],
      [operation(orphan), "CORE.PROJECT_MATERIALIZATION_INVALID"],
    ] as const
  ) {
    try {
      await refuses(() => op.validateRelease(request), code);
    } catch (error) {
      boundaryFailures.push(String(error));
    }
  }
  if (boundaryFailures.length) throw Error(boundaryFailures.join("\n"));
  await refuses(
    () => incompleteOperation.assignmentProvenance(),
    "BODY.ASSIGNMENT_VALIDATION_REQUIRED",
  );
  await refuses(
    () => incompleteOperation.withProjectContracts([], async () => {}),
    "BODY.ASSIGNMENT_VALIDATION_REQUIRED",
  );
  await refuses(
    () =>
      incompleteOperation.assignmentDelivery({
        source: "bank.qmd",
        assessmentId: "work",
      }, { projectPlans: [] }),
    "BODY.ASSIGNMENT_VALIDATION_REQUIRED",
  );
  // Исправление фактов после отказа не снимает existing sticky failure.
  incomplete.state.ownerInputs.pop();
  await refuses(
    () => incompleteOperation.validateRelease(request),
    "BODY.ASSIGNMENT_VALIDATION_REQUIRED",
  );

  const valid = operation(fixture());
  await refuses(
    () => valid.assignmentProvenance(),
    "BODY.ASSIGNMENT_VALIDATION_REQUIRED",
  );
  await valid.validateRelease(request);
  const provenance = await valid.assignmentProvenance();
  if (
    provenance.documents.length !== 1 ||
    provenance.documents[0].source !== "bank.qmd" ||
    provenance.documents[0].format !== "html"
  ) {
    throw Error("Потеря полной native проекции после успешной validation");
  }
  live = false;
  await refuses(() => valid.assignmentProvenance(), "OPERATION_EXPIRED");
  console.log(
    "PASS assignment validation отказывает incomplete/foreign facts, сохраняет sticky failure, доступ к provenance и expiry",
  );
} finally {
  await Deno.remove(modulePath);
  await Deno.remove(root, { recursive: true });
}
