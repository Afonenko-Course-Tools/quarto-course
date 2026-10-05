// Real installed native owner/Nav + HTML/PDF + public QRC completion.
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const quarto = Deno.env.get("QUARTO") || "quarto";
const output = Deno.env.get("OWNER_PUBLICATION_TEST_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "owner-publication-addresses-" });
const selected = Deno.args[0] || "all";
const bodyMode = selected === "body";
const bodySources = [
  "tasks/corpus.qmd",
  "tasks/work-one.qmd",
  "tasks/work-two.qmd",
];
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
    "body",
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
    "writer-convention",
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
let bodyArchive: string | undefined;
if (bodyMode) {
  await Deno.mkdir(output, { recursive: true });
  bodyArchive = join(output, "quarto-course-candidate.tar.gz");
  const packed = await new Deno.Command("tar", {
    cwd: repo,
    args: [
      "-czf",
      bodyArchive,
      "--transform=s,^,quarto-course/,",
      "_extensions",
      "README.md",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(packed.success, new TextDecoder().decode(packed.stderr));
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
    projectType?: "default" | "book" | "website";
    profile?: "student" | "full";
  } = {},
) {
  const root = join(output, `case-${sequence++}`), book = join(root, "book");
  for (
    const dir of [
      root,
      book,
      join(root, "handouts"),
      ...(bodyMode ? [join(root, "lectures")] : []),
    ]
  ) {
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
  await command(root, ["add", bodyArchive || repo, "--no-prompt"]);
  await command(book, ["add", bodyArchive || repo, "--no-prompt"]);
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
      options.book ? "book" : options.projectType || "default"
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
  if (bodyMode) {
    // Authored before either owner freezes inputs. The foreign PDF Link stays
    // on the top-level book home, outside selected Body source roots.
    for (
      const name of [
        "corpus.qmd",
        "work-one.qmd",
        "work-two.qmd",
        "data.txt",
        "diagram.svg",
      ]
    ) {
      let contents = await Deno.readTextFile(
        join(repo, "tests/fixtures/owner-bodies/tasks", name),
      );
      if (name.startsWith("work-")) {
        contents = contents.replace("---\n", `---\ntitle: "${name} chapter"\n`)
          .replace("\n# ", "\n## ");
      }
      await write("book/tasks/" + name, contents);
    }
    await write(
      "book/_quarto.yml",
      "project:\n  type: book\n  output-dir: _output\n  execute-dir: project\n  resources: [assets/contract.svg]\n  pre-render: [_extensions/course-core/entrypoints/pre.ts, _extensions/course-core/entrypoints/owner-freeze.ts]\n  post-render: [_extensions/course-core/entrypoints/post.ts]\nbook:\n  title: Native combined Body and Navigation\n  chapters: [index.qmd, tasks/corpus.qmd, tasks/work-one.qmd, tasks/work-two.qmd]\nformat:\n  html:\n    theme: none\nexecute:\n  freeze: false\n  cache: false\nfilters: [course-core, course-presentation]\ncourse:\n  id: body-proof\n  validate: true\n",
    );
    await write(
      "lectures/_quarto.yml",
      "project:\n  type: default\n  output-dir: _output\n  render: [01/contracts.qmd]\n  resources: []\nformat:\n  revealjs:\n    output-file: slides.html\n",
    );
    await write("lectures/_quarto-student.yml", "metadata: {}\n");
    await write(
      "lectures/01/contracts.qmd",
      "# Native contract slides\n\nA named nested Reveal writer.\n",
    );
    await write(
      "index.qmd",
      "# Portal {#sec-portal}\n\n[Book](book/index.html)\n\n[Lecture](lectures/01/slides.html)\n\n[Handout](handouts/contracts.pdf)\n",
    );
  }
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
  if (bodyMode) {
    async function completeMap(base: string) {
      const files: Record<
        string,
        { sha256: string; mode: number | null; bytes: number }
      > = {};
      async function walk(directory: string) {
        for await (const entry of Deno.readDir(directory)) {
          const path = join(directory, entry.name);
          assert(!entry.isSymlink, "candidate package symlink");
          if (entry.isDirectory) await walk(path);
          else {
            assert(entry.isFile, "candidate package nonregular file");
            const stat = await Deno.stat(path);
            files[path.slice(base.length + 1)] = {
              sha256: await api.digestFile(path),
              mode: stat.mode === null ? null : stat.mode & 0o777,
              bytes: stat.size,
            };
          }
        }
      }
      await walk(base);
      return Object.fromEntries(
        Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    const source = await completeMap(join(repo, "_extensions"));
    const parent = await completeMap(join(root, "_extensions"));
    // The parent also installs QRC. Compare exactly the complete Core archive's
    // extension directories; the independent QRC package retains its own map.
    const parentCore = Object.fromEntries(
      Object.entries(parent).filter(([path]) =>
        !path.startsWith("reference-catalog/")
      ),
    );
    const child = await completeMap(join(book, "_extensions"));
    assert(
      JSON.stringify(source) === JSON.stringify(parentCore) &&
        JSON.stringify(source) === JSON.stringify(child),
      "whole archive/install file set, hashes or modes differ",
    );
    assert(
      Object.keys(source).some((path) => /LICENSE/.test(path)),
      "candidate archive omitted licenses",
    );
    await Deno.writeTextFile(
      join(output, "complete-installed-package.json"),
      JSON.stringify(
        {
          archive: bodyArchive,
          archiveSha256: await api.digestFile(bodyArchive),
          source,
          parentCore,
          child,
        },
        null,
        2,
      ),
    );
  }
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
  if (bodyMode) {
    members.push({
      path: join(root, "lectures"),
      mount: "lectures",
      format: "revealjs",
      output: root + "-native-lectures",
    });
  }
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
      ...(bodyMode ? { body: { sources: bodySources } } : {}),
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
  selected === "capture-positive" || selected === "book-writer" ||
  selected === "writer-convention" || bodyMode
) {
  const bookWriterMode = selected === "book-writer" ||
    selected === "writer-convention";
  const transportMode = selected === "transport" || bookWriterMode || bodyMode;
  const bookProfile = Deno.args[1] || "student";
  const writerProject = selected === "writer-convention"
    ? Deno.args[2] || "book"
    : "book";
  assert(
    !bookWriterMode || ["student", "full"].includes(bookProfile),
    "unknown book writer profile",
  );
  assert(
    !bookWriterMode || ["default", "book", "website"].includes(writerProject),
    "unknown native writer project type",
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
      ? {
        book: writerProject === "book",
        projectType: writerProject as "default" | "book" | "website",
        profile: bookProfile as "student" | "full",
      }
      : {},
  );
  // On frozen base this fails with real RESOURCE.OUTSIDE_OWNER, not missing API.
  const child = await f.prepare();
  if (bodyMode) {
    assert(
      !await exists(join(f.book, ".course-owner/engine-count")),
      "combined prepare executed R",
    );
  }
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
    ...(bodyMode ? ["--execute", "--no-cache", "--no-execute-daemon"] : []),
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
  if (bodyMode) {
    const reveal = f.members[2];
    await command(reveal.path, [
      "render",
      ".",
      "--profile",
      f.profile,
      "--to",
      "revealjs",
      "--output-dir",
      reveal.output,
    ]);
    assert(
      await Deno.readTextFile(join(f.book, ".course-owner/engine-count")) ===
        "executed\n",
      "combined actual Body engine did not execute exactly once",
    );
    await rejects(
      () => f.childApi.finishOwner(child),
      "SOURCE.PUBLICATION_ADDRESS_FINISH_REQUIRED",
    );
    for (
      const name of [
        "finished.json",
        "resources.json",
        "body/package.json",
        "body/public.json",
      ]
    ) {
      assert(
        !await exists(join(f.book, ".course-owner", name)),
        "bare finish issued " + name,
      );
    }
  }
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
    assert(
      current.reports.length === (writerProject === "book" ? 2 : 1),
      "native writer input count differs",
    );
    const session = await f.childApi.preparedSession(child);
    assert(
      (session.audit.profiles[f.profile].config.project.type || "default") ===
        writerProject,
      "frozen native project type differs",
    );
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
          resolve(
            writerProject === "default" ? f.book : current.invocation.output,
            "index.html",
          ),
      "native writer must match its frozen project convention",
    );
    const outputFiles: Array<[(typeof f.members)[number], string]> = [
      [f.members[0], "index.html"],
      [f.members[1], "contracts.pdf"],
    ];
    if (writerProject === "book") {
      outputFiles.push([f.members[0], "chapter.html"]);
    }
    for (const [member, file] of outputFiles) {
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
  const finished = await f.childApi.finishOwner(child, finishContext);
  assert(finished.exitCode === 0, "child address completion failed");
  if (bodyMode) {
    await Deno.writeTextFile(
      join(output, "finished.json"),
      JSON.stringify(finished, null, 2),
    );
    await Deno.writeTextFile(
      join(output, "prepared.json"),
      JSON.stringify(child, null, 2),
    );
    const checked = await f.childApi.validateOwnerBodies(
      child,
      finished.report.body,
    );
    const bundle = checked.publicPackage;
    assert(
      bundle.questions.length === 5 && bundle.works.length === 2,
      "combined Body lost canonical questions or fixed works",
    );
    assert(
      bundle.works[0].items.join(",") ===
          "body-proof/exr-manual,body-proof/exr-choice,body-proof/exr-numeric" &&
        bundle.works[1].items.join(",") ===
          "body-proof/exr-manual,body-proof/exr-multipart,body-proof/exr-matching",
      "combined Body changed fixed work membership/order",
    );
    assert(
      bundle.questions.map((q: any) => q.answerType).join(",") ===
        "manual,single-choice,numeric,multipart,matching",
      "combined Body changed canonical answer order",
    );
    const exported = JSON.stringify(
      bundle.questions.find((q: any) => q.id === "exr-manual").condition,
    );
    assert(
      exported.includes("COMPUTED_BODY_CONDITION") &&
        exported.includes('"t":"Table"') && exported.includes('"t":"Image"'),
      "combined Body lost actual computed paragraph/Table/Image",
    );
    const choice = JSON.stringify(
      bundle.questions.find((q: any) => q.id === "exr-choice").publicAnswer,
    );
    assert(
      ["HTTP", "TLS", "FTP"].every((v) => choice.includes(v)) &&
        choice.includes('"t":"Link"'),
      "combined Body lost choice options/resource link",
    );
    assert(
      bundle.resources.length === 3 &&
        !bundle.resources.some((r: any) => r.source.includes("handouts")),
      "combined Body changed resources or granted the foreign PDF",
    );
    const publicText = JSON.stringify(bundle);
    const html = await Deno.readTextFile(join(stage, "book/tasks/corpus.html"));
    for (
      const secret of [
        "GRADING_SECRET",
        "TEACHER_SECRET",
        '"closedKey"',
        '"gradingNotes"',
        '"solution"',
        '"correct"',
        "answer-spec",
      ]
    ) {
      assert(
        !publicText.includes(secret) && !html.includes(secret),
        "combined public answer leak: " + secret,
      );
    }
    const privateText = JSON.stringify(checked.privatePackage);
    assert(
      privateText.includes("GRADING_SECRET") &&
        privateText.includes("TEACHER_SECRET") &&
        privateText.includes('"closedKey"'),
      "combined Body private authority missing",
    );
  }
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
  if (bodyMode) {
    const services = [
      "book/_quarto.yml",
      "book/_quarto-student.yml",
      "book/_quarto-full.yml",
      "book/.course-owner/body/package.json",
      "book/.course-owner/body/public.json",
      "book/.course-owner/body/receipt.json",
    ];
    for (const path of services) {
      assert(
        parentIndex.files.some((file: any) =>
          file.path === path && file.origin === "service"
        ) &&
          parentIndex.policy.files.some((file: any) =>
            file.path === path && !file.allowed
          ),
        "parent lost Body/config service denial: " + path,
      );
    }
    const rootBinding = join(f.root, ".course-owner/navigation-addresses.json");
    const rootBindingHash = await f.api.digestFile(rootBinding);
    assert(
      parentIndex.files.some((file: any) =>
        file.path === ".course-owner/navigation-addresses.json" &&
        file.sha256 === rootBindingHash
      ),
      "parent resource index lost root address binding",
    );
  }
  const publicationOptions = {
    output: stage,
    members: f.members.map((m) => ({
      ...m,
      ...(m.path === f.book ? { owner: child } : {}),
    })),
  };
  if (bodyMode) {
    for (
      const [source, alias] of [
        [
          ".course-owner/body/package.json",
          "book/.course-owner/body/package.json",
        ],
        [".course-owner/body/package.json", "renamed-private-body.bin"],
        [".course-owner/body/public.json", "renamed-public-body.bin"],
        [".course-owner/body/receipt.json", "renamed-body-receipt.bin"],
      ]
    ) {
      const target = join(stage, alias);
      await Deno.mkdir(dirname(target), { recursive: true });
      await Deno.copyFile(join(f.book, source), target);
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
    // Remove only our now-empty test carrier directories before the first seal.
    await Deno.remove(join(stage, "book/.course-owner/body"));
    await Deno.remove(join(stage, "book/.course-owner"));
  }
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
  if (!captureMode && !bodyMode) await extraCurrentGuards(f, child, stage);
  if (bodyMode) {
    const currentBody = () =>
      f.childApi.validateOwnerBodies(child, finished.report.body);
    const currentResources = () => f.childApi.validateOwnerResources(child);
    await mutation(
      join(stage, "handouts/contracts.pdf"),
      "changed mounted combined PDF",
      async () => {
        await rejects(currentBody, "SOURCE.PUBLICATION_ADDRESS_CHANGED");
        return currentResources();
      },
      "SOURCE.PUBLICATION_ADDRESS_CHANGED",
    );
    await currentBody();
    await currentResources();
    await f.publication.validateNavigationPublicationResources(f.navigation);
    assert(
      await Deno.readTextFile(join(f.book, ".course-owner/engine-count")) ===
        "executed\n",
      "combined current validation executed R again",
    );
    console.log(
      "PASS combined Body+Nav+QRC+HTML/PDF/Reveal: public/private bodies, exact services and current PDF refusal/restore",
    );
  }
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
      `PASS native ${writerProject} actual writer/${f.profile}, native/staged hashes and restored current refusals`,
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
