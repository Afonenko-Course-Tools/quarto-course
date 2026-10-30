import * as Core from "../../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const extension = join(
  dirname(dirname(dirname(fromFileUrl(import.meta.url)))),
  "_extensions/course-core",
);
/** Только автор fixture: настоящий production producer и публичный loader. */
export async function renderFixture(root: string) {
  const path = join(root, "_quarto.yml");
  let config = await Deno.readTextFile(path);
  config = config.replace(
    "project:\n",
    `project:\n  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]\n  post-render: [quarto run ${extension}/entrypoints/native-post.ts]\n`,
  );
  if (!config.includes("output-dir:")) {
    config = config.replace("project:\n", "project:\n  output-dir: _site\n");
  }
  config = config.replace("type: default", "type: website");
  config +=
    "\ncourse-core-runtime: native-ts\ncourse-core-role: exercise-bank\n";
  if (!config.includes("course-core-projection:")) {
    config += "course-core-projection: student\n";
  }
  if (!config.includes("filters:")) {
    config +=
      `filters:\n  - at: pre-ast\n    path: ${extension}/native-ts/early-context.lua\n  - at: post-quarto\n    path: ${extension}/native-ts/late-kind.lua\n  - at: post-render\n    path: ${extension}/native-ts/late-filter.lua\n`;
  }
  await Deno.writeTextFile(path, config);
  const result = await new Deno.Command("quarto", {
    args: ["render", "index.qmd", "--to", "html"],
    cwd: root,
    env: {
      QUARTO_RUN_NO_NETWORK: "true",
      DENO_NO_PACKAGE_JSON: "1",
      CUE: "/nonexistent-a3-fix-cue",
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  await Deno.writeTextFile(
    join(root, "_generated/qualification-render.log"),
    new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr),
  );
  if (!result.success) {
    throw Error(
      "Native fixture render failed: " + root +
        "/_generated/qualification-render.log",
    );
  }
  return result;
}
export function fixtureOperation<T>(
  root: string,
  use: (operation: Core.NativeOperation) => Promise<T>,
) {
  return Core.withCurrentNativeOperation({
    root,
    profiles: [],
    projection: "student",
    outputDirectory: join(root, "_site"),
  }, use);
}
