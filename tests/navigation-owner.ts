import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const quarto = Deno.env.get("QUARTO") || "quarto";
const evidence = Deno.env.get("NAVIGATION_TEST_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "navigation-owner-" });
function assert(v: unknown, message: string): asserts v {
  if (!v) throw new Error(message);
}
async function command(
  root: string,
  args: string[],
  env: Record<string, string> = {},
) {
  const r = await new Deno.Command(quarto, {
    args,
    cwd: root,
    env,
    stdout: "piped",
    stderr: "piped",
  }).output();
  return {
    code: r.code,
    text: new TextDecoder().decode(r.stdout) +
      new TextDecoder().decode(r.stderr),
  };
}
async function hash(path: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", await Deno.readFile(path)),
    ),
  ].map((b) => b.toString(16).padStart(2, "0")).join("");
}
let sequence = 0;
async function fixture(
  body = "# Portal {#sec-portal}\n\n[Current](public.txt)\n",
) {
  const root = join(evidence, `case-${sequence++}`);
  await Deno.mkdir(root, { recursive: true });
  const r = await command(root, ["add", repo, "--no-prompt"]);
  assert(!r.code, r.text);
  const write = async (path: string, text: string) => {
    await Deno.mkdir(dirname(join(root, path)), { recursive: true });
    await Deno.writeTextFile(join(root, path), text);
  };
  await write(
    "_quarto.yml",
    "project:\n  type: website\n  output-dir: .project-publish/native\n  render: []\n  resources: [public.txt, '!book/**']\n  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts\nformat:\n  html:\n    theme: none\nfilters: [course-core]\ncourse:\n  id: navigation-proof\n",
  );
  await write("_quarto-student.yml", "course:\n  view: student\n");
  await write(
    "_quarto-publish-portal.yml",
    JSON.stringify({ project: { render: ["index.qmd"] } }),
  );
  await write("index.qmd", body);
  await write("public.txt", "CURRENT_RESOURCE\n");
  await write(
    "book/_quarto.yml",
    "project:\n  type: book\n  output-dir: _book\nbook:\n  title: Child\n  chapters: [index.qmd]\nformat: html\n",
  );
  await write("book/_quarto-student.yml", "metadata: {}\n");
  await write(
    "book/index.qmd",
    "# Child\n\n::: {#exr-child}\nChild pedagogy belongs to the child owner.\n:::\n",
  );
  const portal = {
    input: join(root, "index.qmd"),
    output: join(evidence, `output-${sequence}`),
    renderProfiles: ["student", "publish-portal"],
    control: join(root, "_quarto-publish-portal.yml"),
    controlHash: await hash(join(root, "_quarto-publish-portal.yml")),
    configHashes: Object.fromEntries(
      await Promise.all(
        ["_quarto.yml", "_quarto-student.yml", "_quarto-publish-portal.yml"]
          .map(async (p) => [join(root, p), await hash(join(root, p))]),
      ),
    ),
  };
  let api: any;
  try {
    api = await import(
      new URL(
        `file://${root}/_extensions/course-core/owner-preflight/navigation.ts`,
      ).href
    );
  } catch { /* Missing provider is the initial RED. */ }
  assert(
    typeof api?.prepareNavigationOwner === "function",
    "missing native navigation owner provider",
  );
  const options = {
    attemptId: `navigation-${sequence}`,
    profile: "student",
    portal,
    members: [{ path: join(root, "book"), format: "html", mount: "book" }],
    extension: "_extensions/course-core",
  };
  return { root, api, options, portal, write };
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
if (
  !Deno.args.includes("--address-only") &&
  !Deno.args.includes("--scope-only") && !Deno.args.includes("--download-only")
) {
  const f = await fixture();
  const prepared = await f.api.prepareNavigationOwner(f.root, f.options);
  assert(prepared.profile === "student", "audience identity lost");
  const controlBytes = await Deno.readTextFile(f.portal.control);
  await f.write(
    "_quarto-publish-portal.yml",
    JSON.stringify({ project: { render: ["book/index.qmd"] } }),
  );
  await rejects(
    () => f.api.activateNavigationOwner(prepared),
    "SOURCE.NAVIGATION_DESCRIPTOR_INVALID",
  );
  await f.write("_quarto-publish-portal.yml", controlBytes);
  await f.write("public.txt", "TAMPERED\n");
  await rejects(
    () => f.api.activateNavigationOwner(prepared),
    "SOURCE.FROZEN_INPUT_CHANGED",
  );
  await f.write("public.txt", "CURRENT_RESOURCE\n");
  await f.write("book/index.qmd", "# Child tampered\n");
  await rejects(
    () => f.api.activateNavigationOwner(prepared),
    "SOURCE.FROZEN_INPUT_CHANGED",
  );
  await f.write(
    "book/index.qmd",
    "# Child\n\n::: {#exr-child}\nChild pedagogy belongs to the child owner.\n:::\n",
  );
  const metadata = await f.api.activateNavigationOwner(prepared);
  const metadataPath = join(evidence, "actual-metadata.json");
  await Deno.writeTextFile(metadataPath, JSON.stringify(metadata));
  const wrongProfile = await command(f.root, [
    "render",
    ".",
    "--profile",
    "student",
    "--output-dir",
    f.portal.output,
    "--metadata-file",
    metadataPath,
  ], { PROJECT_PUBLISH_MEMBER: "1" });
  assert(
    wrongProfile.code !== 0 &&
      wrongProfile.text.includes("SOURCE.INVOCATION_PROFILE_MISMATCH"),
    "native original profile bypassed composite guard",
  );
  const r = await command(f.root, [
    "render",
    ".",
    "--profile",
    "student,publish-portal",
    "--output-dir",
    f.portal.output,
    "--metadata-file",
    metadataPath,
  ], { PROJECT_PUBLISH_MEMBER: "1" });
  await Deno.writeTextFile(join(evidence, "native.log"), r.text);
  assert(!r.code, r.text);
  const finished = await f.api.finishNavigationOwner(prepared);
  assert(finished.exitCode === 0, JSON.stringify(finished));
  const resources = await f.api.validateOwnerResources(prepared);
  assert(
    resources.files.find((x: any) => x.path === "public.txt")?.sha256 ===
      await hash(join(f.root, "public.txt")),
    "current native root resource omitted",
  );
  assert(
    resources.policy.files.find((x: any) => x.path === "public.txt")?.allowed,
    "public resource denied",
  );
  assert(
    !resources.policy.files.find((x: any) =>
      x.path === "_quarto-publish-portal.yml"
    )?.allowed,
    "control bytes became public",
  );
  assert(
    !resources.policy.files.find((x: any) => x.path === "book/index.qmd")
      ?.allowed,
    "child raw source became public",
  );
  for (
    const [body, code] of [
      ["::: {#exr-root}\nTask\n:::\n", "SOURCE.NAVIGATION_UNSUPPORTED"],
      ["::: {.grading-notes}\nSecret\n:::\n", "SOURCE.NAVIGATION_UNSUPPORTED"],
      [
        "```{python}\nopen('engine-ran','w').write('bad')\n```\n",
        "SOURCE.NAVIGATION_COMPUTED_UNSUPPORTED",
      ],
    ]
  ) {
    const bad = await fixture(body);
    await rejects(
      () => bad.api.prepareNavigationOwner(bad.root, bad.options),
      code,
    );
    try {
      await Deno.stat(join(bad.root, "engine-ran"));
      throw new Error("navigation prepare executed engine");
    } catch (e) {
      assert(e instanceof Deno.errors.NotFound, String(e));
    }
  }
  const overlap = await fixture();
  overlap.options.members.push({ ...overlap.options.members[0] });
  await rejects(
    () => overlap.api.prepareNavigationOwner(overlap.root, overlap.options),
    "SOURCE.NAVIGATION_MEMBER_BOUNDARY_INVALID",
  );
  const changed = await fixture();
  changed.portal.renderProfiles = ["full", "publish-portal"];
  await rejects(
    () => changed.api.prepareNavigationOwner(changed.root, changed.options),
    "SOURCE.NAVIGATION_DESCRIPTOR_INVALID",
  );
  const control = await fixture();
  control.portal.controlHash = "0".repeat(64);
  await rejects(
    () => control.api.prepareNavigationOwner(control.root, control.options),
    "SOURCE.NAVIGATION_DESCRIPTOR_INVALID",
  );
}
if (
  !Deno.args.includes("--address-only") &&
  !Deno.args.includes("--download-only")
) {
  const dormant = await fixture();
  await dormant.write(
    "examples/_quarto.yml",
    "project:\n  type: default\n  output-dir: _example\n  render: []\n  pre-render: _extensions/missing/project-download/pre.ts\nformat: html\nfilters: [course-core, project-download]\n",
  );
  await dormant.write(
    "examples/demo.qmd",
    "# Independent dormant source\n\n::: {#exr-independent}\nNot root pedagogy.\n:::\n",
  );
  await dormant.write(
    "examples/_generated/project-download/requests/frozen.json",
    "DORMANT_STATE\n",
  );
  const dormantOwner = await dormant.api.prepareNavigationOwner(
    dormant.root,
    dormant.options,
  );
  const dormantConfig = await Deno.readTextFile(
    join(dormant.root, "examples/_quarto.yml"),
  );
  await dormant.write(
    "examples/_quarto.yml",
    dormantConfig + "title: Changed dormant identity\n",
  );
  await rejects(
    () => dormant.api.activateNavigationOwner(dormantOwner),
    "SOURCE.CONFIGURATION_CHANGED",
  );
  await dormant.write("examples/_quarto.yml", dormantConfig);
  await dormant.write(
    "examples/_generated/project-download/requests/frozen.json",
    "CHANGED_DORMANT_STATE\n",
  );
  await rejects(
    () => dormant.api.activateNavigationOwner(dormantOwner),
    "SOURCE.FROZEN_INPUT_CHANGED",
  );
  await dormant.write(
    "examples/_generated/project-download/requests/frozen.json",
    "DORMANT_STATE\n",
  );
  await dormant.write("examples/demo.qmd", "# Dormant changed\n");
  await rejects(
    () => dormant.api.activateNavigationOwner(dormantOwner),
    "SOURCE.FROZEN_INPUT_CHANGED",
  );
  const rawDormant = await fixture(
    "# Portal\n\n[Raw dormant](examples/demo.qmd)\n",
  );
  await rawDormant.write(
    "examples/_quarto.yml",
    "project:\n  type: default\n  output-dir: _example\nformat: html\n",
  );
  await rawDormant.write("examples/demo.qmd", "# Independent closed source\n");
  await rejects(
    () =>
      rawDormant.api.prepareNavigationOwner(
        rawDormant.root,
        rawDormant.options,
      ),
    "RESOURCE.POLICY_DENIED",
  );
  const orphan = await fixture();
  await orphan.write("orphan.qmd", "# Uncovered owner source\n");
  await rejects(
    () => orphan.api.prepareNavigationOwner(orphan.root, orphan.options),
    "SOURCE.UNCOVERED_QMD",
  );
  const foreignInclude = await fixture(
    "# Portal\n\n{{< include book/index.qmd >}}\n",
  );
  await rejects(
    () =>
      foreignInclude.api.prepareNavigationOwner(
        foreignInclude.root,
        foreignInclude.options,
      ),
    "SOURCE.NAVIGATION_INCLUDE_BOUNDARY_INVALID",
  );
  const localInclude = await fixture(
    "# Portal\n\n{{< include _partials/navigation.qmd >}}\n",
  );
  await localInclude.write(
    "_partials/navigation.qmd",
    "## Shared navigation\n",
  );
  await localInclude.api.prepareNavigationOwner(
    localInclude.root,
    localInclude.options,
  );
  const dormantInclude = await fixture(
    "# Portal\n\n{{< include examples/index.qmd >}}\n",
  );
  await dormantInclude.write(
    "examples/_quarto.yml",
    "project:\n  type: default\n  output-dir: _example\nformat: html\n",
  );
  await dormantInclude.write(
    "examples/index.qmd",
    "## Independent plain navigation\n",
  );
  await rejects(
    () =>
      dormantInclude.api.prepareNavigationOwner(
        dormantInclude.root,
        dormantInclude.options,
      ),
    "SOURCE.NAVIGATION_INCLUDE_BOUNDARY_INVALID",
  );
  const foreignResource = await fixture();
  await foreignResource.write(
    "examples/_quarto.yml",
    "project:\n  type: default\n  output-dir: _example\nformat: html\n",
  );
  await foreignResource.write(
    "examples/index.qmd",
    "# Independent resource source\n",
  );
  const original = await Deno.readTextFile(
    join(foreignResource.root, "_quarto.yml"),
  );
  await foreignResource.write(
    "_quarto.yml",
    original.replace(
      "resources: [public.txt, '!book/**']",
      "resources: [public.txt, examples/index.qmd, '!book/**']",
    ),
  );
  foreignResource.portal
    .configHashes[join(foreignResource.root, "_quarto.yml")] = await hash(
      join(foreignResource.root, "_quarto.yml"),
    );
  const audit = await foreignResource.api.auditNavigation(
    foreignResource.root,
    "_extensions/course-core",
    "student",
    foreignResource.options,
  );
  assert(
    !audit.coverage["examples/index.qmd"] &&
      audit.navigation.dormant.some((x: any) => x.path === "examples"),
    "foreign resource edge promoted native project to root coverage",
  );
  await rejects(
    () =>
      foreignResource.api.prepareNavigationOwner(
        foreignResource.root,
        foreignResource.options,
      ),
    "RESOURCE.POLICY_DENIED",
  );
}
if (
  !Deno.args.includes("--scope-only") && !Deno.args.includes("--download-only")
) {
  const address = await fixture("# Portal\n\n[Child](book/index.html)\n");
  const addressOwner = await address.api.prepareNavigationOwner(
    address.root,
    address.options,
  );
  const addressMetadata = join(evidence, "address-metadata.json");
  await Deno.writeTextFile(
    addressMetadata,
    JSON.stringify(await address.api.activateNavigationOwner(addressOwner)),
  );
  const rootRender = await command(address.root, [
    "render",
    address.root,
    "--profile",
    "student,publish-portal",
    "--output-dir",
    address.portal.output,
    "--metadata-file",
    addressMetadata,
  ], { PROJECT_PUBLISH_MEMBER: "1" });
  assert(!rootRender.code, rootRender.text);
  const stage = join(evidence, "publication-stage");
  await Deno.mkdir(stage, { recursive: true });
  await rejects(
    () => address.api.finishNavigationOwner(addressOwner, { output: stage }),
    "SOURCE.NAVIGATION_ADDRESS_MISSING",
  );
  await rejects(
    () => address.api.validateOwnerResources(addressOwner),
    "RESOURCE.FINISH_REQUIRED",
  );
  const childRender = await command(join(address.root, "book"), [
    "render",
    ".",
    "--profile",
    "student",
    "--output-dir",
    join(stage, "book"),
  ]);
  assert(!childRender.code, childRender.text);
  assert(
    (await address.api.finishNavigationOwner(addressOwner, { output: stage }))
      .exitCode === 0,
    "native mounted address failed",
  );
  await address.api.validateOwnerResources(addressOwner);
  await Deno.writeTextFile(
    join(stage, "book/index.html"),
    "late address tamper",
  );
  await rejects(
    () => address.api.validateOwnerResources(addressOwner),
    "SOURCE.NAVIGATION_ADDRESS_CHANGED",
  );
}
if (Deno.args.includes("--download-only")) {
  const download = Deno.env.get("PROJECT_DOWNLOAD_REPO");
  assert(download, "PROJECT_DOWNLOAD_REPO required");
  const child = await fixture("# Portal\n\n[Child](book/index.html)\n");
  for (const provider of [repo, download]) {
    const added = await command(join(child.root, "book"), [
      "add",
      provider,
      "--no-prompt",
    ]);
    assert(!added.code, added.text);
  }
  await child.write(
    "book/_quarto.yml",
    `project:
  type: book
  output-dir: _book
  pre-render:
    - _extensions/course-core/entrypoints/pre.ts
    - _extensions/project-download/entrypoints/pre.ts
  post-render:
    - _extensions/course-core/entrypoints/post.ts
    - _extensions/project-download/entrypoints/post.ts
book:
  title: Child
  chapters: [index.qmd]
format: html
filters: [course-core, project-download]
course:
  id: child-download
project-download:
  resources:
    starter:
      path: starter
      profiles: [student, full]
`,
  );
  await child.write("book/_quarto-student.yml", "course:\n  view: student\n");
  await child.write(
    "book/index.qmd",
    "# Child\n\n{{< project-download starter >}}\n",
  );
  await child.write("book/starter/payload.txt", "CURRENT_NATIVE_DOWNLOAD\n");
  const handle = await child.api.prepareNavigationOwner(
      child.root,
      child.options,
    ),
    metadataFile = join(evidence, "download-metadata.json");
  await Deno.writeTextFile(
    metadataFile,
    JSON.stringify(await child.api.activateNavigationOwner(handle)),
  );
  const rootRender = await command(child.root, [
    "render",
    child.root,
    "--profile",
    "student,publish-portal",
    "--output-dir",
    child.portal.output,
    "--metadata-file",
    metadataFile,
  ], { PROJECT_PUBLISH_MEMBER: "1" });
  assert(!rootRender.code, rootRender.text);
  const stage = join(evidence, "download-stage"),
    native = await command(join(child.root, "book"), [
      "render",
      ".",
      "--profile",
      "student",
      "--output-dir",
      join(stage, "book"),
    ]);
  assert(!native.code, native.text);
  await child.write("book/starter/payload.txt", "TAMPERED_CHILD_SOURCE\n");
  await rejects(
    () => child.api.finishNavigationOwner(handle, { output: stage }),
    "SOURCE.FROZEN_INPUT_CHANGED",
  );
  await child.write("book/starter/payload.txt", "CURRENT_NATIVE_DOWNLOAD\n");
  assert(
    (await child.api.finishNavigationOwner(handle, { output: stage }))
      .exitCode === 0,
    "current child Download state broke navigation freeze",
  );
  const index = await child.api.validateOwnerResources(handle);
  assert(
    index.files.some((x: any) =>
      x.path.startsWith("book/_generated/project-download/requests/") &&
      x.origin === "service"
    ),
    "current native Download producer receipt absent",
  );
}
console.log(
  `PASS native navigation owner: frozen descriptor/child/current resource, canonical/computed refusal; evidence ${evidence}`,
);
