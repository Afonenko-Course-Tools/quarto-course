import { collectNativeProjectFacts } from "../_extensions/course-core/document/project-capture.ts";
import type { EarlyDocument } from "../_extensions/course-core/document/contracts.ts";
const owner = "/tmp/native-common-source-owner";
const file = (
  source: string,
  target = "student/tools/count.fish",
  audience = "student",
) => ({ source, target, audience });
function collect(source: string, commonFiles: unknown[]) {
  const early = {
    context: {
      operation: crypto.randomUUID(),
      captureWitness: crypto.randomUUID(),
      input: owner + "/" + source,
      format: "html",
      profiles: ["full"],
      projection: "author",
      exerciseBank: true,
      defaults: {},
    },
    definitions: { "exr-demo": { "statement-visibility": "open" } },
    release: {
      declarations: [{ id: "exr-demo", project: "/projects/demo" }],
      nativeMetadata: {
        projectMaterialization: {
          projects: { "exr-demo": { "common-files": commonFiles } },
        },
      },
    },
  } as unknown as EarlyDocument;
  return collectNativeProjectFacts(early, owner);
}
for (
  const [document, raw, expected] of [
    [
      "index.qmd",
      "/common/work-environment/count.fish",
      "common/work-environment/count.fish",
    ],
    [
      "labs/bank.qmd",
      "/common/work-environment/count.fish",
      "common/work-environment/count.fish",
    ],
    ["labs/bank.qmd", "../common/count.fish", "common/count.fish"],
    ["labs/bank.qmd", "common/count.fish", "labs/common/count.fish"],
  ]
) {
  const facts = collect(document, [file(raw)]);
  if (
    facts.source !== document ||
    facts.projectMaterializations["exr-demo"].commonFiles[0].source !==
      expected ||
    facts.projects[0].materialization?.commonFiles[0].source !== expected
  ) throw Error("Native common source canonical path differs");
}
for (
  const files of [
    [file("")],
    [file("../../secret")],
    [file("/../secret")],
    [file("https://host/x")],
    [file("common\\x")],
    [file("/private/x")],
    [file("/common/x", "reference/x", "student")],
    [file("/common/x", "student/x", "grading")],
    [file("/common/x", "student/x", "foreign")],
    [file("/common/x"), file("/common/y")],
    [file("/common/x", "../escape")],
  ]
) {
  let refused = false;
  try {
    collect("labs/bank.qmd", files);
  } catch (e) {
    refused = String(e).includes("CORE.PROJECT_MATERIALIZATION_INVALID");
  }
  if (!refused) {
    throw Error(
      "Invalid common source/target/audience/duplicate accepted: " +
        JSON.stringify(files),
    );
  }
}
console.log(
  "PASS root/nested native common source canon; escape/private/target/audience/duplicate refusals; pure field control, no Native child",
);
