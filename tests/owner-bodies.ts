import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const evidence = Deno.env.get("OWNER_BODIES_TEST_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "owner-bodies-test-" });
const root = join(evidence, "owner");
const quarto = Deno.env.get("QUARTO") || "quarto";
const scenario = Deno.args[0] || "student";
const implicit = scenario === "implicit-default";
const book = scenario.startsWith("book-");
const mode = implicit ? "student" : book ? scenario.slice(5) : scenario;
assert(
  [
    "student",
    "computed-bank",
    "post-failure",
    "automatic-work",
    "full-plot",
    "full-static",
    ...(book ? ["consumed-work"] : []),
  ].includes(mode),
  "Unknown owner bodies scenario",
);
const profile = mode.startsWith("full-") ? "full" : "student";
const sources = [
  "tasks/corpus.qmd",
  "tasks/work-one.qmd",
  "tasks/work-two.qmd",
];

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

async function copy(source: string, destination: string) {
  await Deno.mkdir(destination, { recursive: true });
  for await (const entry of Deno.readDir(source)) {
    const from = join(source, entry.name), to = join(destination, entry.name);
    if (entry.isDirectory) await copy(from, to);
    else if (entry.isFile) await Deno.copyFile(from, to);
    else throw new Error("Unsupported fixture entry: " + from);
  }
}

async function command(
  args: string[],
  log: string,
  requireZero = true,
  env: Record<string, string> = {},
) {
  const result = await new Deno.Command(quarto, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
    env,
  }).output();
  const output = new TextDecoder().decode(result.stdout) +
    new TextDecoder().decode(result.stderr);
  await Deno.writeTextFile(join(evidence, log), output);
  assert(
    !requireZero || result.code === 0,
    `Native ${args[0]} exited ${result.code}: ${output}`,
  );
  return { code: result.code, output };
}

function hasNode(value: unknown, type: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasNode(item, type));
  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    return node.t === type ||
      Object.values(node).some((item) => hasNode(item, type));
  }
  return false;
}

await Deno.mkdir(evidence, { recursive: true });
assert(!await exists(root), "Use a fresh owner-bodies evidence directory");
await Deno.mkdir(root, { recursive: true });
// Initialize stock project service metadata before author inputs freeze.
// In a Git checkout the first capture would otherwise create .gitignore late.
await command([
  "create-project",
  root,
  "--type",
  "default",
  "--no-scaffold",
  "--engine",
  "markdown",
], "create-project.log");
await copy(join(repo, "tests/fixtures/owner-bodies"), root);
// All scenario inputs are authored before prepareOwner seals native inputs.
if (implicit) {
  const path = join(root, "_quarto.yml");
  await Deno.writeTextFile(
    path,
    (await Deno.readTextFile(path)).replace("  type: default\n", ""),
  );
}
if (mode === "full-static") {
  await copy(join(repo, "tests/fixtures/owner-bodies-static"), root);
}
if (mode === "automatic-work") {
  const path = join(root, "tasks/work-one.qmd");
  const authored = await Deno.readTextFile(path);
  await Deno.writeTextFile(
    path,
    authored.replace(
      "# Practice and review {#sec-work-one}",
      "# sec-work-one\n\n## Later authored identity {#sec-work-one}",
    ),
  );
}
if (mode === "computed-bank") {
  const path = join(root, "tasks/corpus.qmd");
  const authored = await Deno.readTextFile(path);
  await Deno.writeTextFile(
    path,
    authored.replace(
      'cat("COMPUTED_BODY_CONDITION 42.\\n\\n")',
      'cat("COMPUTED_BODY_CONDITION 42.\\n\\n")\nif (Sys.getenv("BODY_TEST_COMPUTED_BANK") == "1") cat("```{.yaml .answer-spec}\\ntype: numeric\\nkey: {value: 42, tolerance: {absolute: 0.1}}\\n```\\n\\n")',
    ),
  );
}
if (mode === "post-failure") {
  await Deno.writeTextFile(
    join(root, "fail-post.ts"),
    'const active = JSON.parse(await Deno.readTextFile(".course-owner/active.json"));\nif (active.phase === "render") { console.error("BODY_TEST_NATIVE_POST_FAILURE"); Deno.exit(9); }\n',
  );
  const path = join(root, "_quarto.yml");
  await Deno.writeTextFile(
    path,
    (await Deno.readTextFile(path)).replace(
      "    - _extensions/course-core/entrypoints/post.ts",
      "    - _extensions/course-core/entrypoints/post.ts\n    - fail-post.ts",
    ),
  );
}
if (book) {
  const path = join(root, "_quarto.yml");
  const config = await Deno.readTextFile(path);
  await Deno.writeTextFile(
    path,
    config.replace("  type: default", "  type: book").replace(
      "  render: [tasks/corpus.qmd, tasks/work-one.qmd, tasks/work-two.qmd]\n",
      "",
    ) +
      "book:\n  title: Native owner body proof\n  chapters: [index.qmd, tasks/corpus.qmd, tasks/work-one.qmd, tasks/work-two.qmd]\n",
  );
  await Deno.writeTextFile(
    join(root, "index.qmd"),
    "# Native body home {#sec-body-home}\n\nThis is the authored book home.\n",
  );
  if (mode !== "consumed-work") {
    // Native book chapter titles are metadata; the work is the separate first
    // retained authored Header, proved by the ordinary/no-auto inventories.
    for (const name of ["one", "two"]) {
      const path = join(root, `tasks/work-${name}.qmd`);
      const authored = await Deno.readTextFile(path);
      await Deno.writeTextFile(
        path,
        authored.replace(
          "---\n",
          `---\ntitle: "Work ${name} chapter"\n`,
        ).replace("\n# ", "\n## "),
      );
    }
  }
}
await command(["add", repo, "--no-prompt"], "install.log");
const api = await import(
  toFileUrl(join(root, "_extensions/course-core/owner-preflight/owner.ts")).href
);

