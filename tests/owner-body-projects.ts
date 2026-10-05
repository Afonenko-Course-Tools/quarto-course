// Body project capability gate; native owner regressions retain the raw audit.
import { selectBodies } from "../_extensions/course-core/body-export/producer.ts";
import type { Audit } from "../_extensions/course-core/owner-preflight/owner.ts";
const source = "index.qmd";
for (
  const [name, project, accepted] of [
    ["explicit default", { type: "default" }, true],
    ["book", { type: "book" }, true],
    ["implicit default", { render: [source] }, true],
    ["website", { type: "website" }, false],
    ["unknown", { type: "unknown" }, false],
    ["missing", undefined, false],
    ["null", null, false],
    ["non-object", "default", false],
    ["array", [], false],
    ["explicit null type", { type: null }, false],
  ] as const
) {
  const audit = {
    coverage: { [source]: { kind: "root", profiles: ["student", "full"] } },
    profiles: Object.fromEntries(
      ["student", "full"].map((profile) => [profile, {
        config: { ...(project === undefined ? {} : { project }) },
      }]),
    ),
  } as unknown as Audit;
  const before = JSON.stringify(audit);
  try {
    const selection = await selectBodies(
      audit,
      { sources: [source] },
      "project-gate",
    );
    if (!accepted || selection?.sources.join() !== source) {
      throw new Error("Unexpected accepted project: " + name);
    }
  } catch (error) {
    if (accepted || !String(error).includes("BODY.PROJECT_UNSUPPORTED")) {
      throw error;
    }
  }
  if (JSON.stringify(audit) !== before) {
    throw new Error("Mutated native audit: " + name);
  }
  console.log("PASS Body project capability: " + name);
}
