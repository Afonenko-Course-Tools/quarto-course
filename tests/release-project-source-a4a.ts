import * as Core from "../_extensions/course-core/public.ts";
import { renderFixture } from "./helpers/native-operation-a3.ts";
import { dirname, join } from "stdlib/path";
const checks: {
  name: string;
  passed: boolean;
  proofIssued: boolean;
  error: string;
}[] = [];
const only = Deno.env.get("A4A_I1_ONLY");
const cases = [
  ...["_output", "_site", "_book", "_freeze", "site_libs"].map((namespace) => ({
    name: namespace,
    path: namespace + "/generated-project",
    kind: "directory" as const,
    allowed: false,
    projection: "student" as const,
  })),
  {
    name: "ordinary-directory",
    path: "ordinary/project",
    kind: "directory" as const,
    allowed: true,
    projection: "student" as const,
  },
  {
    name: "ordinary-file",
    path: "ordinary/input.txt",
    kind: "file" as const,
    allowed: true,
    projection: "student" as const,
  },
  {
    name: "ordinary-empty-directory-full",
    path: "ordinary/empty",
    kind: "empty" as const,
    allowed: true,
    projection: "author" as const,
  },
  {
    name: "similar-generated-name",
    path: "_output-lessons/project",
    kind: "directory" as const,
    allowed: true,
    projection: "student" as const,
  },
];
if (only && !cases.some((c) => c.name === only)) {
  throw Error("Неизвестный I1 case");
}
for (const item of cases.filter((c) => !only || c.name === only)) {
  const root = await Deno.makeTempDir({ prefix: "a4a-i1-project-" });
  const put = async (path: string, text: string) => {
    await Deno.mkdir(dirname(join(root, path)), { recursive: true });
    await Deno.writeTextFile(join(root, path), text);
  };
  await put(
    "_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\nformat:\n  html:\n    theme: none\ncourse: {id: source-policy, view: ${
      item.projection === "author" ? "full" : "student"
    }}\ncourse-core-projection: ${item.projection}\n`,
  );
  await put(
    "index.qmd",
    `::: {#exr-demo difficulty=introductory statement-visibility=open project="${item.path}"}\nПолное условие обычного проекта без Gradle.\n:::\n`,
  );
  if (item.kind === "empty") {
    await Deno.mkdir(join(root, item.path), { recursive: true });
  } else {await put(
      item.kind === "file" ? item.path : item.path + "/input.txt",
      "Обычный материал проекта\n",
    );}
  await renderFixture(root);
  // Retained output действительно существует; отсутствие файла не является отрицательным доказательством.
  if (!item.allowed) {
    try {
      await Deno.stat(join(root, item.path));
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
      await put(item.path + "/input.txt", "Текущий generated output\n");
    }
  }
  let proofIssued = false, error = "";
  try {
    await Core.withCurrentNativeOperation({
      root,
      profiles: [],
      format: "html",
      projection: item.projection,
      outputDirectory: join(root, "_site"),
    }, async (op) => {
      const proof = await op.validateRelease({
        expectedSources: ["index.qmd"],
        courseId: "source-policy",
      });
      proofIssued = proof.exerciseIds.includes("exr-demo");
    });
  } catch (e) {
    error = String(e);
  }
  checks.push({
    name: item.name,
    proofIssued,
    error,
    passed: item.allowed
      ? proofIssued && !error
      : !proofIssued && error.includes("RELEASE.SOURCE_POLICY"),
  });
  await Deno.remove(root, { recursive: true });
}
console.log(
  JSON.stringify({
    status: checks.every((c) => c.passed) ? "PASS" : "FAIL",
    checks,
    actualProducer: "native pre/early/late/post -> public validateRelease",
  }),
);
if (checks.some((c) => !c.passed)) {
  throw Error("A4a-I1 captured project source policy");
}
