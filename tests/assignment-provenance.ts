import { fixtureAt, fixtureRecord, required } from "./helpers/required.ts";
import {
  buildAssignmentProvenance,
  NativeAssignmentProvenanceSchema,
  validateAssignmentProvenance,
} from "../_extensions/course-core/runtime/assignment-provenance.ts";
import { NativeProjectFactsCaptureSchema } from "../_extensions/course-core/document/project-facts.ts";
type Captured = Parameters<typeof buildAssignmentProvenance>[3][number];
const identity: Parameters<typeof buildAssignmentProvenance>[0] = {
    operation: crypto.randomUUID(),
    projection: "author",
    profiles: ["full"],
    runtime: "quarto-1.11.5",
  },
  context: Captured["early"]["context"] = {
    operation: identity.operation,
    profiles: identity.profiles,
    projection: identity.projection,
    captureWitness: crypto.randomUUID(),
    input: "/owner/bank.qmd",
    format: "revealjs",
    exerciseBank: true,
    defaults: {},
  };
const early: Captured["early"] = {
  context,
  definitions: {
    "exr-visible": {
      difficulty: "introductory",
      project: "/visible",
      "statement-visibility": "open",
    },
    "exr-hidden": {
      difficulty: "introductory",
      project: "/hidden",
      "statement-visibility": "restricted",
    },
  },
  release: {
    course: {
      id: "projection",
      view: "full",
      adapters: ["prairielearn", "other"],
    },
    nativeMetadata: {
      adapters: {},
      projectChecks: { profiles: { junit: { runtime: "java25-junit-v1" } } },
    },
    declarations: [{
      id: "exr-visible",
      project: "/visible",
      target: "prairielearn",
      check: "junit",
      hasSolution: false,
      attributes: {},
    }, {
      id: "exr-hidden",
      project: "/hidden",
      target: "other",
      check: "junit",
      hasSolution: false,
      attributes: {},
    }],
  },
};
const docs: Captured[] = [{
  source: "bank.qmd",
  early,
  projectFacts: {
    schema: "course-native-project-facts-v1",
    context,
    source: "bank.qmd",
    projectMaterializations: {},
    projects: Object.entries(early.definitions).map(([id, v]) => ({
      exerciseId: id,
      source: "bank.qmd",
      projectRoot: v.project!.slice(1),
      bankMember: true,
      projectCheck: "junit",
      statementVisibility: v["statement-visibility"],
      artifactPolicy: {
        ...(id === "exr-visible" ? { student: "starter" } : {}),
        full: "full",
        conditions: id === "exr-visible",
      },
    })),
  },
}];
const result = buildAssignmentProvenance(
  identity,
  ["bank.qmd"],
  ["bank.qmd"],
  docs,
);
const retiredTopFields = {
  schema: "course-native-assignment-provenance-v1",
  identity,
  ownerInputs: ["bank.qmd"],
  capturedInputs: ["bank.qmd"],
  projects: [],
};
const retiredDocumentFields = ["courseId", "projectMaterializations"];
const projectionFailures: string[] = [];
for (const [field, value] of Object.entries(retiredTopFields)) {
  if (Object.hasOwn(result, field)) {
    projectionFailures.push("Top field remains: " + field);
  }
  const injected = { ...result, [field]: value };
  if (NativeAssignmentProvenanceSchema.safeParse(injected).success) {
    projectionFailures.push(
      "Strict schema accepted retired top field: " + field,
    );
  }
}
for (const field of retiredDocumentFields) {
  if (Object.hasOwn(required(result.documents[0]), field)) {
    projectionFailures.push("Document field remains: " + field);
  }
  const injected = structuredClone(result);
  Reflect.set(
    required(injected.documents[0]),
    field,
    field === "courseId" ? "retired" : {},
  );
  if (NativeAssignmentProvenanceSchema.safeParse(injected).success) {
    projectionFailures.push(
      "Strict schema accepted retired document field: " + field,
    );
  }
}
if (projectionFailures.length) throw Error(projectionFailures.join("\n"));
if (
  required(result.documents[0]).projects.length !== 2 ||
  !required(result.documents[0]).projects.some((r) => r.exerciseId === "exr-hidden") ||
  required(result.documents[0]).format !== "revealjs" || "sourceRows" in result
) throw Error("Hidden/nonPL completeness lost");
if (
  required(result.documents[0]).projects.some((p) => p.projectCheck !== "junit") ||
  JSON.stringify(required(result.documents[0]).projectChecks) !==
    JSON.stringify(early.release!.nativeMetadata.projectChecks)
) throw Error("Same-source generic selector/raw plane lost");
if (
  "sourceSnapshotHash" in result || "inventoryHash" in result ||
  JSON.stringify(result).includes("answer")
) throw Error("Invented legacy hash/private content");
// Проекция не должна freeze/alias private input, включая unknown raw plane.
const privatePlane = fixtureRecord(fixtureAt(required(early.release).nativeMetadata.projectChecks,["profiles","junit"]));
if (Object.isFrozen(identity) || Object.isFrozen(privatePlane)) {
  throw Error("Projection froze private captured input");
}
privatePlane.runtime = "input-changed";
const projectedPlane = fixtureRecord(fixtureAt(required(result.documents[0]).projectChecks,["profiles","junit"]));
if (projectedPlane.runtime !== "java25-junit-v1") {
  throw Error("Projection aliases captured raw plane");
}
if (
  !Object.isFrozen(required(result.documents[0]).projects) ||
  !Object.isFrozen(projectedPlane) ||
  !Object.isFrozen(required(required(result.documents[0]).projects[0]).artifactPolicy)
) {
  throw Error("Projection lost deep immutability");
}
privatePlane.runtime = "java25-junit-v1";
const retired = structuredClone(result);
Reflect.set(required(required(retired.documents[0]).projects[0]), "check", { runtime: "retired" });
if (NativeAssignmentProvenanceSchema.safeParse(retired).success) {
  throw Error("Public provenance accepted retired normalized Core check field");
}
for (
  const bad of [{ owner: ["bank.qmd", "missing.qmd"], docs }, {
    owner: ["bank.qmd", "bank.qmd"],
    docs,
  }, {
    owner: ["bank.qmd"],
    docs: [...docs, ...docs],
  }, {
    owner: ["bank.qmd"],
    docs: docs.map((v) => ({ ...v, projectFacts: undefined })),
  }]
) {
  let failed = false;
  try {
    buildAssignmentProvenance(
      identity,
      bad.owner,
      ["bank.qmd"],
      bad.docs,
    );
  } catch (e) {
    failed = /BODY.PROVENANCE_(?:COVERAGE|UNQUALIFIED)/.test(String(e));
  }
  if (!failed) throw Error("Missing scope/producer accepted");
}
console.log(
  "PASS pure typed provenance complete hidden/nonPL actual-format project projection, без sourceRows, scope/producer refusal; no legacy v3 equivalence or I/O authority",
);

