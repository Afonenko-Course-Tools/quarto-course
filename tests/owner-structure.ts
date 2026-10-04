// Malformed envelopes never confer native acceptance or producer authority.
import { dirname, fromFileUrl, join, resolve, toFileUrl } from "stdlib/path";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const root = dirname(dirname(fromFileUrl(import.meta.url)));
const extension = Deno.args[0]
  ? resolve(Deno.args[0])
  : join(root, "_extensions/course-core");
const api = await import(
  toFileUrl(join(extension, "owner-preflight/owner.ts")).href
);
const audit = await import(
  toFileUrl(join(extension, "owner-preflight/owner/source-audit.ts")).href
);
assert(
  api.fingerprint === audit.fingerprint,
  "Facade fingerprint binding changed",
);

async function refuses(
  fn: () => Promise<unknown>,
  code: string,
  cause?: string,
) {
  try {
    await fn();
  } catch (error) {
    assert(
      error instanceof api.OwnerFailure,
      "Public failure constructor changed: " + error,
    );
    assert((error as any).code === code, "Expected " + code + ", got " + error);
    if (cause) {
      assert(
        (error as any).cause === cause,
        "Failure order/cause changed: " + error,
      );
    }
    return;
  }
  throw new Error("Expected " + code);
}

const dir = await Deno.makeTempDir({ prefix: "owner-structure-" });
try {
  await Deno.mkdir(join(dir, "nested"));
  await Deno.mkdir(join(dir, ".course-owner"));
  for (
    const path of ["z.txt", "nested/b.txt", "a.txt", ".course-owner/mutable"]
  ) {
    await Deno.writeTextFile(join(dir, path), "abc");
  }
  const inventory = { root: dir, excluded: [".course-owner"] };
  const files = await api.fingerprint(inventory);
  assert(
    JSON.stringify(Object.keys(files)) === '["a.txt","nested/b.txt","z.txt"]',
    "Inventory sort/exclusion changed",
  );
  assert(
    Object.values(files).every((hash) =>
      hash ===
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    ),
    "Source byte hash changed",
  );
  await Deno.symlink(join(dir, "a.txt"), join(dir, "nested/link"));
  await refuses(
    () => api.fingerprint(inventory),
    "SOURCE.SYMLINK_UNSUPPORTED",
    "nested/link",
  );
  await Deno.remove(join(dir, "nested/link"));

  const envelope = {
    protocol: 1,
    root: dir,
    attemptId: "attempt",
    profile: "student",
    sessionId: "session",
    extension: "_extensions/course-core",
    quarto: "quarto",
    audit: {
      root: dir,
      profiles: {},
      coverage: {},
      excluded: [],
      dependencies: {},
    },
    files: {},
    validated: false,
    captures: {},
    captureHashes: {},
    captureProjections: {},
    captureProjectionHash: "",
    identities: {},
    identityHashes: {},
    identityReaders: {},
    identityReplays: {},
    readerInputs: {},
    readerInputHashes: {},
    headers: [],
  };
  const path = join(dir, ".course-owner/preparation.json");
  async function write(value: unknown) {
    await Deno.writeTextFile(path, JSON.stringify(value));
  }
  await write(envelope);
  assert(
    JSON.stringify(await api.sessionAt(path)) === JSON.stringify(envelope),
    "Read-only envelope shape/order changed",
  );
  await refuses(
    async () =>
      api.preparedSession({
        ...envelope,
        sessionPath: path,
        sessionHash: await api.digestFile(path),
      }),
    "SOURCE.INVALID_ATTEMPT",
    "handle/session mismatch",
  );

  for (
    const change of [
      { protocol: 2 },
      { profile: "teacher" },
      { files: { "a.txt": "wrong" } },
      { identityReplays: { "student:index.qmd": false } },
      { captures: { "full:foreign.qmd": "/borrowed/capture" } },
      { identities: { "student:foreign.qmd": "/borrowed/identity" } },
      { readerInputs: { "student:foreign.qmd": "/borrowed/input" } },
      { extension: "../outside" },
    ]
  ) {
    await write({ ...envelope, ...change });
    const code = "extension" in change
      ? "SOURCE.OUTSIDE_OWNER"
      : "SOURCE.INVALID_ATTEMPT";
    await refuses(() => api.sessionAt(path), code);
  }
  // All three validators see invalid evidence: the first refusal must win.
  const body = { sources: [], release: "release", selectionHash: "invalid" };
  const nativeListingInputs = { foreign: {} };
  await write({
    ...envelope,
    captureProjectionHash: "invalid",
    nativeListingInputs,
    body,
  });
  await refuses(() => api.sessionAt(path), "SOURCE.CAPTURE_PROJECTION_CHANGED");
  await write({ ...envelope, nativeListingInputs, body });
  await refuses(
    () => api.sessionAt(path),
    "SOURCE.NATIVE_LISTING_WITNESS_INVALID",
  );
  await write({ ...envelope, body });
  await refuses(() => api.sessionAt(path), "BODY.SELECTION_INVALID");
  await write(envelope);
  await Deno.rename(path, path + ".saved");
  await Deno.symlink(path + ".saved", path);
  await refuses(() => api.sessionAt(path), "SOURCE.INVALID_ATTEMPT");
  await Deno.remove(path);
  await Deno.rename(path + ".saved", path);
  const state = join(dir, ".course-owner");
  await Deno.rename(state, state + "-saved");
  await Deno.symlink(state + "-saved", state);
  await refuses(() => api.sessionAt(path), "SOURCE.INVALID_ATTEMPT");
  await Deno.remove(state);
  await Deno.rename(state + "-saved", state);
  console.log(
    "PASS sorted source hashing/exclusion/link refusal and exact malformed session validation order/public errors",
  );
} finally {
  await Deno.remove(dir, { recursive: true });
}
