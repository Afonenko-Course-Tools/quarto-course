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
    relevantInputs: ["index.qmd", "_quarto.yml"],
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
    "symlink",
  ]
) {
  const { root, state } = await fixture();
  try {
    await assertSources(state, [], false);
    // Изменение после baseline и через await: closing должен видеть иной S.
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
      await Deno.writeTextFile(join(root, "banks/new.qmd"), "Новое содержимое");
    } else if (name === "symlink") {
      const path = join(root, "_extensions/provider/vendor.js");
      await Deno.remove(path);
      await Deno.symlink(join(root, "index.qmd"), path);
    }
    if (["unselected", "vendor", "addition", "symlink"].includes(name)) {
      // Эти edits вне relevant rows и их membership ancestors: local их не квалифицирует.
      await assertSources(state, [], false);
    }
    let error: unknown;
    try {
      await assertSources(state);
    } catch (cause) {
      error = cause;
    }
    if (
      name === "unchanged"
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
  "PASS data-only closing Source fence: relevant source/config и edits вне local scope; zero render/inspect/hash",
);
