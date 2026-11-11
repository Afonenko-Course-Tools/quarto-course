import { strict as assert } from "node:assert";
import type { Node } from "../_extensions/course-core/document/native-ast.ts";
import { NativePublicDocumentSchema } from "../_extensions/course-core/runtime/contracts.ts";
import { operationFixture } from "./helpers/operation-fixture.ts";
import { fixtureAt, required } from "./helpers/required.ts";

// Типы проверяются на результатах настоящего producer и его публичных consumers.
const ordinary = await operationFixture();
try {
  await ordinary.use(async (operation) => {
    const document = operation.document({ source: "bank.qmd" });
    const body: Node[] = required(document.occurrences[0]).body;
    const condition = operation.condition({
      source: "bank.qmd",
      exerciseId: "exr-one",
      view: "author",
    });
    const selected: Node[] = condition.body;
    assert.ok(body.length > 0 && selected.length > 0);
    assert.ok(JSON.stringify(selected).includes("Условие"));
    assert.ok(Object.isFrozen(condition.body));
    await operation.validateRelease({ expectedSources: ["bank.qmd"] });
  });
} finally {
  await ordinary.close();
}

const assignment = await operationFixture(true);
try {
  const capture: unknown = JSON.parse(await Deno.readTextFile(assignment.completePath));
  const document = NativePublicDocumentSchema.parse(fixtureAt(capture, ["documents", 0]));
  const fragments = required(document.assignment);
  const introduction: Node[] = required(fragments.introductions.work);
  const answer: Node[] = required(fragments.answers["exr-one"]).publicAnswer;
  assert.ok(introduction.length > 0 && answer.length > 0);
  await assignment.use(async (operation) => {
    await operation.validateRelease({ expectedSources: ["bank.qmd"] });
    const delivery = await operation.assignmentDelivery({
      source: "bank.qmd",
      assessmentId: "work",
    }, { projectPlans: [] });
    const body: Node[] = required(delivery.conditions["exr-one"]).body;
    const question = required(delivery.publicPackage.questions[0]);
    assert.ok(body.length > 0 && question.publicAnswer.length > 0);
    assert.ok(JSON.stringify(question.condition).includes("Условие"));
    assert.equal("closedKey" in question, false);
    assert.equal(required(delivery.conditions["exr-one"]).responseSlots[0]?.type, "manual");
    assert.ok(JSON.stringify(required(delivery.publicPackage.works[0]).introduction).includes("Работа"));
  });
} finally {
  await assignment.close();
}
console.log("PASS native AST contracts: actual ordinary/assignment capture → checked Node[] → public condition/Body delivery");
