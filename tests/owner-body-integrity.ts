import { join, toFileUrl } from "stdlib/path";
const evidence = Deno.args[0];
if (!evidence) {
  throw new Error(
    "usage: owner-body-integrity.ts completed-owner-bodies-evidence",
  );
}
const result = JSON.parse(
    await Deno.readTextFile(join(evidence, "finished.json")),
  ),
  h = result.report.body;
const p = {
  protocol: 1,
  root: h.root,
  attemptId: h.attemptId,
  profile: h.profile,
  sessionId: h.sessionId,
  sessionPath: join(h.root, ".course-owner/session.json"),
  sessionHash: h.sessionHash,
};
const api = await import(
  toFileUrl(join(h.root, "_extensions/course-core/owner-preflight/owner.ts"))
    .href
);
const resources = await import(
  toFileUrl(join(h.root, "_extensions/course-core/owner-preflight/resources.ts"))
    .href
);
const s = await api.preparedSession(p),
  index = await api.validateOwnerResources(p),
  invocation = await api.activeOwner(h.root);
if (!invocation) throw new Error("Missing completed native invocation");
async function refuses(
  label: string,
  fn: () => Promise<unknown>,
  code: string,
  exact?: { cause?: string },
) {
  try {
    await fn();
  } catch (error) {
    const matches = exact
      ? error instanceof Error && error instanceof api.OwnerFailure &&
        "code" in error && error.code === code &&
        (exact.cause === undefined || error.cause === exact.cause)
      : String(error).includes(code);
    if (!matches) {
      throw new Error(label + ": unexpected refusal " + error);
    }
    console.log("PASS " + label);
    return;
  }
  throw new Error("Expected refusal: " + label);
}
for (
  const field of [
    "root",
    "attemptId",
    "profile",
    "invocationId",
    "selectionHash",
    "indexHash",
  ]
) {
  await refuses(
    "other " + field + " handle",
    () => api.validateOwnerBodies(p, { ...h, [field]: "other" }),
    "BODY.HANDLE_INVALID",
  );
}
for (
  const work of [["body-proof/sec-missing"], [
    "body-proof/sec-work-one",
    "body-proof/sec-work-one",
  ]]
) {
  await refuses(
    "invalid fixed work selection",
    () => api.validateOwnerBodies(p, h, { works: work }),
    "BODY.WORK_SELECTION_INVALID",
  );
}
const seal = index.files.find((file: { path: string }) =>
  file.path.startsWith(".course-owner/body/seal-")
);
const plot = index.files.find((file: { origin: string }) =>
  file.origin === "generated"
);
const actual = index.files.find((file: { path: string }) =>
  file.path.startsWith(".course-owner/render/")
);
for (
  const [label, path, code] of [
    ["private package bytes", h.packagePath, "RESOURCE.BYTES_CHANGED"],
    ["public projection bytes", h.publicPath, "RESOURCE.BYTES_CHANGED"],
    ["receipt bytes", h.receiptPath, "RESOURCE.BYTES_CHANGED"],
    ["body seal bytes", seal.actualPath, "RESOURCE.BYTES_CHANGED"],
    [
      "actual native observation bytes",
      actual.actualPath,
      s.publicationAddresses
        ? "SOURCE.INVALID_ATTEMPT"
        : "RESOURCE.BYTES_CHANGED",
    ],
    [
      "ordinary native capture bytes",
      Object.values(s.captures)[0],
      "SOURCE.BASELINE_CHANGED",
    ],
    [
      "owned identity seal bytes",
      Object.values(s.identities)[0],
      "SOURCE.HEADER_IDENTITY_CHANGED",
    ],
    [
      "answer module bytes",
      join(h.root, "_extensions/course-core/body-export/answer.cue"),
      "SOURCE.FROZEN_INPUT_CHANGED",
    ],
    [
      "native Header reader module bytes",
      join(h.root, "_extensions/course-core/owner-preflight/reader.lua"),
      "SOURCE.FROZEN_INPUT_CHANGED",
    ],
    [
      "owner source bytes",
      join(h.root, "tasks/corpus.qmd"),
      "SOURCE.FROZEN_INPUT_CHANGED",
    ],
    [
      "current generated image bytes",
      plot.actualPath,
      "RESOURCE.BYTES_CHANGED",
    ],
  ] as [string, string, string][]
) {
  const original = await Deno.readFile(path);
  try {
    const changed = new Uint8Array(original.length + 1);
    changed.set(original);
    changed[original.length] = 32;
    await Deno.writeFile(path, changed);
    const actualObservation = label === "actual native observation bytes";
    await refuses(
      label,
      () => api.validateOwnerBodies(p, h),
      code,
      actualObservation
        ? s.publicationAddresses
          ? { cause: "stale/corrupt observation receipt" }
          : {}
        : undefined,
    );
    if (actualObservation) {
      await refuses(
        "same observation independent resource byte guard",
        () => resources.checkResourceFiles([actual], h.root, invocation.output),
        "RESOURCE.BYTES_CHANGED",
        {},
      );
    }
  } finally {
    await Deno.writeFile(path, original);
  }
}
const indexPath = join(h.root, ".course-owner/resources.json"),
  indexBytes = await Deno.readTextFile(indexPath);
try {
  await Deno.writeTextFile(
    indexPath,
    JSON.stringify({ ...index, root: "other" }),
  );
  await refuses(
    "resource index content",
    () => api.validateOwnerBodies(p, h),
    "RESOURCE.INDEX_CHANGED",
  );
} finally {
  await Deno.writeTextFile(indexPath, indexBytes);
}
for (
  const path of [
    h.packagePath,
    h.publicPath,
    h.receiptPath,
    Object.values(s.identities)[0] as string,
  ]
) {
  await refuses(
    "service bytes denied to delivery",
    () =>
      api.validateOwnerResources(p, {
        selections: [path.slice(h.root.length + 1)],
      }),
    "RESOURCE.SELECTION_FORBIDDEN",
  );
}
const original = await Deno.readFile(h.publicPath),
  target = await Deno.makeTempFile();
try {
  await Deno.writeFile(target, original);
  await Deno.remove(h.publicPath);
  await Deno.symlink(target, h.publicPath);
  await refuses(
    "symlink public projection",
    () => api.validateOwnerBodies(p, h),
    "RESOURCE.SYMLINK_UNSUPPORTED",
  );
} finally {
  await Deno.remove(h.publicPath);
  await Deno.writeFile(h.publicPath, original);
  await Deno.remove(target);
}
await api.validateOwnerBodies(p, h);
console.log(
  "PASS current producer validation restored; no native engine rerun",
);
