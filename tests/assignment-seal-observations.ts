// Уже наблюдённые dependencies должны пережить child → seal; graph discovery отсутствует.
import { join } from "stdlib/path";
const generation = Deno.args[0];
if (generation) {
  const complete = JSON.parse(
    await Deno.readTextFile(join(generation, "complete.json")),
  );
  const reservation = JSON.parse(
    await Deno.readTextFile(join(generation, "reservation.json")),
  );
  const observed = new Map<string, string>();
  for (const child of reservation.children) {
    const value = JSON.parse(
      await Deno.readTextFile(
        join(generation, "child-" + child.token + ".json"),
      ),
    );
    for (const row of value.state.assignment.runtime.implementationFiles) {
      observed.set(row.path, row.signature);
    }
  }
  const sealed = complete.state.assignment.runtime.implementationFiles;
  if (
    !observed.size || sealed.length !== observed.size ||
    sealed.some((row: any) => observed.get(row.path) !== row.signature)
  ) {
    throw Error(
      `Потеря наблюдённых dependencies при seal: child=${observed.size}, complete=${sealed.length}`,
    );
  }
  console.log(
    `PASS actual sealed implementation dependencies: ${sealed.length}`,
  );
} else {
  const { mergeAssignmentImplementationFiles, assertAssignmentRuntime } =
    await import("../_extensions/course-core/runtime/assignment-admission.ts");
  const before = [{ path: "/native/one.js", signature: "one" }];
  const child = [{ path: "/native/one.js", signature: "one" }, {
    path: "/native/two.js",
    signature: "two",
  }];
  const merged = mergeAssignmentImplementationFiles(before, child);
  if (
    merged.length !== 2 || merged[1].path !== "/native/two.js" ||
    before.length !== 1
  ) throw Error("Потеря/дублирование или мутация исходных observations");
  let conflict = "";
  try {
    mergeAssignmentImplementationFiles(merged, [{
      path: "/native/one.js",
      signature: "changed",
    }]);
  } catch (e) {
    conflict = String(e);
  }
  if (
    !conflict.includes("BODY.PRODUCER_INPUT_CHANGED") ||
    merged[0].signature !== "one"
  ) throw Error("Signature conflict принят или изменил прежний набор");
  const path = await Deno.makeTempFile({
    prefix: "observed-native-dependency-",
  });
  try {
    const { signature } = await import(
      "../_extensions/course-core/runtime/source-snapshot.ts"
    );
    const runtime = {
      executable: Deno.execPath(),
      profiles: ["full"],
      environment: {},
      outputDirectory: "/tmp/_generated/out",
      inputs: ["index.qmd"],
      implementationFiles: mergeAssignmentImplementationFiles([], [{
        path,
        signature: signature(await Deno.lstat(path)),
      }]),
    };
    await assertAssignmentRuntime(runtime, "/tmp", undefined, true);
    await Deno.writeTextFile(path, "Изменённые bytes");
    let changed = "";
    try {
      await assertAssignmentRuntime(runtime, "/tmp", undefined, true);
    } catch (e) {
      changed = String(e);
    }
    if (!changed.includes("BODY.PRODUCER_INPUT_CHANGED")) {
      throw Error("Изменённая observed dependency принята full fence");
    }
  } finally {
    await Deno.remove(path);
  }
  console.log(
    "PASS observed dependency merge/dedup/conflict и existing full currentness fence",
  );
}
