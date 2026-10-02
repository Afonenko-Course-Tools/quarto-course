// A small genuine installed-owner fixture, not original-course coverage.
// No synthetic receipt, output existence or caller success flag proves native completion.
import { dirname, fromFileUrl, isAbsolute, join, relative } from "stdlib/path";

const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const quarto = Deno.env.get("QUARTO");
const expectedVersion = Deno.env.get("NATIVE_LISTING_EXPECTED_QUARTO");
const evidence = Deno.env.get("NATIVE_LISTING_TEST_OUTPUT");
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
assert(
  quarto && isAbsolute(quarto),
  "QUARTO must identify the actual absolute CLI",
);
assert(
  evidence && isAbsolute(evidence),
  "NATIVE_LISTING_TEST_OUTPUT is required",
);
assert(
  expectedVersion === "1.10.18" || expectedVersion === "1.11.5",
  "an exact reviewed stable/prerelease version is required",
);
assert(
  await Deno.realPath(quarto) === quarto,
  "QUARTO must be the canonical CLI",
);
await Deno.mkdir(evidence, { recursive: true });
for await (const entry of Deno.readDir(evidence)) {
  assert(
    entry.name === "official-release.json" && entry.isFile,
    "a fresh evidence directory is required; no resume",
  );
}
let commandSequence = 0;
const commands: any[] = [];
async function command(cwd: string, args: string[], executable = quarto!) {
  const started = new Date().toISOString();
  const result = await new Deno.Command(executable, {
    cwd,
    args,
    env: { QUARTO: quarto!, QUARTO_RUN_NO_NETWORK: "true" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const log = `native-command-${commandSequence++}.log`;
  await Deno.writeFile(join(evidence!, log), result.stdout);
  const file = await Deno.open(join(evidence!, log), {
    write: true,
    append: true,
  });
  try {
    await file.write(result.stderr);
  } finally {
    file.close();
  }
  const receipt = {
    executable,
    cwd,
    args,
    started,
    finished: new Date().toISOString(),
    exitCode: result.code,
    log,
  };
  commands.push(receipt);
  assert(
    result.success,
    JSON.stringify(receipt) + "\n" +
      new TextDecoder().decode(result.stderr),
  );
  return { receipt, stdout: new TextDecoder().decode(result.stdout) };
}
async function sha(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer),
    ),
  )
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}
async function digest(path: string) {
  return await sha(await Deno.readFile(path));
}
async function exists(path: string) {
  try {
    await Deno.lstat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}
async function fileMap(root: string) {
  const result: Record<string, { sha256: string; bytes: number }> = {};
  async function walk(path: string) {
    for await (const entry of Deno.readDir(path)) {
      const target = join(path, entry.name);
      assert(!entry.isSymlink, "evidence/package symlink: " + target);
      if (entry.isDirectory) await walk(target);
      else {
        assert(entry.isFile, "nonregular evidence/package file: " + target);
        const bytes = await Deno.readFile(target);
        result[relative(root, target).replaceAll("\\", "/")] = {
          sha256: await sha(bytes),
          bytes: bytes.length,
        };
      }
    }
  }
  await walk(root);
  return Object.fromEntries(
    Object.entries(result).sort(([a], [b]) => a.localeCompare(b)),
  );
}
async function writeJSON(path: string, value: unknown) {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, JSON.stringify(value, null, 2) + "\n");
}
async function refuses(run: () => Promise<unknown>, codes: string[]) {
  try {
    await run();
  } catch (error) {
    const message = String(error);
    const code = codes.find((candidate) => message.includes(candidate));
    assert(code, `expected ${codes.join(" or ")}, observed ${message}`);
    return { code, message };
  }
  throw new Error("accepted forbidden operation: " + codes.join(" or "));
}
const version = (await command(repo, ["--version"])).stdout.trim();
assert(
  version === expectedVersion,
  "actual CLI differs from the reviewed channel: " + version,
);
const paths = (await command(repo, ["--paths"])).stdout;
const pandoc = (await command(repo, ["pandoc", "--version"])).stdout;
const cue = (await command(repo, ["version"], "cue")).stdout;
const sourceHead = (await command(repo, ["rev-parse", "HEAD"], "git")).stdout
  .trim();
