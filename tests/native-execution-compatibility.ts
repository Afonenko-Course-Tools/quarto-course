import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { required } from "./helpers/required.ts";
const extension = fromFileUrl(new URL("../_extensions/course-core", import.meta.url));
const quarto = Deno.env.get("CORE_TEST_QUARTO") ?? "quarto";
if (Deno.env.get("CORE_TEST_QUARTO")) Deno.env.set("QUARTO", quarto);
const roots: string[] = [];
const evidence: unknown[] = [];
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>NATIVE_MEDIA_57</text></svg>';
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
async function put(root: string, path: string, value: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), value);
}
async function fixture(custom: boolean, media: boolean) {
  const root = await Deno.makeTempDir({ prefix: "core-execution-compat-" });
  roots.push(root);
  await put(
    root,
    "_quarto.yml",
    `project:
  type: website
  output-dir: _site
  render: [index.qmd]
  pre-render: [${quarto} run ${extension}/entrypoints/native-pre.ts]
  post-render: [${quarto} run ${extension}/entrypoints/native-post.ts]
format: {${custom ? "custom-html" : "html"}: {theme: none}}
course: {id: native-execution, view: student}
course-core-runtime: native-ts
course-core-projection: student
exercise-bank: true
default-exercise-statement-visibility: open
filters:
  - at: pre-ast
    path: ${extension}/native-ts/early-context.lua
  - at: post-quarto
    path: ${extension}/native-ts/late-kind.lua
${media ? `  - at: post-quarto\n    path: ${root}/media.lua\n` : ""}  - at: post-render
    path: ${extension}/native-ts/late-filter.lua
`,
  );
  if (custom) {
    await put(
      root,
      "_extensions/custom/_extension.yml",
      "title: Custom HTML\nversion: 1.0.0\ncontributes:\n  formats:\n    html:\n      toc: true\n",
    );
  }
  await put(
    root,
    "index.qmd",
    `---\nassessment: {id: work, kind: seminar}\n---\n# Native manual\n\n::: {#exr-manual target="manual" difficulty=introductory}\n## Условие\n\nPUBLIC_MANUAL_62\n\n${
      media ? "![](bag.svg)\n\n" : ""
    }\n::: {.solution}\nPRIVATE_MANUAL_62\n\n![](hidden.svg)\n:::\n:::\n\n::: {.task-items}\n1. @exr-manual\n:::\n`,
  );
  if (media) {
    await put(
      root,
      "media.lua",
      `return {{Pandoc=function(doc) pandoc.mediabag.insert('bag.svg','image/svg+xml',${JSON.stringify(
        svg,
      )}); return doc end}}\n`,
    );
  }
  return root;
}
async function render(root: string) {
  const result = await new Deno.Command(quarto, {
    args: ["render"],
    cwd: root,
    env: {
      XDG_CACHE_HOME: join(root, "_generated/cache"),
      QUARTO: quarto,
      QUARTO_RUN_NO_NETWORK: "true",
      DENO_NO_PACKAGE_JSON: "1",
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const log = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  await put(root, "render.log", log);
  assert(result.success, "Native render failed: " + root + "/render.log\n" + log);
}
async function ordinary(custom: boolean, media: boolean) {
  const root = await fixture(custom, media);
  await render(root);
  await Core.withCurrentNativeOperation(
    {
      root,
      profiles: [],
      projection: "student",
      outputDirectory: join(root, "_site"),
    },
    async (op) => {
      const before = structuredClone(op.metrics);
      assert(
        op.catalog.documents.length === 1 && required(op.catalog.documents[0]).format === "html",
        "custom base must be html",
      );
      const document = op.document({ source: "index.qmd" });
      assert(
        JSON.stringify(document).includes("PUBLIC_MANUAL_62") &&
          !JSON.stringify(document).includes("PRIVATE_MANUAL_62"),
        "manual privacy",
      );
      if (media) {
        const resources = await op.resourceFiles({
          files: [{ source: "bag.svg", target: "resources/bag.svg" }],
        });
        assert(new TextDecoder().decode(required(resources.files[0]).bytes) === svg, "mediabag bytes lost");
      }
      assert(op.metrics.inspectCalls === before.inspectCalls, "getter performs discovery");
      evidence.push({
        case: custom ? "custom-html" : "native-html",
        media,
        metrics: op.metrics,
        root,
      });
    },
  );
}
async function manualAssignment(custom: boolean, media = false, parent = false, ojs = "") {
  const root = await fixture(custom, media);
  if (ojs) {
    const text = await Deno.readTextFile(join(root, "index.qmd"));
    const expression =
      ojs === "inline"
        ? "Результат: `{ojs} 6 * 7`."
        : "```{ojs}\n" + (ojs === "single" ? "html`<p>42</p>`" : "value57 = 42\nhtml`<p>${value57}</p>`") + "\n```";
    const changed = text.replace("PUBLIC_MANUAL_62", "PUBLIC_MANUAL_62\n\n" + expression);
    await put(
      root,
      "index.qmd",
      ojs === "inline"
        ? changed.replace("PRIVATE_MANUAL_62", "PRIVATE_MANUAL_62\n\n```{ojs}\nsetup57 = 1\n```\n")
        : changed,
    );
  }
  if (parent) {
    const metadata = root + "-parent.yml";
    roots.push(metadata);
    await Deno.writeTextFile(metadata, "default-exercise-time: 7\n");
    const config = await Deno.readTextFile(join(root, "_quarto.yml"));
    await put(root, "_quarto.yml", config + "metadata-files: [../" + metadata.split("/").at(-1) + "]\n");
  }
  await put(root, "_quarto-full.yml", "course: {view: full}\ncourse-core-projection: author\n");
  const oldCache = Deno.env.get("XDG_CACHE_HOME");
  Deno.env.set("XDG_CACHE_HOME", join(root, "_generated/cache"));
  try {
    await Core.withNativeCaptureScope(
      {
        root,
        projection: "author",
        outputDirectory: join(root, "_generated/assignment"),
      },
      {
        assignment: {
          mode: "new",
          prepare: async () => ({
            expectedSources: ["index.qmd"],
            assessments: [{ source: "index.qmd", id: "work" }],
          }),
        },
      },
      (scope) =>
        scope.withPreparedOperation((lease) =>
          lease.captureInputs(lease.descriptor, ["index.qmd"], {
            args: ["render", "--output-dir", "_generated/assignment"],
            timeoutMs: 60000,
          }),
        ),
    );
    await Core.withCurrentNativeOperation(
      {
        root,
        profiles: ["full"],
        projection: "author",
        outputDirectory: join(root, "_generated/assignment"),
      },
      async (op) => {
        await op.validateRelease({ expectedSources: ["index.qmd"] });
        if (ojs) {
          let error = "";
          try {
            await op.assignmentDelivery(
              {
                source: "index.qmd",
                assessmentId: "work",
              },
              { projectPlans: [] },
            );
          } catch (cause) {
            error = String(cause);
          }
          assert(error.includes("BODY.CAPABILITY_UNSUPPORTED"), "OJS portable Body must fail explicitly: " + error);
          evidence.push({
            case: "ojs-portable-body-refusal",
            variant: ojs,
            error,
            root,
          });
          return;
        }
        const result = await op.assignmentDelivery(
          {
            source: "index.qmd",
            assessmentId: "work",
          },
          { projectPlans: [] },
        );
        if (parent) {
          assert(required(result.publicPackage.questions[0]).time === 7, "manual Body parent metadata lost");
        }
        const body = JSON.stringify(result);
        assert(
          body.includes("PUBLIC_MANUAL_62") && !body.includes("PRIVATE_MANUAL_62"),
          "manual assignment requires no PL adapter and keeps privacy",
        );
        if (media) {
          assert(
            result.publicPackage.resources.length === 1 &&
              atob(required(result.publicPackage.resources[0]).data) === svg,
            "manual Body mediabag resources lost",
          );
        }
        assert(result.publicPackage.questions.length === 1, "manual Body question missing");
        evidence.push({
          case: "manual-assignment-no-adapter",
          custom,
          metrics: op.metrics,
          root,
        });
      },
    );
  } finally {
    if (oldCache === undefined) Deno.env.delete("XDG_CACHE_HOME");
    else Deno.env.set("XDG_CACHE_HOME", oldCache);
  }
}
async function parentMetadata() {
  const container = await Deno.makeTempDir({ prefix: "core-parent-metadata-" });
  roots.push(container);
  const root = join(container, "owner");
  await Deno.mkdir(root);
  const initial = await fixture(false, false);
  const copied = await new Deno.Command("cp", {
    args: ["-R", initial + "/.", root],
  }).output();
  assert(copied.success, "copy parent fixture");
  await put(container, "metadata.yml", "default-exercise-time: 7\nlang: ru\n");
  const config = await Deno.readTextFile(join(root, "_quarto.yml"));
  await put(root, "_quarto.yml", config + "metadata-files: [../metadata.yml]\n");
  await render(root);
  await Core.withCurrentNativeOperation(
    {
      root,
      profiles: [],
      projection: "student",
      outputDirectory: join(root, "_site"),
    },
    async (op) => {
      assert(op.document({ source: "index.qmd" }).definitions["exr-manual"]?.time === 7, "parent native metadata lost");
      let refused = false;
      try {
        await op.resourceFiles({
          files: [{ source: "../metadata.yml", target: "metadata.yml" }],
        });
      } catch {
        refused = true;
      }
      assert(refused, "parent metadata grants no resource authority");
      evidence.push({ case: "parent-native-metadata", root });
    },
  );
}
async function ojsPublication() {
  const root = await fixture(false, false);
  const source = await Deno.readTextFile(join(root, "index.qmd"));
  await put(root, "index.qmd", source + "\n```{ojs}\nvalue57 = 6 * 7\nhtml`<p>OJS_NATIVE_57: ${value57}</p>`\n```\n");
  await render(root);
  const html = await Deno.readTextFile(join(root, "_site/index.html"));
  assert(html.includes("OJS_NATIVE_57") && html.includes("quarto-ojs"), "native OJS runtime missing");
  await Core.withCurrentNativeOperation(
    {
      root,
      profiles: [],
      projection: "student",
      outputDirectory: join(root, "_site"),
    },
    async (op) => {
      assert(op.catalog.documents.length === 1, "OJS capture missing");
      evidence.push({
        case: "ojs-native-publication",
        metrics: op.metrics,
        root,
      });
    },
  );
}
async function dynamicPlanAndProfiles() {
  const root = await fixture(false, false);
  const config = await Deno.readTextFile(join(root, "_quarto.yml"));
  await put(
    root,
    "_quarto.yml",
    config
      .replace("  render: [index.qmd]\n", "")
      .replace("  - at: post-render", "  - at: post-quarto\n    path: " + root + "/generate.lua\n  - at: post-render"),
  );
  await put(root, "_quarto-full.yml", "course: {view: full}\ncourse-core-projection: author\n");
  await put(
    root,
    "generate.lua",
    `return {{Pandoc=function(doc)
    local exists=io.open('added.qmd','rb')
    if exists then exists:close() else
      local added=assert(io.open('added.qmd','wb'));added:write(${JSON.stringify(
        "# Added native source\n",
      )});added:close()
      local authored=assert(io.open('index.qmd','ab'));authored:write(${JSON.stringify(
        "\nSOURCE_EDIT_AFTER_READ_57\n",
      )});authored:close()
    end
    return doc
  end}}`,
  );
  const ids: string[] = [];
  for (const profiles of [[], ["full"], []]) {
    const result = await new Deno.Command(quarto, {
      args: ["render", ...(profiles.length ? ["--profile", profiles.join(",")] : [])],
      cwd: root,
      env: {
        XDG_CACHE_HOME: join(root, "_generated/cache"),
        QUARTO: quarto,
        QUARTO_RUN_NO_NETWORK: "true",
        DENO_NO_PACKAGE_JSON: "1",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const log = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
    await put(root, "dynamic-" + ids.length + ".log", log);
    assert(result.success, "dynamic/profile native render: " + log);
    await Core.withCurrentNativeOperation(
      {
        root,
        profiles,
        projection: profiles.length ? "author" : "student",
        outputDirectory: join(root, "_site"),
      },
      async (op) => {
        const first = ids.length === 0;
        ids.push(op.identity.operation);
        assert(
          op.catalog.documents.length === (first ? 1 : 2),
          "generated QMD joined an existing selected plan or next pre missed it",
        );
        const text = JSON.stringify(op.document({ source: "index.qmd" }));
        const html = await Deno.readTextFile(join(root, "_site/index.html"));
        assert(html.includes("SOURCE_EDIT_AFTER_READ_57") === !first, "source byte edit freshness was misrepresented");
        assert(
          text.includes("PRIVATE_MANUAL_62") === profiles.length > 0,
          "profile switch leaks/reuses wrong projection",
        );
        const before = structuredClone(op.metrics);
        for (let i = 0; i < 100; i++) {
          op.catalog;
          op.document({ source: "index.qmd" });
        }
        assert(
          JSON.stringify(op.metrics) === JSON.stringify(before),
          "getter loop rediscovers native inputs/resources",
        );
      },
    );
  }
  assert(new Set(ids).size === 3, "profiles/source renders reused identity");
  evidence.push({
    case: "fixed-selected-plan-source-edit-next-pre-student-author-student",
    ids,
    root,
  });
}
async function crossChildMediaCollision() {
  const root = await fixture(false, true);
  const config = await Deno.readTextFile(join(root, "_quarto.yml"));
  await put(root, "_quarto.yml", config.replace("render: [index.qmd]", "render: [index.qmd, second.qmd]"));
  await put(root, "second.qmd", "# Second\n\n![](bag.svg)\n");
  await put(
    root,
    "media.lua",
    `return {{Pandoc=function(doc) pandoc.mediabag.insert('bag.svg','image/svg+xml',quarto.doc.input_file);return doc end}}`,
  );
  let children = 0,
    error = "";
  try {
    await Core.withNativeCaptureScope(
      { root, projection: "student", outputDirectory: join(root, "_site") },
      { expectedSources: ["index.qmd", "second.qmd"] },
      async (scope) => {
        for (const source of ["index.qmd", "second.qmd"]) {
          await scope.captureInputs([source], async (token) => {
            const result = await new Deno.Command(quarto, {
              args: ["render", source],
              cwd: root,
              env: {
                QUARTO: quarto,
                COURSE_CORE_CAPTURE_TOKEN: token,
                XDG_CACHE_HOME: join(root, "_generated/cache"),
                QUARTO_RUN_NO_NETWORK: "true",
                DENO_NO_PACKAGE_JSON: "1",
              },
              stdout: "piped",
              stderr: "piped",
            }).output();
            assert(
              result.success,
              "media collision child failed before seal: " + new TextDecoder().decode(result.stderr),
            );
            children++;
          });
        }
      },
    );
  } catch (cause) {
    error = String(cause);
  }
  assert(children === 2 && error.includes("RESOURCE_COLLISION"), "cross-child media origins silently merge: " + error);
  evidence.push({
    case: "cross-child-mediabag-source-key-collision",
    children,
    error,
    root,
  });
}
try {
  if (Deno.args.includes("--manual")) {
    await manualAssignment(false);
    await manualAssignment(true, false, true);
  } else if (Deno.args.includes("--manual-media")) {
    await manualAssignment(false, true);
  } else if (Deno.args.includes("--media-collision")) {
    await crossChildMediaCollision();
  } else if (Deno.args.includes("--dynamic")) await dynamicPlanAndProfiles();
  else if (Deno.args.includes("--ojs-body")) {
    for (const variant of ["multi", "single", "inline"]) {
      await manualAssignment(false, false, false, variant);
    }
  } else if (Deno.args.includes("--ojs")) await ojsPublication();
  else if (Deno.args.includes("--parent")) await parentMetadata();
  else if (Deno.args.includes("--probe-custom")) await ordinary(true, false);
  else if (Deno.args.includes("--probe-media")) await ordinary(false, true);
  else {
    await crossChildMediaCollision();
    await dynamicPlanAndProfiles();
    for (const variant of ["multi", "single", "inline"]) {
      await manualAssignment(false, false, false, variant);
    }
    await ojsPublication();
    await ordinary(false, false);
    await ordinary(true, false);
    await ordinary(false, true);
    await manualAssignment(false, true);
    await manualAssignment(true, false, true);
    await parentMetadata();
  }
  console.log(JSON.stringify({ status: "PASS", quarto, evidence }));
} finally {
  if (Deno.env.get("CORE_KEEP_FIXTURES")) {
    console.log("Retained " + JSON.stringify(roots));
  } else for (const root of roots) await Deno.remove(root, { recursive: true });
}
