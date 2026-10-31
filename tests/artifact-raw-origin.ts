import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const extension = join(
  dirname(dirname(fromFileUrl(import.meta.url))),
  "_extensions/course-core",
);
const root = await Deno.makeTempDir({ prefix: "raw-artifact-origin-" }),
  output = await Deno.makeTempDir({ prefix: "raw-artifact-output-" }),
  expectAbsent = Deno.env.get("RAW_ORIGIN_EXPECT") === "absent";
const checks: any[] = [];
let success = false;
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const put = async (path: string, text: string) => {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
};
const refused = async (fn: () => unknown, pattern: RegExp) => {
  let error = "";
  try {
    await fn();
  } catch (e) {
    error = String(e);
  }
  assert(pattern.test(error), "Expected refusal " + pattern + " got " + error);
};
const same = (v: unknown) => JSON.stringify(v);
const bindings = {
  submission: { files: [], instructions: "Сдайте рабочие файлы." },
};
const config = (audience: string) =>
  `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  resources: ['!projects/**', '!common/**']\n  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]\n  post-render: [quarto run ${extension}/entrypoints/native-post.ts]\nformat:\n  html: {theme: none}\ncourse: {id: raw-origins, view: ${
    audience === "student" ? "student" : "full"
  }}\ncourse-core-runtime: native-ts\ncourse-core-role: exercise-bank\ncourse-core-projection: ${
    audience === "student" ? "student" : "author"
  }\nfilters:\n  - at: pre-ast\n    path: ${extension}/native-ts/early-context.lua\n  - at: post-quarto\n    path: ${extension}/native-ts/late-kind.lua\n  - at: post-render\n    path: ${extension}/native-ts/late-filter.lua\ncourse-project:\n  build:\n    files: {copy.txt: common/payload.txt}\n`;
