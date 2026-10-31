import * as Core from "../_extensions/course-core/public.ts";
import { join } from "stdlib/path";
import { captureFixture } from "./helpers/native-capture-a4c.ts";
const r = await captureFixture();
await Deno.mkdir(join(r.root, "_extensions/pl"), { recursive: true });
await Deno.writeTextFile(
  join(r.root, "_extensions/pl/contract.json"),
  JSON.stringify({ name: "pl" }),
);
await Deno.writeTextFile(
  join(r.root, "_quarto.yml"),
  (await Deno.readTextFile(join(r.root, "_quarto.yml"))).replace(
    "course-core-role: page",
    "course-core-role: exercise-bank",
  ).replace(
    "course: {id: scope-course, view: student}",
    "course: {id: scope-course, view: student, adapters: [pl]}\nmetadata-files: [settings.yml]",
  ),
);
await Deno.writeTextFile(
  join(r.root, "settings.yml"),
  `pl: &policy
  runtime: NEVER_CONFIG
  flag: true
assessment:
  id: metadata-lab
  kind: lab
  pl: *policy
project-checks:
  unused: {runtime: NEVER_CHECKS}
project-materialization:
  unused: {policy: NEVER_MATERIALIZATION}
`,
);
await Deno.writeTextFile(
  join(r.root, "_metadata.yml"),
  "pl: {directory: NEVER_DIRECTORY}\n",
);
await Deno.writeTextFile(
  join(r.root, "_quarto-student.yml"),
  "course: {view: student}\npl: {profile: NEVER_PROFILE}\n",
);
await Deno.writeTextFile(
  join(r.root, "index.qmd"),
  "---\nformat: html\n---\n# Работа\n\n::: {#exr-own target=pl difficulty=introductory statement-visibility=open}\n## Условие\n\nОткрытый текст.\n:::\n\n::: {.task-items}\n- @exr-own\n:::\n",
);
const native = await new Deno.Command("quarto", {
  args: ["render", "index.qmd", "--to", "html"],
  cwd: r.root,
  env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1" },
  stdout: "piped",
  stderr: "piped",
}).output();
if (!native.success) throw Error(new TextDecoder().decode(native.stderr));
let envelopeBytes = 0;
await Core.withCurrentNativeOperation(
  { ...r, profiles: ["student"] },
  async (op) => {
    const proof = await op.validateRelease({ expectedSources: ["index.qmd"] }, [
      {
        name: "pl",
        nativeMetadataReadSet: [
          "configuration",
          "assessment",
          "projectChecks",
          "projectMaterialization",
        ],
        validate(input) {
          const values = input.nativeMetadata.values as any;
          if (
            values.configuration.runtime !== "NEVER_CONFIG" ||
            values.configuration.directory !== "NEVER_DIRECTORY" ||
            values.configuration.profile !== "NEVER_PROFILE" ||
            values.assessment.runtime !== "NEVER_CONFIG" ||
            values.projectChecks.unused.runtime !== "NEVER_CHECKS" ||
            values.projectMaterialization.unused.policy !==
              "NEVER_MATERIALIZATION"
          ) throw Error("Native inheritance/alias authority lost");
          if (
            input.origin.format !== "html" ||
            input.origin.operation !== op.identity.operation ||
            !Object.isFrozen(values.configuration)
          ) throw Error("Native origin/mutability");
          envelopeBytes +=
            new TextEncoder().encode(JSON.stringify(input.nativeMetadata))
              .length;
          return { sources: [] };
        },
      },
    ]);
    const publicValue = JSON.stringify({
      catalog: op.catalog,
      document: op.document({ source: "index.qmd" }),
      proof,
    });
    if (publicValue.includes("NEVER_")) {
      throw Error(
        "Policy leaked through public transport",
      );
    }
    const html = await Deno.readTextFile(join(r.root, "_site/index.html"));
    if (html.includes("NEVER_")) throw Error("Policy leaked to HTML");
    console.log(
      JSON.stringify({ root: r.root, metrics: op.metrics, envelopeBytes }),
    );
  },
);
console.log(
  "PASS actual native four-plane producer, YAML alias/profile/directory/metadata-files inheritance and private output",
);