for (
  const mutate of [
    (v: Captured) => v.projectFacts!.context.operation = crypto.randomUUID(),
    (v: Captured) =>
      v.projectFacts!.context.captureWitness = crypto.randomUUID(),
    (v: Captured) => v.projectFacts!.context.format = "html",
    (v: Captured) => v.projectFacts!.context.projection = "student",
    (v: Captured) => v.projectFacts!.context.profiles = ["foreign"],
    (v: Captured) => {
      v.early.context.operation = crypto.randomUUID();
      v.projectFacts!.context.operation = v.early.context.operation;
    },
    (v: Captured) => v.projectFacts!.projects.pop(),
    (v: Captured) => required(v.projectFacts!.projects[0]).projectCheck = "foreign",
    (v: Captured) => required(v.projectFacts!.projects[0]).source = "other.qmd",
    (v: Captured) =>
      v.projectFacts!.projects[1] = structuredClone(
        required(v.projectFacts!.projects[0]),
      ),
  ]
) {
  const modified = structuredClone(docs);
  required(modified[0]).projectFacts = structuredClone(required(modified[0]).projectFacts);
  mutate(required(modified[0]));
  let refused = false;
  try {
    buildAssignmentProvenance(
      identity,
      ["bank.qmd"],
      ["bank.qmd"],
      modified,
    );
  } catch (e) {
    refused = String(e).includes("BODY.PROVENANCE_UNQUALIFIED");
  }
  if (!refused) throw Error("Foreign/incomplete project frame accepted");
}
console.log(
  "PASS provenance same-operation/source/format/witness/projection/profiles/duplicate/reverse-coverage mutants and isolated immutable projection",
);
// Malformed producer shapes принадлежат decoder перед typed builder.
for (
  const mutate of [
    (value: Record<string, unknown>) =>
      value.projectMaterializations = {
        "exr-visible": {
          commonFiles: [{
            source: "private/Answer.java",
            target: "student/Answer.java",
            audience: "student",
          }],
        },
      },
    (value: Record<string, unknown>) =>
      value.projectMaterializations = {
        "exr-visible": {
          commonFiles: [{
            source: "shared/Answer.java",
            target: "student/private/Answer.java",
            audience: "student",
          }],
        },
      },
  ]
) {
  const malformed: Record<string, unknown> = structuredClone(
    required(docs[0]).projectFacts!,
  );
  mutate(malformed);
  if (NativeProjectFactsCaptureSchema.safeParse(malformed).success) {
    throw Error(
      "Malformed producer count/private roles accepted at capture boundary",
    );
  }
}
// Same typed source facts могут содержать конфликтующие materialization declarations.
const conflict = structuredClone(docs);
required(required(conflict[0]).projectFacts!.projects[0]).materialization = {
  commonFiles: [],
  includeGit: false,
};
required(conflict[0]).projectFacts!.projectMaterializations["exr-visible"] = {
  commonFiles: [],
  includeGit: true,
};
let conflictRefused = false;
try {
  validateAssignmentProvenance(identity, ["bank.qmd"], ["bank.qmd"], conflict);
} catch (error) {
  conflictRefused = String(error).includes(
    "CORE.PROJECT_MATERIALIZATION_INVALID",
  );
}
if (!conflictRefused) throw Error("Materialization conflict accepted");
const materialized = structuredClone(docs);
required(materialized[0]).projectFacts!.projectMaterializations["exr-hidden"] = {
  commonFiles: [{
    source: "shared/Test.java",
    target: "tests/Test.java",
    audience: "grading",
  }],
};
const projected = buildAssignmentProvenance(identity, ["bank.qmd"], [
  "bank.qmd",
], materialized);
const effective = required(required(required(projected.documents[0]).projects.find((fact) =>
    fact.exerciseId === "exr-hidden"
  )).materialization);
if (
  required(effective?.commonFiles[0]).audience !== "grading" ||
  effective.includeGit !== false ||
  !Object.isFrozen(effective.commonFiles[0]) ||
  required(required(materialized[0]).projectFacts!.projects[1]).materialization !== undefined
) {
  throw Error(
    "Projection lost bound materialization/input isolation after removing declaration map",
  );
}
console.log(
  "PASS capture private role/producer shape boundary and typed materialization conflict",
);
