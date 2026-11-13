import { strict as assert } from "node:assert";
import type { NativeOperation } from "../_extensions/course-core/public.ts";
import { fixtureArray, fixtureAt, fixtureRecord, fixtureSet } from "./helpers/required.ts";
import { operationFixture } from "./helpers/operation-fixture.ts";

const fixture = await operationFixture(true);
const request = { expectedSources: ["bank.qmd"] };
const delivery = (op: NativeOperation) =>
  op.assignmentDelivery(
    { source: "bank.qmd", assessmentId: "work" },
    {
      projectPlans: [],
    },
  );
const refuses = (use: () => Promise<unknown>, code: string) =>
  assert.rejects(use, (error: unknown) => error instanceof Error && "code" in error && error.code === code);
try {
  const original: unknown = JSON.parse(await Deno.readTextFile(fixture.completePath));
  const cases: [string, (complete: unknown) => void][] = [
    [
      "BODY.PROVENANCE_COVERAGE",
      (value) => fixtureArray(fixtureAt(value, ["state", "ownerInputs"])).push("missing.qmd"),
    ],
    [
      "BODY.PROVENANCE_UNQUALIFIED",
      (value) =>
        fixtureSet(value, ["releaseDocuments", 0, "projectFacts", "context", "captureWitness"], crypto.randomUUID()),
    ],
    [
      "BODY.PROVENANCE_UNQUALIFIED",
      (value) => Reflect.deleteProperty(fixtureRecord(fixtureAt(value, ["releaseDocuments", 0])), "projectFacts"),
    ],
    [
      "CORE.PROJECT_MATERIALIZATION_INVALID",
      (value) =>
        fixtureSet(value, ["releaseDocuments", 0, "projectFacts", "projectMaterializations"], {
          "exr-orphan": { commonFiles: [] },
        }),
    ],
  ];
  for (const [code, mutate] of cases) {
    const invalid = structuredClone(original);
    mutate(invalid);
    await Deno.writeTextFile(fixture.completePath, JSON.stringify(invalid));
    await fixture.use(async (op) => {
      await refuses(() => op.validateRelease(request), code);
      await refuses(() => op.assignmentProvenance(), "BODY.ASSIGNMENT_VALIDATION_REQUIRED");
      await refuses(() => delivery(op), "BODY.ASSIGNMENT_VALIDATION_REQUIRED");
      // Исправление сохранённого frame не сбрасывает уже проваленную validation scope.
      await Deno.writeTextFile(fixture.completePath, JSON.stringify(original));
      await refuses(() => op.validateRelease(request), "BODY.ASSIGNMENT_VALIDATION_REQUIRED");
    });
    await Deno.writeTextFile(fixture.completePath, JSON.stringify(invalid));
    let downstreamCalled = false;
    await refuses(
      () =>
        fixture.use(async (op) => {
          await refuses(() => op.validateRelease(request), code);
          await refuses(
            () =>
              op.withProjectContracts([], async () => {
                downstreamCalled = true;
              }),
            "BODY.ASSIGNMENT_VALIDATION_REQUIRED",
          );
        }),
      "OPERATION_INCOMPLETE",
    );
    assert.equal(downstreamCalled, false, "Ошибка validation открыла downstream callback");
  }
  await Deno.writeTextFile(fixture.completePath, JSON.stringify(original));
  let retained: NativeOperation | undefined;
  await fixture.use(async (op) => {
    retained = op;
    await refuses(() => op.assignmentProvenance(), "BODY.ASSIGNMENT_VALIDATION_REQUIRED");
    await op.validateRelease(request);
    assert.deepEqual(
      (await op.assignmentProvenance()).documents.map((doc) => [doc.source, doc.format]),
      [["bank.qmd", "html"]],
    );
  });
  const closed = retained;
  assert.ok(closed);
  await refuses(() => closed.assignmentProvenance(), "OPERATION_EXPIRED");
  console.log(
    "PASS native public validation: incomplete/foreign/missing/orphan facts, sticky failure, closed downstream, provenance и expiry",
  );
} finally {
  await fixture.close();
}
