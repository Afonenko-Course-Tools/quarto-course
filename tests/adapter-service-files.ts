// Resource classification only: synthetic envelopes are not completion evidence.
// Actual owner capture/render/finish is exercised separately by adapter-owner.ts.
import { join } from "stdlib/path";
import { coreServiceResourceFiles } from "../_extensions/course-core/owner-preflight/resources.ts";
import { sha } from "../_extensions/course-core/owner-preflight/owner/runtime.ts";
import type { Session } from "../_extensions/course-core/owner-preflight/owner/protocol.ts";
const root = await Deno.makeTempDir({ prefix: "adapter-service-files-" });
const source = "index.qmd";
function session(directory: string, adapter = "cloud"): Session {
  const native = {
    config: {
      filters: ["course-core", "course-" + adapter],
      course: { adapters: [adapter] },
    },
    files: { input: [join(directory, source)] },
  };
  return {
    protocol: 1,
    attemptId: "classifier-only",
    sessionId: "classifier-only",
    extension: "",
    quarto: "",
    files: {},
    headers: [],
    identityHashes: {},
    identityReaders: {},
    readerInputHashes: {},
    root: directory,
    profile: "full",
    validated: false,
    captures: {},
    captureHashes: {},
    captureProjections: {},
    captureProjectionHash: "",
    identities: {},
    identityReplays: {},
    readerInputs: {},
    audit: {
      root: directory,
      coverage: {
        [source]: {
          kind: "root",
          profiles: ["full"],
          evidence: "native input",
        },
      },
      profiles: { full: native },
      excluded: [],
      dependencies: {},
    },
  };
}
async function write(directory: string, path: string, value: unknown) {
  const file = join(directory, path);
  await Deno.mkdir(file.slice(0, file.lastIndexOf("/")), { recursive: true });
  await Deno.writeTextFile(
    file,
    typeof value === "string" ? value : JSON.stringify(value),
  );
}
async function expect(s: Session, path: string, valid: boolean) {
  let failure: any;
  let files: Awaited<ReturnType<typeof coreServiceResourceFiles>> = [];
  try {
    files = await coreServiceResourceFiles(s);
  } catch (e) {
    failure = e;
  }
  if (
    valid
      ? failure || !files.some((f) => f.path === path && f.origin === "service")
      : failure?.code !== "RESOURCE.SERVICE_PRODUCER_UNSUPPORTED"
  ) throw new Error(JSON.stringify({ path, valid, failure }));
}
try {
  for (const adapter of ["cloud", "prairielearn"]) {
    const directory = join(root, adapter);
    const path = `_generated/course-spec/${adapter}/${await sha(source)}.json`;
    await write(directory, path, { source, exercises: [] });
    const s = session(directory, adapter);
    await expect(s, path, true);
    await write(directory, path, { source: "other.qmd", exercises: [] });
    await expect(s, path, false);
    await write(directory, path, "not JSON");
    await expect(s, path, false);
    await write(directory, path, { source, exercises: [] });
    s.audit.profiles.full.config.filters.push("course-presentation");
    await expect(s, path, true);
    s.audit.profiles.full.config.filters.pop();
    s.audit.profiles.full.files.input = [];
    await expect(s, path, false);
    s.audit.profiles.full.files.input = [join(directory, source)];
    s.audit.coverage[source].profiles = ["student"];
    await expect(s, path, false);
    s.audit.coverage[source].profiles = ["full"];
    s.audit.coverage[source].kind = "include";
    await expect(s, path, false);
    s.audit.coverage[source].kind = "root";
    s.audit.profiles.full.config.course.adapters = [];
    await expect(s, path, false);
    s.audit.profiles.full.config.course.adapters = [adapter];
    s.audit.profiles.full.config.filters.reverse();
    await expect(s, path, false);
    s.audit.profiles.full.config.filters.reverse();
    for (
      const extra of [
        "unknown/random.json",
        `${adapter}/renamed.json`,
        `${adapter === "cloud" ? "prairielearn" : "cloud"}/${await sha(
          source,
        )}.json`,
      ]
    ) {
      const unknown = `_generated/course-spec/${extra}`;
      await write(directory, unknown, { source, exercises: [] });
      await expect(s, unknown, false);
      await Deno.remove(join(directory, unknown));
    }
    await expect(s, path, true);
    console.log(
      "PASS exact " + adapter +
        " resource binding and negative producer controls",
    );
  }
  const parentRoot = join(root, "parent");
  const childRoot = join(parentRoot, "child");
  const child = session(childRoot, "prairielearn");
  const parent = session(parentRoot, "cloud");
  parent.audit.navigation = {
    members: [{ path: "child", native: child.audit.profiles.full }],
  } as any;
  const fragment = `_generated/course-spec/prairielearn/${await sha(
    source,
  )}.json`;
  await write(childRoot, fragment, { source, exercises: [] });
  await expect(parent, "child/" + fragment, true);
  const renamed = "_generated/course-spec/prairielearn/renamed.json";
  await write(childRoot, renamed, { source, exercises: [] });
  await expect(parent, "child/" + renamed, false);
  await Deno.remove(join(childRoot, renamed));
  await write(childRoot, fragment, { source: "other.qmd", exercises: [] });
  await expect(parent, "child/" + fragment, false);
  console.log(
    "PASS child scope uses its own selected native adapter and exact source binding",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
