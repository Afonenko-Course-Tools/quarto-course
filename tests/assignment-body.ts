import type { AssignmentBodyCache } from "../_extensions/course-core/body-export/assignment.ts";
import * as Core from "../_extensions/course-core/public.ts";
import { fixtureArray, fixtureAt, fixtureRecord, fixtureSet, required } from "./helpers/required.ts";
import { citationResourceGuard } from "../_extensions/course-core/body-export/citation-inputs.ts";
import { normalizeDocument } from "../_extensions/course-core/document/normalize.ts";
import { finalizeDocument } from "../_extensions/course-core/document/finalize.ts";
import { buildAssignmentBody } from "../_extensions/course-core/body-export/assignment.ts";
import { assignmentRolePredicate } from "../_extensions/course-core/runtime/assignment-roles.ts";
import {
  assertAssignmentConditionPlan,
  bindAssignmentCondition,
} from "../_extensions/course-core/runtime/assignment-condition.ts";
function assert(v: unknown, s: string): asserts v {
  if (!v) throw Error(s);
}
const p = (s: string) => ({ t: "Para", c: [{ t: "Str", c: s }] }),
  div = (
    id: string,
    body: unknown[],
    classes: string[] = [],
    pairs: string[][] = [],
  ) => ({ t: "Div", c: [[id, classes, pairs], body] }),
  spec = (yaml: string) => ({
    t: "CodeBlock",
    c: [["", ["yaml", "answer-spec"], []], yaml],
  });