console.log("Owner bodies evidence: " + evidence + " scenario=" + scenario);
let prepared;
try {
  prepared = await api.prepareOwner(root, {
    attemptId: "body-native-once",
    profile,
    body: {
      sources,
      ...(mode === "full-static" ? { release: "static-build-release" } : {}),
    },
  });
} catch (error) {
  if (
    !["automatic-work", "consumed-work"].includes(mode) ||
    !String(error).includes("BODY.CONTRACT_INVALID")
  ) throw error;
  assert(
    !await exists(join(root, ".course-owner/engine-count")),
    "Unsupported work identity refusal ran R",
  );
  console.log(
    mode === "consumed-work"
      ? "PASS consumed book chapter Header cannot become a work identity from metadata; before engine"
      : "PASS exact first automatic Header cannot borrow the later authored work identity; before engine",
  );
  Deno.exit(0);
}
await Deno.writeTextFile(
  join(evidence, "prepared.json"),
  JSON.stringify(prepared, null, 2),
);
assert(
  !await exists(join(root, ".course-owner/engine-count")),
  "Preparation executed the real R cell",
);
assert(
  !await exists(join(root, "_site")),
  "Preparation kept private capture output",
);
if (implicit) {
  const session = await api.preparedSession(prepared);
  for (const native of Object.values(session.audit.profiles) as any[]) {
    assert(
      native.config.project && !Object.hasOwn(native.config.project, "type"),
      "implicit default changed native inspect facts",
    );
  }
}
console.log("PASS native preparation kept engine count at zero");

const metadata = await api.activateOwner(prepared);
const metadataPath = join(root, ".course-owner/render-metadata.json");
await Deno.writeTextFile(metadataPath, JSON.stringify(metadata));
const render = await command(
  [
    "render",
    ".",
    "--profile",
    profile,
    "--to",
    "html",
    "--execute",
    "--no-cache",
    "--no-execute-daemon",
    "--metadata-file",
    metadataPath,
  ],
  "render.log",
  !["computed-bank", "post-failure"].includes(mode),
  mode === "computed-bank" ? { BODY_TEST_COMPUTED_BANK: "1" } : {},
);
if (book) {
  assert(
    !/\bWARNING(?:\s|:)/i.test(render.output),
    "Native book emitted a warning: " + render.output,
  );
}
if (mode === "full-static") {
  assert(
    !await exists(join(root, ".course-owner/engine-count")),
    "Static full corpus executed an engine cell",
  );
} else {
  assert(
    await Deno.readTextFile(join(root, ".course-owner/engine-count")) ===
      "executed\n",
    "The native owner engine did not execute exactly once",
  );
}
if (["computed-bank", "post-failure"].includes(mode)) {
  assert(
    render.code !== 0 && render.output.includes(
      mode === "computed-bank"
        ? "BODY.CONTRACT_INVALID"
        : "BODY_TEST_NATIVE_POST_FAILURE",
    ),
    "Native refusal did not prove its intended boundary",
  );
  if (mode === "post-failure") {
    const receipts = [];
    for await (const entry of Deno.readDir(join(root, ".course-owner"))) {
      if (entry.name.startsWith("result-") && entry.name.endsWith(".json")) {
        receipts.push(
          JSON.parse(
            await Deno.readTextFile(join(root, ".course-owner", entry.name)),
          ),
        );
      }
    }
    assert(
      receipts.length === (book ? sources.length + 1 : sources.length) &&
        receipts.every((receipt) =>
          receipt.status === "ok" &&
          (!sources.includes(receipt.source) || receipt.bodySealHash)
        ),
      "Post failure did not follow complete native observations/body seals",
    );
  }
  // The participating caller observes nonzero and never calls finishOwner.
  assert(
    !await exists(join(root, ".course-owner/finished.json")) &&
      !await exists(join(root, ".course-owner/body/package.json")),
    "Native failure issued a current finish/body package",
  );
  try {
    await api.validateOwnerBodies(prepared, {});
    throw new Error("Native failure accepted a body handle");
  } catch (error) {
    assert(
      String(error).includes("RESOURCE.FINISH_REQUIRED"),
      "Unexpected missing-finish refusal: " + error,
    );
  }
  console.log(
    "PASS native nonzero; caller skipped finish and no current body handle validates",
  );
  Deno.exit(0);
}
console.log(
  mode === "full-static"
    ? "PASS native full static render exited zero without engine cells"
    : "PASS native render exited zero and R executed exactly once",
);

