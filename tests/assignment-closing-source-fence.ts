// Data-only coverage: actual existing fence на своих файлах, не seal/producer replay.
import { dirname, join } from "stdlib/path";
import { CoreContractError } from "../_extensions/course-core/contracts/project.ts";
import {
  assertSources,
  signature,
} from "../_extensions/course-core/runtime/source-snapshot.ts";
import type { SourceSnapshotState } from "../_extensions/course-core/runtime/source-snapshot.ts";
async function fixture() {
  const root = await Deno.makeTempDir({ prefix: "closing-source-fence-" });
  const paths = [
    "index.qmd",
    "_quarto.yml",
    "banks/unselected.qmd",
    "_extensions/provider/vendor.js",
  ];
  const rows: SourceSnapshotState["rows"] = [];
  for (const path of paths) {
    await Deno.mkdir(dirname(join(root, path)), { recursive: true });
    await Deno.writeTextFile(join(root, path), "Исходные данные " + path);
    rows.push({
      path,
      signature: signature(await Deno.lstat(join(root, path))),
      sha256: "not-read-by-signature-fence",
    });
  }
  const state: SourceSnapshotState = {
    root,
    outputDirectory: join(root, "_generated/output"),
    rows,
    relevantInputs: ["index.qmd"],
    ownerInputs: ["index.qmd"],
    memberships: {
      "": ["_extensions", "_quarto.yml", "banks", "index.qmd"],
      _extensions: ["provider"],
      "_extensions/provider": ["vendor.js"],
      banks: ["unselected.qmd"],
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
  return { root, state };
}
for (
  const name of [
    "unchanged",
    "source",
    "config",
    "unselected",
    "vendor",
    "addition",
    "metadata-addition",
    "symlink",
  ]
) {
  const { root, state } = await fixture();
  try {
    await assertSources(state, [], false);
    // Только raw selected QMD связан с initial provenance; actual metadata принадлежит render.
    if (["source", "config", "unselected", "vendor"].includes(name)) {
      const path = name === "source"
        ? "index.qmd"
        : name === "config"
        ? "_quarto.yml"
        : name === "unselected"
        ? "banks/unselected.qmd"
        : "_extensions/provider/vendor.js";
      await Deno.writeTextFile(
        join(root, path),
        "Изменённые данные другой длины " + name,
      );
    } else if (name === "addition") {
      await Deno.writeTextFile(join(root, "new.qmd"), "Новое содержимое");
    } else if (name === "metadata-addition") {
      await Deno.writeTextFile(
        join(root, "_metadata.yml"),
        "title: Native actual metadata\n",
      );
    } else if (name === "symlink") {
      const path = join(root, "index.qmd");
      await Deno.remove(path);
      await Deno.symlink(join(root, "banks/unselected.qmd"), path);
    }
    let error: unknown;
    try {
      await assertSources(state, [], false);
    } catch (cause) {
      error = cause;
    }
    if (
      [
          "unchanged",
          "config",
          "unselected",
          "vendor",
          "addition",
          "metadata-addition",
        ].includes(name)
        ? error !== undefined
        : !(error instanceof CoreContractError) ||
          error.code !== "OPERATION_CHANGED"
    ) {
      throw Error(name + ": " + String(error));
    }
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}
console.log(
  "PASS selected raw-QMD closing; metadata/cache/siblings принимаются, source/symlink отказаны; zero render/inspect/hash",
);