const forms = [["manual", "type: manual\nsubmission: text"], [
  "numeric",
  "type: numeric\nkey: {value: 918273, tolerance: {absolute: 0.125}}",
], [
  "multipart",
  "type: multipart\nparts:\n  - {name: cost, label: Цена, type: numeric, key: {value: 918273, tolerance: {absolute: 0.125}}}\n  - {name: reason, label: Причина, type: manual, submission: text}",
], [
  "matching",
  "type: matching\nprompts: [Процесс, Поток]\noptions: [Свой, Общий, Лишний]\nkey: {pairs: {Процесс: Свой, Поток: Общий}}",
]] as const;
const root = await Deno.makeTempDir({ prefix: "assignment-body-" });
try {
  const context = {
    operation: crypto.randomUUID(),
    captureWitness: crypto.randomUUID(),
    input: "bank/items.qmd",
    format: "revealjs",
    profiles: ["full", "lab"],
    projection: "author" as const,
    exerciseBank: true,
    defaults: {
      difficulty: "introductory" as const,
      "statement-visibility": "restricted" as const,
    },
  };
  const ast = {
    "pandoc-api-version": [1, 23, 1],
    meta: {},
    blocks: [
      ...forms.map(([id, yaml]) =>
        div("exr-" + id, [p("CONDITION-" + id), spec(yaml)])
      ),
      div("exr-choice", [
        p("CONDITION-choice"),
        div("", [{ t: "BulletList", c: [[p("Первый")], [p("Второй")]] }], [
          "answer",
        ], [["type", "single-choice"], ["correct", "0"]]),
      ]),
    ],
  };
  // The checked choice marker belongs to the source, never public transport.
  fixtureSet(ast, ["blocks", forms.length, "c", 1, 1, "c", 1, 0, "c", 0, 0, "c"], [{
    t: "Span",
    c: [["", ["correct"], []], [{ t: "Str", c: "Первый" }]],
  }]);
  fixtureSet(ast, ["blocks", forms.length, "c", 1, 1, "c", 0, 2], [["type", "single-choice"]]);
  const early = normalizeDocument(ast, context, {
    source: context.input,
    assessments: [{ source: "work.qmd", id: "work" }],
  });
  const late = {
    context,
    occurrences: early.occurrences.map((row, i) => ({
      key: row.key,
      nativeKind: "Div",
      anchor: row.exerciseId,
      title: [{ t: "Strong", c: [{ t: "Str", c: "Поздний заголовок " + i }] }],
      body: structuredClone(fixtureArray(fixtureAt(early.ast, ["blocks",i,"c",1]))),
    })),
    assignment: { introductions: [] },
  };
  const bank = Core.NativePublicDocumentSchema.parse(finalizeDocument(early, late));
  const publicTests = div("", [
    p("Публичные проверки"),
    { t: "BulletList", c: [[p("При входе 2 ожидается 4.")]] },
    { t: "CodeBlock", c: [["", ["java"], []], "assertEquals(4, square(2));"] },
  ], ["public-tests"]);
  required(bank.occurrences[0]).body.push(publicTests);
  const link = (href: string) => ({
    t: "Link",
    c: [["", [], []], [{ t: "Str", c: "Ресурс" }], [href, ""]],
  });
  required(bank.occurrences[0]).body.push({
    t: "Para",
    c: [link("../assets/public.txt?raw=1#part")],
  });
  const workDoc = Core.NativePublicDocumentSchema.parse({
    status: "complete",
    pandocApiVersion: [1, 23, 1],
    context: { ...context, input: "work.qmd", exerciseBank: false },
    definitions: {},
    occurrences: [],
    hasPublicSolution: {},
    unresolved: [],
    assignment: {
      source: "work.qmd",
      assessments: [],
      introductions: {
        work: [p("Богатое введение"), { t: "BulletList", c: [[p("Пункт")]] }],
      },
      answers: {},
      citationMetadata: {},
    },
  });
  const ids = Object.keys(bank.definitions);
  const composition = Core.AssessmentCompositionSchema.parse({
      id: "work",
      title: "Составная работа",
      kind: "practical",
      memberContainers: 1,
      memberKinds: ["BulletList"],
      memberSizes: ids.map(() => 1),
      slots: ids.map((id) => ({
        id,
        selection: "fixed",
        candidates: [id],
        assignment: { requirement: "required", workMode: "individual" },
      })),
    });
  let reads = 0;
  const cache: AssignmentBodyCache = { questions: new Map(), introductions: new Map() };
  const args = {
    root,
    owner: "demo",
    cache,
    work: { source: "work.qmd", composition },
    documents: [bank, workDoc],
    assertPublicResource: assignmentRolePredicate([{
      path: root + "/closed-golden",
      tree: true,
      public: false,
      reason: "solutions",
    }], []),
    readResource: async () => {
      reads++;
      return {
        bytes: new TextEncoder().encode("PUBLIC"),
        identity: "physical-public",
      };
    },
  };
  const build = async (
    input: Omit<typeof args, "cache"> & { cache?: typeof args.cache | undefined },
  ) =>
    buildAssignmentBody({
      ...input,
      assertCitationResource: citationResourceGuard(
        { root, outputDirectory: root + "/_generated/output" },
        input.documents,
        {
          assertPath: input.assertPublicResource,
          assertIdentity: input.assertPublicResource.assertIdentity,
        },
      ),
    });
  const built = await build(args);
  for (
    const body of [
      required(built.publicPackage.questions[0]).condition,
      required(built.conditions["exr-manual"]).body,
    ]
  ) {
    assert(
      body.some((node) =>
        JSON.stringify(node) === JSON.stringify(publicTests)
      ),
      "Обычный Div public-tests потерян между native condition и Assignment Body",
    );
  }
  assert(built.publicPackage.questions.length === 5, "Не все пять форм");
  assert(
    required(built.publicPackage.questions[0]).title === "Поздний заголовок 0",
    "Потерян actual late title",
  );
  assert(
    required(built.publicPackage.works[0]).kind === "practical" &&
      JSON.stringify(required(built.publicPackage.works[0]).introduction).includes(
        "Богатое введение",
      ),
    "Rich intro/kind lost",
  );
  const text = JSON.stringify(built.publicPackage);
  assert(
    !/918273|tolerance|closedKey|gradingNotes|correct/.test(text),
    "Private answer facts leaked",
  );
  assert(
    reads === 1 &&
      required(built.publicPackage.resources[0]).target === "assets/public.txt" &&
      text.includes("assets/public.txt?raw=1#part"),
    "Resource origin/suffix lost",
  );
  assert(
    Object.values(built.conditions).every((c) =>
      c.kind === "assignment" && c.context.format === "revealjs" &&
      c.context.projection === "author" &&
      JSON.stringify(c.context.profiles) === '["full","lab"]'
    ),
    "Actual context forged",
  );
  assert(
    required(built.conditions["exr-choice"]).responseSlots.length === 2 &&
      required(built.conditions["exr-multipart"]).responseSlots.length === 2,
    "Response slot identity/cardinality lost",
  );
  const condition = required(built.conditions["exr-manual"]);
  const plan = Core.ProjectPlanSchema.parse({
    id: crypto.randomUUID(), input: "project", audience: "student",
    testsets: [], components: [], groups: [],
  });
  bindAssignmentCondition(condition, [plan], args.assertPublicResource);
  assertAssignmentConditionPlan(condition, plan);
  for (const [v, q] of [[structuredClone(condition), plan], [condition, { ...plan }]] as const) {
    let error = "";
    try {
      assertAssignmentConditionPlan(v, q);
    } catch (e) {
      error = String(e);
    }
    assert(error.includes("CONDITION_AUTHORITY"), "Copied capability accepted");
  }
  const closed = structuredClone(bank);
  required(closed.occurrences[0]).body.push({
    t: "Para",
    c: [link("../closed-golden/private.txt")],
  });
  let error = "";
  const before = reads;
  try {
    await build({
      ...args,
      cache: undefined,
      documents: [closed, workDoc],
    });
  } catch (e) {
    error = String(e);
  }
  assert(
    error.includes("BODY.RESOURCE_PRIVATE_ROLE") && reads === before,
    "Closed resource read before role check",
  );
  await Deno.mkdir(root + "/bank");
  const withCitations = structuredClone(bank);
  await Deno.writeTextFile(
    root + "/refs.bib",
    "@book{condition, title={PUBLIC_CONDITION_ATTRIBUTION}, year={2024}}\n@book{answer, title={PUBLIC_ANSWER_ATTRIBUTION}, year={2023}}\n@book{unused, title={PRIVATE_UNUSED_ATTRIBUTION}, year={2022}}\n",
  );
  required(withCitations.assignment).citationMetadata = {
    bibliography: { t: "MetaString", c: "../refs.bib" },
    "link-citations": { t: "MetaBool", c: true },
  };
  const citation = (id: string) => ({
    t: "Para",
    c: [{
      t: "Cite",
      c: [[{
        citationId: id,
        citationPrefix: [],
        citationSuffix: [],
        citationMode: { t: "NormalCitation" },
        citationNoteNum: 0,
        citationHash: 0,
      }], [{ t: "Str", c: "@" + id }]],
    }],
  });
  required(withCitations.occurrences[0]).body.push(citation("condition"));
  required(required(withCitations.assignment).answers["exr-manual"]).publicAnswer.push(
    citation("answer"),
  );
  const citationPackage = await build({
    ...args,
    cache: undefined,
    documents: [withCitations, workDoc],
  });
  const citationText = JSON.stringify(citationPackage.publicPackage);
  assert(
    citationText.includes("PUBLIC_CONDITION_ATTRIBUTION") &&
      citationText.includes("PUBLIC_ANSWER_ATTRIBUTION") &&
      !citationText.includes("PRIVATE_UNUSED_ATTRIBUTION") &&
      !citationText.includes('"Cite"'),
    "Selected native bibliography/answer citation scope lost",
  );
  const privateCitation = structuredClone(withCitations);
  fixtureSet(privateCitation, ["assignment","citationMetadata","bibliography","c"], "../closed-golden/refs.bib");
  let citationError = "";
  try {
    await build({
      ...args,
      cache: undefined,
      documents: [privateCitation, workDoc],
    });
  } catch (e) {
    citationError = String(e);
  }
  assert(
    citationError.includes("BODY.RESOURCE_PRIVATE_ROLE"),
    "Closed citation file reached native citeproc",
  );
  for (
    const mutate of [
      (b: typeof bank) => delete required(b.assignment).answers["exr-numeric"],
      (b: typeof bank) => b.occurrences.splice(0, 1),
    ]
  ) {
    const b = structuredClone(bank);
    mutate(b);
    let failed = false;
    try {
      await build({
        ...args,
        cache: undefined,
        documents: [b, workDoc],
      });
    } catch (e) {
      failed = String(e).includes("BODY.ANSWER_OCCURRENCE_MISMATCH");
    }
    assert(failed, "Missing late fragment accepted");
  }
  console.log(
    "PASS pure native-fragment assembly: five forms, late title, rich intro, actual author/revealjs, exact capability, role-before-read and missing-fragment refusals; not producer qualification",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