const actuals = [];
for await (
  const entry of Deno.readDir(join(root, ".course-owner/render", profile))
) {
  if (!entry.isFile || !entry.name.endsWith(".json")) continue;
  actuals.push(JSON.parse(
    await Deno.readTextFile(
      join(root, ".course-owner/render", profile, entry.name),
    ),
  ));
}
assert(
  actuals.length === (book ? 4 : 3),
  "Native render did not observe every actual owner root",
);
const actual = actuals.find((item) => item.source === "tasks/corpus.qmd");
const manual = actual?.occurrences.find((item: { id: string }) =>
  item.id === "exr-manual"
);
assert(manual, "Actual native manual question observation missing");
const condition = JSON.parse(manual.contentJson);
const nativePlots = actual.resources.raw.filter(
  (use: { kind: string; nativePlot: boolean }) =>
    use.kind === "Image" && use.nativePlot,
);
if (mode !== "full-static") {
  assert(
    manual.contentJson.includes("COMPUTED_BODY_CONDITION") &&
      hasNode(condition.blocks, "Table") &&
      hasNode(condition.blocks, "Image") &&
      nativePlots.length === 1 &&
      manual.contentJson.includes(nativePlots[0].target),
    "Actual native condition lost the computed paragraph, table or display image",
  );
}
console.log(
  mode === "full-static"
    ? "PASS actual full owner observation contains the authored static condition"
    : "PASS actual owner observation contains computed condition, table and image",
);
if (mode === "full-plot") {
  try {
    await api.finishOwner(prepared);
    throw new Error("Full-only generated plot received public authorization");
  } catch (error) {
    assert(
      String(error).includes("BODY.RESOURCE_DENIED"),
      "Unexpected full plot refusal: " + error,
    );
  }
  assert(
    !await exists(join(root, ".course-owner/finished.json")) &&
      !await exists(join(root, ".course-owner/body/package.json")),
    "Denied full plot issued a body package/finish",
  );
  console.log(
    "PASS full-only generated plot refuses without executed student evidence",
  );
  Deno.exit(0);
}

