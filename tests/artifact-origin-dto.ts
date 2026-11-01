import * as Core from "../_extensions/course-core/public.ts";
import { join } from "stdlib/path";
const output = await Deno.makeTempDir({ prefix: "artifact-origin-dto-" }),
  bytes = new TextEncoder().encode("SUPPLIED_BYTES"),
  hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  ).map((v) => v.toString(16).padStart(2, "0")).join("");
// A syntactically valid locator in serialized DATA is deliberately not authenticated.
const data = {
  schema: "course-artifact-inventory-v1",
  operation: crypto.randomUUID(),
  exerciseId: "exr-dto",
  audience: "student",
  files: [{
    target: "main.txt",
    rawSource: "unknown/missing/source.txt",
    sha256: hash,
    size: bytes.length,
    bytes: Array.from(bytes),
    audience: "student",
    reason: "caller-data",
  }],
};
const copy = JSON.parse(JSON.stringify(data));
copy.files[0].bytes = new Uint8Array(copy.files[0].bytes);
const actualRead = Deno.readFile, actualText = Deno.readTextFile;
let reads = 0;
(Deno as any).readFile = (...args: any[]) => {
  reads++;
  return (actualRead as any)(...args);
};
(Deno as any).readTextFile = (...args: any[]) => {
  reads++;
  return (actualText as any)(...args);
};
try {
  const inventory = Core.ArtifactInventorySchema.parse(copy);
  await Core.writeArtifactInventory(inventory, join(output, "data-only"));
  if (reads) throw Error("Serialized origin caused source IO");
} finally {
  (Deno as any).readFile = actualRead;
  (Deno as any).readTextFile = actualText;
}
try {
  if (
    new TextDecoder().decode(
      await Deno.readFile(join(output, "data-only/main.txt")),
    ) !== "SUPPLIED_BYTES"
  ) throw Error("Writer used locator instead of supplied bytes");
  let missing = false;
  try {
    await Deno.stat(join(output, "data-only/unknown/missing/source.txt"));
  } catch (e) {
    missing = e instanceof Deno.errors.NotFound;
  }
  if (!missing) throw Error("Origin entered written tree");
  console.log(
    "PASS serialized unknown rawSource is unauthenticated data: writer reads ZERO source files and writes only supplied target/bytes; no I/O or currentness authority",
  );
} finally {
  await Deno.remove(output, { recursive: true });
}
