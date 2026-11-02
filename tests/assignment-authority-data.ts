import { copy } from "stdlib/fs";
import { fromFileUrl, join, toFileUrl } from "stdlib/path";
const base = await Deno.makeTempDir({ prefix: "authority-data-only-" }),
  owner = join(base, "owner"),
  capsule = join(base, "capsule"),
  core = join(base, "core");
await Deno.mkdir(owner);
await Deno.mkdir(capsule);
await copy(
  new URL("../_extensions/course-core", import.meta.url).pathname,
  core,
);
const hash = async (text: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  ).map((v) => v.toString(16).padStart(2, "0")).join("");
const location = join(core, "runtime/assignment-authority-location.json"),
  epoch = "reader-data-only-not-qualified";
await Deno.writeTextFile(
  location,
  JSON.stringify({
    schema: "course-assignment-authority-location-v1",
    root: capsule,
    epoch,
  }),
);
await Deno.chmod(location, 0o444);
const lf = await Deno.readTextFile(location), entry = Deno.mainModule;
const profile: any = {
  id: "reader-not-a-producer-qualification",
  root: owner,
  source: {
    files: [{ path: "dummy.txt", sha256: "0".repeat(64) }],
    memberships: {},
  },
  runtime: {
    files: [Deno.execPath(), fromFileUrl(entry), location].map((path) => ({
      path,
      sha256: "0".repeat(64),
    })),
    directories: [],
    absent: [],
  },
  hostEnvironment: {},
  launcher: {
    entrypoint: entry,
    executable: Deno.execPath(),
    arguments: Deno.args,
    requestedProfiles: [],
  },
  native: {
    executable: Deno.execPath(),
    environment: {},
    renders: [],
    actualProfiles: [],
    producerEvidence: {},
    literalShortcodes: [],
  },
};
async function writeData(mut?: (p: any) => void) {
  await Deno.chmod(capsule, 0o755);
  const p = structuredClone(profile);
  mut?.(p);
  const r = JSON.stringify({
      schema: "course-assignment-profiles-v1",
      epoch,
      profiles: [p],
    }),
    m = JSON.stringify({
      schema: "course-assignment-authority-manifest-v1",
      epoch,
      files: ["anchor.json", "manifest.json", "profiles.json"],
      mode: 292,
      profiles: {
        sha256: await hash(r),
        size: new TextEncoder().encode(r).length,
      },
    }),
    e = JSON.stringify({
      schema: "course-assignment-authority-anchor-v1",
      epoch,
      root: capsule,
      manifest: {
        sha256: await hash(m),
        size: new TextEncoder().encode(m).length,
      },
      graph: {
        files: [{
          path: location,
          sha256: await hash(lf),
          size: new TextEncoder().encode(lf).length,
          mode: 292,
        }],
        directories: [],
        absent: [],
      },
      launches: [{
        entrypoint: entry,
        executable: Deno.execPath(),
        cwd: owner,
        arguments: Deno.args,
        runtimeArguments: [],
        environment: Deno.env.toObject(),
      }],
    });
  for (
    const [name, text] of Object.entries({
      "profiles.json": r,
      "manifest.json": m,
      "anchor.json": e,
    })
  ) {
    try {
      await Deno.chmod(join(capsule, name), 0o644);
    } catch {}
    await Deno.writeTextFile(join(capsule, name), text);
    await Deno.chmod(join(capsule, name), 0o444);
  }
  await Deno.chmod(capsule, 0o555);
}
const A = await import(
  toFileUrl(join(core, "runtime/assignment-authority.ts")).href
);
const reject = async (
  fn: () => Promise<unknown> | unknown,
  pattern = /BODY.PRODUCER_INPUT_(?:UNQUALIFIED|CHANGED)/,
) => {
  let s = "";
  try {
    await fn();
  } catch (e) {
    s = String(e);
  }
  if (!pattern.test(s)) throw Error("Expected bounded refusal: " + s);
};
try {
  await writeData();
  const handle = await A.openAssignmentAuthority(owner);
  if (
    handle.cost.authorityDataReads !== 4 ||
    handle.cost.authorityGraphHashReads !== 1 ||
    !Object.isFrozen(handle.profiles[0])
  ) throw Error("Reader cost/immutability");
  await A.assertAssignmentAuthority(handle, owner, undefined, true);
  const N = await import(
    toFileUrl(join(core, "runtime/assignment-admission.ts")).href
  );
  const operation = crypto.randomUUID(),
    capture = join(owner, "_generated/course-spec/native-ts", operation, "1");
  for (
    const source of ["index.qmd", "labs/bank.qmd", "delivery/units/work.qmd"]
  ) {
    const input = join(owner, source);
    const actualOwner = N.nativeAssignmentOwner(
      input,
      source,
      capture,
      operation,
    );
    if (actualOwner !== owner) throw Error("Document directory replaced owner");
    const selected = await N.nativeAssignmentProfile(
      profile.id,
      actualOwner,
      handle.identity,
    );
    if (selected.profile.root !== owner) {
      throw Error("Qualified profile owner changed");
    }
  }
  for (
    const [input, source, cap, op] of [
      [join(owner, "labs/bank.qmd"), "../bank.qmd", capture, operation],
      [join(owner, "labs/bank.qmd"), "/labs/bank.qmd", capture, operation],
      [join(owner, "labs/bank.qmd"), "bank.qmd", capture, operation],
      [
        join(owner, "labs/bank.qmd"),
        "labs/bank.qmd",
        join(base, "foreign/1"),
        operation,
      ],
      [
        join(owner, "labs/bank.qmd"),
        "labs/bank.qmd",
        capture,
        crypto.randomUUID(),
      ],
    ]
  ) await reject(() => N.nativeAssignmentOwner(input, source, cap, op));
  const foreign = join(base, "foreign");
  await Deno.mkdir(foreign);
  const foreignOwner = N.nativeAssignmentOwner(
    join(foreign, "bank.qmd"),
    "bank.qmd",
    join(foreign, "_generated/course-spec/native-ts", operation, "1"),
    operation,
  );
  await reject(() =>
    N.nativeAssignmentProfile(profile.id, foreignOwner, handle.identity)
  );
  await reject(() =>
    N.nativeAssignmentProfile("foreign-profile", owner, handle.identity)
  );

  await reject(() =>
    A.assertAssignmentAuthority(structuredClone(handle), owner)
  );
  await reject(() => A.assertAuthorityHost(handle, handle.profiles[0])); // cwd is the test repo, never a supported launcher.
  await reject(() => A.openAssignmentAuthority(base)); // capsule physically inside this owner, including any excluded cache.
  const info = await Deno.stat(join(capsule, "profiles.json"));
  await reject(() =>
    A.assertCapsuleIndependent(handle, [{
      path: join(owner, "alias"),
      signature: JSON.stringify([info.dev, info.ino]),
    }])
  );
  await Deno.chmod(capsule, 0o755);
  await Deno.writeTextFile(
    join(capsule, "injected.ts"),
    'throw Error("MUST_NOT_EXECUTE")',
  );
  await Deno.chmod(capsule, 0o555);
  await reject(() => A.openAssignmentAuthority(owner));
  await Deno.chmod(capsule, 0o755);
  await Deno.remove(join(capsule, "injected.ts"));
  await Deno.chmod(capsule, 0o555);
  await writeData((p) =>
    p.runtime.files.push({
      path: join(capsule, "profiles.json"),
      sha256: "0".repeat(64),
    })
  );
  await reject(() => A.openAssignmentAuthority(owner));
  await writeData();
  await Deno.chmod(join(capsule, "profiles.json"), 0o644);
  await Deno.writeTextFile(
    join(capsule, "profiles.json"),
    'not JSON; throw Error("MUST_NOT_EXECUTE")',
  );
  await Deno.chmod(join(capsule, "profiles.json"), 0o444);
  await reject(() => A.openAssignmentAuthority(owner));
  await writeData();
  const current = await A.openAssignmentAuthority(owner);
  await Deno.chmod(location, 0o644);
  await Deno.writeTextFile(location, lf + "\n");
  await Deno.chmod(location, 0o444);
  await reject(
    () => A.assertAssignmentAuthority(current, owner),
    /BODY.PRODUCER_INPUT_CHANGED/,
  );
  console.log(
    "PASS data-reader consistency, immutable/private handle, wrong launcher, owner overlap, hardlink, extra file, capsule-in-K, malformed JSON and same-id location mutation refusals. NO prior P/native profile qualification or native child.",
  );
} finally {
  await Deno.chmod(capsule, 0o755);
  await Deno.remove(base, { recursive: true });
}
