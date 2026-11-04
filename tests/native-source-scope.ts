import { join } from "stdlib/path";
import {
  excluded,
  regular,
} from "../_extensions/course-core/runtime/source-paths.ts";
const root = await Deno.makeTempDir({ prefix: "native-source-scope-" });
try {
  await Deno.mkdir(join(root, "selected"));
  await Deno.writeTextFile(join(root, "selected/input.qmd"), "Вход");
  await Deno.symlink(root, join(root, "unrelated-link"));
  const original = Deno.readDir;
  Deno.readDir = () => {
    throw Error("Обход дерева не разрешён");
  };
  try {
    const file = await regular(root, "selected/input.qmd");
    if (file !== join(root, "selected/input.qmd")) {
      throw Error("Потерян выбранный вход");
    }
    await Deno.writeTextFile(file, "Изменённый вход");
    await regular(root, "selected/input.qmd");
  } finally {
    Deno.readDir = original;
  }
  for (
    const path of [
      "../escape",
      "/absolute",
      "selected/../input",
      "unrelated-link/selected/input.qmd",
    ]
  ) {
    let failed = false;
    try {
      await regular(root, path);
    } catch {
      failed = true;
    }
    if (!failed) throw Error("Принят небезопасный путь: " + path);
  }
  if (
    !excluded(
      { root, outputDirectory: join(root, "_site") },
      join(root, "_generated/data"),
    )
  ) throw Error("Служебный каталог открыт");
  if (
    !excluded(
      { root, outputDirectory: join(root, "published") },
      join(root, "published/sub/file"),
    )
  ) throw Error("Вложенный output открыт");
  console.log(
    "PASS selected native source path scope, no tree discovery/freshness, unsafe path refusal",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
