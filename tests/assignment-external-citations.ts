import { fixtureArray, fixtureRecord, fixtureString } from "./helpers/required.ts";
import { citationResourceGuard } from "../_extensions/course-core/body-export/citation-inputs.ts";
import { projectRolePredicate } from "../_extensions/course-core/domain/project-roles.ts";
import { NativePublicDocumentSchema } from "../_extensions/course-core/runtime/contracts.ts";
import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { withNativeCaptureScope } from "../_extensions/course-core/capture.ts";
import { withCurrentNativeOperation } from "../_extensions/course-core/public.ts";
const extension = join(
  dirname(dirname(fromFileUrl(import.meta.url))),
  "_extensions/course-core",
);
const parent = await Deno.makeTempDir({
  prefix: "assignment-external-citations-",
});
const root = join(parent, "tasks"),
  outputDirectory = join(root, "_generated/output");
let success = false;
try {
  await Deno.mkdir(join(root, "_extensions"), { recursive: true });
  await copy(extension, join(root, "_extensions/course-core"));
  await Deno.mkdir(join(parent, "bibliography"));
  await Deno.mkdir(join(root, "labs"));
  await Deno.writeTextFile(
    join(parent, "bibliography/public.bib"),
    "@book{public, title={PUBLIC_EXTERNAL_BIBLIOGRAPHY}, year={2026}}\n@book{unused,title={UNUSED_EXTERNAL_BIBLIOGRAPHY}}\n",
  );
  await Deno.writeTextFile(
    join(parent, "bibliography/style.csl"),
    `<style xmlns="http://purl.org/net/xbiblio/csl" version="1.0" class="in-text"><info><title>Проверка</title><id>http://example.org/test</id><updated>2026-11-05T00:00:00+00:00</updated></info><citation><layout prefix="[" suffix="]"><text variable="citation-number"/></layout></citation><bibliography><layout><text variable="title"/></layout></bibliography></style>`,
  );
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    `project:\n  type: website\n  render: [labs/work.qmd]\n  pre-render: [quarto run _extensions/course-core/entrypoints/native-pre.ts]\n  post-render: [quarto run _extensions/course-core/entrypoints/native-post.ts]\nformat: {html: {theme: none}}\ncourse: {id: external-citations, view: full}\ncourse-core-runtime: native-ts\ncourse-core-projection: author\nexercise-bank: true\ndefault-exercise-statement-visibility: open\nbibliography: [../bibliography/public.bib]\ncsl: ../bibliography/style.csl\nfilters: [course-core]\n`,
  );
  await Deno.writeTextFile(
    join(root, "labs/work.qmd"),
    `---\nassessment: {id: work, kind: seminar}\n---\n# Работа\n\nВведение с источником [@public].\n\n::: {#exr-one difficulty=introductory}\nУсловие со ссылкой [@public].\n:::\n\n::: {.task-items}\n1. @exr-one\n:::\n`,
  );
  await withNativeCaptureScope(
    { root, projection: "author", outputDirectory },
    {
      assignment: {
        mode: "new",
        prepare: async () => ({
          expectedSources: ["labs/work.qmd"],
          assessments: [{ source: "labs/work.qmd", id: "work" }],
        }),
      },
    },
    async (scope) => {
      await scope.withPreparedOperation(async (lease) =>
        await lease.captureInputs(lease.descriptor, ["labs/work.qmd"], {
          args: ["render", "--output-dir", "_generated/output"],
          timeoutMs: 60000,
        })
      );
    },
  );
  await withCurrentNativeOperation({
    root,
    projection: "author",
    profiles: ["full"],
    outputDirectory,
  }, async (operation) => {
    await operation.validateRelease({ expectedSources: ["labs/work.qmd"] });
    const delivered = await operation.assignmentDelivery({
      source: "labs/work.qmd",
      assessmentId: "work",
    }, { projectPlans: [] });
    const text = JSON.stringify(delivered);
    if (
      !text.includes("PUBLIC_EXTERNAL_BIBLIOGRAPHY") ||
      text.includes("UNUSED_EXTERNAL_BIBLIOGRAPHY")
    ) throw Error("Потеря или расширение выбранной библиографии");
  });
  const pointer = fixtureRecord(JSON.parse(
    await Deno.readTextFile(
      join(root, "_generated/course-spec/native-ts/active.json"),
    ),
  ));
  const complete = fixtureRecord(JSON.parse(
    await Deno.readTextFile(join(fixtureString(pointer.directory), "complete.json")),
  ));
  const document = NativePublicDocumentSchema.parse(fixtureArray(complete.documents)[0]);
  if (!document.assignment) throw Error("Нет настоящих citation metadata");
  await Deno.mkdir(join(root, "closed-golden"));
  const closed = join(root, "closed-golden/answer.bib");
  await Deno.writeTextFile(closed, "Закрытые данные");
  const info = await Deno.lstat(closed);
  const role = projectRolePredicate(
    [{
      path: join(root, "closed-golden"),
      tree: true,
      public: false,
      reason: "solutions",
    }],
    [],
    [{ path: closed, identity: JSON.stringify([info.dev, info.ino]) }],
  );
  const roles = { assertPath: role, assertIdentity: role.assertIdentity };
  const guard = citationResourceGuard(
    { root, outputDirectory },
    [document],
    roles,
  );
  let refused = 0;
  const reject = async (run: () => Promise<void>) => {
    let error = "";
    try {
      await run();
    } catch (cause) {
      error = String(cause);
    }
    if (
      !/BODY\.(?:CITATION_METADATA_UNQUALIFIED|RESOURCE_PRIVATE_ROLE)|RESOURCE_PATH|OPERATION_CHANGED/
        .test(error)
    ) throw Error("Нет ожидаемого отказа: " + error);
    refused++;
  };
  await reject(() =>
    guard("labs/work.qmd", "bibliography", "../../bibliography/unknown.bib")
  );
  await reject(() =>
    guard("labs/work.qmd", "csl", "../../bibliography/public.bib")
  );
  const alias = join(parent, "bibliography/public-alias.bib"),
    link = join(parent, "bibliography/public-link.bib");
  await Deno.link(closed, alias);
  await Deno.symlink(join(parent, "bibliography/public.bib"), link);
  const cache = join(parent, "configured-cache");
  await Deno.mkdir(cache);
  await Deno.writeTextFile(join(cache, "cached.bib"), "cache");
  await Deno.mkdir(join(parent, ".cache/codex-tools"), { recursive: true });
  await Deno.writeTextFile(
    join(parent, ".cache/codex-tools/cached.bib"),
    "cache",
  );
  for (
    const path of [
      "../../bibliography/public-alias.bib",
      "../../bibliography/public-link.bib",
      "../../configured-cache/cached.bib",
      "../../.cache/codex-tools/cached.bib",
      "../../private/secret.bib",
    ]
  ) {
    const modified = structuredClone(document);
    if (!modified.assignment) throw Error("Нет assignment metadata");
    modified.assignment.citationMetadata.bibliography = {
      t: "MetaString",
      c: path,
    };
    const check = citationResourceGuard(
      { root, outputDirectory, cacheDirectory: cache },
      [modified],
      roles,
    );
    await reject(() => check("labs/work.qmd", "bibliography", path));
  }
  if (refused !== 7) throw Error("Неполное negative coverage");
  success = true;
  console.log(
    "PASS actual native rebased external bibliography/CSL → selected assignment citations; exact declaration/key, private hardlink, symlink and cache refusals",
  );
} finally {
  if (success) await Deno.remove(parent, { recursive: true });
  else console.error("Fixture для диагностики: " + parent);
}
