import { join } from "stdlib/path";
import {
  assertProjectContext,
  decodeProjectContract,
  readProjectContexts,
} from "../_extensions/course-core/infrastructure/project-context.ts";
const assert = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const root = await Deno.makeTempDir({ prefix: "course-project-loader-" });
async function put(path: string, text: string) {
  const target = join(root, path);
  await Deno.mkdir(target.slice(0, target.lastIndexOf("/")), {
    recursive: true,
  });
  await Deno.writeTextFile(target, text);
}
try {
  await put(
    "_quarto.yml",
    `project: {type: book}\nmetadata-files: [config/shared.yml]\ncourse-project:\n  starter: {path: starter}\n  testsets: {demo: {path: tests}}\n  components: {support: {path: root-decoy, base: config}}\n  delivery: {student: {testsets: {demo: true}}}\n`,
  );
  await put(
    "config/shared.yml",
    `course-project:\n  components: {support: {path: shared, base: config}}\n  build: {files: {settings.gradle: {path: settings.gradle, base: config}}}\n`,
  );
  await put(
    "_quarto-alpha.yml",
    `metadata-files: [does-not-exist.yml]\ncourse-project:\n  verification: {testsets: {demo: false}}\n  components: {support: {path: alpha, base: config}}\nformat:\n  html:\n    course-project:\n      delivery: {student: {testsets: {demo: false}}}\n`,
  );
  await put(
    "_quarto-beta.yml",
    `course-project:\n  verification: {testsets: {demo: true}}\n`,
  );
  await put(
    "_quarto.yml.local",
    `course-project:\n  components: {support: {path: shared, base: config}}\n`,
  );
  await put(
    "projects/_metadata.yml",
    `metadata-files: [../config/shared.yml]\ncourse-project:\n  solutions: {reference: {path: reference}}\n`,
  );
  await put(
    "projects/a/_metadata.yml",
    `course-project:\n  components: {support: {path: local}}\n`,
  );
  for (
    const path of [
      "config/shared/api.txt",
      "config/settings.gradle",
      "shared/README.txt",
      "projects/a/local/a.txt",
      "projects/a/starter/Main.java",
      "projects/b/starter/Main.java",
      "projects/a/tests/Test.java",
      "projects/b/tests/Test.java",
      "projects/a/reference/Main.java",
      "projects/b/reference/Main.java",
    ]
  ) {
    await put(path, path);
  }
  let expired: unknown;
  const started = performance.now();
  await readProjectContexts([{
    owner: root,
    directories: ["projects/a", "projects/b"],
    profiles: ["alpha", "beta"],
    format: "html",
  }], async ([group]) => {
    const [a, b] = group.contexts;
    const pa = decodeProjectContract(a), pb = decodeProjectContract(b);
    assert(
      a.input === join(root, "projects/a"),
      "Code directory заменён synthetic QMD",
    );
    assert(
      pa.starter?.path === join(root, "projects/a/starter") &&
        pb.starter?.path === join(root, "projects/b/starter"),
      "Inherited starter не project-relative",
    );
    assert(
      pa.testsets.demo.path === join(root, "projects/a/tests") &&
        pb.testsets.demo.path === join(root, "projects/b/tests"),
      "Inherited tests не project-relative",
    );
    assert(
      pa.components.support.path === join(root, "projects/a/local"),
      "Atomic override сохранил base:config",
    );
    assert(
      pb.components.support.path === join(root, "config/shared"),
      "Include потерял собственную базу",
    );
    assert(
      pb.build.files["settings.gradle"].path ===
        join(root, "config/settings.gradle"),
      "Build address не config-relative",
    );
    assert(
      pa.verification.testsets.demo === false,
      "First selected profile не победил",
    );
    assert(
      pa.delivery.student.testsets.demo === false,
      "Format overlay/false потерян",
    );
    await assertProjectContext(a);
    expired = a;
    assert(
      group.metrics.yamlFileReads === 7,
      `YAML прочитаны повторно: ${JSON.stringify(group.metrics)}`,
    );
    console.log(
      JSON.stringify({
        metrics: group.metrics,
        wallMs: Math.round(performance.now() - started),
      }),
    );
  });
  let refused = false;
  try {
    await assertProjectContext(expired);
  } catch (e) {
    refused = String(e).includes("CONTEXT_EXPIRED");
  }
  assert(refused, "Завершённый контекст активен");
  await put(
    "projects/b/_metadata.yml",
    "course-project:\n  components: {support: {path: missing, base: config}}\n",
  );
  await put("missing/decoy.txt", "decoy");
  refused = false;
  try {
    await readProjectContexts([{
      owner: root,
      directories: ["projects/b"],
      profiles: [],
      format: "html",
    }], async () => {});
  } catch (e) {
    refused = String(e).includes("PROJECT_PATH_MISSING") &&
      String(e).includes("projects/b/missing");
  }
  assert(refused, "Missing config target выбрал существующий decoy");
  console.log(
    "PASS course-project: inheritance, atomic addresses, shared/includes/profiles/format, missing/decoy, one YAML read",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