// finishOwner is called only after the participating caller observed native exit zero.
const finished = await api.finishOwner(prepared);
assert(
  finished.exitCode === 0,
  "Native owner finish failed: " + JSON.stringify(finished),
);
await Deno.writeTextFile(
  join(evidence, "finished.json"),
  JSON.stringify(finished, null, 2),
);
console.log(
  "PASS current owner lifecycle finished the successful native invocation",
);
assert(
  finished.report?.body,
  "BODY.EXPORT_MISSING: successful native owner render did not return a production body handle",
);
console.log("PASS installed Core returned a current production body handle");
const checked = await api.validateOwnerBodies(
  JSON.parse(JSON.stringify(prepared)),
  JSON.parse(JSON.stringify(finished.report.body)),
);
const bundle = checked.publicPackage;
assert(
  bundle.schema === "course-body-package-v1",
  "Wrong installed body contract",
);
assert(
  bundle.release ===
    (mode === "full-static" ? "static-build-release" : prepared.attemptId),
  "Default release did not name this participating build",
);
assert(
  bundle.questions.length === 5 && bundle.works.length === 2,
  "Canonical corpus was not aggregated exactly once",
);
assert(
  bundle.works[0].items.join(",") ===
      "body-proof/exr-manual,body-proof/exr-choice,body-proof/exr-numeric" &&
    bundle.works[1].items.join(",") ===
      "body-proof/exr-manual,body-proof/exr-multipart,body-proof/exr-matching",
  "Fixed work order/membership or shared canonical key changed",
);
const exported = bundle.questions.find((question: { id: string }) =>
  question.id === "exr-manual"
);
assert(
  JSON.stringify(exported.condition).includes(
    mode === "full-static"
      ? "STATIC_BODY_CONDITION"
      : "COMPUTED_BODY_CONDITION",
  ) &&
    hasNode(exported.condition, "Table") &&
    hasNode(exported.condition, "Image"),
  "Producer exported capture/source text instead of actual computed native body",
);
assert(
  bundle.questions.map((question: { answerType: string }) =>
    question.answerType
  ).join(",") ===
    "manual,single-choice,numeric,multipart,matching",
  "Common answer forms changed or silently fell back to manual",
);
const publicText = JSON.stringify(bundle);
assert(
  ![
    "GRADING_SECRET",
    "TEACHER_SECRET",
    '"closedKey"',
    '"gradingNotes"',
    '"solution"',
    '"correct"',
    '"answer-spec"',
  ].some((secret) => publicText.includes(secret)),
  "Public package leaked a closed component or marker",
);
assert(
  JSON.stringify(checked.privatePackage).includes("GRADING_SECRET") &&
    JSON.stringify(checked.privatePackage).includes("TEACHER_SECRET"),
  "Private owner package lost its closed components",
);
const choice = bundle.questions.find((question: { id: string }) =>
  question.id === "exr-choice"
);
assert(
  ["HTTP", "TLS", "FTP"].every((option) =>
    JSON.stringify(choice.publicAnswer).includes(option)
  ),
  "Choice projection removed an option",
);
assert(
  hasNode(choice.publicAnswer, "Link"),
  "Choice projection lost its native option resource slot",
);
const html = await Deno.readTextFile(join(root, "_site/tasks/corpus.html"));
assert(
  ["HTTP", "TLS", "FTP"].every((option) => html.includes(option)),
  "Native student HTML removed an option",
);
if (profile === "student") {
  assert(
    !html.includes("answer-spec") && !html.includes('class="correct"') &&
      !html.includes("GRADING_SECRET") && !html.includes("TEACHER_SECRET"),
    "Native student HTML leaked a bank, marker, solution or grading notes",
  );
}
assert(
  bundle.resources.length === (mode === "full-static" ? 2 : 3) &&
    bundle.resources.every((resource: { effectiveBase: string }) =>
      resource.effectiveBase === "tasks/corpus.qmd"
    ),
  "Actual attachment/diagram/plot binding or effective base changed",
);
const index = await api.validateOwnerResources(prepared);
for (const resource of bundle.resources) {
  const file = index.files.find((file: { path: string }) =>
    file.path === resource.source
  );
  const bytes = Uint8Array.from(
    atob(resource.data),
    (character) => character.charCodeAt(0),
  );
  const actualBytes = await Deno.readFile(file.actualPath);
  assert(
    file.sha256 === resource.sha256 && bytes.length === actualBytes.length &&
      bytes.every((byte, index) => byte === actualBytes[index]),
    "Embedded current resource bytes differ from owner index",
  );
}
for (
  const path of [
    finished.report.body.packagePath,
    finished.report.body.publicPath,
    finished.report.body.receiptPath,
  ]
) {
  const rel = path.slice(root.length + 1);
  assert(
    index.files.some((file: { path: string; origin: string }) =>
      file.path === rel && file.origin === "service"
    ) && !index.policy.files.find((file: { path: string }) =>
      file.path === rel
    ).allowed,
    "Body service files are not indexed and forbidden before delivery",
  );
}
if (book) {
  const session = await api.preparedSession(prepared);
  for (const work of bundle.works) {
    assert(
      session.headers.some((header: any) =>
        header.id === work.id && header.source.rootQmd === work.source &&
        header.source.owner === bundle.owner && header.ordinal === 1 &&
        header.topLevel && header.level === 2
      ),
      "Native book work did not preserve exact first authored Header proof",
    );
    const actual = actuals.find((capture: any) =>
      capture.source === work.source
    );
    assert(
      actual.assessmentFacts.chapterId === "" &&
        actual.assessmentFacts.chapterId !== work.id,
      "Native work identity borrowed book chapter metadata",
    );
    const workHtml = await Deno.readTextFile(
      join(root, "_site", work.source.replace(/\.qmd$/, ".html")),
    );
    for (const key of work.items) {
      assert(
        workHtml.includes("corpus.html#" + key.split("/")[1]),
        "Native book did not resolve the genuine cross-chapter question link: " +
          key,
      );
    }
  }
  console.log(
    "PASS warning-free native book cross-chapter links and exact first authored work Header proofs",
  );
}
const selected = await api.validateOwnerBodies(prepared, finished.report.body, {
  works: ["body-proof/sec-work-two"],
});
assert(
  selected.publicPackage.works.length === 1 &&
    selected.publicPackage.questions.length === 3,
  "Checked fixed-work selection did not reuse canonical questions",
);
console.log(
  profile === "student"
    ? "PASS actual checked body, common answers, student HTML, current resources and producer service index"
    : "PASS checked static full public package, common answers, current resources and producer service index",
);
