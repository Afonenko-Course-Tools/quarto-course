import { fixtureRecord, required } from "./helpers/required.ts";
import {
  fixtureOperation,
  renderFixture,
} from "./helpers/native-operation-a3.ts";
import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const extension = join(repo, "_extensions/course-core/native-ts");
const plPublic = Deno.env.get("A2_PL_PUBLIC");
const pl: unknown = plPublic ? await import(toFileUrl(plPublic).href) : undefined;
function summary(name: string, starterPath: string): Core.SubmissionInstructions {
  if (pl === undefined) return Core.SubmissionInstructionsSchema.parse({ files: [{ name, starterPath }], instructions: "Сдайте исходники выбранного проекта." });
  const describeSubmission = fixtureRecord(pl).describeSubmission;
  assert(typeof describeSubmission === "function", "PL describeSubmission отсутствует");
  const described: unknown = Reflect.apply(describeSubmission, pl, [{ mode: "upload" }, [{ name, starterPath }]]);
  return Core.SubmissionInstructionsSchema.parse(described);
}
const root = await Deno.makeTempDir({ prefix: "a2-materialization-" });
const output = await Deno.makeTempDir({ prefix: "a2-consumer-" });
function assert(v: unknown, m: string): asserts v {
  if (!v) throw Error(m);
}
const refused = async (fn: () => unknown, code: string) => {
  let error = "";
  try {
    await fn();
  } catch (e) {
    error = String(e);
  }
  assert(error.includes(code), code + ": " + error);
};
async function put(name: string, text: string) {
  const p = join(root, name);
  await Deno.mkdir(dirname(p), { recursive: true });
  await Deno.writeTextFile(p, text);
}
await put(
  "_quarto.yml",
  `project:\n  type: book\n  output-dir: _site\nbook:\n  title: A2\n  chapters: [index.qmd]\nformat:\n  html:\n    theme: none\ncourse-core-projection: student\nfilters:\n  - at: pre-ast\n    path: ${extension}/early-context.lua\n  - at: post-quarto\n    path: ${extension}/late-kind.lua\n  - at: post-render\n    path: ${extension}/late-filter.lua\ncourse-project:\n  components:\n    helper: {path: shared/helper, base: config}\n  build:\n    files:\n      build.gradle: {path: shared/build.gradle, base: config}\n      settings.gradle: {path: shared/settings.gradle, base: config}\n  starter: {path: starter}\n  instructions:\n    gradle: {path: shared/gradle.md, base: config}\n  testsets:\n    demo: {path: demo, requires: {helper: true}}\n    extra: {path: extra, requires: {demo: true}}\n  delivery:\n    student:\n      testsets: {demo: true}\n  verification:\n    testsets: {demo: true}\n`,
);
await put(
  "shared/build.gradle",
  `plugins { id 'java' }\nrepositories { mavenCentral() }\ndependencies { testImplementation 'org.junit.jupiter:junit-jupiter:5.13.4'; testRuntimeOnly 'org.junit.platform:junit-platform-launcher' }\njava { toolchain { languageVersion = JavaLanguageVersion.of(25) } }\ntest { useJUnitPlatform() }\n`,
);
await put("shared/settings.gradle", "rootProject.name='a2-standalone'\n");
await put(
  "shared/gradle.md",
  "JDK 25. Выполните `gradle test`. [Справка](guide.txt).\n",
);
await put("shared/guide.txt", "Общая инструкция сборки\n");
await put(
  "shared/helper/src/test/java/Helper.java",
  "final class Helper { static int value(){return 1;} }\n",
);
for (const name of ["reverse-array", "book-selection"]) {
  await put(
    `projects/${name}/starter/src/main/java/${
      name === "reverse-array" ? "Main" : "Book"
    }.java`,
    name === "reverse-array"
      ? "public class Main { public static void main(String[] args) {} }\n"
      : "public class Book {}\n",
  );
  await put(
    `projects/${name}/demo/src/test/java/DemoTest.java`,
    "import org.junit.jupiter.api.Test; import static org.junit.jupiter.api.Assertions.*; class DemoTest { @Test void demo(){ assertEquals(1,Helper.value()); } }\n",
  );
  await put(
    `projects/${name}/extra/src/test/java/Extra.java`,
    "class Extra {}\n",
  );
  await put(
    `projects/${name}/README.local.md`,
    "Локальные сведения: [данные](data.txt).\n",
  );
  await put(`projects/${name}/data.txt`, "Локальный материал\n");
  await put(
    `projects/${name}/reference/src/main/java/Reference.java`,
    "class Reference {}\n",
  );
  await put(
    `projects/${name}/_metadata.yml`,
    `course-project:\n  starter: {path: starter}\n  instructions:\n    local: {path: README.local.md}\n  solutions:\n    reference: {path: reference}\n`,
  );
}
// Native include expands lists, table, note, explicit anchors and a generated asset.
await put(
  "sections/condition-extra.qmd",
  `### Дополнение {#details}\n\n#### Русский якорь {#заметка}\n\n[К заметке](#заметка)\n\n- Первый пункт\n- Второй пункт\n\n| Вход | Выход |\n|---|---|\n| 1 | 1 |\n\nСноска[^n].\n\n[^n]: Содержание сноски.\n\n![Ресурс](visible.svg)\n\n![Generated](generated.svg)\n\n[Другой проект](other.qmd#target) и [заготовка](starter.zip).\n\n::: {.callout-note}\nСодержимое native callout.\n:::\n`,
);
await put(
  "visible.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="30"><text y="20">VISIBLE_RESOURCE</text></svg>',
);
await put(
  "private.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="30"><text y="20">PRIVATE_RESOURCE</text></svg>',
);
// post-render hook models an actual renderer-created resource, absent before render.
await put(
  "generate.lua",
  `return {{Pandoc=function(doc) local f=assert(io.open('generated.svg','wb')); f:write('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="30"><text y="20">GENERATED_AFTER_NATIVE</text></svg>'); f:close(); return doc end}}`,
);
let cfg = await Deno.readTextFile(join(root, "_quarto.yml"));
cfg = cfg.replace(
  "  - at: post-render\n",
  `  - at: post-quarto\n    path: ${root}/generate.lua\n  - at: post-render\n`,
);
await put("_quarto.yml", cfg);
await put(
  "index.qmd",
  `# A2\n\n::: {#exr-reverse-array difficulty=introductory statement-visibility=open project="projects/reverse-array"}\n${await Deno
    .readTextFile(
      join(repo, "tests/fixtures/a2-subjects/reverse-array.md"),
    )}\n{{< include sections/condition-extra.qmd >}}\n\n::: {.solution}\n![Private](private.svg)\n:::\n\n:::\n\n::: {#exr-book-selection difficulty=intermediate statement-visibility=open project="projects/book-selection"}\n${await Deno
    .readTextFile(
      join(repo, "tests/fixtures/a2-subjects/book-selection.md"),
    )}\n:::\n`,
);
await put(
  "index.qmd",
  (await Deno.readTextFile(join(root, "index.qmd"))) + `
::: {#exr-linked-starter difficulty=introductory statement-visibility=open project="projects/reverse-array"}
[Это упражнение](#exr-linked-starter) и [Main](projects/reverse-array/starter/src/main/java/Main.java).
{{< include sections/condition-extra.qmd >}}
:::
`,
);
const start = performance.now();
await renderFixture(root);
const api = Core;
let savedPlan: Core.ProjectPlan | undefined;
let savedInventory: Core.ArtifactFiles | undefined;
let budget: (() => unknown) | undefined;
let planMetrics: Core.ProjectPlanMetrics | undefined;
let ioMetrics: Core.ArtifactWriteResult | undefined;
let savedCondition: Core.ResolvedCondition | undefined;
await fixtureOperation(root, async (native) => {
  const document = native.document({ source: "index.qmd" });

  assert(
    typeof api.selectCondition === "function",
    "A2 RED: full late condition has no public selectCondition/materializer boundary",
  );
  const condition = api.selectCondition(document, "exr-reverse-array", "student");
  savedCondition = condition;
  assert(
    JSON.stringify(condition).includes("Содержание") &&
      JSON.stringify(condition).includes("сноски"),
    "full include/note lost",
  );
  assert(
    !JSON.stringify(condition).includes("private.svg"),
    "private solution escaped student projection",
  );
  await Core.readProjectContexts([{
    owner: root,
    directories: [
      "projects/reverse-array",
      "projects/book-selection",
    ],
    profiles: [],
    format: "html",
  }], async (groups) => {
    const op = required(groups[0]);
    const plan = await api.planProject(required(op.contexts[0]), { audience: "student" });
    savedPlan = plan;
    const bindings = {
      links: {
        "other.qmd#target": "https://example.invalid/other.html#target",
        "starter.zip": "downloads/reverse-array.zip",
      },
      resources: {
        "visible.svg": { path: "visible.svg", target: "resources/visible.svg" },
        "generated.svg": {
          path: "generated.svg",
          target: "resources/generated.svg",
        },
        "guide.txt": {
          path: "shared/guide.txt",
          target: "resources/guide.txt",
        },
        "projects/reverse-array/data.txt": {
          path: "projects/reverse-array/data.txt",
          target: "resources/data.txt",
        },
      },
      submission: summary("Main.java", "src/main/java/Main.java"),
    };
    const inventory = await api.materializeProject(plan, condition, bindings);
    savedInventory = inventory;
    const files = new Map(inventory.files.map((f) => [f.target, f]));
    const readme = new TextDecoder().decode(
      required(files.get("README.md")).bytes,
    );
    for (
      const phrase of [
        "не изменяя сам массив",
        "Первый пункт",
        "Содержание сноски",
        "Содержимое native callout",
        "gradle test",
        "Локальные сведения",
        bindings.submission.instructions,
      ]
    ) assert(readme.includes(phrase), "README lost " + phrase);
    assert(
      readme.includes('id="details"') &&
        readme.includes("https://example.invalid/other.html#target"),
      "anchor/link mapping lost",
    );
    assert(
      readme.includes("downloads/reverse-array.zip"),
      "self download binding lost",
    );
    assert(
      !readme.includes("PRIVATE_RESOURCE") && !files.has("private.svg"),
      "private resource leaked",
    );
    for (
      const file of [
        "build.gradle",
        "settings.gradle",
        "src/main/java/Main.java",
        "src/test/java/DemoTest.java",
        "src/test/java/Helper.java",
        "resources/generated.svg",
      ]
    ) assert(files.has(file), "missing standalone file " + file);
    assert(!files.has("gradlew"), "unsolicited wrapper");
    assert(
      new TextDecoder().decode(
        required(files.get("resources/generated.svg")).bytes,
      ).includes("GENERATED_AFTER_NATIVE"),
      "generated final bytes lost",
    );
    const before = JSON.stringify(op.metrics);
    await api.materializeProject(plan, condition, bindings);
    assert(
      JSON.stringify(op.metrics) === before,
      "repeat materialization re-inspects/walks owner",
    );
    planMetrics = api.projectPlanMetrics(plan);
    ioMetrics = await api.writeArtifactFiles(
      inventory,
      join(output, "student"),
    );
    const linkedStarter = api.selectCondition(
      document,
      "exr-linked-starter",
      "student",
    );
    const linkedInventory = await api.materializeProject(plan, linkedStarter, {
      ...bindings,
      resources: {
        ...bindings.resources,
        "projects/reverse-array/starter/src/main/java/Main.java": {
          path: "projects/reverse-array/starter/src/main/java/Main.java",
          target: "src/main/java/Main.java",
        },
      },
    });
    assert(
      linkedInventory.files.length === inventory.files.length,
      "link to already included starter duplicated bytes",
    );
    const book = api.selectCondition(document, "exr-book-selection", "student");
    const bookPlan = await api.planProject(required(op.contexts[1]), {
      audience: "student",
    });
    const bookInventory = await api.materializeProject(bookPlan, book, {
      ...bindings,
      resources: {
        ...bindings.resources,
        "projects/book-selection/data.txt": {
          path: "projects/book-selection/data.txt",
          target: "resources/data.txt",
        },
      },
      submission: summary("Book.java", "src/main/java/Book.java"),
    });
    assert(
      bookInventory.files.some((f) =>
        f.target === "src/main/java/Book.java"
      ),
      "second code input starter base lost",
    );
    assert(
      !bookInventory.files.some((f) =>
        f.target === "src/main/java/Main.java"
      ),
      "two inputs share local source",
    );
    budget = () => op.metrics;
    await refused(
      () =>
        api.materializeProject(
          plan,
          { ...condition, view: "author" },
          bindings,
        ),
      "CONDITION_AUTHORITY",
    );
    const automaticResources = await api.materializeProject(plan, condition, {
      ...bindings,
      resources: {},
    });
    assert(
      automaticResources.files.some((
        f: Core.ArtifactFiles["files"][number],
      ) =>
        f.reason === "condition-resource" && f.target.startsWith("resources/")
      ),
      "owner automatic condition resource closure",
    );
    await refused(
      () =>
        api.materializeProject(plan, {
          ...condition,
          body: [{
            t: "Para",
            c: [{ t: "Image", c: [["", [], []], [], ["../escape.svg", ""]] }],
          }],
        }, bindings),
      "CONDITION_AUTHORITY",
    );
    // Malformed or altered IO DTO is refused before destination creation.
    await refused(
      () =>
        api.writeArtifactFiles({
          ...inventory,
          files: [{ ...required(inventory.files[0]), target: "../escape" }],
        }, join(output, "bad")),
      "ARTIFACT_CONTRACT",
    );
  });
});
await refused(
  () => api.materializeProject(required(savedPlan), required(savedCondition), { submission: summary("Main.java", "src/main/java/Main.java") }),
  "CONTEXT_EXPIRED",
);
const archive = join(output, "student.zip"),
  unpacked = join(output, "unpacked");
