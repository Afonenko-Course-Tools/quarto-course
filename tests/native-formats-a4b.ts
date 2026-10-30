import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const extension = join(
  dirname(dirname(fromFileUrl(import.meta.url))),
  "_extensions/course-core",
);
const checks: { name: string; passed: boolean }[] = [];
function check(name: string, passed: boolean) {
  checks.push({ name, passed });
  if (!passed) throw Error(name);
}
for (const format of ["revealjs", "html"] as const) {
  for (const projection of ["student", "author"] as const) {
    const root = await Deno.makeTempDir({ prefix: "a4b-format-native-" });
    await Deno.writeTextFile(
      join(root, "_quarto.yml"),
      `project:\n  type: website\n  render: [index.qmd]\n  output-dir: _site\n  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]\n  post-render: [quarto run ${extension}/entrypoints/native-post.ts]\nformat:\n  ${format}:\n    theme: ${
        format === "html" ? "none" : "simple"
      }\ncourse: {id: formats-course, view: ${
        projection === "student" ? "student" : "full"
      }}\ncourse-core-runtime: native-ts\ncourse-core-role: exercise-bank\nexercise-defaults: {difficulty: introductory, statement-visibility: open}\nfilters:\n  - at: pre-ast\n    path: ${extension}/native-ts/early-context.lua\n  - at: post-quarto\n    path: ${extension}/native-ts/late-kind.lua\n  - at: post-render\n    path: ${extension}/native-ts/late-filter.lua\n`,
    );
    await Deno.writeTextFile(
      join(root, "fragment.qmd"),
      "Включённый **native текст**.\n",
    );
    await Deno.writeTextFile(
      join(root, "index.qmd"),
      `# Тест\n\n::: {#exr-native}\n## Условие\n\n{{< include fragment.qmd >}}\n\n::: {.content-visible when-format=${format}}\nFORMAT_VISIBLE\n:::\n\n::: {.content-visible unless-format=${format}}\nWRONG_FORMAT\n:::\n\n::: {.solution}\nPRIVATE_SOLUTION\n:::\n:::\n`,
    );
    const result = await new Deno.Command("quarto", {
      args: ["render", "--to", format],
      cwd: root,
      env: {
        DENO_NO_PACKAGE_JSON: "1",
        QUARTO_RUN_NO_NETWORK: "true",
        CUE: "/nonexistent-a4b-cue",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const log = new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr);
    await Deno.mkdir(join(root, "_generated"), { recursive: true });
    await Deno.writeTextFile(join(root, "_generated/qualification.log"), log);
    check(
      `${format}/${projection}: actual native render`,
      result.success || (console.error(log), false),
    );
    const expectation = {
      root,
      format,
      projection,
      profiles: [],
      outputDirectory: join(root, "_site"),
    };
    await Core.withCurrentNativeOperation(expectation, async (op) => {
      check(
        `${format}/${projection}: exact native identity`,
        op.identity.format === format,
      );
      const d = op.document({ source: "index.qmd" }),
        condition = op.condition({
          source: "index.qmd",
          exerciseId: "exr-native",
          view: projection,
        });
      check(
        `${format}/${projection}: native late transformations`,
        JSON.stringify(condition.body).includes("Включённый") &&
          JSON.stringify(condition.body).includes("FORMAT_VISIBLE") &&
          !JSON.stringify(condition.body).includes("WRONG_FORMAT"),
      );
      check(
        `${format}/${projection}: full solution`,
        JSON.stringify(d).includes("PRIVATE_SOLUTION") ===
          (projection === "author"),
      );
      const proof = await op.validateRelease({
        expectedSources: ["index.qmd"],
      });
      check(
        `${format}/${projection}: exact release format`,
        proof.format === format,
      );
    });
    let error = "";
    try {
      await Core.withCurrentNativeOperation({
        ...expectation,
        format: format === "html" ? "revealjs" : "html",
      }, async () => {});
    } catch (e) {
      error = String(e);
    }
    check(
      `${format}/${projection}: other-format-refused`,
      error.includes("OPERATION_BINDING"),
    );
    console.log(JSON.stringify({ format, projection, root }));
  }
}
console.log(JSON.stringify({ status: "PASS", checks }));
