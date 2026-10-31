import { buildAssignmentProvenance } from "../_extensions/course-core/runtime/assignment-provenance.ts";
const identity: any = {
    operation: crypto.randomUUID(),
    projection: "author",
    profiles: ["full"],
    runtime: "quarto-1.11.5",
  },
  context: any = {
    operation: identity.operation,
    profiles: identity.profiles,
    projection: identity.projection,
    captureWitness: crypto.randomUUID(),
    input: "/owner/bank.qmd",
    format: "revealjs",
    exerciseBank: true,
    defaults: {},
  };
const early: any = {
  context,
  definitions: {
    "exr-visible": { project: "/visible", "statement-visibility": "open" },
    "exr-hidden": { project: "/hidden", "statement-visibility": "restricted" },
  },
  release: {
    nativeMetadata: { adapters: {}, projectChecks: { profiles: {} } },
    declarations: [{
      id: "exr-visible",
      project: "/visible",
      target: "prairielearn",
    }, { id: "exr-hidden", project: "/hidden" }],
  },
};
const docs: any[] = [{
  source: "bank.qmd",
  early,
  projectFacts: {
    schema: "course-native-project-facts-v1",
    context,
    source: "bank.qmd",
    projectMaterializations: {},
    collectCalls: 1,
    projects: Object.entries(early.definitions).map(([id, v]: any) => ({
      exerciseId: id,
      source: "bank.qmd",
      projectRoot: v.project.slice(1),
      bankMember: true,
      statementVisibility: v["statement-visibility"],
      artifactPolicy: {
        ...(id === "exr-visible" ? { student: "starter" } : {}),
        full: "full",
        conditions: id === "exr-visible",
      },
    })),
  },
}];
const rows = [{ path: "bank.qmd", sha256: "a".repeat(64) }, {
  path: "hidden/private.txt",
  sha256: "b".repeat(64),
}];
const result = buildAssignmentProvenance(
  identity,
  ["bank.qmd"],
  ["bank.qmd"],
  rows,
  docs,
);
if (
  result.projects.length !== 2 ||
  !result.projects.some((r) =>
    r.id === "exr-hidden" && r.format === "revealjs"
  ) || result.sourceRows.length !== 2
) throw Error("Hidden/nonPL completeness lost");
if (
  "sourceSnapshotHash" in result || "inventoryHash" in result ||
  JSON.stringify(result).includes("answer")
) throw Error("Invented legacy hash/private content");
for (
  const bad of [{ owner: ["bank.qmd", "missing.qmd"], docs }, {
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
      rows,
      bad.docs,
    );
  } catch (e) {
    failed = /BODY.PROVENANCE_(?:COVERAGE|UNQUALIFIED)/.test(String(e));
  }
  if (!failed) throw Error("Missing scope/producer accepted");
}
console.log(
  "PASS pure typed provenance complete hidden/nonPL actual-format project projection, same-S rows, scope/producer refusal; no legacy v3 equivalence or I/O authority",
);

for (
  const mutate of [
    (v: any) => v.projectFacts.context.operation = crypto.randomUUID(),
    (v: any) => v.projectFacts.context.captureWitness = crypto.randomUUID(),
    (v: any) => v.projectFacts.context.format = "html",
    (v: any) => v.projectFacts.projects.pop(),
    (v: any) => v.projectFacts.projects[0].source = "other.qmd",
    (v: any) => v.projectFacts.collectCalls = 2,
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
      rows,
      modified,
    );
  } catch (e) {
    refused = String(e).includes("BODY.PROVENANCE_UNQUALIFIED");
  }
  if (!refused) throw Error("Foreign/incomplete project frame accepted");
}
console.log(
  "PASS provenance same-operation/source/format/witness/producer-count mutants",
);
