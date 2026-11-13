import { required } from "./helpers/required.ts";
import { rejects } from "node:assert/strict";
import * as Core from "../_extensions/course-core/public.ts";
import { join, dirname, fromFileUrl } from "stdlib/path";
import { fixtureOperation, renderFixture } from "./helpers/native-operation-a3.ts";
import { assertProjectContextGeneration } from "../_extensions/course-core/infrastructure/project-context.ts";
const root = await Deno.makeTempDir({ prefix: "operation-project-reuse-" });
const extension = join(dirname(dirname(fromFileUrl(import.meta.url))), "_extensions/course-core/native-ts");
function assert(v: unknown, m: string): asserts v {
  if (!v) throw Error(m);
}
async function put(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
const request = { owner: root, directories: ["projects/a"], profiles: [], format: "html" };
try {
  await put(
    "_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\nformat: {html: {theme: none}}\ncourse-core-projection: student\nfilters:\n  - at: pre-ast\n    path: ${extension}/early-context.lua\n  - at: post-quarto\n    path: ${extension}/late-kind.lua\n  - at: post-render\n    path: ${extension}/late-filter.lua\ncourse-project: {starter: {path: student}}\n`,
  );
  await put(
    "index.qmd",
    '::: {#exr-one project="/projects/a" difficulty=introductory statement-visibility=open}\nУсловие.\n:::\n',
  );
  await put("projects/a/student/Main.java", "class Main {}");
  await renderFixture(root);
  let escaped: Core.ProjectContext | undefined;
  await rejects(
    fixtureOperation(root, async (op) => {
      const condition = op.condition({ source: "index.qmd", exerciseId: "exr-one", view: "student" });
      let first: Core.ArtifactFiles | undefined;
      await op.withProjectContexts([request], async (batch) => {
        escaped = required(required(batch.groups[0]).contexts[0]);
        first = await Core.materializeProject(await Core.planProject(escaped, { audience: "student" }), condition, {
          submission: { files: [], instructions: "Сдайте исходник." },
        });
        assert(
          first.files.some((f) => f.target === "Main.java" && new TextDecoder().decode(f.bytes) === "class Main {}"),
          "Starter bytes потеряны",
        );
      });
      let refused = false;
      try {
        await Core.planProject(escaped!, { audience: "student" });
      } catch (e) {
        refused = String(e).includes("CONTEXT_EXPIRED");
      }
      assert(refused, "Context пережил callback");
      await Core.readProjectContexts([request], async (fixtureGroups) => {
        const group = required(fixtureGroups[0]);
        const standalone = required(group.contexts[0]);
        const files = await Core.materializeProject(
          await Core.planProject(standalone, { audience: "student" }),
          condition,
          { submission: { files: [], instructions: "Сдайте исходник." } },
        );
        assert(JSON.stringify(files) === JSON.stringify(first), "Standalone/operation file bytes различаются");
        let refused = false;
        try {
          assertProjectContextGeneration(standalone, {});
        } catch (e) {
          refused = String(e).includes("BODY.ASSIGNMENT_PROJECT_PLANS");
        }
        assert(refused, "Standalone получил authority native operation");
      });
      await op.withProjectContexts([], async (batch) =>
        assert(batch.groups.length === 0, "Empty batch создала context"),
      );
      await op.withProjectContexts([request], async (batch) =>
        assert(required(batch.groups[0]).contexts[0] !== escaped, "Новая batch воскресила context"),
      );
      let failed: Core.ProjectContext | undefined;
      const sentinel = Error("CALLBACK_SENTINEL");
      await rejects(
        op.withProjectContexts([request], async (batch) => {
          failed = required(required(batch.groups[0]).contexts[0]);
          throw sentinel;
        }),
        (error: unknown) => error === sentinel,
        "Callback error потерян",
      );
      await rejects(
        Core.assertProjectContext(required(failed)),
        {
          name: "CoreContractError",
          code: "CONTEXT_EXPIRED",
        },
        "Контекст остался активен после ошибки callback",
      );
    }),
    {
      name: "CoreContractError",
      code: "OPERATION_INCOMPLETE",
    },
    "Операция приняла результат после ошибки batch",
  );
  console.log(
    "PASS operation project reuse: bytes, standalone parity, generation isolation, empty/new/failed batches, lifetime",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
