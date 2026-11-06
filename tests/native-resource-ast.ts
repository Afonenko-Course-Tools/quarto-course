import {
  fixtureOperation,
  renderFixture,
} from "./helpers/native-operation-a3.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";

const assert = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const extension = fromFileUrl(
  new URL("../_extensions/course-core/", import.meta.url),
);
const lua = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
  args: [
    "pandoc",
    "--lua-filter",
    fromFileUrl(new URL("native-resource-ast.lua", import.meta.url)),
    "--to",
    "plain",
  ],
  cwd: extension,
  stdin: "null",
  stdout: "piped",
  stderr: "piped",
}).output();
console.log(new TextDecoder().decode(lua.stdout));
assert(lua.success, new TextDecoder().decode(lua.stderr));

const root = await Deno.makeTempDir({ prefix: "native-resource-ast-" });
async function put(path: string, bytes: string | Uint8Array) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  if (typeof bytes === "string") {
    await Deno.writeTextFile(join(root, path), bytes);
  } else await Deno.writeFile(join(root, path), bytes);
}
// Обычный PNG остаётся opaque asset: Core не декодирует и не переписывает bytes.
const png = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
  ),
  (c) => c.charCodeAt(0),
);
await put(
  "_quarto.yml",
  "project:\n  type: website\n  output-dir: _site\nformat:\n  html:\n    theme: none\n",
);
await put(
  "index.qmd",
  `::: {#exr-native difficulty=introductory statement-visibility=open}
Полное условие с ![пикселем](native.png) и [материалом](native.txt).

<img src="raw-block.png"><a href="raw-block.txt">HTML-блок</a>

Встроенный HTML: <img src="raw-inline.png"><a href="raw-inline.txt">HTML</a>.
:::
`,
);
for (const name of ["native.png", "raw-block.png", "raw-inline.png"]) {
  await put(name, png);
}
for (const name of ["native.txt", "raw-block.txt", "raw-inline.txt"]) {
  await put(name, "Обычный материал.\n");
}
await renderFixture(root);
await fixtureOperation(root, async (operation) => {
  const inventory = await operation.resourceFiles({
    files: [
      { source: "native.png", target: "assets/native.png" },
      { source: "native.txt", target: "assets/native.txt" },
    ],
  });
  assert(
    inventory.files.length === 2 &&
      inventory.files[0].target === "assets/native.png" &&
      inventory.files[0].bytes.length === png.length &&
      inventory.files[0].bytes.every((byte, i) => byte === png[i]) &&
      new TextDecoder().decode(inventory.files[1].bytes) ===
        "Обычный материал.\n",
    "Native Image/Link или исходные opaque bytes потеряны",
  );
  for (
    const source of [
      "raw-block.png",
      "raw-block.txt",
      "raw-inline.png",
      "raw-inline.txt",
    ]
  ) {
    let error = "";
    try {
      await operation.resourceFiles({
        files: [{ source, target: "assets/" + source }],
      });
    } catch (cause) {
      error = String(cause);
    }
    assert(
      error.includes("RESOURCE_PRIVATE_OR_SOURCE"),
      "HTML-атрибут стал ресурсом Core: " + source + "; " + error,
    );
  }
});
console.log(
  JSON.stringify({
    status: "PASS",
    root,
    checks: [
      "RawBlock/RawInline не создают Core resources",
      "native Image/Link и opaque PNG bytes сохранены",
    ],
  }),
);
