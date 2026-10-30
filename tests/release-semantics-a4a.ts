// Pure owner semantic checks; this matrix does not manufacture production authority.
import { normalizeDocument } from "../_extensions/course-core/public.ts";
import { validateNativeRelease } from "../_extensions/course-core/release/validate.ts";
import {
  AssessmentCompositionSchema,
  NativeReleaseFactsSchema,
} from "../_extensions/course-core/release/contracts.ts";
const operation = crypto.randomUUID();
const declaration = {
  difficulty: "introductory",
  "statement-visibility": "open",
  "course-role": "demonstration",
} as const;
const slot = {
  id: "exr-demo",
  selection: "fixed",
  candidates: ["exr-demo"],
  assignment: {
    stage: "demonstration",
    requirement: "required",
    workMode: "individual",
  },
} as const;
const facts = NativeReleaseFactsSchema.parse({
  course: { id: "demo", view: "student" },
  nativeMetadata: {adapters:{}},
  declarations: [{ id: "exr-demo", hasSolution: true, attributes: {} }],
  assessment: {
    id: "lab-demo",
    title: "Работа",
    kind: "lab",
    slots: [slot],
    memberContainers: 1,
    memberKinds: ["BulletList"],
    memberSizes: [1],
  },
});
const base = {
  source: "index.qmd",
  early: {
    context: {
      operation,
      input: "index.qmd",
      projection: "student" as const,
      profiles: [],
      format: "html",
      exerciseBank: true,
      defaults: {},
    },
    definitions: { "exr-demo": declaration },
    release: facts,
  },
  final: { hasPublicSolution: { "exr-demo": true } },
};
const checks: { name: string; passed: boolean }[] = [];
async function test(
  name: string,
  alter: (value: typeof base) => void,
  code: string,
) {
  const value = structuredClone(base);
  alter(value);
  let error = "";
  try {
    await validateNativeRelease(
      [value],
      { operation, projection: "student", profiles: [] },
      { expectedSources: ["index.qmd"] },
      [],
      [],
      async () => {},
      async () => {},
    );
  } catch (e) {
    error = String(e);
  }
  checks.push({ name, passed: error.includes(code) });
}
await test("unknown-member", (v) => {
  v.early.release.assessment!.slots[0].candidates = ["exr-missing"];
}, "CORE.UNKNOWN_MEMBER");
await test("unknown-related", (v) => {
  v.early.release.assessment!.relatedExercise = "exr-missing";
}, "CORE.RELATED_EXERCISE_MISSING");
await test("practical-open", (v) => {
  v.early.release.assessment!.kind = "practical";
}, "CORE.ASSESSMENT_INVALID");
await test("test-open", (v) => {
  v.early.release.assessment!.kind = "test";
}, "CORE.ASSESSMENT_INVALID");
await test("demonstration-no-late-solution", (v) => {
  v.final.hasPublicSolution["exr-demo"] = false;
}, "CORE.ASSESSMENT_INVALID");
await test("unknown-target", (v) => {
  v.early.release.declarations[0].target = "uninstalled";
  v.early.release.declarations[0].head = { level: 2, title: "Задача" };
}, "CORE.UNKNOWN_TARGET");
await test("wrong-view", (v) => {
  v.early.release.course.view = "full";
}, "RELEASE.EXPECTATION_MISMATCH");
let duplicate = "";
try {
  await validateNativeRelease(
    [base, { ...structuredClone(base), source: "other.qmd" }],
    { operation, projection: "student", profiles: [] },
    { expectedSources: ["index.qmd", "other.qmd"] },
    [],
    [],
    async () => {},
    async () => {},
  );
} catch (e) {
  duplicate = String(e);
}
checks.push({
  name: "duplicate-declaration-across-documents",
  passed: duplicate.includes("CORE.DUPLICATE_EXERCISE"),
});
const invalids: Record<string, unknown> = {
  "fixed-cardinality": {
    ...facts.assessment,
    slots: [{ ...slot, candidates: ["exr-demo", "exr-other"] }],
  },
  "random-cardinality": {
    ...facts.assessment,
    slots: [{ ...slot, id: "alt-demo", selection: "random" }],
  },
  "choice-optional": {
    ...facts.assessment,
    slots: [{
      ...slot,
      id: "alt-demo",
      selection: "choice",
      candidates: ["exr-demo", "exr-other"],
      assignment: { ...slot.assignment, requirement: "optional" },
    }],
  },
  "duplicate-slot": {
    ...facts.assessment,
    slots: [slot, slot],
    memberSizes: [1, 1],
  },
  "negative-theory-time": { ...facts.assessment, theoryTime: -1 },
  "bad-member-shape": { ...facts.assessment, memberSizes: [2] },
  "unknown-assignment": {
    ...facts.assessment,
    slots: [{ ...slot, assignment: { ...slot.assignment, unknown: true } }],
  },
};
for (const [name, value] of Object.entries(invalids)) {
  checks.push({
    name,
    passed: !AssessmentCompositionSchema.safeParse(value).success,
  });
}
const accepted = normalizeDocument({
  "pandoc-api-version": [1, 23],
  meta: {},
  blocks: [],
}, {
  operation,
  input: "page.qmd",
  format: "html",
  projection: "student",
  exerciseBank: false,
});
checks.push({
  name: "pure-normalization-still-pure",
  passed: accepted.occurrences.length === 0,
});
console.log(
  JSON.stringify({
    status: checks.every((c) => c.passed) ? "PASS" : "FAIL",
    checks,
  }),
);
if (checks.some((c) => !c.passed)) throw Error("A4a release semantics");