const packageFiles = await fileMap(join(repo, "_extensions"));
assert(Object.keys(packageFiles).length > 0, "candidate package is empty");
const archive = join(evidence, "quarto-course-candidate.tar.gz");
await command(repo, [
  "-czf",
  archive,
  "--transform=s,^,quarto-course/,",
  "_extensions",
  "README.md",
], "tar");
const archiveHash = await digest(archive);
await writeJSON(join(evidence, "native-tools-and-package.json"), {
  sourceHead,
  quarto,
  version,
  expectedVersion,
  paths,
  pandoc,
  cue,
  archive,
  archiveHash,
  packageFiles,
});

const sources = [
  "index.qmd",
  "text/index.qmd",
  "text/representation/index.qmd",
  "text/decoding/index.qmd",
  "text/immutability/index.qmd",
];
const declarations = [
  ["introductory-topics", "introductory", 1],
  ["intermediate-topics", "intermediate", 1],
  ["advanced-topics", "advanced", 2],
] as const;
const topics = [
  {
    path: sources[2],
    title: "Символ и его байтовое представление",
    id: "sec-representation",
    difficulty: "introductory",
    semester: 1,
    categories: ["UTF-8", "Строки"],
  },
  {
    path: sources[3],
    title: "Строгое декодирование UTF-8",
    id: "sec-decoding",
    difficulty: "intermediate",
    semester: 1,
    categories: ["Декодирование", "Контракты"],
  },
  {
    path: sources[4],
    title: "Сохранность данных на границе компонентов",
    id: "sec-immutability",
    difficulty: "advanced",
    semester: 2,
    categories: ["Массивы", "Границы компонентов"],
  },
];
const prior = join(evidence, "previous-publications");
for (const profile of ["student", "full"]) {
  await Deno.mkdir(join(prior, profile), { recursive: true });
  await Deno.writeTextFile(
    join(prior, profile, "index.html"),
    `prior ${profile} publication\n`,
  );
  await writeJSON(join(prior, profile, "manifest.json"), {
    profile,
    generation: "prior",
  });
}
const priorMap = await fileMap(prior);
async function priorUnchanged() {
  assert(
    JSON.stringify(await fileMap(prior)) === JSON.stringify(priorMap),
    "prior student/full publications changed",
  );
}
let caseSequence = 0;
async function fixture(
  options: { unsupportedField?: boolean; closedDestination?: boolean } = {},
) {
  const root = join(evidence!, `case-${caseSequence++}`);
  await Deno.mkdir(root);
  const added = await command(root, ["add", archive, "--no-prompt"]);
  const installedFiles = await fileMap(join(root, "_extensions"));
  assert(
    JSON.stringify(installedFiles) === JSON.stringify(packageFiles),
    "archive/quarto add lost or changed package files",
  );
  await writeJSON(root + "-installed-package.json", {
    archiveHash,
    added: added.receipt,
    packageFiles,
    installedFiles,
  });
  async function write(path: string, contents: string) {
    await Deno.mkdir(dirname(join(root, path)), { recursive: true });
    await Deno.writeTextFile(join(root, path), contents);
  }
  await write(
    "_quarto.yml",
    `project:
  type: book
  output-dir: _book/student
  resources: []
  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts
profile:
  group: [[student, full]]
course:
  id: small-native-listing-owner
  view: student
filters: [course-core]
book:
  title: Исследования программных контрактов
  chapters:
    - index.qmd
    - part: text/index.qmd
      chapters:
        - text/representation/index.qmd
        - text/decoding/index.qmd
        - text/immutability/index.qmd
format:
  html:
    theme: none
    toc: false
lang: ru
execute:
  freeze: false
  cache: false
`,
  );
  await write(
    "_quarto-student.yml",
    "course:\n  view: student\nproject:\n  output-dir: _book/student\n",
  );
  await write(
    "_quarto-full.yml",
    "course:\n  view: full\nproject:\n  output-dir: _book/full\n",
  );
  const listingYAML = declarations.map(([id, difficulty, semester], index) =>
    `  - id: ${id}\n    contents: "*/*/index.qmd"\n    type: table\n    fields: [title, ${
      options.unsupportedField && index === 0 ? "image" : "categories"
    }]\n    field-display-names: {title: Тема исследования, categories: Ключевые слова}\n    sort: title\n    filter-ui: false\n    sort-ui: false\n    include: {difficulty: ${difficulty}, semester: ${semester}}`
  ).join("\n");
  const destinations = declarations.map(([id], index) => {
    const destination = `::: {#${id}}\n:::`;
    return options.closedDestination && index === 0
      ? `:::: {.when-full}\n${destination}\n::::`
      : destination;
  }).join("\n\n");
  await write(
    "index.qmd",
    `---\nlisting:\n${listingYAML}\n---\n\n# Исследовательские работы {#sec-essays .unnumbered}\n\nВыберите вопрос и сформулируйте проверяемый контракт.\n\n${destinations}\n`,
  );
  await write(
    "text/index.qmd",
    `---
listing:
  id: text-topics
  contents: "*/index.qmd"
  type: table
  fields: [title, semester, categories]
  field-display-names:
    title: Тема исследования
    semester: Семестр
    categories: Ключевые слова
  page-size: 10
  sort: title
  filter-ui: false
  sort-ui: false
---

# Текст как данные {.unnumbered}

Представление текста, декодирование и передача данных между компонентами.

::: {#text-topics}
:::
`,
  );
  await write(
    "text/_prerequisites.qmd",
    "Обычный включённый текст о проверяемых контрактах.\n",
  );
  for (const topic of topics) {
    await write(
      topic.path,
      `---\ndifficulty: ${topic.difficulty}\nsemester: ${topic.semester}\ncategories: ${
        JSON.stringify(topic.categories)
      }\n---\n\n# ${topic.title} {#${topic.id}}\n\n{{< include ../_prerequisites.qmd >}}\n\nПроверьте контракт воспроизводимым примером.\n`,
    );
  }
  const authored = Object.fromEntries(
    await Promise.all([
      "_quarto.yml",
      "_quarto-student.yml",
      "_quarto-full.yml",
      ...sources,
      "text/_prerequisites.qmd",
    ].map(async (path) => [path, await digest(join(root, path))])),
  );
  const api = await import(
    `file://${root}/_extensions/course-core/owner-preflight/owner.ts`
  );
  return { root, api, authored, installedFiles };
}

