import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "a2-i1-guards-" });
const output = await Deno.makeTempDir({ prefix: "a2-i1-output-" });
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
async function put(name: string, text: string) {
  const path = join(root, name);
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, text);
}
const targets = [
  ["git", ".git/config"],
  ["quarto", "_quarto.yml"],
  ["metadata", "_metadata.yml"],
  ["hidden", ".env"],
  ["script", "check.sh"],
  ["generated", "build/marker.txt"],
  ["binary", "lib/dependency.jar"],
  ["bytecode", "cached.pyc"],
  ["source", "doc.qmd"],
  ["maven", ".mvn/settings.xml"],
] as const;
const sources = [
  "shared/_quarto-payload.yml",
  "shared/raw.qmd",
  "shared/build/payload.txt",
];
const inputs = [
  ...targets.map(([name, target]) => ({
    name: "target-" + name,
    target,
    source: "../../shared/payload.txt",
  })),
  ...sources.map((source, i) => ({
    name: "source-" + i,
    target: "resources/copied.txt",
    source: "../../" + source,
  })),
  { name: "legal", target: ".gitignore", source: "../../shared/.gitignore" },
];
const extension = join(repo, "_extensions/course-core/native-ts");
await put(
  "_quarto.yml",
  `project:\n  type: book\n  output-dir: _site\nbook:\n  title: Проверка\n  chapters: [index.qmd]\nformat:\n  html:\n    theme: none\ncourse-core-projection: student\nfilters:\n  - at: pre-ast\n    path: ${extension}/early-context.lua\n  - at: post-quarto\n    path: ${extension}/late-kind.lua\n  - at: post-render\n    path: ${extension}/late-filter.lua\ncourse-project:\n  starter: {path: starter}\n  instructions:\n    gradle: {path: shared/gradle.md}\n  build:\n    files:\n      build.gradle: shared/build.gradle\n      settings.gradle: shared/settings.gradle\n`,
);
for (
  const [path, text] of Object.entries({
    "shared/gradle.md": "Выполните `gradle test`.\n",
    "shared/build.gradle": "plugins { id 'java' }\n",
    "shared/settings.gradle": "rootProject.name='guard-control'\n",
    "shared/payload.txt": "TARGET_GUARD_CONTROL\n",
    "shared/.gitignore": "build/\n",
    "public.svg":
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle r="5" cx="10" cy="10"/></svg>',
  })
) await put(path, text);
for (const source of sources) await put(source, "SOURCE_GUARD_CONTROL\n");
let body = "# Проверка\n\n";
for (const input of inputs) {
  const dir = "projects/" + input.name;
  await put(dir + "/input.qmd", "# Code\n");
  await put(dir + "/starter/src/main/java/Main.java", "class Main {}\n");
  await put(dir + "/starter/assets/.gitignore", "*.tmp\n");
  await put(
    dir + "/_metadata.yml",
    `course-project:\n  build:\n    files:\n      ${
      JSON.stringify(input.target)
    }: ${input.source}\n${
      input.name === "legal"
        ? "  solutions:\n    reference: {path: reference}\n"
        : ""
    }`,
  );
  if (input.name === "legal") {
    await put(dir + "/reference/src/main/java/Main.java", "class Main {}\n");
  }
  body +=
    `::: {#exr-${input.name} difficulty=introductory statement-visibility=open project="${dir}/input.qmd"}\nУсловие ${input.name}.\n\n${
      input.name === "legal" ? "![Ресурс](public.svg)\n" : ""
    }\n:::\n\n`;
}
for (const [i, source] of sources.entries()) {
  body +=
    `::: {#exr-resource-source-${i} difficulty=introductory statement-visibility=open project="projects/legal/input.qmd"}\n[Материал](${source}).\n:::\n\n`;
}
await put("index.qmd", body);
const context = {
  operation: crypto.randomUUID(),
  input: join(root, "index.qmd"),
  format: "html",
  projection: "student",
  exerciseBank: true,
};
const capture = join(root, "capture");
await put("run.json", JSON.stringify({ context, capture }));
const started = performance.now();
const native = await new Deno.Command("quarto", {
  args: ["render", "index.qmd", "--to", "html"],
  cwd: root,
  env: {
    COURSE_CORE_TS_RUN: join(root, "run.json"),
    QUARTO_RUN_NO_NETWORK: "true",
  },
  stdout: "piped",
  stderr: "piped",
}).output();
await put(
  "render.log",
  new TextDecoder().decode(native.stdout) +
    new TextDecoder().decode(native.stderr),
);
assert(native.success, "Native render failed: " + root);
const document = Core.finalizeDocument(
  JSON.parse(await Deno.readTextFile(capture + ".early.json")),
  JSON.parse(await Deno.readTextFile(capture + ".late.json")),
);
assert(document.status === "complete", "Native document incomplete");
const results: { name: string; status: string; error?: string }[] = [];
async function reject(name: string, code: string, operation: () => unknown) {
  try {
    await operation();
    results.push({ name, status: "ACCEPTED_UNSAFE" });
  } catch (error) {
    results.push({
      name,
      status: String(error).includes(code) ? "refused" : "WRONG_ERROR",
      error: String(error),
    });
  }
}
const submission = { files: [], instructions: "Сдайте исходник." };
const bindings = {
  submission,
  resources: {
    "public.svg": { path: "public.svg", target: "resources/public.svg" },
  },
};
let legalCapture: unknown,
  fullCapture: unknown,
  budget: () => unknown = () => null;
