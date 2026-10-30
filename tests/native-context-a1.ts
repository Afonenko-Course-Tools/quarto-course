import { join } from "stdlib/path";
import {
  assertProjectContext,
  decodeProjectContract,
  readProjectContexts,
} from "../_extensions/course-core/public.ts";
const assert = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const root = Deno.env.get("A1_FIXTURE") ||
  await Deno.makeTempDir({ prefix: "a1-native-context-" });
async function put(path: string, value: string) {
  const parts = path.split("/");
  parts.pop();
  await Deno.mkdir(join(root, ...parts), { recursive: true });
  await Deno.writeTextFile(join(root, path), value);
}
await put(
  "_quarto.yml",
  `project:
  type: book
book:
  title: Тест
  chapters: [index.qmd]
course-project:
  components:
    root: {path: src}
  build:
    files:
      build.gradle.kts: shared/build.gradle.kts
  delivery:
    student:
      testsets: {demo: true}
`,
);
await put("index.qmd", "# Тест\n");
await put(
  "projects/_metadata.yml",
  `course-project:
  components:
    parent: {path: src}
  testsets:
    demo: {path: tests/demo}
`,
);
await put(
  "projects/a/_metadata.yml",
  `course-project:
  components:
    local: {path: src}
  delivery:
    student:
      testsets: {demo: false}
`,
);
for (
  const name of [
    "src/root.txt",
    "shared/build.gradle.kts",
    "projects/src/parent.txt",
    "projects/a/src/local.txt",
    "projects/b/src/decoy.txt",
    "projects/a/tests/demo/test.txt",
    "projects/b/tests/demo/test.txt",
  ]
) await put(name, name);
let expired: unknown;
let budget: (() => unknown) | undefined;
const started = performance.now();
await readProjectContexts([{
  owner: root,
  inputs: ["projects/a/input.qmd", "projects/b/input.qmd"],
  profiles: [],
  format: "html",
}], async ([operation]) => {
  const a = operation.contexts[0], b = operation.contexts[1];
  assert(
    a.origins["testsets.demo.path"].baseKind === "project" &&
      a.origins["testsets.demo.path"].resolvedPath ===
        join(root, "projects/a/tests/demo"),
    "Локальный testset получил definition base",
  );
  assert(
    b.origins["testsets.demo.path"].resolvedPath ===
      join(root, "projects/b/tests/demo"),
    "Локальный testset второго проекта получил чужую базу",
  );
  expired = a;
  assert(
    operation.ownerMetadata.project.type === "book",
    "Потерян настоящий book owner",
  );
  const project = decodeProjectContract(a);
  assert(
    a.origins["build.files.build.gradle.kts"].resolvedPath ===
      join(root, "shared/build.gradle.kts"),
    "Target с точкой потерял source origin",
  );
  assert(
    project.delivery.student.testsets.demo === false,
    "Native child false потерян",
  );
  assert(
    a.origins["components.root.path"].resolvedPath === join(root, "src"),
    "Неправильная root база",
  );
  assert(
    a.origins["components.parent.path"].resolvedPath ===
      join(root, "projects/src"),
    "Неправильная parent база",
  );
  assert(
    a.origins["components.local.path"].resolvedPath ===
      join(root, "projects/a/src"),
    "Неправильная local база",
  );
  assert(
    a.origins["components.root.path"].effective === "../../src",
    "Не сохранён native rebasing",
  );
  assert(
    !Object.hasOwn(b.origins, "components.local.path"),
    "Чужой local origin",
  );
  assert(
    a.origins["components.parent.path"].sourceFile ===
      join(root, "projects/_metadata.yml"),
    "Не доказан raw source",
  );
  await assertProjectContext(a);
  await assertProjectContext(a);
  budget = () => operation.metrics;
  assert(operation.metrics.inspectCalls === 3, "Лишние inspect в getter");
  assert(operation.metrics.fullWalks === 1, "Лишние обходы в getter");
});
let refused = false;
try {
  await assertProjectContext(expired);
} catch (e) {
  refused = String(e).includes("CONTEXT_EXPIRED");
}
assert(refused, "Просроченный контекст принят");
console.log(
  "PASS native A1 root/parent/local, book owner, two inputs, native false, lifetime/budget",
);

for (const name of ["projects/a/input.qmd", "projects/b/input.qmd"]) {
  let absent = false;
  try {
    await Deno.lstat(join(root, name));
  } catch (e) {
    absent = e instanceof Deno.errors.NotFound;
  }
  assert(absent, "Служебный input изменил author source");
}
console.log(
  JSON.stringify({
    budget: budget?.(),
    wallMs: Math.round(performance.now() - started),
  }),
);
