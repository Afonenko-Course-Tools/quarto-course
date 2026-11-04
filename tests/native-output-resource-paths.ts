import {
  finishedNativeResource,
  nativeResourceHandleIdentity,
} from "../_extensions/course-core/runtime/native-output-resources.ts";
import { assignmentRolePredicate } from "../_extensions/course-core/runtime/assignment-roles.ts";
import { join } from "stdlib/path";

const root = await Deno.makeTempDir({ prefix: "native-output-resource-paths-" });
const outside = await Deno.makeTempDir({ prefix: "native-output-resource-outside-" });
const owner = { root, outputDirectory: join(root, "_site") };
const source = "assets/figure.svg";
const input = join(root, source), output = join(owner.outputDirectory, source);
const closed = join(root, "private/figure.svg");
async function refused(use: () => Promise<unknown>) {
  let error = "";
  try {
    await use();
  } catch (cause) {
    error = String(cause);
  }
  if (!/RESOURCE_PATH|OPERATION_CHANGED|BODY.RESOURCE_PRIVATE_ROLE/.test(error)) {
    throw Error("Ожидался отказ resource path/privacy: " + error);
  }
}
try {
  for (const directory of ["assets", "private", "_site/assets"]) {
    await Deno.mkdir(join(root, directory), { recursive: true });
  }
  await Deno.writeTextFile(closed, "Закрытый original");
  await Deno.link(closed, input);
  await Deno.copyFile(input, output);
  const captured = await finishedNativeResource(owner, source);
  const closedInfo = await Deno.lstat(closed);
  const assertClosedAssociation = async () => {
    const finished = await finishedNativeResource(owner, source, captured.sourceIdentities);
    const gate = assignmentRolePredicate([{
      path: closed,
      tree: false,
      public: false,
      reason: "solutions.path",
    }], [], [
      { path: closed, identity: JSON.stringify([closedInfo.dev, closedInfo.ino]) },
      ...finished.sourceIdentities.map((identity) => ({ path: input, identity })),
      { path: input, identity: finished.identity },
    ]);
    await refused(async () => gate(input));
  };
  await Deno.remove(input);
  await assertClosedAssociation();
  await Deno.writeTextFile(input, "Новый regular source после hooks");
  await assertClosedAssociation();

  // Законная regular rewrite до первого чтения не обязана сохранять прежний inode.
  const replacement = join(root, "_site/replacement.svg");
  await Deno.writeTextFile(replacement, "Конечный regular output");
  await Deno.rename(replacement, output);
  const current = await finishedNativeResource(owner, source);
  const opened = await Deno.open(current.path, { read: true });
  try {
    await nativeResourceHandleIdentity(root, current.path, opened);
    const bytes = new Uint8Array(1024);
    const length = await opened.read(bytes);
    if (new TextDecoder().decode(bytes.subarray(0, length ?? 0)) !== "Конечный regular output") {
      throw Error("Не прочитан конечный regular output");
    }
  } finally {
    opened.close();
  }

  const foreign = join(outside, "foreign.svg");
  await Deno.writeTextFile(foreign, "Вне owner");
  const foreignHandle = await Deno.open(foreign, { read: true });
  try {
    await refused(() => nativeResourceHandleIdentity(root, output, foreignHandle));
  } finally {
    foreignHandle.close();
  }
  // Постоянная подмена после open: handle остаётся regular, pathname стал symlink.
  const beforeSwap = await Deno.open(output, { read: true });
  try {
    await Deno.remove(output);
    await Deno.symlink(foreign, output);
    await refused(() => nativeResourceHandleIdentity(root, output, beforeSwap));
  } finally {
    beforeSwap.close();
  }
  console.log("PASS конечный regular output, closed source association и actual handle path");
} finally {
  await Deno.remove(root, { recursive: true });
  await Deno.remove(outside, { recursive: true });
}