await Core.readProjectContexts([{
  owner: root,
  inputs: inputs.map((i) => "projects/" + i.name + "/input.qmd"),
  profiles: [],
  format: "html",
}], async ([op]) => {
  for (const [index, input] of inputs.entries()) {
    if (input.name === "legal") continue;
    const condition = Core.selectCondition(
      document,
      "exr-" + input.name,
      "student",
    );
    const plan = await Core.planProject(op.contexts[index], {
      audience: "student",
    });
    await reject(
      "build:" + input.name,
      input.name.startsWith("source-") ? "ARTIFACT_SOURCE" : "ARTIFACT_TARGET",
      async () => {
        const inventory = await Core.materializeProject(plan, condition, {
          submission,
        });
        await Core.writeArtifactInventory(
          inventory,
          join(output, "unsafe-build-" + input.name),
        );
      },
    );
  }
  const selected = Core.selectCondition(document, "exr-legal", "student");
  const ctx = op.contexts.at(-1)!;
  const plan = await Core.planProject(ctx, { audience: "student" });
  const legal = await Core.materializeProject(plan, selected, bindings);
  legalCapture = legal;
  for (const [name, target] of targets) {
    await reject("resource-target:" + name, "ARTIFACT_TARGET", async () => {
      const inventory = await Core.materializeProject(plan, selected, {
        submission,
        resources: { "public.svg": { path: "public.svg", target } },
      });
      await Core.writeArtifactInventory(
        inventory,
        join(output, "unsafe-resource-" + name),
      );
    });
  }
  for (const [i, source] of sources.entries()) {
    await reject(
      "resource-source:" + i,
      "ARTIFACT_SOURCE",
      () =>
        Core.materializeProject(
          plan,
          Core.selectCondition(document, "exr-resource-source-" + i, "student"),
          {
            submission,
            resources: {
              [source]: { path: source, target: "resources/copied.txt" },
            },
          },
        ),
    );
  }
  const fullPlan = await Core.planProject(ctx, { audience: "full" });
  const full = await Core.materializeProject(fullPlan, selected, bindings);
  fullCapture = full;
  for (
    const target of [
      ".gitignore",
      "assets/.gitignore",
      "build.gradle",
      "settings.gradle",
      "src/main/java/Main.java",
    ]
  ) {
    assert(
      legal.files.some((f) => f.target === target),
      "Legal target lost: " + target,
    );
  }
  for (
    const target of [
      "author/reference/.gitignore",
      "author/reference/build.gradle",
      "author/reference/settings.gradle",
      "author/reference/src/main/java/Main.java",
    ]
  ) {
    assert(
      full.files.some((f) => f.target === target && f.audience === "full"),
      "Full source group lost: " + target,
    );
  }
  budget = () => op.metrics;
});
const legal = Core.ArtifactInventorySchema.parse(legalCapture),
  full = Core.ArtifactInventorySchema.parse(fullCapture);
// A consumer process can supply an independently decoded DTO: policy must hold at IO too.
const file = legal.files.find((f) => f.target === "build.gradle")!;
for (
  const [name, target] of [...targets, [
    "private",
    "reference/control.txt",
  ]] as const
) {
  await reject(
    "IO:" + name,
    name === "private" ? "ARTIFACT_PRIVATE" : "ARTIFACT_TARGET",
    () =>
      Core.writeArtifactInventory(
        { ...legal!, files: [{ ...file, target }] },
        join(output, "unsafe-io-" + name),
      ),
  );
}
await reject(
  "IO-full-git",
  "ARTIFACT_TARGET",
  () =>
    Core.writeArtifactInventory({
      ...full!,
      files: [{
        ...file,
        audience: "full",
        target: "author/reference/.git/config",
      }],
    }, join(output, "unsafe-io-full-git")),
);
const consumer = join(output, "consumer");
const io = await Core.writeArtifactInventory(legal, consumer);
await Core.writeArtifactInventory(full, join(output, "full-consumer"));
const archive = join(output, "student.zip"),
  extracted = join(output, "extracted");
let result = await new Deno.Command("zip", {
  args: ["-qr", archive, "."],
  cwd: consumer,
  stdout: "piped",
  stderr: "piped",
}).output();
assert(result.success, "ZIP test consumer failed");
result = await new Deno.Command("unzip", {
  args: ["-q", archive, "-d", extracted],
  stdout: "piped",
  stderr: "piped",
}).output();
assert(result.success, "Extraction failed");
for (const file of legal.files) {
  const bytes = await Deno.readFile(join(extracted, file.target));
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  assert(
    bytes.length === file.size && digest === file.sha256,
    "Extracted IO bytes changed: " + file.target,
  );
}
for await (const entry of Deno.readDir(output)) {
  assert(
    !entry.name.startsWith("unsafe-") ||
      results.some((r) => r.status === "ACCEPTED_UNSAFE"),
    "Refused target produced output",
  );
}
const summary = {
  status: results.every((r) => r.status === "refused") ? "PASS" : "FAIL",
  root,
  output,
  nativeExit: native.code,
  documentStatus: document.status,
  budget: budget(),
  io,
  results,
  legalTargets: legal.files.map((f) => f.target),
  fullTargets: full.files.map((f) => f.target),
  wallMs: Math.round(performance.now() - started),
};
const evidence = Deno.env.get("A2_I1_RESULTS");
if (evidence) {
  await Deno.writeTextFile(evidence, JSON.stringify(summary, null, 2) + "\n");
}
console.log(JSON.stringify(summary));
assert(summary.status === "PASS", "A2-I1 target/source guard bypass");
