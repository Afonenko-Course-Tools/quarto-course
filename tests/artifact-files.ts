import { join } from "stdlib/path";
import {
  ArtifactFilesSchema,
  writeArtifactFiles,
} from "../_extensions/course-core/public.ts";
const assert = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const root = await Deno.makeTempDir({ prefix: "artifact-files-" });
try {
  const payload = ArtifactFilesSchema.parse({
    exerciseId: "exr-test",
    audience: "student",
    files: [{
      target: "src/Main.java",
      audience: "student",
      reason: "starter",
      bytes: new TextEncoder().encode("class Main {}"),
    }],
  });
  payload.files[0].bytes[0] = 47;
  const written = await writeArtifactFiles(payload, join(root, "output"));
  assert(
    written.files === 1 && written.bytes === 13,
    "Неверные результаты файлового writer",
  );
  assert(
    (await Deno.readTextFile(join(root, "output/src/Main.java"))).startsWith(
      "/lass",
    ),
    "Writer не использовал переданные bytes",
  );
  for (
    const files of [
      [{
        target: "../outside",
        audience: "student",
        reason: "starter",
        bytes: new Uint8Array(),
      }],
      [{
        target: "same",
        audience: "student",
        reason: "starter",
        bytes: new Uint8Array(),
      }, {
        target: "same/nested",
        audience: "student",
        reason: "starter",
        bytes: new Uint8Array(),
      }],
      [{
        target: "author/reference/Main.java",
        audience: "student",
        reason: "reference",
        bytes: new Uint8Array(),
      }],
      [{
        target: "src/Private.java",
        audience: "full",
        reason: "reference",
        bytes: new Uint8Array(),
      }],
    ]
  ) {
    const result = ArtifactFilesSchema.safeParse({
      exerciseId: "exr-test",
      audience: "student",
      files,
    });
    assert(
      !result.success,
      "Файловый contract пропустил containment/collision/privacy violation",
    );
  }
  let rejected = false;
  try {
    await writeArtifactFiles(payload, join(root, "output"));
  } catch (e) {
    rejected = String(e).includes("ARTIFACT_OUTPUT");
  }
  assert(rejected, "Writer перезаписал существующий destination");
  console.log(
    "PASS artifact files: actual bytes, target collision/containment/private roles, new destination",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
