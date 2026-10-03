// Public Navigation root mounted-output addresses: actual root before native members.
import { dirname, fromFileUrl, join } from "stdlib/path";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const quarto = Deno.env.get("QUARTO") || "quarto";
const evidence = Deno.env.get("ROOT_ADDRESS_TEST_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "navigation-root-addresses-" });
const selected = Deno.args[0] || "all";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
assert(
  ["all", "--baseline-red", "--positive-only", "--children-only", "--audit-only"].includes(selected),
  "unknown focused root address mode",
);
async function hash(path: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", await Deno.readFile(path)),
  );
  return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
}
let commandSequence = 0;
async function command(root: string, args: string[], env: Record<string, string> = {}) {
  const result = await new Deno.Command(quarto, {
    cwd: root, args, env, stdout: "piped", stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(result.stdout) +
    new TextDecoder().decode(result.stderr);
  await Deno.mkdir(evidence, { recursive: true });
  await Deno.writeTextFile(join(evidence, `command-${commandSequence++}.log`), text);
  return { code: result.code, text };
}
async function write(root: string, path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
async function rejects(run: () => Promise<unknown>, code: string) {
  try {
    await run();
  } catch (error) {
    assert(String(error).includes(code), `expected ${code}: ${error}`);
    return;
  }
  throw new Error(`accepted ${code}`);
}
async function providerFiles(base: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function visit(dir: string) {
    for await (const entry of Deno.readDir(dir)) {
      const path = join(dir, entry.name);
      assert(!entry.isSymlink, "installed provider symlink");
      if (entry.isDirectory) await visit(path);
      else if (entry.isFile) files[path.slice(base.length + 1)] = await hash(path);
    }
  }
  await visit(base);
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}
const coreMap = await providerFiles(join(repo, "_extensions/course-core"));
async function install(root: string) {
  await Deno.mkdir(root, { recursive: true });
  const added = await command(root, ["add", repo, "--no-prompt"]);
  assert(!added.code, added.text);
  assert(
    JSON.stringify(coreMap) ===
      JSON.stringify(await providerFiles(join(root, "_extensions/course-core"))),
    "installed complete Core differs from candidate",
  );
}
async function rootFixture(root: string, body: string, output: string, id: string) {
  await install(root);
  await write(root, "_quarto.yml",
    "project:\n  type: website\n  output-dir: .project-publish/native\n  render: []\n  resources: []\n  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts\nformat:\n  html:\n    theme: none\nfilters: [course-core]\ncourse:\n  id: " + id + "\n");
  await write(root, "_quarto-student.yml", "course:\n  view: student\n");
  await write(root, "_quarto-publish-portal.yml",
    JSON.stringify({ project: { render: ["index.qmd"] } }));
  await write(root, "index.qmd", body);
  const configHashes = Object.fromEntries(await Promise.all(
    ["_quarto.yml", "_quarto-student.yml", "_quarto-publish-portal.yml"].map(
      async (path) => [join(root, path), await hash(join(root, path))],
    ),
  ));
  const portal = {
    input: join(root, "index.qmd"), output,
    renderProfiles: ["student", "publish-portal"],
    control: join(root, "_quarto-publish-portal.yml"),
    controlHash: configHashes[join(root, "_quarto-publish-portal.yml")],
    configHashes,
  };
  const nav = await import(`file://${root}/_extensions/course-core/owner-preflight/navigation.ts`);
  const owner = await import(`file://${root}/_extensions/course-core/owner-preflight/owner.ts`);
  return { portal, nav, owner };
}
type Member = { name: string; format: string; source: string; file: string };
async function member(root: string, value: Member) {
  await write(root, value.name + "/_quarto.yml",
    `project:\n  type: default\n  output-dir: _output\n  render: [${value.source}]\n  resources: []\nformat:\n  ${value.format}:\n    output-file: ${value.file}\n` +
    (value.format === "pdf"
      ? "    pdf-engine: xelatex\n    documentclass: article\n"
      : value.format === "html" ? "    theme: none\n" : ""));
  await write(root, value.name + "/_quarto-student.yml", "metadata: {}\n");
  await write(root, value.name + "/" + value.source,
    "# Current native member\n\nCurrent native writer bytes.\n");
}
const positiveMembers: Member[] = [
  { name: "lectures", format: "revealjs", source: "01/contracts.qmd", file: "slides.html" },
  { name: "practice", format: "revealjs", source: "01/contracts.qmd", file: "contracts.html" },
  { name: "book", format: "html", source: "topics/article.qmd", file: "article.html" },
  { name: "handouts", format: "pdf", source: "01/contracts.qmd", file: "contracts.pdf" },
];
async function positive() {
  const root = join(evidence, "course");
  const f = await rootFixture(root,
    "# Portal {#sec-portal}\n\n[Lecture](lectures/01/slides.html)\n\n[Practice](practice/01/contracts.html)\n\n[Article](book/topics/article.html)\n\n[Handout](handouts/01/contracts.pdf)\n",
    join(evidence, "portal-output"), "root-native-addresses");
  for (const value of positiveMembers) await member(root, value);
  await Deno.writeTextFile(join(evidence, "installed-core-map.json"), JSON.stringify(coreMap));
  const handle = await f.nav.prepareNavigationOwner(root, {
    attemptId: "root-native-addresses", profile: "student", portal: f.portal,
    members: positiveMembers.map((value) => ({
      path: join(root, value.name), format: value.format, mount: value.name,
    })),
    extension: "_extensions/course-core",
  });
  const metadata = join(evidence, "metadata.json");
  await Deno.writeTextFile(metadata, JSON.stringify(await f.nav.activateNavigationOwner(handle)));
  const rendered = await command(root, [
    "render", root, "--profile", "student,publish-portal",
    "--output-dir", f.portal.output, "--metadata-file", metadata,
  ], { PROJECT_PUBLISH_MEMBER: "1" });
  if (selected === "--baseline-red") {
    assert(rendered.code !== 0 &&
      rendered.text.includes("RESOURCE.ACTUAL_TARGET_MISSING") &&
      rendered.text.includes("lectures/01/slides.html"), rendered.text);
    await Deno.writeTextFile(join(evidence, "baseline-red.json"), JSON.stringify({
      status: "EXPECTED_RED", code: rendered.code,
      reason: "RESOURCE.ACTUAL_TARGET_MISSING", target: "lectures/01/slides.html",
      memberRendered: false,
    }));
    console.log("EXPECTED RED RESOURCE.ACTUAL_TARGET_MISSING lectures/01/slides.html before any child render");
    return;
  }
  assert(!rendered.code, rendered.text);
  const audit = (await f.owner.preparedSession(handle)).audit.navigation;
  assert(audit.addresses.length === 0, "root registry widened child transport");
  assert(audit.rootAddresses.length === 4, "finite native root registry incomplete");
  const stage = join(evidence, "stage");
  await Deno.mkdir(stage, { recursive: true });
  await rejects(() => f.nav.finishNavigationOwner(handle, { output: stage }),
    "SOURCE.NAVIGATION_ADDRESS_MISSING");
  for (const value of positiveMembers) {
    const renderedChild = await command(join(root, value.name), [
      "render", ".", "--profile", "student", "--output-dir", join(stage, value.name),
    ]);
    assert(!renderedChild.code, renderedChild.text);
  }
  const target = join(stage, "lectures/01/slides.html");
  const saved = await Deno.readFile(target);
  await Deno.rename(target, target + ".saved");
  await Deno.symlink(target + ".saved", target);
  await rejects(() => f.nav.finishNavigationOwner(handle, { output: stage }),
    "RESOURCE.SYMLINK_UNSUPPORTED");
  await Deno.remove(target);
  await Deno.rename(target + ".saved", target);
  const finished = await f.nav.finishNavigationOwner(handle, { output: stage });
  assert(finished.exitCode === 0, JSON.stringify(finished));
  await f.nav.validateOwnerResources(handle);
  const receipt = JSON.parse(await Deno.readTextFile(
    join(root, ".course-owner/navigation-addresses.json")));
  assert(receipt.bindings.length === 4, "missing nested native writer binding");
  for (const binding of receipt.bindings) {
    assert(binding.sha256 === await hash(join(stage, binding.target)), "staged SHA mismatch");
  }
  await Deno.writeTextFile(target, "LATE_NATIVE_ADDRESS_TAMPER\n");
  await rejects(() => f.nav.validateOwnerResources(handle), "SOURCE.NAVIGATION_ADDRESS_CHANGED");
  await Deno.writeFile(target, saved);
  await f.nav.validateOwnerResources(handle);
  await Deno.writeTextFile(join(evidence, "root-address-result.json"), JSON.stringify({
    status: "PASS", portalBeforeChildren: true,
    rootTargets: audit.rootAddresses.map((value: { target: string }) => value.target),
    childTargets: audit.addresses.map((value: { target: string }) => value.target),
    bindings: receipt.bindings.map((value: any) => ({
      target: value.target, format: value.format, sha256: value.sha256,
    })),
    refusals: ["missing-stage", "stage-symlink", "late-staged-bytes"],
  }));
  console.log("PASS native root addresses: Reveal/nested HTML/PDF, named writers, stage SHA/current; 3 live stage refusals");
}
async function childForeignRefusals() {
  // Separate fresh fixture; expected failed children never enter the positive root.
  const root = join(evidence, "child-boundaries");
  const f = await rootFixture(root, "# Portal {#sec-portal}\n",
    join(evidence, "child-boundary-portal-output"), "child-boundaries");
  const targets = positiveMembers.filter((value) => value.name !== "practice");
  for (const value of targets) await member(root, value);
  const controls = [
    { name: "reader-reveal", target: "lectures/01/slides.html" },
    { name: "reader-html", target: "book/topics/article.html" },
    { name: "reader-pdf", target: "handouts/01/contracts.pdf" },
  ];
  for (const control of controls) {
    await write(root, control.name + "/_quarto.yml",
      "project:\n  type: default\n  output-dir: _output\n  render: [index.qmd]\n  resources: []\n  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts\nformat:\n  html:\n    theme: none\nfilters: [course-core]\ncourse:\n  id: foreign-address-refusal\n");
    await write(root, control.name + "/_quarto-student.yml", "course:\n  view: student\n");
    await write(root, control.name + "/_quarto-full.yml", "course:\n  view: full\n");
    await write(root, control.name + "/index.qmd",
      `# Child reader\n\n[Foreign](../${control.target})\n`);
    await install(join(root, control.name));
  }
  const attemptId = "fresh-child-address-refusals";
  const handle = await f.nav.prepareNavigationOwner(root, {
    attemptId, profile: "student", portal: f.portal,
    members: [
      ...targets.map((value) => ({
        path: join(root, value.name), format: value.format, mount: value.name,
      })),
      ...controls.map((value) => ({
        path: join(root, value.name), format: "html", mount: value.name,
      })),
    ],
  });
  const audit = (await f.owner.preparedSession(handle)).audit.navigation;
  assert(audit.rootAddresses.length === 6 && audit.addresses.length === 3,
    "child-control registry geometry changed");
  for (const control of controls) {
    assert(audit.rootAddresses.some((value: { target: string }) => value.target === control.target) &&
      !audit.addresses.some((value: { target: string }) => value.target === control.target),
      "root registration widened child foreign transport");
    const child = await import(
      `file://${root}/${control.name}/_extensions/course-core/owner-preflight/owner.ts`);
    await rejects(() => child.prepareOwner(join(root, control.name), {
      attemptId, profile: "student", publicationAddresses: { navigation: handle },
    }), "RESOURCE.OUTSIDE_OWNER");
    console.log(`PASS independent child foreign ${control.name} refusal RESOURCE.OUTSIDE_OWNER`);
  }
  await Deno.writeTextFile(join(evidence, "child-boundary-result.json"), JSON.stringify({
    status: "PASS", parentPreparedOnly: true,
    refusals: controls.map((value) => ({ target: value.target, code: "RESOURCE.OUTSIDE_OWNER" })),
    coreInstallationFiles: Object.keys(coreMap).length, matchedInstallations: 4,
  }));
}
async function auditRefusal(name: string, file: string, code: string,
  options: { ambiguous?: boolean; symlink?: boolean } = {}) {
  const root = join(evidence, "audit-" + name);
  const f = await rootFixture(root, "# Portal {#sec-portal}\n",
    join(evidence, "audit-output-" + name), "bounded-audit");
  const inputs = options.ambiguous ? ["01/a.qmd", "01/b.qmd"] : ["01/a.qmd"];
  await write(root, "lectures/_quarto.yml",
    `project:\n  type: default\n  output-dir: _output\n  render: ${JSON.stringify(inputs)}\n  resources: []\nformat:\n  revealjs:\n    output-file: ${JSON.stringify(file)}\n`);
  await write(root, "lectures/_quarto-student.yml", "metadata: {}\n");
  for (const input of inputs) await write(root, "lectures/" + input, "# Native member\n");
  if (options.symlink) {
    await write(root, "external.qmd", "# External symlink source\n");
    await Deno.remove(join(root, "lectures/01/a.qmd"));
    await Deno.symlink(join(root, "external.qmd"), join(root, "lectures/01/a.qmd"));
  }
  await rejects(() => f.nav.auditNavigation(root, "_extensions/course-core", "student", {
    portal: f.portal, members: [{ path: join(root, "lectures"), format: "revealjs", mount: "lectures" }],
  }), code);
  console.log(`PASS root address finite audit refusal ${name}: ${code}`);
}
async function auditRefusals() {
  const controls = [
    ["absolute", "/tmp/escaped-native-writer.html", "SOURCE.NAVIGATION_ADDRESS_UNSUPPORTED"],
    ["escaping", "../../../escaped.html", "SOURCE.NAVIGATION_ADDRESS_UNSUPPORTED"],
    ["noncanonical", "folder/../slides.html", "SOURCE.NAVIGATION_ADDRESS_UNSUPPORTED"],
    ["backslash", "folder\\slides.html", "SOURCE.NAVIGATION_ADDRESS_UNSUPPORTED"],
  ] as const;
  for (const [name, file, code] of controls) await auditRefusal(name, file, code);
  await auditRefusal("ambiguous", "slides.html", "SOURCE.NAVIGATION_ADDRESS_AMBIGUOUS", { ambiguous: true });
  await auditRefusal("source-symlink", "slides.html", "SOURCE.NAVIGATION_MEMBER_BOUNDARY_INVALID", { symlink: true });
  await Deno.writeTextFile(join(evidence, "root-address-audit-result.json"), JSON.stringify({
    status: "PASS", refusals: [
      ...controls.map(([name, , code]) => ({ name, code })),
      { name: "ambiguous", code: "SOURCE.NAVIGATION_ADDRESS_AMBIGUOUS" },
      { name: "source-symlink", code: "SOURCE.NAVIGATION_MEMBER_BOUNDARY_INVALID" },
    ],
  }));
}
if (["all", "--positive-only", "--baseline-red"].includes(selected)) await positive();
if (["all", "--children-only"].includes(selected)) await childForeignRefusals();
if (["all", "--audit-only"].includes(selected)) await auditRefusals();
console.log(selected === "all"
  ? "PASS root native output registry: 4 native positive targets; 3 stage/current, 3 child and 6 audit refusals"
  : "PASS focused root native output mode " + selected);
