// Real installed native owner/Nav + HTML/PDF + public QRC completion.
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const quarto = Deno.env.get("QUARTO") || "quarto";
const output = Deno.env.get("OWNER_PUBLICATION_TEST_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "owner-publication-addresses-" });
const selected = Deno.args[0] || "all";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function exists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}
assert(
  [
    "all",
    "no-context",
    "positive",
    "transport",
    "base-red",
    "late",
    "late-rest",
    "flags",
    "late-extra",
    "negative",
    "capture-red",
    "capture-positive",
    "book-writer",
  ].includes(selected),
  "unknown focused test mode",
);
const nativeVersion = await new Deno.Command(quarto, {
  args: ["--version"],
  stdout: "piped",
  stderr: "piped",
}).output();
assert(nativeVersion.success, "actual Quarto version query failed");
const quartoVersion = new TextDecoder().decode(nativeVersion.stdout).trim();
assert(/^\d+\.\d+\.\d+/.test(quartoVersion), "invalid actual Quarto version");
console.log(`actual Quarto ${quartoVersion}`);
let nativeCommandSequence = 0;
async function command(root: string, args: string[]) {
  const r = await new Deno.Command(quarto, {
    cwd: root,
    args,
    env: { PROJECT_PUBLISH_MEMBER: "1" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const text = new TextDecoder().decode(r.stdout) +
    new TextDecoder().decode(r.stderr);
  await Deno.mkdir(output, { recursive: true });
  await Deno.writeTextFile(
    join(output, `native-command-${nativeCommandSequence++}.log`),
    text,
  );
  assert(r.success, text);
  console.log(`native zero ${JSON.stringify({ root, args })}`);
}
async function rejects(run: () => Promise<unknown>, code: string | string[]) {
  try {
    await run();
  } catch (e) {
    const codes = Array.isArray(code) ? code : [code];
    assert(codes.some((c) => String(e).includes(c)), `expected ${codes}: ${e}`);
    return String(e);
  }
  throw new Error(`accepted ${code}`);
}
let sequence = 0;
async function fixture(
  options: {
    mount?: string;
    writer?: string;
    link?: string;
    nested?: boolean;
    resources?: string;
    fullTitle?: string;
    fullOutput?: string;
    book?: boolean;
    profile?: "student" | "full";
  } = {},
) {
  const root = join(output, `case-${sequence++}`), book = join(root, "book");
  for (const dir of [root, book, join(root, "handouts")]) {
    await Deno.mkdir(dir, { recursive: true });
    await command(dir, [
      "create-project",
      dir,
      "--type",
      "default",
      "--no-scaffold",
      "--engine",
      "markdown",
    ]);
  }
  await command(root, ["add", repo, "--no-prompt"]);
  await command(book, ["add", repo, "--no-prompt"]);
  const qrcRepo = Deno.env.get("REFERENCE_CATALOG_REPO");
  if (qrcRepo) await command(root, ["add", qrcRepo, "--no-prompt"]);
  async function write(path: string, text: string) {
    await Deno.mkdir(dirname(join(root, path)), { recursive: true });
    await Deno.writeTextFile(join(root, path), text);
  }
  const profile = options.profile || "student";
  const mount = options.mount || "book",
    writer = options.writer || "index.html";
  await write(
    "_quarto.yml",
    "project:\n  type: website\n  output-dir: .project-publish/native\n  render: []\n  resources: []\n  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts\nformat:\n  html:\n    theme: none\nfilters: [course-core]\ncourse:\n  id: address-root\nreference-catalog:\n  namespace: site\n",
  );
  await write("_quarto-student.yml", "course:\n  view: student\n");
  if (profile === "full") {
    await write("_quarto-full.yml", "course:\n  view: full\n");
  }
  await write(
    "_quarto-publish-portal.yml",
    JSON.stringify({ project: { render: ["index.qmd"] } }),
  );
  await write(
    "index.qmd",
    options.nested
      ? "# Portal {#sec-portal}\n"
      : `# Portal {#sec-portal}\n\n[Book](${mount}/${writer})\n`,
  );
  const source = options.nested ? "topics/index.qmd" : "index.qmd";
  await write(
    "book/_quarto.yml",
    `project:\n  type: ${
      options.book ? "book" : "default"
    }\n  output-dir: _output\n${
      options.book ? "" : `  render: [${source}]\n`
    }  resources: [${
      options.resources || "assets/contract.svg"
    }]\n  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts\n${
      options.book ? "book:\n  chapters: [index.qmd, chapter.qmd]\n" : ""
    }format:\n  html:\n    theme: none\n${
      options.book ? "" : `    output-file: ${writer}\n`
    }filters: [course-core]\ncourse:\n  id: address-book\n`,
  );
  if (options.book) {
    await write(
      "book/chapter.qmd",
      "# Additional chapter {#sec-extra}\n\nPublic book chapter.\n",
    );
  }
  await write("book/_quarto-student.yml", "course:\n  view: student\n");
  await write(
    "book/_quarto-full.yml",
    "course:\n  view: full\n" +
      (options.fullTitle ? `title: ${options.fullTitle}\n` : "") +
      (options.fullOutput
        ? `project:\n  output-dir: ${options.fullOutput}\n`
        : ""),
  );
  await write(
    `book/${source}`,
    `# Book {#sec-book}\n\n${
      options.link ||
      `[Contract PDF](${
        options.nested ? "../../" : "../"
      }handouts/contracts.pdf)`
    }\n\n![Public contract](${
      options.nested ? "../" : ""
    }assets/contract.svg)\n`,
  );
  await write(
    "book/assets/contract.svg",
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="blue"/></svg>\n',
  );
  await write(
    "handouts/_quarto.yml",
    "project:\n  type: default\n  output-dir: _output\n  render: [sheet.qmd]\nformat:\n  pdf:\n    output-file: contracts.pdf\n    pdf-engine: xelatex\n    documentclass: article\n",
  );
  await write("handouts/_quarto-student.yml", "metadata: {}\n");
  if (profile === "full") {
    await write("handouts/_quarto-full.yml", "metadata: {}\n");
  }
  await write(
    "handouts/sheet.qmd",
    "# Contract handout\n\nThis is a real native PDF.\n",
  );
  const api = await import(
    `file://${root}/_extensions/course-core/owner-preflight/owner.ts`
  );
  const nav = await import(
    `file://${root}/_extensions/course-core/owner-preflight/navigation.ts`
  );
  const publication = await import(
    `file://${root}/_extensions/course-core/owner-preflight/publication-resources.ts`
  );
  const config = [
    "_quarto.yml",
    `_quarto-${profile}.yml`,
    "_quarto-publish-portal.yml",
  ];
  async function providerFiles(base: string): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    async function walk(dir: string) {
      for await (const entry of Deno.readDir(dir)) {
        const path = join(dir, entry.name);
        assert(!entry.isSymlink, "installed provider symlink");
        if (entry.isDirectory) await walk(path);
        else if (entry.isFile) {
          files[path.slice(base.length + 1)] = await api.digestFile(path);
        }
      }
    }
    await walk(base);
    return Object.fromEntries(
      Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
    );
  }
  const sourceFiles = await providerFiles(
    join(repo, "_extensions/course-core"),
  );
  const installedFiles = await providerFiles(
    join(root, "_extensions/course-core"),
  );
  const childFiles = await providerFiles(join(book, "_extensions/course-core"));
  assert(
    JSON.stringify(sourceFiles) === JSON.stringify(installedFiles) &&
      JSON.stringify(sourceFiles) === JSON.stringify(childFiles),
    "installed Core bytes differ from candidate",
  );
  await Deno.writeTextFile(
    root + "-installed-core.json",
    JSON.stringify({ sourceFiles, installedFiles, childFiles }),
  );
  const portal = {
    input: join(root, "index.qmd"),
    output: root + "-native-portal",
    renderProfiles: [profile, "publish-portal"],
    control: join(root, "_quarto-publish-portal.yml"),
    controlHash: await api.digestFile(join(root, "_quarto-publish-portal.yml")),
    configHashes: Object.fromEntries(
      await Promise.all(
        config.map(
          async (p) => [join(root, p), await api.digestFile(join(root, p))],
        ),
      ),
    ),
  };
  const members = [
    { path: book, mount, format: "html", output: root + "-native-book" },
    {
      path: join(root, "handouts"),
      mount: "handouts",
      format: "pdf",
      output: root + "-native-handouts",
    },
  ];
  const navigation = await nav.prepareNavigationOwner(root, {
    attemptId: "current-address-attempt",
    profile,
    portal,
    members: members.map(({ path, mount, format }) => ({
      path,
      mount,
      format,
    })),
  });
  assert(
    !await exists(join(root, ".course-owner/active.json")),
    "parent preparation left actual invocation",
  );
  const childApi = await import(
    `file://${book}/_extensions/course-core/owner-preflight/owner.ts`
  );
  const prepare = (context = true) =>
    childApi.prepareOwner(book, {
      attemptId: "current-address-attempt",
      profile,
      ...(context ? { publicationAddresses: { navigation } } : {}),
    });
  return {
    root,
    profile,
    book,
    source,
    api,
    nav,
    publication,
    navigation,
    portal,
    members,
    prepare,
    childApi,
    write,
  };
}
async function mutation(
  path: string,
  bytes: Uint8Array | string,
  run: () => Promise<unknown>,
  code: string | string[],
) {
  const before = await Deno.readFile(path);
  try {
    await Deno.writeFile(
      path,
      typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes,
    );
    await rejects(run, code);
  } finally {
    await Deno.writeFile(path, before);
  }
}
async function jsonMutation(
  path: string,
  change: (value: any) => void,
  run: () => Promise<unknown>,
  code: string | string[],
) {
  const value = JSON.parse(await Deno.readTextFile(path));
  change(value);
  await mutation(path, JSON.stringify(value), run, code);
}
async function flagGuards(f: any, child: any, stage: string) {
  for (
    const options of [
      { output: stage, members: f.members, checked: true },
      {
        output: stage,
        members: f.members.map((m: any, index: number) =>
          index ? m : { ...m, checked: true }
        ),
      },
    ]
  ) {
    await rejects(
      () => f.childApi.finishOwner(child, { publicationAddresses: options }),
      "SOURCE.PUBLICATION_ADDRESS_FINISH_INVALID",
    );
  }
  console.log(
    "PASS arbitrary context/member checked flags carry no publication address authority",
  );
}
async function extraCurrentGuards(f: any, child: any, stage: string) {
  const current = () => f.childApi.validateOwnerResources(child);
  const parentReceipt = join(
    f.root,
    ".course-owner",
    `result-${await f.api.sha(child.profile + ":index.qmd")}.json`,
  );
  const bytes = await Deno.readFile(parentReceipt);
  try {
    await Deno.remove(parentReceipt);
    await rejects(current, "SOURCE.RECONCILIATION_MISSING");
  } finally {
    await Deno.writeFile(parentReceipt, bytes);
  }
  await mutation(
    join(f.members[0].output, "index.html"),
    "changed own native writer",
    current,
    "SOURCE.PUBLICATION_ADDRESS_CHANGED",
  );
  await jsonMutation(
    join(f.root, ".course-owner/active.json"),
    (value) => {
      value.profile = child.profile === "student" ? "full" : "student";
    },
    current,
    "SOURCE.INVALID_ATTEMPT",
  );
  const proof = JSON.parse(
    await Deno.readTextFile(
      join(f.book, ".course-owner/publication-addresses.json"),
    ),
  );
  const alias = join(stage, "copied-owner-proof.bin");
  assert(!await exists(alias), "alias fixture path already exists");
  try {
    await Deno.copyFile(
      join(f.book, ".course-owner/publication-addresses.json"),
      alias,
    );
    await rejects(
      () =>
        f.publication.sealNavigationPublicationResources(
          proof.parent.prepared,
          {
            output: stage,
            members: f.members.map((m: any) => ({
              ...m,
              ...(m.path === f.book ? { owner: child } : {}),
            })),
          },
        ),
      "RESOURCE.PUBLICATION_DENIED_BYTES",
    );
  } finally {
    if (await exists(alias)) await Deno.remove(alias);
  }
  await current();
  console.log(
    "PASS missing complete root receipt and renamed proof publication denial; no engines",
  );
}
async function lateRestGuards(f: any, child: any, stage: string) {
  const current = () => f.childApi.validateOwnerResources(child);
  const nativePdf = join(f.members[1].output, "contracts.pdf");
  const nativeBytes = await Deno.readFile(nativePdf);
  // Exact actual Core model producer protocol, already present in the current index.
  const generated = join(
    f.book,
    "_generated/course-spec/core",
    await f.childApi.sha(f.source) + ".json",
  );
  await mutation(
    generated,
    nativeBytes,
    current,
    "SOURCE.PUBLICATION_ADDRESS_DENIED_BYTES",
  );
  const parentActive = JSON.parse(
    await Deno.readTextFile(join(f.root, ".course-owner/active.json")),
  );
  await mutation(
    join(f.root, ".course-owner", `guard-${parentActive.invocationId}.json`),
    "{}",
    current,
    "SOURCE.INVALID_ATTEMPT",
  );
  await current();
  console.log(
    "PASS current actual model-service denied-byte veto and exact parent guard, restored without engines",
  );
}
async function lateGuards(f: any, child: any, stage: string) {
  const current = () => f.childApi.validateOwnerResources(child);
  await rejects(
    () =>
      f.childApi.validateOwnerResources({
        ...child,
        sessionHash: "0".repeat(64),
      }),
    "SOURCE.INVALID_ATTEMPT",
  );
  await rejects(
    () => f.childApi.validateOwnerResources({ ...child, profile: "full" }),
    "SOURCE.INVALID_ATTEMPT",
  );
  const parentActive = JSON.parse(
    await Deno.readTextFile(join(f.root, ".course-owner/active.json")),
  );
  const parentReceipt = join(
    f.root,
    ".course-owner",
    `result-${await f.api.sha("student:index.qmd")}.json`,
  );
  const childReceipt = join(
    f.book,
    ".course-owner",
    `result-${await f.childApi.sha("student:" + f.source)}.json`,
  );
  const actual = join(
    f.book,
    ".course-owner/render/student",
    await f.childApi.sha(f.source) + ".json",
  );
  const seal = join(
    f.book,
    ".course-owner",
    `resource-seal-${await f.childApi.sha("student:" + f.source)}.json`,
  );
  const proof = join(f.book, ".course-owner/publication-addresses.json");
  await jsonMutation(
    parentReceipt,
    (v) => {
      v.invocationId = crypto.randomUUID();
    },
    current,
    "SOURCE.INVALID_ATTEMPT",
  );
  await jsonMutation(
    childReceipt,
    (v) => {
      v.status = "failure";
    },
    current,
    "SOURCE.INVALID_ATTEMPT",
  );
  await jsonMutation(
    actual,
    (v) => {
      v.resources.raw[0].target = "../handouts/other.pdf";
    },
    current,
    "SOURCE.INVALID_ATTEMPT",
  );
  await jsonMutation(
    seal,
    (v) => {
      v.publicationAddresses[0].address.target = "handouts/other.pdf";
    },
    current,
    "SOURCE.INVALID_ATTEMPT",
  );
  await jsonMutation(
    proof,
    (v) => {
      v.options.members[0].mount = "courses/book";
    },
    current,
    "SOURCE.PUBLICATION_ADDRESS_CHANGED",
  );
  await mutation(join(f.root, "index.qmd"), "# Changed portal\n", current, [
    "SOURCE.FROZEN_INPUT_CHANGED",
    "SOURCE.CONFIGURATION_CHANGED",
  ]);
  await mutation(
    join(f.root, "_quarto-publish-portal.yml"),
    '{"project":{"render":[]}}',
    current,
    [
      "SOURCE.NAVIGATION_DESCRIPTOR_INVALID",
      "SOURCE.NAVIGATION_SELECTION_MISMATCH",
    ],
  );
  await mutation(
    join(f.book, f.source),
    "# Changed book {#sec-book}\n",
    current,
    ["SOURCE.FROZEN_INPUT_CHANGED", "SOURCE.CONFIGURATION_CHANGED"],
  );
  await mutation(
    join(f.book, "_extensions/course-core/filter.lua"),
    "-- changed Core module\n",
    current,
    ["SOURCE.FROZEN_INPUT_CHANGED", "SOURCE.CONFIGURATION_CHANGED"],
  );
  const nativePdf = join(f.members[1].output, "contracts.pdf"),
    stagePdf = join(stage, "handouts/contracts.pdf");
  await mutation(
    nativePdf,
    "changed native PDF",
    current,
    "SOURCE.PUBLICATION_ADDRESS_CHANGED",
  );
  await mutation(
    stagePdf,
    "changed mounted PDF",
    current,
    "SOURCE.PUBLICATION_ADDRESS_CHANGED",
  );
  await mutation(
    join(stage, "book/index.html"),
    "changed mounted native writer",
    current,
    "SOURCE.PUBLICATION_ADDRESS_CHANGED",
  );
  const nativeBytes = await Deno.readFile(nativePdf),
    stageBytes = await Deno.readFile(stagePdf);
  const deniedBytes = await Deno.readFile(proof);
  try {
    await Deno.writeFile(nativePdf, deniedBytes);
    await Deno.writeFile(stagePdf, deniedBytes);
    await rejects(current, "SOURCE.PUBLICATION_ADDRESS_DENIED_BYTES");
  } finally {
    await Deno.writeFile(nativePdf, nativeBytes);
    await Deno.writeFile(stagePdf, stageBytes);
  }
  // Recognized current producer data newly matching a witness must revoke an older proof.
  await lateRestGuards(f, child, stage);
  console.log(
    "PASS current handle/profile/root receipts, actual target/seal/proof, source/control/module/native/stage/writer, current denied bytes and renamed proof guards; restored without engines",
  );
}
console.log(`Owner publication evidence: ${output}`);
if (selected === "all" || selected === "no-context") {
  const f = await fixture();
  await rejects(() => f.prepare(false), "RESOURCE.OUTSIDE_OWNER");
  console.log("PASS original no-context outside-owner refusal");
}
if (
  selected === "all" || selected === "positive" || selected === "transport" ||
  selected === "base-red" || selected === "capture-red" ||
  selected === "capture-positive" || selected === "book-writer"
) {
  const bookWriterMode = selected === "book-writer";
  const transportMode = selected === "transport" || bookWriterMode;
  const bookProfile = Deno.args[1] || "student";
  assert(
    !bookWriterMode || ["student", "full"].includes(bookProfile),
    "unknown book writer profile",
  );
  const captureMode = selected === "capture-red" ||
    selected === "capture-positive";
  const f = await fixture(
    captureMode
      ? {
        fullTitle: "Private full capture projection",
        ...(selected === "capture-positive"
          ? { fullOutput: "_book/full" }
          : {}),
      }
      : bookWriterMode
      ? { book: true, profile: bookProfile as "student" | "full" }
      : {},
  );
  // On frozen base this fails with real RESOURCE.OUTSIDE_OWNER, not missing API.
  const child = await f.prepare();
  if (selected === "capture-positive") {
    assert(
      !await exists(join(f.book, "_book/full")) &&
        !await exists(join(f.book, "_output")),
      "native captures changed author-declared alternate output directories",
    );
  }
  assert(
    !await exists(join(f.root, ".course-owner/active.json")),
    "child prepare required parent actual activation",
  );
  if (selected === "base-red") {
    throw new Error("BASE_FEATURE_UNEXPECTEDLY_SUPPORTED");
  }
  await rejects(
    () => f.childApi.finishOwner(child),
    "SOURCE.PUBLICATION_ADDRESS_FINISH_REQUIRED",
  );
  assert(
    !await exists(join(f.book, ".course-owner/finished.json")),
    "bare child finish wrote a complete marker",
  );
  const metadata = f.root + "-metadata.json";
  await Deno.writeTextFile(
    metadata,
    JSON.stringify(await f.nav.activateNavigationOwner(f.navigation)),
  );
  await command(f.root, [
    "render",
    ".",
    "--profile",
    f.portal.renderProfiles.join(","),
    "--to",
    "html",
    "--output-dir",
    f.portal.output,
    "--metadata-file",
    metadata,
  ]);
  const childMetadata = f.root + "-child-metadata.json";
  await Deno.writeTextFile(
    childMetadata,
    JSON.stringify(
      await f.childApi.activateOwner(child, { output: f.members[0].output }),
    ),
  );
  await command(f.book, [
    "render",
    ".",
    "--profile",
    f.profile,
    "--to",
    "html",
    "--output-dir",
    f.members[0].output,
    "--metadata-file",
    childMetadata,
  ]);
  await command(f.members[1].path, [
    "render",
    ".",
    "--profile",
    f.profile,
    "--to",
    "pdf",
    "--output-dir",
    f.members[1].output,
  ]);
  const stage = f.root + "-stage";
  async function copy(src: string, dst: string) {
    await Deno.mkdir(dst, { recursive: true });
    for await (const entry of Deno.readDir(src)) {
      const a = join(src, entry.name), b = join(dst, entry.name);
      if (entry.isDirectory) await copy(a, b);
      else if (entry.isFile) await Deno.copyFile(a, b);
      else throw new Error("symlink");
    }
  }
  await copy(f.portal.output, stage);
  for (const member of f.members) {
    await copy(member.output, join(stage, member.mount));
  }
  if (bookWriterMode) {
    const current = await f.childApi.readOwnerInvocationEvidence(child);
    assert(current.reports.length === 2, "native book must render both inputs");
    const observation = JSON.parse(
      await Deno.readTextFile(join(
        f.book,
        ".course-owner/render",
        f.profile,
        await f.childApi.sha("index.qmd") + ".json",
      )),
    ).resources;
    const { resolve } = await import("stdlib/path");
    assert(
      resolve(f.book, observation.outputDirectory) ===
          current.invocation.output &&
        resolve(f.book, observation.outputFile) ===
          resolve(current.invocation.output, "index.html"),
      "native book writer must identify the actual output file",
    );
    for (
      const [member, file] of [[f.members[0], "index.html"], [
        f.members[0],
        "chapter.html",
      ], [f.members[1], "contracts.pdf"]] as const
    ) {
      assert(
        await f.api.digestFile(join(member.output, file)) ===
          await f.api.digestFile(join(stage, member.mount, file)),
        "native/staged book/PDF bytes differ",
      );
    }
  }
  const qrcRepo = Deno.env.get("REFERENCE_CATALOG_REPO");
  assert(
    qrcRepo,
    "REFERENCE_CATALOG_REPO must be the pinned public QRC provider",
  );
  const qrc = await import(
    `file://${f.root}/_extensions/reference-catalog/entrypoints/publication.ts`
  );
  await qrc.default.finalize({
    root: f.root,
    stage,
    quarto: quartoVersion,
    config: { "reference-catalog": { namespace: "site" } },
    members: f.members.map((m) => ({ namespace: m.mount, format: m.format })),
    portal: f.portal,
  });
  const oldSnapshots = [];
  for (const profile of ["student", "full"]) {
    const old = f.root + `-previous-${profile}`;
    await copy(stage, old);
    oldSnapshots.push({
      path: join(old, "book/index.html"),
      sha256: await f.api.digestFile(join(old, "book/index.html")),
    });
    oldSnapshots.push({
      path: join(old, "handouts/contracts.pdf"),
      sha256: await f.api.digestFile(join(old, "handouts/contracts.pdf")),
    });
  }
  const finishContext = {
    publicationAddresses: { output: stage, members: f.members },
  };
  if (!transportMode && !captureMode) {
    for (
      const bad of [
        { output: stage, members: f.members.slice(0, 1) },
        { output: stage, members: [...f.members, f.members[0]] },
        {
          output: stage,
          members: f.members.map((m, i) => i ? m : { ...m, checked: true }),
        },
        {
          output: stage,
          members: f.members.map((m, i) =>
            i ? m : { ...m, mount: "courses/book" }
          ),
        },
        {
          output: stage,
          members: f.members.map((m, i) => i ? m : { ...m, format: "pdf" }),
        },
        {
          output: stage,
          members: f.members.map((m, i) => i ? m : { ...m, output: stage }),
        },
      ]
    ) {
      await rejects(
        () => f.childApi.finishOwner(child, { publicationAddresses: bad }),
        "SOURCE.PUBLICATION_ADDRESS_FINISH_INVALID",
      );
    }
    await rejects(
      () =>
        f.childApi.finishOwner(
          { ...child, attemptId: "another-attempt" },
          finishContext,
        ),
      "SOURCE.INVALID_ATTEMPT",
    );
    await rejects(
      () => f.childApi.finishOwner(child),
      "SOURCE.PUBLICATION_ADDRESS_FINISH_REQUIRED",
    );
    const parentGuard = JSON.parse(
      await Deno.readTextFile(join(f.root, ".course-owner/active.json")),
    );
    await mutation(
      join(f.root, ".course-owner", `guard-${parentGuard.invocationId}.json`),
      "{}",
      () => f.childApi.finishOwner(child, finishContext),
      "SOURCE.INVALID_ATTEMPT",
    );
    assert(
      !await exists(join(f.book, ".course-owner/publication-addresses.json")) &&
        !await exists(join(f.book, ".course-owner/resources.json")) &&
        !await exists(join(f.book, ".course-owner/finished.json")),
      "negative completion exposed a partial complete index/proof",
    );
  }
  assert(
    (await f.childApi.finishOwner(child, finishContext)).exitCode === 0,
    "child address completion failed",
  );
  assert(
    !await exists(join(f.root, ".course-owner/finished.json")),
    "child finish required/finished parent",
  );
  const index = await f.childApi.validateOwnerResources(child);
  assert(
    index.files.some((file: any) =>
      file.path === "assets/contract.svg" &&
      index.policy.files.some((policy: any) =>
        policy.path === file.path && policy.allowed
      )
    ),
    "own public SVG current owner grant missing",
  );
  assert(
    !index.files.some((file: any) =>
      file.path.includes("handouts/contracts.pdf")
    ),
    "address became foreign owner resource grant",
  );
  assert(
    (await f.nav.finishNavigationOwner(f.navigation, { output: stage }))
      .exitCode === 0,
    "parent finish after child failed",
  );
  const parentIndex = await f.nav.validateOwnerResources(f.navigation);
  const childProofSha = await f.childApi.digestFile(
    join(f.book, ".course-owner/publication-addresses.json"),
  );
  assert(
    parentIndex.files.some((file: any) =>
      file.path === "book/.course-owner/publication-addresses.json" &&
      file.origin === "service" && file.sha256 === childProofSha
    ) &&
      parentIndex.policy.files.some((file: any) =>
        file.path === "book/.course-owner/publication-addresses.json" &&
        !file.allowed
      ),
    "root canonical child proof service missing or allowed",
  );
  const publicationOptions = {
    output: stage,
    members: f.members.map((m) => ({
      ...m,
      ...(m.path === f.book ? { owner: child } : {}),
    })),
  };
  if (captureMode) {
    let record: any;
    if (selected === "capture-positive") {
      const session = await f.childApi.preparedSession(child);
      const p = session.captureProjections[`full:${f.source}:ordinary`];
      assert(p, "real retained full ordinary projection missing");
      record = {
        projection: { archive: p.retainedPath, sha256: p.sha256 },
        nativeFacts: p.native,
        source: p.source,
        profile: p.profile,
        invocationId: p.invocationId,
      };
      for (
        const projection of Object.values(session.captureProjections) as any[]
      ) {
        const childPath = projection.retainedPath.slice(f.book.length + 1);
        for (
          const [prefix, certificate] of [["", index], [
            "book/",
            parentIndex,
          ]] as const
        ) {
          const path = prefix + childPath;
          assert(
            certificate.files.some((file: any) =>
              file.path === path && file.origin === "service" &&
              file.sha256 === projection.sha256 &&
              JSON.stringify(file.captureProjection) ===
                JSON.stringify(projection)
            ),
            "canonical child/parent capture projection service missing: " +
              path,
          );
          assert(
            certificate.policy.files.some((file: any) =>
              file.path === path && !file.allowed
            ),
            "capture projection became owner resource allowed: " + path,
          );
        }
      }
    } else {
      const archive = Deno.env.get("OWNER_CAPTURE_RECORDINGS");
      assert(archive, "real native capture recordings directory required");
      const rows = [];
      for await (const entry of Deno.readDir(archive)) {
        if (entry.isFile && entry.name.endsWith(".json")) {
          rows.push(
            JSON.parse(await Deno.readTextFile(join(archive, entry.name))),
          );
        }
      }
      record = rows.find((r) =>
        r.root === f.book && r.profile === "full" && !r.identity &&
        r.phase === "capture" && r.source === f.source && r.exitCode === 0
      );
      assert(
        record?.projection?.archive,
        "real full ordinary writer projection missing",
      );
    }
    const bytes = await Deno.readFile(record.projection.archive);
    const captureSha = await f.api.digestFile(record.projection.archive);
    assert(
      captureSha === record.projection.sha256,
      "recorded projection bytes changed",
    );
    assert(
      captureSha !==
        await f.api.digestFile(join(f.members[0].output, "index.html")),
      "full projection must differ from the actual selected public writer",
    );
    const raw = join(stage, "book/_output/index.html");
    const renamed = join(stage, "unexpected/private-copy.html");
    await Deno.mkdir(dirname(raw), { recursive: true });
    await Deno.mkdir(dirname(renamed), { recursive: true });
    await Deno.writeFile(raw, bytes);
    await Deno.writeFile(renamed, bytes);
    let accepted = false;
    let failure = "";
    try {
      await f.publication.sealNavigationPublicationResources(
        f.navigation,
        publicationOptions,
      );
      accepted = true;
    } catch (e) {
      failure = String(e);
    }
    await Deno.writeTextFile(
      f.root + "-capture-closure.json",
      JSON.stringify({
        schema: "native-capture-projection-first-seal-v1",
        root: f.root,
        book: f.book,
        child,
        stage,
        record,
        captureSha,
        raw,
        renamed,
        beforeFirstSeal: true,
        accepted,
        failure,
      }),
    );
    assert(
      !accepted,
      "CAPTURE_PROJECTION_DELIVERY_UNEXPECTEDLY_ACCEPTED: raw and renamed full capture bytes passed the first publication seal",
    );
    assert(failure.includes("RESOURCE.PUBLICATION_DENIED_BYTES"), failure);
    await Deno.remove(raw);
    await rejects(
      () =>
        f.publication.sealNavigationPublicationResources(
          f.navigation,
          publicationOptions,
        ),
      "RESOURCE.PUBLICATION_DENIED_BYTES",
    );
    await Deno.remove(renamed);
    // These are additional finite aliases, never native artifact/runtime witnesses.
    for (
      const alias of [
        "handouts/private-copy.html",
        "book/site_libs/private-copy.js",
      ]
    ) {
      const target = join(stage, alias);
      await Deno.mkdir(dirname(target), { recursive: true });
      await Deno.writeFile(target, bytes);
      try {
        await rejects(
          () =>
            f.publication.sealNavigationPublicationResources(
              f.navigation,
              publicationOptions,
            ),
          "RESOURCE.PUBLICATION_DENIED_BYTES",
        );
      } finally {
        await Deno.remove(target);
      }
    }
    console.log(
      "PASS raw and renamed full projection denial before first seal",
    );
  }
  await f.publication.sealNavigationPublicationResources(
    f.navigation,
    publicationOptions,
  );
  await f.publication.validateNavigationPublicationResources(f.navigation);
  await Deno.writeTextFile(
    f.root + "-fixture.json",
    JSON.stringify({
      root: f.root,
      book: f.book,
      source: f.source,
      members: f.members,
      child,
      stage,
    }),
  );
  if (!transportMode && !captureMode) {
    await lateGuards(f, child, stage);
  }
  if (!captureMode) await extraCurrentGuards(f, child, stage);
  if (bookWriterMode) {
    const current = () => f.childApi.validateOwnerResources(child);
    await mutation(
      join(stage, "handouts/contracts.pdf"),
      "changed mounted book PDF target",
      current,
      "SOURCE.PUBLICATION_ADDRESS_CHANGED",
    );
    await current();
    console.log(
      `PASS multi-input book actual writer/${f.profile}, native/staged hashes and restored current refusals`,
    );
  }
  if (!transportMode && !captureMode) {
    await flagGuards(f, child, stage);
  }
  for (const snapshot of oldSnapshots) {
    assert(
      await f.api.digestFile(snapshot.path) === snapshot.sha256,
      "prior output changed on denial",
    );
  }
  console.log(
    "PASS previous populated student/full native HTML/PDF artifacts preserved across all denials",
  );
  console.log(
    `PASS actual native HTML/PDF + QRC, own SVG index, child-before-parent finish: ${f.root}`,
  );
}
if (
  selected === "late" || selected === "late-rest" || selected === "flags" ||
  selected === "late-extra"
) {
  const path = Deno.env.get("OWNER_PUBLICATION_LATE_FIXTURE");
  assert(
    path,
    "OWNER_PUBLICATION_LATE_FIXTURE must identify an already successful sealed attempt",
  );
  const f = JSON.parse(await Deno.readTextFile(path));
  f.api = await import(
    `file://${f.root}/_extensions/course-core/owner-preflight/owner.ts`
  );
  f.childApi = await import(
    `file://${f.book}/_extensions/course-core/owner-preflight/owner.ts`
  );
  f.publication = await import(
    `file://${f.root}/_extensions/course-core/owner-preflight/publication-resources.ts`
  );
  if (selected === "late") await lateGuards(f, f.child, f.stage);
  if (selected === "late-rest") await lateRestGuards(f, f.child, f.stage);
  if (selected === "flags") await flagGuards(f, f.child, f.stage);
  else await extraCurrentGuards(f, f.child, f.stage);
}
if (selected === "all" || selected === "negative") {
  const cases: [Parameters<typeof fixture>[0], string | string[]][] = [
    [{ mount: "courses/book" }, "SOURCE.PUBLICATION_ADDRESS_WRITER_MISMATCH"],
    [
      { writer: "pages/start.html" },
      ["SOURCE.PUBLICATION_ADDRESS_WRITER_MISMATCH", "SOURCE.CAPTURE_FAILED"],
    ],
    [{ nested: true }, "SOURCE.PUBLICATION_ADDRESS_WRITER_UNSUPPORTED"],
    [
      { link: "![Foreign PDF](../handouts/contracts.pdf)" },
      "RESOURCE.OUTSIDE_OWNER",
    ],
    [
      { link: "[Foreign source](../handouts/sheet.qmd)" },
      "RESOURCE.OUTSIDE_OWNER",
    ],
    [
      { link: '<a href="../handouts/contracts.pdf">Opaque PDF</a>' },
      "RESOURCE.OPAQUE_CARRIER_UNSUPPORTED",
    ],
    [
      { resources: "assets/contract.svg, ../handouts/sheet.qmd" },
      "SOURCE.OUTSIDE_OWNER",
    ],
  ];
  const from = selected === "negative"
    ? Number(Deno.args.find((arg) => arg.startsWith("--from="))?.slice(7) || 0)
    : 0;
  assert(
    Number.isInteger(from) && from >= 0 && from < cases.length,
    "invalid focused case selector",
  );
  for (const [index, [options, code]] of cases.entries()) {
    if (index < from) continue;
    const f = await fixture(options);
    const failure = await rejects(() => f.prepare(), code);
    if (
      options?.writer === "pages/start.html" &&
      failure.includes("SOURCE.CAPTURE_FAILED")
    ) {
      assert(
        failure.includes("paths are not allowed"),
        "moved writer failed for an unrelated native reason",
      );
    }
    assert(
      !await exists(join(f.book, ".course-owner/render-invocation.json")),
      "negative triggered actual engine/render",
    );
    console.log(
      `PASS bounded early refusal ${code}: ${JSON.stringify(options)}`,
    );
  }
}