async function render(audience: string) {
  await put("_quarto.yml", config(audience));
  const r = await new Deno.Command("quarto", {
    args: ["render", "index.qmd", "--to", "html"],
    cwd: root,
    env: { QUARTO_RUN_NO_NETWORK: "true" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  await Deno.mkdir(join(root, "_generated"), { recursive: true });
  await Deno.writeFile(
    join(root, "_generated/render.log"),
    new Uint8Array([...r.stdout, ...r.stderr]),
  );
  assert(
    r.success,
    "Actual native render failed " + root + " " +
      new TextDecoder().decode(r.stderr),
  );
}
async function current<T>(
  audience: string,
  use: (op: Core.NativeOperation) => Promise<T>,
) {
  return await Core.withCurrentNativeOperation({
    root,
    profiles: [],
    projection: audience === "student" ? "student" : "author",
    outputDirectory: join(root, "_site"),
  }, use);
}
try {
  await put(".gitignore", "/.quarto/\n**/*.quarto_ipynb\n");
  await put("common/payload.txt", "COMMON_BYTES");
  await put("diagram.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>');
  for (const id of ["a", "b"]) {
    await put(`projects/${id}/input.qmd`, "# Проект\n");
    await put(
      `projects/${id}/_metadata.yml`,
      "course-project:\n  starter: {path: starter}\n  solutions:\n    teacher: {path: reference}\n",
    );
    await put(`projects/${id}/starter/main.txt`, "IDENTICAL_BYTES");
    await put(`projects/${id}/reference/main.txt`, "PRIVATE_REFERENCE_BYTES");
  }
  await put(
    "index.qmd",
    ["a", "b"].map((id) =>
      `::: {#exr-${id} difficulty=introductory statement-visibility=open project="projects/${id}/input.qmd"}\nУсловие ${id}.\n\n![Рисунок](diagram.svg)\n:::\n`
    ).join("\n"),
  );
  for (const audience of ["student", "full"]) {
    await render(audience);
    await current(audience, async (op) => {
      await Core.readProjectContexts([{
        owner: root,
        inputs: ["projects/a/input.qmd", "projects/b/input.qmd"],
        profiles: [],
        format: "html",
      }], async ([group]) => {
        const samples: any[] = [];
        for (const [index, id] of ["a", "b"].entries()) {
          const plan = await Core.planProject(group.contexts[index], {
              audience: audience as "student" | "full",
            }),
            condition = op.condition({
              source: "index.qmd",
              exerciseId: "exr-" + id,
              view: audience === "student" ? "student" : "author",
            });
          const inventory = await Core.materializeProject(
              plan,
              condition,
              bindings,
            ),
            raw = inventory.files.find((f) => f.target === "main.txt") as any;
          assert(
            expectAbsent
              ? raw.rawSource === undefined
              : raw.rawSource === `projects/${id}/starter/main.txt`,
            "RAW_SOURCE_MISSING_OR_GUESSED " + same(raw),
          );
          assert(
            new TextDecoder().decode(raw.bytes) === "IDENTICAL_BYTES",
            "Raw byte binding changed",
          );
          const common = inventory.files.find((f) =>
            f.target === "copy.txt"
          ) as any;
          assert(
            expectAbsent
              ? common.rawSource === undefined
              : common.rawSource === "common/payload.txt",
            "Native inherited common origin was rebased/guessed",
          );
          const resource = inventory.files.find((f) =>
            f.reason === "condition-resource"
          ) as any;
          assert(
            expectAbsent
              ? resource.rawSource === undefined
              : resource.rawSource === "diagram.svg",
            "Raw resource origin lost",
          );
          assert(
            inventory.files.filter((f) => f.target.endsWith("README.md")).every(
              (f) => (f as any).rawSource === undefined,
            ),
            "Generated/transformed README guessed raw origin",
          );
          if (audience === "full") {
            const reference = inventory.files.find((f) =>
              f.target === "author/teacher/main.txt"
            ) as any;
            assert(
              expectAbsent
                ? reference.rawSource === undefined
                : reference.rawSource === `projects/${id}/reference/main.txt`,
              "Full raw solution origin lost",
            );
          } else {assert(
              inventory.files.every((f) =>
                !(f as any).rawSource ||
                !/reference|private|^\//.test((f as any).rawSource)
              ),
              "Student private/absolute origin leak",
            );}
          const before = Core.projectPlanMetrics(plan),
            cached = await Core.materializeProject(plan, condition, bindings),
            after = Core.projectPlanMetrics(plan);
          assert(
            same(cached) === same(inventory),
            "Cache lost exact origin/bytes",
          );
          assert(
            after.fileReads === before.fileReads &&
              after.hashReads === before.hashReads &&
              after.treeWalks === before.treeWalks &&
              after.pandocCalls === before.pandocCalls &&
              after.cacheHits === before.cacheHits + 1,
            "Cache added read/walk/hash/pandoc",
          );
          cached.files[0].bytes[0] ^= 1;
          (cached.files[0] as any).rawSource = "wrong.txt";
          const fresh = await Core.materializeProject(
            plan,
            condition,
            bindings,
          );
          assert(
            same(fresh) === same(inventory),
            "Clone mutation poisoned cached source/bytes",
          );
          await refused(
            () =>
              Core.materializeProject(
                structuredClone(plan),
                condition,
                bindings,
              ),
            /CONTEXT_EXPIRED/,
          );
          await refused(
            () =>
              Core.materializeProject(
                plan,
                structuredClone(condition),
                bindings,
              ),
            /CONDITION_AUTHORITY/,
          );
          const destination = join(output, audience + "-" + id);
          await Core.writeArtifactInventory(
            structuredClone(inventory),
            destination,
          );
          assert(
            new TextDecoder().decode(
              await Deno.readFile(join(destination, "main.txt")),
            ) === "IDENTICAL_BYTES",
            "Existing bytes DTO writer changed",
          );
          assert(
            !new TextDecoder().decode(
              await Deno.readFile(join(destination, "README.md")),
            ).includes("rawSource"),
            "Origin metadata entered README",
          );
          samples.push({
            id,
            rawSource: raw.rawSource,
            sha256: raw.sha256,
            metrics: before,
            files: inventory.files.map(({ bytes, ...metadata }) => metadata),
          });
        }
        if (!expectAbsent) {
          assert(
            samples[0].sha256 === samples[1].sha256 &&
              samples[0].rawSource !== samples[1].rawSource,
            "Origin inferred from target/hash",
          );
        }
        checks.push({ audience, samples, contextMetrics: group.metrics });
      });
    });
  }
  if (!expectAbsent) {
    const file: any = {
      target: "main.txt",
      rawSource: "projects/a/starter/main.txt",
      sha256: "a".repeat(64),
      size: 1,
      audience: "student",
      reason: "starter",
      bytes: new Uint8Array([1]),
    };
    assert(
      Core.ArtifactFileSchema.safeParse(file).success,
      "Additive field rejected",
    );
    const old = { ...file };
    delete old.rawSource;
    assert(
      Core.ArtifactFileSchema.safeParse(old).success,
      "Old file DTO rejected",
    );
    for (
      const rawSource of [
        "",
        "/absolute",
        "../secret",
        "a/../b",
        "a//b",
        "a\\b",
        "C:x",
        "a\0x",
        ".cache/codex-tools/secret",
        "projects/a/reference/private.txt",
      ]
    ) {
      assert(
        !Core.ArtifactFileSchema.safeParse({ ...file, rawSource }).success,
        "Unsafe/student-private origin accepted " + rawSource,
      );
    }
    assert(
      !Core.ArtifactFileSchema.safeParse({ ...file, unknownOrigin: "x" })
        .success,
      "Unknown schema key accepted",
    );
    assert(
      Core.ArtifactFileSchema.safeParse({
        ...file,
        audience: "full",
        rawSource: "projects/a/reference/main.txt",
      }).success,
      "Full data-only origin denied",
    );
  }
  if (!expectAbsent) {
    for (const mutation of ["changed", "missing", "alias"]) {
      await render("student");
      let changed = false, error = "";
      try {
        await current("student", async (op) => {
          await Core.readProjectContexts([{
            owner: root,
            inputs: ["projects/a/input.qmd"],
            profiles: [],
            format: "html",
          }], async ([group]) => {
            const plan = await Core.planProject(group.contexts[0], {
                audience: "student",
              }),
              condition = op.condition({
                source: "index.qmd",
                exerciseId: "exr-a",
                view: "student",
              });
            await Core.materializeProject(plan, condition, bindings);
            const path = join(root, "projects/a/starter/main.txt");
            changed = true;
            if (mutation === "changed") {
              await Deno.writeTextFile(path, "CHANGED_BYTES");
            } else {
              await Deno.remove(path);
              if (mutation === "alias") {
                await Deno.symlink(
                  join(root, "projects/b/starter/main.txt"),
                  path,
                );
              }
            }
            await Core.materializeProject(plan, condition, bindings);
            throw Error("MUTATED_SOURCE_RETURNED_CACHED_ORIGIN");
          });
        });
      } catch (e) {
        error = String(e);
      } finally {
        if (changed) {
          try {
            await Deno.remove(join(root, "projects/a/starter/main.txt"));
          } catch (e) {
            if (!(e instanceof Deno.errors.NotFound)) throw e;
          }
          await put("projects/a/starter/main.txt", "IDENTICAL_BYTES");
        }
      }
      assert(
        changed &&
          /CONTEXT_CHANGED|OPERATION_CHANGED|NotFound|PROJECT_SOURCE/.test(
            error,
          ),
        "Raw source " + mutation + " accepted: " + error,
      );
      checks.push({ mutation, error });
    }
  }
  console.log(JSON.stringify({ root, expectAbsent, checks }));
  success = true;
  console.log(
    "PASS exact raw files/tree/common origins, same-target/hash distinction, raw resource/generated README boundary, cache/clone/no new selection counters, old/new schema/privacy, bytes-only writer and no cloned source authority",
  );
} finally {
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Preserved failed raw origin fixture " + root);
  await Deno.remove(output, { recursive: true });
}