const completed: any[] = [];
async function positive(profile: "student" | "full") {
  const f = await fixture();
  const prepared = await f.api.prepareOwner(f.root, {
    attemptId: `small-native-listing-${profile}`,
    profile,
  });
  const session = await f.api.preparedSession(prepared);
  const expectedCaptureKeys = ["student", "full"].flatMap((p) =>
    sources.map((source) => p + ":" + source)
  ).sort();
  for (
    const name of [
      "captures",
      "captureHashes",
      "identities",
      "identityHashes",
      "identityReaders",
    ]
  ) {
    assert(
      JSON.stringify(Object.keys(session[name]).sort()) ===
        JSON.stringify(expectedCaptureKeys),
      "incomplete mandatory native matrix: " + name,
    );
  }
  for (const key of expectedCaptureKeys) {
    assert(
      await digest(session.captures[key]) === session.captureHashes[key],
      "capture bytes drifted: " + key,
    );
    assert(
      await digest(session.identities[key]) === session.identityHashes[key],
      "identity bytes drifted: " + key,
    );
  }
  // Core's existing whole-input identity replay is mandatory for Jupyter only.
  // This fixture is static Markdown; Listing's own input witness is checked below.
  for (const name of ["identityReplays", "readerInputs", "readerInputHashes"]) {
    assert(
      Object.keys(session[name]).length === 0,
      "static fixture acquired an invented Jupyter replay: " + name,
    );
  }
  const listingKeys = [
    "student:index.qmd",
    "student:text/index.qmd",
    "full:index.qmd",
    "full:text/index.qmd",
  ].sort();
  assert(
    JSON.stringify(Object.keys(session.nativeListingPlans).sort()) ===
      JSON.stringify(listingKeys),
    "fixture must bind two emitters in both profiles",
  );
  assert(
    session.nativeListingProvider.version === version,
    "provider binds another actual CLI",
  );
  for (const key of listingKeys) {
    const plan = session.nativeListingPlans[key];
    assert(
      plan.declarations.length === (plan.source === "index.qmd" ? 3 : 1),
      "four declarations were not retained",
    );
    assert(
      plan.selectedWriters.length === 5,
      "selected native writer set is incomplete",
    );
    for (const phase of ["capture", "identity"]) {
      const hashes = session.nativeListingHashes[key][phase];
      assert(
        await digest(session.nativeListingInputs[key][phase]) === hashes.input,
        "unretained native listing input",
      );
      assert(
        await digest(session.nativeListingWitnesses[key][phase]) ===
          hashes.witness,
        "unretained native listing witness",
      );
    }
  }
  assert(
    !await exists(join(f.root, "_book")),
    "private captures retained authored output",
  );
  await priorUnchanged();
  await refuses(() => f.api.validateOwnerResources(prepared), [
    "RESOURCE.FINISH_REQUIRED",
  ]);
  const nativeOutput = join(evidence!, `native-${profile}`);
  await Deno.mkdir(nativeOutput);
  const metadata = await f.api.activateOwner(prepared, {
    output: nativeOutput,
  });
  const metadataFile = join(
    f.root,
    ".course-owner/native-render-metadata.json",
  );
  await writeJSON(metadataFile, metadata);
  // The only actual publication render in this positive. finish is called after awaited CLI zero.
  const rendered = await command(f.root, [
    "render",
    ".",
    "--profile",
    profile,
    "--to",
    "html",
    "--no-execute",
    "--no-cache",
    "--metadata-file",
    metadataFile,
    "--output-dir",
    nativeOutput,
  ]);
  const finished = await f.api.finishOwner(prepared);
  assert(
    finished.exitCode === 0,
    "owner refused actual complete native zero: " + JSON.stringify(finished),
  );
  const index = await f.api.validateOwnerResources(prepared);
  const addressPath = join(
    f.root,
    ".course-owner/native-listing-addresses.json",
  );
  const addresses = JSON.parse(await Deno.readTextFile(addressPath));
  assert(
    addresses.invocation.invocationId === index.invocationId &&
      addresses.writers.length === 5,
    "current native address completion is incomplete",
  );
  assert(
    addresses.actualEdges.length === 12,
    "fixture has exactly six rows with raw/projected edges",
  );
  assert(
    addresses.assets.length === 2 && addresses.auxiliary.expected.length === 2,
    "finite stock dependencies/auxiliary writers incomplete",
  );
  assert(
    index.nativeListingAddressReceiptHash === await digest(addressPath),
    "index does not bind current address receipt",
  );
  for (const source of sources) {
    const policy = index.policy.files.find((row: any) => row.path === source);
    assert(
      policy?.allowed === false,
      "same-owner address promoted raw Source: " + source,
    );
  }
  const mutations: any[] = [];
  const current = () => f.api.validateOwnerResources(prepared);
  async function restored(label: string) {
    const actual = await current();
    assert(
      actual.invocationId === index.invocationId &&
        actual.indexHash === index.indexHash,
      "restore changed actual invocation/index: " + label,
    );
    await priorUnchanged();
  }
  async function mutate(
    label: string,
    path: string,
    codes: string[],
    replacement?: string,
  ) {
    const bytes = await Deno.readFile(path), stat = await Deno.stat(path);
    let refusal;
    try {
      if (replacement === undefined) await Deno.remove(path);
      else await Deno.writeTextFile(path, replacement);
      refusal = await refuses(current, codes);
    } finally {
      await Deno.writeFile(path, bytes);
      if (stat.mtime) {
        await Deno.utime(path, stat.atime || stat.mtime, stat.mtime);
      }
    }
    await restored(label);
    mutations.push({
      label,
      path,
      beforeHash: await sha(bytes),
      ...refusal,
      restoredIndexHash: index.indexHash,
    });
    console.log(
      `PASS ${profile} current refusal and exact same-invocation restore: ${label}`,
    );
  }
  const listingKey = profile + ":index.qmd";
  const input = session.nativeListingInputs[listingKey].render;
  const witness = session.nativeListingWitnesses[listingKey].render;
  const baselineWitness = session.nativeListingWitnesses[listingKey].capture;
  const serviceAsset = join(
    f.root,
    ".course-owner/native-listing/provider/list.min.js",
  );
  const writer = addresses.writers.find((row: any) =>
    row.descriptor.source === sources[2]
  );
  assert(writer, "selected HTML target witness is missing");
  const html = join(nativeOutput, writer.native.path);
  const sourceCodes = [
    "SOURCE.FROZEN_INPUT_CHANGED",
    "SOURCE.CONFIGURATION_CHANGED",
    "SOURCE.NATIVE_LISTING_SOURCE_CHANGED",
  ];
  await mutate(
    "selected-source",
    join(f.root, sources[2]),
    sourceCodes,
    "# Changed Source\n",
  );
  await mutate("current-native-input", input, [
    "SOURCE.NATIVE_LISTING_WITNESS_INVALID",
    "RESOURCE.BYTES_CHANGED",
  ], "changed exact native input\n");
  await mutate("current-constructor-witness", witness, [
    "SOURCE.NATIVE_LISTING_WITNESS_INVALID",
    "SOURCE.NATIVE_LISTING_ADDRESS_CHANGED",
  ], "{}\n");
  await mutate("baseline-constructor-witness", baselineWitness, [
    "SOURCE.NATIVE_LISTING_WITNESS_INVALID",
  ], "{}\n");
  await mutate("stock-service-asset", serviceAsset, [
    "SOURCE.NATIVE_LISTING_WITNESS_INVALID",
    "SOURCE.NATIVE_LISTING_ADDRESS_CHANGED",
  ], "changed retained stock asset\n");
  await mutate("selected-html-edit", html, [
    "SOURCE.NATIVE_LISTING_ADDRESS_CHANGED",
  ], "changed selected HTML\n");
  await mutate("selected-html-delete", html, [
    "SOURCE.NATIVE_LISTING_ADDRESS_CHANGED",
  ]);
  await mutate("auxiliary-index", join(nativeOutput, "listings.json"), [
    "SOURCE.NATIVE_LISTING_ADDRESS_CHANGED",
  ], "[]");
  await mutate(
    "stock-emitted-asset",
    join(nativeOutput, addresses.assets[0].native.path),
    ["SOURCE.NATIVE_LISTING_ADDRESS_CHANGED"],
    "changed emitted stock asset\n",
  );
  await mutate("native-address-receipt", addressPath, [
    "SOURCE.NATIVE_LISTING_ADDRESS_CHANGED",
  ], "{}\n");
  const active = JSON.parse(
    await Deno.readTextFile(join(f.root, ".course-owner/active.json")),
  );
  await mutate(
    "current-guard",
    join(f.root, `.course-owner/guard-${active.invocationId}.json`),
    ["SOURCE.INVALID_ATTEMPT"],
    "{}\n",
  );
  await mutate(
    "provider-code",
    join(f.root, "_extensions/course-core/owner-preflight/native-listing.lua"),
    sourceCodes,
    "-- changed provider code\n",
  );
  const renamedReceipt = join(
    f.root,
    ".course-owner/renamed-native-listing-addresses.json",
  );
  let renamedRefusal;
  try {
    await Deno.rename(addressPath, renamedReceipt);
    renamedRefusal = await refuses(current, [
      "SOURCE.NATIVE_LISTING_ADDRESS_CHANGED",
    ]);
  } finally {
    await Deno.rename(renamedReceipt, addressPath);
  }
  await restored("renamed-address-receipt");
  mutations.push({
    label: "renamed-address-receipt",
    ...renamedRefusal,
    restoredIndexHash: index.indexHash,
  });
  const privateFiles = [
    join(f.root, sources[2]),
    input,
    witness,
    addressPath,
    serviceAsset,
  ];
  for (const privateFile of privateFiles) {
    const selection = relative(f.root, privateFile).replaceAll("\\", "/");
    const refusal = await refuses(
      () => f.api.validateOwnerResources(prepared, { selections: [selection] }),
      ["RESOURCE.POLICY_DENIED"],
    );
    await restored("raw-selection:" + selection);
    mutations.push({ label: "raw-selection", selection, ...refusal });
  }
  for (const [number, privateFile] of privateFiles.entries()) {
    const alias = join(nativeOutput, `renamed-private-${number}.bin`);
    assert(!await exists(alias), "alias path already exists");
    let refusal;
    try {
      await Deno.copyFile(privateFile, alias);
      refusal = await refuses(current, [
        "SOURCE.NATIVE_LISTING_ADDRESS_CHANGED",
        "RESOURCE.PUBLICATION_DENIED_BYTES",
      ]);
    } finally {
      await Deno.remove(alias);
    }
    await restored("renamed-private-output:" + number);
    mutations.push({
      label: "renamed-private-output",
      source: privateFile,
      alias,
      ...refusal,
    });
  }
  const authoredAfter = Object.fromEntries(
    await Promise.all(
      Object.keys(f.authored).map(async (
        path,
      ) => [path, await digest(join(f.root, path))]),
    ),
  );
  assert(
    JSON.stringify(authoredAfter) === JSON.stringify(f.authored),
    "native/mutation harness changed authored fixture bytes",
  );
  assert(
    JSON.stringify(await fileMap(join(f.root, "_extensions"))) ===
      JSON.stringify(f.installedFiles),
    "mutation harness changed installed package bytes",
  );
  await priorUnchanged();
  const result = {
    kind: "small-installed-native-owner",
    profile,
    root: f.root,
    nativeOutput,
    archiveHash,
    actualQuarto: version,
    prepared,
    completeCaptureKeys: expectedCaptureKeys,
    listingKeys,
    nativeRender: rendered.receipt,
    finished,
    indexHash: index.indexHash,
    invocationId: index.invocationId,
    addressReceiptHash: await digest(addressPath),
    currentWriters: addresses.writers,
    auxiliary: addresses.auxiliary,
    assets: addresses.assets,
    authoredBefore: f.authored,
    authoredAfter,
    installedFiles: f.installedFiles,
    mutations,
    priorPublications: priorMap,
  };
  await writeJSON(join(evidence!, `${profile}-owner-receipt.json`), result);
  completed.push(result);
  console.log(
    `PASS genuine installed NativeListing ${profile}: selected5/declarations4; complete captures and identities; actual native zero, owner finish/current; exact current mutations/restore; raw source/service aliases denied`,
  );
}
await positive("student");
await positive("full");

