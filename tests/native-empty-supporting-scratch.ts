// Existing signature/membership fence на малых собственных файлах; без hash/inspect/render.
import { join } from "stdlib/path";
import {
  assertSources,
  signature,
} from "../_extensions/course-core/runtime/source-snapshot.ts";
import type { SourceSnapshotState } from "../_extensions/course-core/runtime/source-snapshot.ts";
async function fixture() {
  const root = await Deno.makeTempDir({ prefix: "native-empty-scratch-" });
  const input = "chapters/another-input.qmd",
    scratch = "chapters/another-input_files";
  await Deno.mkdir(join(root, scratch, "mediabag"), { recursive: true });
  await Deno.writeTextFile(join(root, input), "# Авторский Source\n");
  const state: SourceSnapshotState & { ownerInputs: string[] } = {
    root,
    outputDirectory: join(root, "_generated/output"),
    ownerInputs: [input],
    relevantInputs: [input],
    rows: [{
      path: input,
      signature: signature(await Deno.lstat(join(root, input))),
      sha256: "not-read-by-signature-fence",
    }],
    memberships: {
      "": ["chapters"],
      chapters: ["another-input.qmd", "another-input_files"],
      [scratch]: ["mediabag"],
      [scratch + "/mediabag"]: [],
    },
    metrics: {
      fullWalks: 0,
      sourceDirectoryReads: 0,
      sourceHashReads: 0,
      sourceHashBytes: 0,
      fullSourceFences: 0,
      localSourceFences: 0,
    },
  };
  return { root, input, scratch, state };
}
async function refuses(
  use: (f: Awaited<ReturnType<typeof fixture>>) => Promise<void>,
) {
  const f = await fixture();
  try {
    await use(f);
    let refused = false;
    try {
      await assertSources(f.state);
    } catch (e) {
      refused = e instanceof Deno.errors.NotFound ||
        e instanceof Error && e.message.includes("OPERATION_CHANGED");
    }
    if (!refused) throw Error("Source/data/unknown-directory change принят");
  } finally {
    await Deno.remove(f.root, { recursive: true });
  }
}
const f = await fixture();
try {
  await Deno.remove(join(f.root, f.scratch), { recursive: true });
  await assertSources(f.state, [], false);
  await assertSources(f.state);
} finally {
  await Deno.remove(f.root, { recursive: true });
}
await refuses(async ({ root, input }) => {
  await Deno.writeTextFile(
    join(root, input),
    "Изменённый авторский Source с другими bytes\n",
  );
});
await refuses(async ({ root, scratch, state }) => {
  state.ownerInputs = [];
  await Deno.remove(join(root, scratch), { recursive: true });
});
await refuses(async ({ root, state }) => {
  state.memberships.chapters.push("notes");
  state.memberships.chapters.sort();
  state.memberships["chapters/notes"] = [];
  // В baseline была чужая пустая папка; в actual она отсутствует.
  await Deno.mkdir(join(root, "chapters/notes"));
  await Deno.remove(join(root, "chapters/notes"));
});
await refuses(async ({ root }) => {
  await Deno.mkdir(join(root, "chapters/new-authored-folder"));
});
await refuses(async ({ root, scratch }) => {
  await Deno.writeTextFile(join(root, scratch, "new-data.txt"), "Новые данные");
});
await refuses(async ({ root, scratch, state }) => {
  const path = scratch + "/keep.txt";
  await Deno.writeTextFile(join(root, path), "Данные baseline");
  state.rows.push({
    path,
    signature: signature(await Deno.lstat(join(root, path))),
    sha256: "not-read-by-signature-fence",
  });
  state.memberships[scratch].push("keep.txt");
  state.memberships[scratch].sort();
  await Deno.remove(join(root, scratch), { recursive: true });
});
await refuses(async ({ root, scratch }) => {
  await Deno.remove(join(root, scratch), { recursive: true });
  await Deno.symlink("/tmp", join(root, scratch));
});
await refuses(async ({ root, scratch, state }) => {
  state.memberships[scratch].push("authored-empty");
  state.memberships[scratch].sort();
  state.memberships[scratch + "/authored-empty"] = [];
  await Deno.mkdir(join(root, scratch, "authored-empty"));
  await Deno.remove(join(root, scratch), { recursive: true });
});
console.log(
  "PASS empty native supporting corridor removal; Source bytes/data/additions/unknown-folder/owner-binding/alias negatives; zero hash/inspect/render",
);
