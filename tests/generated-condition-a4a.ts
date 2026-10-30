import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const core = join(
    dirname(dirname(fromFileUrl(import.meta.url))),
    "_extensions/course-core",
  ),
  root = await Deno.makeTempDir({ prefix: "a4a-generated-condition-" });
async function put(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
await put(
  "_quarto.yml",
  `project:\n  type: website\n  output-dir: _site\n  pre-render: [quarto run ${core}/entrypoints/native-pre.ts]\n  post-render: [quarto run relocate.ts, quarto run ${core}/entrypoints/native-post.ts]\nformat:\n  html:\n    theme: none\ncourse-core-runtime: native-ts\ncourse-core-projection: student\nexercise-bank: true\nexercise-defaults: {difficulty: introductory, statement-visibility: open}\ncourse-project:\n  starter: {path: starter}\nfilters:\n  - at: pre-ast\n    path: ${core}/native-ts/early-context.lua\n  - at: post-quarto\n    path: ${core}/native-ts/late-kind.lua\n  - at: post-quarto\n    path: generate.lua\n  - at: post-render\n    path: ${core}/native-ts/late-filter.lua\n`,
);
await put(
  "index.qmd",
  '::: {#exr-generated project="project/input.qmd"}\nПолное условие с GENERATEASSET и текущим изображением.\n:::\n',
);
await put("project/input.qmd", "# Код\n");
await put("project/starter/main.fish", "echo работа\n");
await put(
  "generate.lua",
  `return {{Str=function(s)if s.text=='GENERATEASSET' then local f=not os.getenv('A4A_SKIP_GENERATED') and assert(io.open('generated.svg','wb'));if f then f:write('<svg xmlns="http://www.w3.org/2000/svg"><text>actual generated</text></svg>');f:close() end;return pandoc.Image({pandoc.Str('График')},'generated.svg')end end}}`,
);
await put(
  "relocate.ts",
  `try{await Deno.rename('generated.svg','_site/generated.svg');}catch(e){if(!(e instanceof Deno.errors.NotFound))throw e;}`,
);
const render = await new Deno.Command("quarto", {
  args: ["render", "index.qmd", "--to", "html"],
  cwd: root,
  env: { DENO_NO_PACKAGE_JSON: "1", QUARTO_RUN_NO_NETWORK: "true" },
  stdout: "piped",
  stderr: "piped",
}).output();
if (!render.success) throw Error(new TextDecoder().decode(render.stderr));
await Core.withCurrentNativeOperation({
  root,
  profiles: [],
  projection: "student",
  outputDirectory: join(root, "_site"),
}, async (op) => {
  await Core.readProjectContexts([{
    owner: root,
    inputs: ["project/input.qmd"],
    profiles: [],
    format: "html",
  }], async ([group]) => {
    const condition = op.condition({
        source: "index.qmd",
        exerciseId: "exr-generated",
        view: "student",
      }),
      plan = await Core.planProject(group.contexts[0], { audience: "student" });
    const files = await Core.materializeCondition(plan, condition, {
      submission: { files: [], instructions: "Сдайте решение." },
    });
    const resource = files.files.find((f) =>
      f.target === "resources/generated.svg"
    );
    if (
      !resource ||
      !new TextDecoder().decode(resource.bytes).includes("actual generated")
    ) throw Error("A4a generated condition resource");
    console.log(
      JSON.stringify({
        status: "PASS",
        root,
        metrics: op.metrics,
        projectMetrics: Core.projectPlanMetrics(plan),
        files: files.files.map((f) => ({
          target: f.target,
          sha256: f.sha256,
          size: f.size,
        })),
      }),
    );
  });
});

const retained = await new Deno.Command("quarto", {
  args: ["render", "index.qmd", "--to", "html"],
  cwd: root,
  env: {
    DENO_NO_PACKAGE_JSON: "1",
    QUARTO_RUN_NO_NETWORK: "true",
    A4A_SKIP_GENERATED: "1",
  },
  stdout: "piped",
  stderr: "piped",
}).output();
if (!retained.success) throw Error(new TextDecoder().decode(retained.stderr));
let refused = "";
await Core.withCurrentNativeOperation({
  root,
  profiles: [],
  projection: "student",
  outputDirectory: join(root, "_site"),
}, async (op) => {
  await Core.readProjectContexts([{
    owner: root,
    inputs: ["project/input.qmd"],
    profiles: [],
    format: "html",
  }], async ([group]) => {
    try {
      await Core.materializeCondition(
        await Core.planProject(group.contexts[0], { audience: "student" }),
        op.condition({
          source: "index.qmd",
          exerciseId: "exr-generated",
          view: "student",
        }),
        { submission: { files: [], instructions: "Сдайте решение." } },
      );
    } catch (e) {
      refused = String(e);
    }
  });
});
console.log(
  JSON.stringify({
    status: refused.includes("RESOURCE_MISSING") ? "PASS" : "FAIL",
    name: "retained-output-does-not-qualify-condition-resource",
    root,
    refusal: refused,
  }),
);
if (!refused.includes("RESOURCE_MISSING")) {
  throw Error("A4a stale condition resource");
}