const refused: any[] = [];
for (
  const [name, options, code] of [
    [
      "unsupported-field",
      { unsupportedField: true },
      "SOURCE.NATIVE_LISTING_UNSUPPORTED",
    ],
    [
      "closed-destination",
      { closedDestination: true },
      "SOURCE.NATIVE_LISTING_DESTINATION_INVALID",
    ],
  ] as const
) {
  const f = await fixture(options);
  const refusal = await refuses(() =>
    f.api.prepareOwner(f.root, {
      attemptId: "small-native-listing-" + name,
      profile: "student",
    }), [code]);
  assert(
    !await exists(join(f.root, ".course-owner/finished.json")),
    "refused prepare yielded finished owner",
  );
  assert(
    !await exists(join(f.root, "_book")),
    "refused prepare retained publication output",
  );
  await priorUnchanged();
  refused.push({ name, root: f.root, ...refusal, authored: f.authored });
  console.log(`PASS strict preparation refusal: ${name} ${code}`);
}
await writeJSON(join(evidence, "required-native-listing-result.json"), {
  protocol: 1,
  scope: "small-installed-five-input-four-declaration-fixture",
  actualQuarto: version,
  expectedVersion,
  quarto,
  sourceHead,
  archiveHash,
  positiveProfiles: completed.map((
    { profile, invocationId, indexHash, addressReceiptHash },
  ) => ({ profile, invocationId, indexHash, addressReceiptHash })),
  refusedPreparations: refused,
  commands,
  priorPublications: priorMap,
});
await writeJSON(join(evidence, "evidence-manifest.json"), {
  protocol: 1,
  files: await fileMap(evidence),
});
console.log(
  "PASS REQUIRED_NATIVE_LISTING_COMPLETE: two real profiles; strict captures/current/refusals; small fixture only",
);
