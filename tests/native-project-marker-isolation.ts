// Actual A1 copy/instrument/lifetime, Native boundary payload double; без render/inspect child.
import {
  assertProjectContext,
  assertProjectContextGeneration,
  decodeProjectContract,
  operationProjectContextReuse,
  projectContextSourceIdentities,
  readProjectContextFile,
} from "../_extensions/course-core/infrastructure/project-context.ts";
import { planProject } from "../_extensions/course-core/artifacts/plan.ts";
import { withAssignmentExecution } from "../_extensions/course-core/runtime/assignment-execution.ts";
import { assignmentRolePredicate } from "../_extensions/course-core/runtime/assignment-roles.ts";
import { parseDocument } from "../_extensions/course-core/body-export/vendor/libraries.js";
import { dirname, join } from "stdlib/path";
const actual = Deno.Command;
const assert = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const malformed = {
  "owner-config-primitive": "CONTEXT_RUNTIME",
  "owner-files-config": "CONTEXT_RUNTIME",
  "live-project": "CONTEXT_OWNER",
  "live-metadata-primitive": "CONTEXT_FORMAT",
  "live-metadata-array": "CONTEXT_FORMAT",
  "live-format": "CONTEXT_FORMAT",
};
for (
  const mode of [
    ...Object.keys(malformed),
    "valid",
    "extra-metadata",
    "missing-marker",
    "wrong-field",
  ]
) {
  const owner = await Deno.makeTempDir({ prefix: "current-a1-markers-" });
  const generation = {};
  let children = 0, retained: unknown;
  const put = async (name: string, value: string) => {
    await Deno.mkdir(dirname(join(owner, name)), { recursive: true });
    await Deno.writeTextFile(join(owner, name), value);
  };
  try {
    await put(
      "_quarto.yml",
      "project: {type: default, render: [index.qmd]}\nformat: {html: {}, revealjs: {}}\n",
    );
    await put("index.qmd", "# Native bank\n");
    for (const name of ["a", "b"]) {
      await put(
        `projects/${name}/_metadata.yml`,
        "course-project:\n  starter: {path: starter}\n  components:\n    helper: {path: common}\n",
      );
      await put(`projects/${name}/starter/Main.txt`, "PUBLIC " + name);
      await put(`projects/${name}/common/Helper.txt`, "CURRENT " + name);
    }
    // Завершившийся engine изменил workspace до A1 acquisition.
    await put("_results/ledger.txt", "after child\n");
    await put("projects/a/private/Answer.txt", "PRIVATE");
    await Deno.link(
      join(owner, "projects/a/private/Answer.txt"),
      join(owner, "projects/a/common/Alias.txt"),
    );
    (Deno as any).Command = class {
      constructor(_exe: unknown, readonly opts: any) {}
      async output() {
        children++;
        const input = this.opts.args[1];
        let value: unknown;
        if (input === owner) {
          const ownerValue = {
            dir: owner,
            quarto: { version: "1.11.5" },
            config: {
              project: { type: "default" },
              format: { html: {}, revealjs: {} },
              extension: { arbitrary: [1, null, { nested: "owner" }] },
            },
            files: {
              config: [join(owner, "_quarto.yml")],
              input: [join(owner, "index.qmd")],
            },
          };
          value = mode === "owner-config-primitive"
            ? { ...ownerValue, config: "unexpected" }
            : mode === "owner-files-config"
            ? { ...ownerValue, files: { config: [7] } }
            : mode === "extra-metadata"
            ? { ...ownerValue, files: { config: ownerValue.files.config } }
            : ownerValue;
        } else {
          const temp = input.slice(0, input.indexOf("/projects/"));
          const metadata = parseDocument(
            await Deno.readTextFile(join(dirname(input), "_metadata.yml")),
          )!.toJS();
          if (mode === "missing-marker") {
            delete metadata._course_core_origins_a1;
          }
          if (mode === "wrong-field") {
            metadata._course_core_origins_a1.components.helper.path =
              metadata._course_core_origins_a1.starter.path;
          }
          metadata.extension = { arbitrary: [1, null, { nested: "document" }] };
          const documentMetadata = mode === "live-metadata-primitive"
            ? "unexpected"
            : mode === "live-metadata-array"
            ? []
            : metadata;
          value = {
            quarto: { version: "1.11.5" },
            project: mode === "live-project" ? "unexpected" : { dir: temp },
            formats: {
              html: mode === "live-format"
                ? []
                : { metadata: documentMetadata },
              revealjs: { metadata: structuredClone(metadata) },
            },
          };
        }
        return {
          success: true,
          code: 0,
          signal: null,
          stdout: new TextEncoder().encode(JSON.stringify(value)),
          stderr: new Uint8Array(),
        };
      }
    };
    const acquire = operationProjectContextReuse({
      owner,
      profiles: [],
      generation,
      outputDirectory: join(owner, "_site"),
      sync: () => {},
    });
    let error = "";
    try {
      await withAssignmentExecution(
        {
          executable: Deno.env.get("QUARTO") || "/opt/quarto/bin/quarto",
          environment: Deno.env.toObject(),
          profiles: [],
          outputDirectory: join(owner, "_site"),
          inputs: ["index.qmd"],
          implementationFiles: [],
        },
        owner,
        () =>
          acquire([{
            owner,
            profiles: [],
            format: "html",
            inputs: [
              "projects/a/native-input.qmd",
              "projects/b/native-input.qmd",
            ],
          }, {
            owner,
            profiles: [],
            format: "revealjs",
            inputs: ["projects/a/native-input.qmd"],
          }], async (batch) => {
            const context = batch.groups[0].contexts[0];
            retained = context;
            assert(
              JSON.stringify(batch.groups[0].ownerMetadata.extension) ===
                '{"arbitrary":[1,null,{"nested":"owner"}]}',
              "Урезаны произвольные owner metadata",
            );
            if (mode === "extra-metadata") {
              assert(
                JSON.stringify(context.effectiveMetadata.extension) ===
                  '{"arbitrary":[1,null,{"nested":"document"}]}',
                "Урезаны произвольные document metadata",
              );
            }
            assert(
              decodeProjectContract(context).starter?.path === "starter",
              "Narrow contract потерял private binding",
            );
            await planProject(context, { audience: "student" });
            assertProjectContextGeneration(context, generation);
            let foreign = false;
            try {
              assertProjectContextGeneration(context, {});
            } catch {
              foreign = true;
            }
            assert(foreign, "Чужая generation получила authority");
            assert(
              batch.groups[1].contexts[0].format === "revealjs",
              "Потерян selected format",
            );
            assert(
              context.origins["components.helper.path"].resolvedPath ===
                join(owner, "projects/a/common"),
              "Потерян actual scalar origin",
            );
            assert(
              new TextDecoder().decode(
                await readProjectContextFile(
                  context,
                  join(owner, "projects/a/common/Helper.txt"),
                ),
              ) === "CURRENT a",
              "Выданы устаревшие A1 bytes",
            );
            await readProjectContextFile(
              context,
              join(owner, "projects/a/common/Helper.txt"),
            );
            const identities = projectContextSourceIdentities(context);
            const roles = assignmentRolePredicate(
              [{
                path: join(owner, "projects/a/private"),
                tree: true,
                public: false,
                reason: "solutions.reference.path",
              }],
              [],
              identities,
            );
            let alias = false;
            try {
              roles(join(owner, "projects/a/common/Alias.txt"));
            } catch (e) {
              alias = String(e).includes("BODY.RESOURCE_PRIVATE_ROLE");
            }
            assert(alias, "Fresh A1 hardlink alias стал публичным");
            assert(
              children === 3 && batch.metrics.inspectCalls === 3 &&
                batch.metrics.fullWalks === 1,
              "Повторный acquisition per-format/consumer",
            );
            assert(
              batch.metrics.sourceFileReads > 0 &&
                batch.metrics.sourceCopyBytes > 0 &&
                batch.metrics.sourceTreeHashes === 0,
              "Метрики скрыли actual copy/read",
            );
          }, mode !== "extra-metadata"),
      );
    } catch (e) {
      error = String(e);
    }
    if (mode === "valid" || mode === "extra-metadata") {
      assert(!error, "Actual current A1 отказал: " + error);
      let expired = false;
      try {
        await assertProjectContext(retained);
      } catch (e) {
        expired = String(e).includes("CONTEXT_EXPIRED");
      }
      assert(expired, "A1 context пережил callback");
      let clone = false;
      try {
        await assertProjectContext(structuredClone(retained));
      } catch (e) {
        clone = String(e).includes("CONTEXT_EXPIRED");
      }
      assert(clone, "DTO clone получил authority");
    } else if (mode in malformed) {
      const diagnostic = malformed[mode as keyof typeof malformed];
      assert(
        error.includes(diagnostic),
        "Malformed Native payload не получил " + diagnostic + ": " + error,
      );
    } else {
      assert(
        error.includes("ORIGIN_UNPROVEN"),
        "Подмена native scalar marker принята: " + error,
      );
    }
    console.log(
      JSON.stringify({
        mode,
        children,
        status: "PASS_CURRENT_A1_PRIVATE_CONTROL_NOT_NATIVE_QUALIFICATION",
      }),
    );
  } finally {
    (Deno as any).Command = actual;
    await Deno.remove(owner, { recursive: true });
  }
}
