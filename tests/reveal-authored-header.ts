import * as Core from "../_extensions/course-core/public.ts";
import { publicCondition } from "../_extensions/course-core/body-export/producer.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "reveal-authored-header-" }),
  extension = join(
    dirname(dirname(fromFileUrl(import.meta.url))),
    "_extensions/course-core",
  );
const config = (format: string) =>
  `project:\n  type: website\n  render: [index.qmd]\n  output-dir: _site\n  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]\n  post-render: [quarto run ${extension}/entrypoints/native-post.ts]\nformat:\n  ${format}:\n    theme: ${
    format === "html" ? "none" : "simple"
  }\ncourse-core-runtime: native-ts\ncourse-core-projection: author\ncourse-core-role: exercise-bank\nexercise-bank: true\ncourse: {id: header-test, view: full}\nfilters:\n  - at: pre-ast\n    path: ${extension}/native-ts/early-context.lua\n  - at: post-quarto\n    path: ${extension}/native-ts/late-kind.lua\n  - at: post-render\n    path: ${extension}/native-ts/late-filter.lua\n`;
const evidence = Deno.env.get("COURSE_TEST_EVIDENCE");
if (evidence) await Deno.mkdir(evidence, { recursive: true });
let success = false;
try {
  await Deno.writeTextFile(
    join(root, ".gitignore"),
    "/.quarto/\n**/*.quarto_ipynb\n",
  );
  await Deno.writeTextFile(
    join(root, "index.qmd"),
    "---\ntitle: Позднее имя\n---\n::: {#exr-one difficulty=introductory statement-visibility=restricted}\n## {{< meta title >}}\n\n### Авторский подраздел {#authored-detail}\n\nНеудаляемое условие.\n:::\n",
  );
  for (const format of ["html", "revealjs"]) {
    await Deno.writeTextFile(join(root, "_quarto.yml"), config(format));
    const child = await new Deno.Command("quarto", {
      args: ["render", "index.qmd", "--to", format],
      cwd: root,
      env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1" },
      stdout: "piped",
      stderr: "piped",
    }).output();
    await Deno.writeTextFile(
      join(root, "_generated/" + format + ".log"),
      new TextDecoder().decode(child.stdout) +
        new TextDecoder().decode(child.stderr),
    );
    if (!child.success) {
      throw Error("Actual render failed " + root + "/" + format + ".log");
    }
    await Core.withCurrentNativeOperation({
      root,
      profiles: [],
      projection: "author",
      outputDirectory: join(root, "_site"),
    }, async (op) => {
      const row = op.document({ source: "index.qmd" }).occurrences.find((r) =>
        r.exerciseId === "exr-one"
      )!;
      if (!row.title || !JSON.stringify(row.title).includes("Позднее")) {
        throw Error("Native late title lost " + format);
      }
      const body = publicCondition(row.body as any[], !!row.title?.length);
      const observed = JSON.stringify({ format, row, body }, null, 2);
      await Deno.writeTextFile(
        join(root, "_generated/" + format + "-observed.json"),
        observed,
      );
      if (evidence) {
        await Deno.writeTextFile(
          join(evidence, format + "-observed.json"),
          observed,
        );
        for (const file of ["_quarto.yml", "index.qmd", ".gitignore"]) {
          await Deno.copyFile(
            join(root, file),
            join(evidence, format + "-" + file.replace(/^\./, "")),
          );
        }
        await Deno.copyFile(
          join(root, "_generated/" + format + ".log"),
          join(evidence, format + ".log"),
        );
        await Deno.writeTextFile(
          join(evidence, format + "-metrics.json"),
          JSON.stringify(op.metrics, null, 2),
        );
      }
      if (!JSON.stringify(body).includes("authored-detail")) {
        throw Error("FIRST_AUTHORED_HEADER_REMOVED " + format + " " + root);
      }
    });
  }
  success = true;
  console.log(
    "PASS actual html/revealjs Theorem.name and first authored header; transport probe, not assignment qualification",
  );
} finally {
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Preserved failed native fixture " + root);
}
