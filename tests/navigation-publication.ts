// Actual installed native outputs, scoped current owner assets and runtime contracts.
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const quarto = Deno.env.get("QUARTO") || "quarto";
const root = await Deno.makeTempDir({ prefix: "navigation-publication-" });
const stage = root + "-stage";
function assert(v: unknown, message: string): asserts v {
  if (!v) throw new Error(message);
}
async function cmd(cwd: string, args: string[]) {
  const r = await new Deno.Command(quarto, {
    cwd,
    args,
    env: { PROJECT_PUBLISH_MEMBER: "1" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(
    r.success,
    new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr),
  );
}
async function write(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
async function hash(path: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", await Deno.readFile(path)),
    ),
  ].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function rejects(run: () => Promise<unknown>, code: string) {
  try {
    await run();
  } catch (e) {
    assert(String(e).includes(code), `expected ${code}: ${e}`);
    return;
  }
  throw new Error(`accepted ${code}`);
}
async function copy(src: string, dst: string) {
  await Deno.mkdir(dst, { recursive: true });
  for await (const e of Deno.readDir(src)) {
    const a = join(src, e.name), b = join(dst, e.name);
    if (e.isDirectory) await copy(a, b);
    else if (e.isFile) await Deno.copyFile(a, b);
    else throw new Error("symlink");
  }
}
await cmd(root, ["add", repo, "--no-prompt"]);
let publication: any;
try {
  publication = await import(
    `file://${root}/_extensions/course-core/owner-preflight/publication-resources.ts`
  );
} catch { /* first native RED */ }
assert(
  typeof publication?.sealNavigationPublicationResources === "function",
  "missing provider scoped publication resource seam",
);
const nav = await import(
  `file://${root}/_extensions/course-core/owner-preflight/navigation.ts`
);
const manifestText = await Deno.readTextFile(
  join(root, "_extensions/course-navigation/navigation/plugin.yml"),
);
const unknownManifest = root + "-unknown-plugin.yml";
const unknownValue = JSON.parse(manifestText);
unknownValue.unknownPrivateField = "secret";
await Deno.writeTextFile(unknownManifest, JSON.stringify(unknownValue) + "\n");
await rejects(
  () => publication.readPublicNavigationManifest(unknownManifest),
  "RESOURCE.RUNTIME_DECLARATION_UNSUPPORTED",
);
const commentManifest = root + "-comment-plugin.yml";
await Deno.writeTextFile(
  commentManifest,
  manifestText + "# PRIVATE_COMMENT_TRANSPORT\n",
);
await rejects(
  () => publication.readPublicNavigationManifest(commentManifest),
  "RESOURCE.RUNTIME_MANIFEST_NONCANONICAL",
);
const owner = await import(
  `file://${root}/_extensions/course-core/owner-preflight/owner.ts`
);
await write(
  "_quarto.yml",
  "project:\n  type: website\n  output-dir: .project-publish/native\n  render: []\n  resources: [public.txt, '!tasks/**', '!slides/**']\n  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts\nformat:\n  html:\n    theme: none\nfilters: [course-core]\ncourse:\n  id: scoped-publication\n",
);
await write("_quarto-student.yml", "course:\n  view: student\n");
await write(
  "_quarto-publish-portal.yml",
  JSON.stringify({ project: { render: ["index.qmd"] } }),
);
await write(
  "index.qmd",
  "# Portal\n\n[Tasks](tasks/index.html)\n\n[Public](public.txt)\n",
);
await write("public.txt", "ROOT_PUBLIC\n");
for (const member of ["tasks", "slides"]) {
  await Deno.mkdir(join(root, member));
  await cmd(join(root, member), ["add", repo, "--no-prompt"]);
}
await write(
  "tasks/_quarto.yml",
  "project:\n  type: default\n  output-dir: _output\n  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts\n  resources: [public-starter.txt, '!closed.txt']\nformat:\n  html:\n    theme: none\nfilters: [course-core, course-presentation]\ncourse:\n  id: task-owner\n",
);
await write("tasks/_quarto-student.yml", "course:\n  view: student\n");
await write("tasks/_quarto-full.yml", "course:\n  view: full\n");
await write(
  "tasks/index.qmd",
  "# Tasks\n\n[Starter](public-starter.txt)\n\n::: {.solution}\n[Closed](closed.txt)\n:::\n",
);
await write("tasks/public-starter.txt", "CHILD_PUBLIC\n");
await write("tasks/closed.txt", "CHILD_CLOSED\n");
await write(
  "slides/_quarto.yml",
  "project:\n  type: default\n  output-dir: _output\nformat: revealjs\nfilters: [course-presentation]\nrevealjs-plugins: [course-navigation]\n",
);
await write("slides/index.qmd", "# Native slides\n\n## Example\n\nText.\n");
const members = [
  { path: join(root, "tasks"), mount: "tasks", format: "html" },
  { path: join(root, "slides"), mount: "slides", format: "revealjs" },
];
const portal = {
  input: join(root, "index.qmd"),
  output: root + "-portal",
  renderProfiles: ["student", "publish-portal"],
  control: join(root, "_quarto-publish-portal.yml"),
  controlHash: await hash(join(root, "_quarto-publish-portal.yml")),
  configHashes: Object.fromEntries(
    await Promise.all(
      ["_quarto.yml", "_quarto-student.yml", "_quarto-publish-portal.yml"].map(
        async (p) => [join(root, p), await hash(join(root, p))],
      ),
    ),
  ),
};
const task = await owner.prepareOwner(join(root, "tasks"), {
  attemptId: "native-scoped",
  profile: "student",
  extension: "_extensions/course-core",
});
const prepared = await nav.prepareNavigationOwner(root, {
  attemptId: "native-scoped",
  profile: "student",
  portal,
  members,
});
const outputs = members.map((m) => ({
  ...m,
  output: root + "-native-" + m.mount,
  ...(m.mount === "tasks" ? { owner: task } : {}),
}));
await Deno.writeTextFile(
  root + "-metadata.json",
  JSON.stringify(await nav.activateNavigationOwner(prepared)),
);
await cmd(root, [
  "render",
  ".",
  "--profile",
  "student,publish-portal",
  "--output-dir",
  portal.output,
  "--metadata-file",
  root + "-metadata.json",
]);
for (const m of outputs) {
  if (m.owner) {
    await Deno.writeTextFile(
      root + "-task-metadata.json",
      JSON.stringify(await owner.activateOwner(m.owner, { output: m.output })),
    );
  }
  await cmd(m.path, [
    "render",
    ".",
    "--profile",
    "student",
    "--output-dir",
    m.output,
    ...(m.owner ? ["--metadata-file", root + "-task-metadata.json"] : []),
  ]);
}
await copy(portal.output, stage);
for (const m of outputs) await copy(m.output, join(stage, m.mount));
assert(
  (await owner.finishOwner(task)).exitCode === 0,
  "task owner finish failed",
);
assert(
  (await nav.finishNavigationOwner(prepared, { output: stage })).exitCode === 0,
  "navigation finish failed",
);
const seal = () =>
  publication.sealNavigationPublicationResources(prepared, {
    output: stage,
    members: outputs,
  });
await Deno.copyFile(
  join(root, ".course-owner/resources.json"),
  join(stage, "renamed-owner-receipt.json"),
);
await rejects(seal, "RESOURCE.PUBLICATION_DENIED_BYTES");
await Deno.remove(join(stage, "renamed-owner-receipt.json"));
await rejects(
  () =>
    publication.sealNavigationPublicationResources(prepared, {
      output: stage,
      members: [
        { ...outputs[0], owner: { ...task, attemptId: "foreign" } },
        outputs[1],
      ],
    }),
  "SOURCE.INVALID_ATTEMPT",
);
await Deno.copyFile(
  join(root, "tasks/public-starter.txt"),
  join(stage, "renamed-starter.txt"),
);
await rejects(seal, "RESOURCE.PUBLICATION_DENIED_BYTES");
await Deno.remove(join(stage, "renamed-starter.txt"));
await Deno.copyFile(
  join(root, "tasks/closed.txt"),
  join(stage, "tasks/renamed-closed.txt"),
);
await rejects(seal, "RESOURCE.PUBLICATION_DENIED_BYTES");
await Deno.remove(join(stage, "tasks/renamed-closed.txt"));
await Deno.copyFile(
  join(root, "slides/_extensions/course-navigation/navigation/model.js"),
  join(stage, "slides/renamed-runtime.js"),
);
await rejects(seal, "RESOURCE.PUBLICATION_DENIED_BYTES");
await Deno.remove(join(stage, "slides/renamed-runtime.js"));
await Deno.copyFile(
  join(root, "slides/_extensions/course-navigation/navigation/plugin.yml"),
  join(stage, "slides/renamed-plugin.yml"),
);
await rejects(seal, "RESOURCE.PUBLICATION_DENIED_BYTES");
await Deno.remove(join(stage, "slides/renamed-plugin.yml"));
const navigationIndex = await nav.validateOwnerResources(prepared);
const currentModel = navigationIndex.files.find((file: any) =>
  file.path.startsWith("tasks/_generated/course-spec/core/") &&
  file.origin === "service"
);
assert(currentModel, "current child Core model is not producer-owned service");
await Deno.copyFile(
  currentModel.actualPath,
  join(stage, "tasks/leaked-current-model.json"),
);
await rejects(seal, "RESOURCE.PUBLICATION_DENIED_BYTES");
await Deno.remove(join(stage, "tasks/leaked-current-model.json"));
const receipt = await seal();
assert(
  receipt.grants.some((g: any) =>
    g.path === "tasks/public-starter.txt" && g.kind === "owner"
  ),
  "current owned mounted asset not authorized",
);
assert(
  receipt.grants.filter((g: any) => g.kind === "runtime").length >= 10,
  "finite native Presentation/Nav proofs absent",
);
assert(
  receipt.grants.some((g: any) =>
    g.kind === "runtime-manifest" &&
    g.path.endsWith("/revealjs/plugin/course-navigation/plugin.yml")
  ),
  "exact native public runtime manifest absent",
);
const pluginFiles = [];
for await (
  const entry of Deno.readDir(
    join(
      outputs[1].output,
      "index_files/libs/revealjs/plugin/course-navigation",
    ),
  )
) pluginFiles.push(entry.name);
assert(
  pluginFiles.sort().join(",") ===
    "model.js,navigation.css,plugin.js,plugin.yml,ui.js",
  "native registered plugin shipped undeclared private files",
);
await publication.validateNavigationPublicationResources(prepared);
const runtime = receipt.grants.find((g: any) => g.kind === "runtime"),
  bytes = await Deno.readFile(join(stage, runtime.path));
await Deno.writeTextFile(join(stage, runtime.path), "runtime-changed");
await rejects(
  () => publication.validateNavigationPublicationResources(prepared),
  "RESOURCE.PUBLICATION_STAGE_CHANGED",
);
await Deno.writeFile(join(stage, runtime.path), bytes);
await Deno.copyFile(
  join(root, "tasks/public-starter.txt"),
  join(stage, "late-renamed.txt"),
);
await rejects(
  () => publication.validateNavigationPublicationResources(prepared),
  "RESOURCE.PUBLICATION_STAGE_CHANGED",
);
await Deno.remove(join(stage, "late-renamed.txt"));
const modelBytes = await Deno.readFile(currentModel.actualPath);
await Deno.writeTextFile(currentModel.actualPath, "changed-current-model");
await rejects(
  () => publication.validateNavigationPublicationResources(prepared),
  "RESOURCE.BYTES_CHANGED",
);
await Deno.writeFile(currentModel.actualPath, modelBytes);
await write(
  "slides/_extensions/course-navigation/navigation/model.js",
  "late-provider-module",
);
await rejects(
  () => publication.validateNavigationPublicationResources(prepared),
  "SOURCE.FROZEN_INPUT_CHANGED",
);
console.log(`PASS native scoped publication resources: ${root}`);
