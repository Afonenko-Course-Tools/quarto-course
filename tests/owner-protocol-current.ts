// Completed native evidence is required; never substitute a fabricated session.
import { join, toFileUrl } from "stdlib/path";
const evidence = Deno.args[0];
if (!evidence) {
  throw new Error(
    "usage: owner-protocol-current.ts completed-owner-bodies-evidence",
  );
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const finished = JSON.parse(
  await Deno.readTextFile(join(evidence, "finished.json")),
);
const handle = finished.report.body;
const prepared = JSON.parse(
  await Deno.readTextFile(join(evidence, "prepared.json")),
);
const api = await import(
  toFileUrl(
    join(handle.root, "_extensions/course-core/owner-preflight/owner.ts"),
  ).href
);
const session = await api.preparedSession(prepared);
const receipt = JSON.parse(await Deno.readTextFile(handle.receiptPath));
// Independent finite obligations: never derive this set from producer.modules.
const requiredModules = [
  "failure.ts",
  "protocol.ts",
  "runtime.ts",
  "source-audit.ts",
  "validation-scope.ts",
  "async-hooks.d.ts",
  "session.ts",
];
for (const name of requiredModules) {
  const path = session.extension + "/owner-preflight/owner/" + name;
  assert(
    receipt.modules[path] && receipt.modules[path] === session.files[path],
    "Body receipt omitted frozen owner module: " + name,
  );
}
for (const name of requiredModules) {
  const path = session.extension + "/owner-preflight/owner/" + name;
  const absolute = join(handle.root, path);
  const original = await Deno.readFile(absolute);
  assert(
    await api.digestFile(absolute) === receipt.modules[path],
    "Attested owner module bytes differ: " + name,
  );
  try {
    const changed = new Uint8Array(original.length + 1);
    changed.set(original);
    changed[original.length] = 32;
    await Deno.writeFile(absolute, changed);
    try {
      await api.validateOwnerBodies(prepared, handle);
      throw new Error("Changed owner module accepted: " + name);
    } catch (error) {
      assert(
        error instanceof api.OwnerFailure &&
          (error as { code?: string }).code === "SOURCE.FROZEN_INPUT_CHANGED",
        "Unexpected current module refusal: " + name + ": " + error,
      );
    }
    console.log("PASS current Body rejects " + name + " byte mutation");
  } finally {
    await Deno.writeFile(absolute, original);
  }
}
await api.validateOwnerBodies(prepared, handle);
console.log(
  "PASS complete owner leaf attestation and restored current Body; no engine rerun",
);