let archived = await new Deno.Command("zip", {
  args: ["-qr", archive, "."],
  cwd: join(output, "student"),
  stdout: "piped",
  stderr: "piped",
}).output();
assert(archived.success, "Test consumer archive failed");
archived = await new Deno.Command("unzip", {
  args: ["-q", archive, "-d", unpacked],
  stdout: "piped",
  stderr: "piped",
}).output();
assert(archived.success, "Test consumer extraction failed");
const inventory = required(savedInventory);
for (const file of inventory.files) {
  const bytes = await Deno.readFile(join(unpacked, file.target));
  assert(bytes.length === file.bytes.length && bytes.every((b,i) => b === file.bytes[i]), "Extracted bytes changed " + file.target);
}
// Extracted student root survives after source checkout disappears.
await Deno.rename(root, root + "-removed");
assert(
  (await Deno.readTextFile(join(output, "unpacked/src/main/java/Main.java")))
    .includes("class Main"),
  "student depends on checkout",
);
console.log(JSON.stringify({
  status: "PASS",
  submissionProducer: plPublic ?? "neutral-fixture",
  planMetrics,
  ioMetrics,
  root: root + "-removed",
  output,
  budget: required(budget)(),
  wallMs: Math.round(performance.now() - start),
  files: inventory.files.map(({ target, audience, bytes }: Core.ArtifactFiles["files"][number]) => ({
    target,
    size: bytes.length,
    audience,
  })),
}));
