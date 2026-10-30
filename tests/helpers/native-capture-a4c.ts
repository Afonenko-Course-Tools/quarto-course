import { dirname, fromFileUrl, join } from "stdlib/path";
const extension = join(
  dirname(dirname(dirname(fromFileUrl(import.meta.url)))),
  "_extensions/course-core",
);
export const captureTokenEnvironment = "COURSE_CORE_CAPTURE_TOKEN";
export async function captureFixture(
  options: {
    group?: boolean;
    collision?: boolean;
    preparationFailure?: boolean;
  } = {},
) {
  const root = await Deno.makeTempDir({ prefix: "a4c-scope-case-" });
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    `project:
  type: website
  render: [index.qmd, slides.qmd]
  output-dir: _site
  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts${
      options.preparationFailure ? ", quarto run fail.ts" : ""
    }]
  post-render: [quarto run ${extension}/entrypoints/native-post.ts]
profile:
  default: student
${options.group ? "  group: [[student,full], [extra,other]]\n" : ""}format:
  revealjs: {theme: simple}
course: {id: scope-course, view: student}
course-core-runtime: native-ts
course-core-role: page
filters:
  - at: pre-ast
    path: ${extension}/native-ts/early-context.lua
  - at: post-quarto
    path: ${extension}/native-ts/late-kind.lua
  - at: post-render
    path: ${extension}/native-ts/late-filter.lua
`,
  );
  await Deno.writeTextFile(
    join(root, "_quarto-student.yml"),
    "course: {view: student}\n",
  );
  await Deno.writeTextFile(
    join(root, "_quarto-full.yml"),
    "course: {view: full}\n",
  );
  await Deno.writeTextFile(join(root, "_quarto-extra.yml"), "lang: ru\n");
  await Deno.writeTextFile(join(root, "_quarto-other.yml"), "lang: ru\n");
  const output = options.collision ? "output-file: _site/shared.html\n" : "";
  await Deno.writeTextFile(
    join(root, "index.qmd"),
    `---\nformat: html\n${output}---\n# Страница\n\nNative HTML.\n`,
  );
  await Deno.writeTextFile(
    join(root, "slides.qmd"),
    `---\n${output}title: Слайды\n---\n# Слайды\n\nNative revealjs.\n`,
  );
  if (options.preparationFailure) {
    await Deno.writeTextFile(
      join(root, "fail.ts"),
      "throw Error('A4C_PREPARATION_FAILURE');\n",
    );
  }
  return {
    root,
    projection: "student" as const,
    outputDirectory: join(root, "_site"),
  };
}
export async function childRender(
  root: string,
  source: string,
  token: string,
  env: Record<string, string> = {},
  args: string[] = [],
) {
  const result = await new Deno.Command("quarto", {
    args: [
      "render",
      source,
      "--to",
      source === "index.qmd" ? "html" : "revealjs",
      ...args,
    ],
    cwd: root,
    env: {
      [captureTokenEnvironment]: token,
      QUARTO_RUN_NO_NETWORK: "true",
      DENO_NO_PACKAGE_JSON: "1",
      ...env,
    },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const log = new TextDecoder().decode(result.stdout) +
    new TextDecoder().decode(result.stderr);
  await Deno.mkdir(join(root, "_generated"), { recursive: true });
  await Deno.writeTextFile(
    join(root, "_generated", `test-${crypto.randomUUID()}.log`),
    log,
  );
  if (!result.success) {
    throw Error("A4C_NATIVE_CHILD_FAILED " + root + "\n" + log);
  }
  return result;
}
