import {
  buildAssignmentProvenance,
  NativeAssignmentProvenanceSchema,
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
    collectCalls: 1,
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
if (
  result.projects.length !== 2 ||
  !result.projects.some((r) =>
    r.id === "exr-hidden" && r.format === "revealjs"
  ) || "sourceRows" in result
) throw Error("Hidden/nonPL completeness lost");
if (
  result.documents[0].projects.some((p) => p.projectCheck !== "junit") ||
  JSON.stringify(result.documents[0].projectChecks) !==
    JSON.stringify(early.release!.nativeMetadata.projectChecks)
) throw Error("Same-source generic selector/raw plane lost");
if (
  "sourceSnapshotHash" in result || "inventoryHash" in result ||
  JSON.stringify(result).includes("answer")
) throw Error("Invented legacy hash/private content");
// Проекция не должна freeze/alias private input, включая unknown raw plane.
const privatePlane = early.release!.nativeMetadata.projectChecks as {
  profiles: { junit: { runtime: string } };
};
if (Object.isFrozen(identity) || Object.isFrozen(privatePlane.profiles.junit)) {
  throw Error("Projection froze private captured input");
}
privatePlane.profiles.junit.runtime = "input-changed";
const projectedPlane = result.documents[0].projectChecks as typeof privatePlane;
if (projectedPlane.profiles.junit.runtime !== "java25-junit-v1") {
  throw Error("Projection aliases captured raw plane");
}
if (
  !Object.isFrozen(result.identity.profiles) ||
  !Object.isFrozen(projectedPlane.profiles.junit) ||
  !Object.isFrozen(result.documents[0].projects[0].artifactPolicy)
) {
  throw Error("Projection lost deep immutability");
}
privatePlane.profiles.junit.runtime = "java25-junit-v1";
const retired = structuredClone(result);
Reflect.set(retired.documents[0].projects[0], "check", { runtime: "retired" });
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
    (v: Captured) => v.projectFacts!.projects[0].projectCheck = "foreign",
    (v: Captured) => v.projectFacts!.projects[0].source = "other.qmd",
    (v: Captured) =>
      v.projectFacts!.projects[1] = structuredClone(
        v.projectFacts!.projects[0],
      ),
  ]
) {
  const modified = structuredClone(docs);
  modified[0].projectFacts = structuredClone(modified[0].projectFacts);
  mutate(modified[0]);
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
    (value: Record<string, unknown>) => value.collectCalls = 2,
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
    docs[0].projectFacts!,
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
conflict[0].projectFacts!.projects[0].materialization = {
  commonFiles: [],
  includeGit: false,
};
conflict[0].projectFacts!.projectMaterializations["exr-visible"] = {
  commonFiles: [],
  includeGit: true,
};
let conflictRefused = false;
try {
  buildAssignmentProvenance(identity, ["bank.qmd"], ["bank.qmd"], conflict);
} catch (error) {
  conflictRefused = String(error).includes(
    "CORE.PROJECT_MATERIALIZATION_INVALID",
  );
}
if (!conflictRefused) throw Error("Materialization conflict accepted");
console.log(
  "PASS capture private role/producer shape boundary and typed materialization conflict",
);
