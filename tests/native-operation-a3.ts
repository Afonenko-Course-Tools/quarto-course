import { fixtureAt, fixtureRecord, required } from "./helpers/required.ts";
import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
const fixChecks: { name: string; passed: boolean }[] = [];
async function fixRefusal(name: string, run: () => unknown, code: string) {
  let error = "";
  try {
    await run();
  } catch (e) {
    error = String(e);
  }
  fixChecks.push({ name, passed: error.includes(code) });
}
const ioProbes: {
  name: string;
  calls: Record<string, number>;
  digestCalls: number;
}[] = [];
async function measured<T>(name: string, use: () => Promise<T>): Promise<T> {
  const methods = [
    "readDir",
    "lstat",
    "stat",
    "realPath",
    "readFile",
    "readTextFile",
    "readLink",
    "open",
    "writeFile",
    "writeTextFile",
    "mkdir",
    "rename",
    "remove",
    "copyFile",
    "symlink",
    "truncate",
    "chmod",
    "utime",
  ];
  const calls: Record<string, number> = {};
  const original = new Map<string, PropertyDescriptor>();
  for (const method of methods) {
    for (const api of [method, method + "Sync"]) {
      const descriptor = Object.getOwnPropertyDescriptor(Deno, api);
      const fn: unknown = descriptor?.value;
      if (typeof fn !== "function") continue;
      calls[api] = 0;
      original.set(api, required(descriptor));
      Object.defineProperty(Deno, api, {
        ...descriptor,
        value: (...args: unknown[]) => {
          calls[api] = required(calls[api]) + 1;
          return Reflect.apply(fn, Deno, args);
        },
      });
    }
  }
  let digestCalls = 0;
  const digest = crypto.subtle.digest;
  crypto.subtle.digest = (...args: Parameters<typeof crypto.subtle.digest>) => {
    digestCalls++;
    return digest.apply(crypto.subtle, args);
  };
  try {
    return await use();
  } finally {
    for (const [api, descriptor] of original) Object.defineProperty(Deno, api, descriptor);
    crypto.subtle.digest = digest;
    ioProbes.push({ name, calls, digestCalls });
  }
}
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "a3-installed-" });
const ext = "_extensions/Afonenko-Course-Tools/course-core";
function assert(v: unknown, message: string): asserts v {
  if (!v) throw Error(message);
}
const refused = async (run: () => unknown, code: string) => {
  let error = "";
  try {
    await run();
  } catch (e) {
    error = String(e);
  }
  assert(error.includes(code), `${code}: ${error}`);
};
async function put(path: string, text: string) {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
await Deno.mkdir(dirname(join(root, ext)), { recursive: true });
await new Deno.Command("cp", {
  args: ["-R", join(repo, "_extensions/course-core"), join(root, ext)],
}).output();
await put(
  "_quarto.yml",
  `project:
  type: website
  output-dir: _site
  render: [index.qmd, other.qmd]
  pre-render: [quarto run ${ext}/entrypoints/native-pre.ts]
  post-render: [quarto run relocate.ts, quarto run ${ext}/entrypoints/native-post.ts]
format:
  html:
    theme: none
filters:
  - course-core
  - at: post-quarto
    path: generate.lua
course-core-runtime: native-ts
course-core-projection: student
course-core-role: exercise-bank
default-exercise-difficulty: introductory
default-exercise-statement-visibility: open
course-project:
  build:
    files:
      build.gradle: {path: shared/build.gradle, base: config}
      settings.gradle: {path: shared/settings.gradle, base: config}
  starter: {path: starter}
  instructions:
    gradle: {path: shared/gradle.md, base: config}
`,
);
await put("_quarto-student.yml", "course-core-projection: student\n");
await put("shared/build.gradle", "plugins { id 'java' }\n");
await put("shared/unrelated.txt", "Независимая заметка.\n");
await put("shared/settings.gradle", "rootProject.name='a3'\n");
await put("shared/gradle.md", "JDK 25: выполните `gradle test`.\n");
await put("project/starter/src/main/java/Main.java", "public class Main {}\n");

await put(
  "relocate.ts",
  `const root=Deno.env.get('QUARTO_PROJECT_DIR')||Deno.cwd();await Deno.rename(root+'/generated.txt',root+'/_site/generated.txt');if(Deno.env.get('A3_TAMPER_GENERATED'))await Deno.writeTextFile(root+'/_site/generated.txt','CHANGED_AFTER_LATE_OBSERVATION');`,
);
await put(
  "generate.lua",
  `return {{Pandoc=function(doc) local path=pandoc.path.join({quarto.project.directory,'generated.txt'});local existing=io.open(path,'rb');if existing then existing:close() else local f=assert(io.open(path,'wb'));f:write('GENERATED_AFTER_NATIVE');f:close() end;return doc end}}`,
);
await put("visible.txt", "VISIBLE_BYTES\n");
await put("visible.svg", '<svg xmlns="http://www.w3.org/2000/svg"><text>VISIBLE_IMAGE</text></svg>');
await put("private.txt", "PRIVATE_BYTES\n");
await put("sections/statement.qmd", "Уточнение из настоящего native include.\n");
await put("contract.md", "AUTHOR_GRADING_PAYLOAD");
await put("_site/stale.txt", "STALE_OUTPUT_ONLY");
await put(
  "index.qmd",
  `# Условия

[Публичный ресурс](visible.txt) и [Generated](generated.txt) и [старый output](stale.txt) и [служебный файл](contract.md).

::: {#exr-demo course-role=demonstration project="project"}
Полное условие ![ресурс](visible.svg), [сосед](other.qmd#other), [заготовка](starter.zip).

{{< include sections/statement.qmd >}}

::: {.solution .content-visible when-format=html}
Публичное решение.
:::
:::

::: {#exr-private difficulty=introductory statement-visibility=open course-role=independent-study}
Закрытое решение скрыто:

::: {.solution}
[Секрет](private.txt)
:::
:::
`,
);
await put("other.qmd", "---\ncourse-core-role: page\n---\n# Другая страница {#other}\n");
await Deno.mkdir(join(root, "_generated"), { recursive: true });
await Deno.mkdir(join(root, "_site"), { recursive: true });
const qrcSource = Deno.env.get("A3_QRC_SOURCE"),
  downloadSource = Deno.env.get("A3_DOWNLOAD_SOURCE");
let qrc: unknown, download: unknown;
function callModule(module: unknown, name: string, ...args: unknown[]): unknown {
  const fn = fixtureRecord(module)[name];
  assert(typeof fn === "function", "Нет callable consumer " + name);
  return Reflect.apply(fn, module, args);
}
async function packageArtifact(inventory: Core.ArtifactFiles): Promise<Uint8Array> {
  const bytes: unknown = await callModule(download, "packageArtifact", inventory);
  assert(bytes instanceof Uint8Array, "Download не вернул ZIP bytes");
  return bytes;
}
if (qrcSource && downloadSource) {
  for (const [source, name] of [
    [qrcSource, "reference-catalog"],
    [downloadSource, "project-download"],
  ] as const) {
    const copied = await new Deno.Command("cp", {
      args: ["-R", source, join(root, "_extensions/Afonenko-Course-Tools", name)],
    }).output();
    assert(copied.success, "consumer copy");
  }
  qrc = await import(toFileUrl(join(root, "_extensions/Afonenko-Course-Tools/reference-catalog/public.ts")).href);
  download = await import(toFileUrl(join(root, "_extensions/Afonenko-Course-Tools/project-download/public.ts")).href);
}
const started = performance.now();
const render = await new Deno.Command("quarto", {
  args: ["render", "--to", "html", "--profile", "student"],
  cwd: root,
  env: { QUARTO_RUN_NO_NETWORK: "true" },
  stdout: "piped",
  stderr: "piped",
}).output();
await Deno.writeTextFile(
  join(root, "_generated/render.log"),
  new TextDecoder().decode(render.stdout) + new TextDecoder().decode(render.stderr),
);
assert(render.success, "A3 actual installed producer RED: " + root + "/render.log");
const installed: typeof Core = await import(toFileUrl(join(root, ext, "public.ts")).href);
assert(typeof installed.withCurrentNativeOperation === "function", "A3 missing public current operation");
const expectation = {
  root,
  profiles: ["student"],
  projection: "student" as const,
  outputDirectory: join(root, "_site"),
};
let escaped: Core.NativeOperation | undefined;
let escapedCondition: Core.ResolvedCondition | undefined;
let groupMetrics: unknown;
let projectGroup: Core.ProjectContextGroup | undefined;
let operationMetrics: Core.NativeOperationMetrics | undefined;
let foreignOwnerChecks = 0;
let packaged: Uint8Array | undefined;

await installed.withCurrentNativeOperation(expectation, async (op) => {
  escaped = op;
  const doc = op.document({ source: "index.qmd" });
  assert(doc.context.input === "index.qmd" && doc.status === "complete", "public relative complete document");
  assert(doc.hasPublicSolution["exr-demo"] === true, "positive native conditional witness");
  assert(
    !JSON.stringify(doc).includes(root) && !JSON.stringify(doc).includes("private.txt"),
    "private path/body in DTO",
  );
  assert(
    required(op.catalog.documents.find((d) => d.source === "index.qmd")).role === "exercise-bank",
    "native bank role missing",
  );
  assert(
    required(op.catalog.documents.find((d) => d.source === "other.qmd")).role === "page",
    "native page role missing",
  );
  assert(Object.isFrozen(op.catalog) && Object.isFrozen(doc), "public DTO mutable");
  assert(doc === op.document({ source: "index.qmd" }), "document lookup reloaded");
  await measured("repeated-document-getter", async () => {
    assert(doc === op.document({ source: "index.qmd" }), "getter identity");
  });
  const condition = op.condition({
    source: "index.qmd",
    exerciseId: "exr-demo",
    view: "student",
  });
  escapedCondition = condition;
  await installed.readProjectContexts(
    [
      {
        owner: root,
        directories: ["project"],
        profiles: ["student"],
        format: "html",
      },
    ],
    async (groups) => {
      const group = required(groups[0]);
      projectGroup = group;
      groupMetrics = group.metrics;
      const plan = await installed.planProject(required(group.contexts[0]), {
        audience: "student",
      });
      const explicit = {
        "other.qmd#other":
          "https://example.test/" +
          required(op.catalog.documents.find((d) => d.source === "other.qmd")).output +
          "#other",
        "starter.zip": "https://example.test/starter.zip",
      };
      const links = qrc
        ? Core.MaterializationBindingsSchema.shape.links.parse(
            callModule(qrc, "bindConditionLinks", condition, {
              catalog: {
                schema: "quarto-reference-catalog",
                generator: { quarto: "1.11.5" },
                targets: {},
              },
              baseUrl: "https://example.test/",
              urls: explicit,
            }),
          )
        : explicit;
      const inventory = await installed.materializeProject(plan, condition, {
        links,
        resources: {
          "visible.svg": { path: "visible.svg", target: "visible.svg" },
        },
        submission: {
          files: [{ name: "Main.java", starterPath: "src/main/java/Main.java" }],
          instructions: "Сдайте Main.java.",
        },
      });
      for (const [name, copy] of [
        ["structured-condition", structuredClone(condition)],
        ["json-condition", JSON.parse(JSON.stringify(condition))],
      ]) {
        await fixRefusal(
          name,
          () =>
            installed.materializeProject(plan, copy, {
              submission: { files: [], instructions: "Сдайте исходник." },
            }),
          "CONDITION_AUTHORITY",
        );
      }
      if (download) {
        const changed = structuredClone(inventory);
        required(changed.files[0]).target = ".git/config";
        await fixRefusal(
          "owner-target-policy-through-Download",
          () => packageArtifact(changed),
          "DOWNLOAD.INVENTORY_INVALID",
        );
      }
      const cached = await installed.materializeProject(plan, condition, {
        links,
        resources: {
          "visible.svg": { path: "visible.svg", target: "visible.svg" },
        },
        submission: {
          files: [{ name: "Main.java", starterPath: "src/main/java/Main.java" }],
          instructions: "Сдайте Main.java.",
        },
      });
      assert(
        cached.files.every(
          (f, index) =>
            f.bytes.length === required(inventory.files[index]).bytes.length &&
            f.bytes.every((b: number, i: number) => b === required(inventory.files[index]).bytes[i]),
        ),
        "repeated materialization bytes differ",
      );
      if (download) packaged = await packageArtifact(inventory);
      assert(
        inventory.files.some((f) => f.target === "README.md"),
        "README missing",
      );
    },
  );
  groupMetrics = required(projectGroup).metrics;
  const generated = await op.resourceFiles({
    files: [{ source: "generated.txt", target: "assets/generated.txt" }],
  });
  assert(
    new TextDecoder().decode(required(generated.files[0]).bytes) === "GENERATED_AFTER_NATIVE",
    "relocated generated bytes missing",
  );
  await refused(
    () =>
      op.resourceFiles({
        files: [{ source: "stale.txt", target: "assets/stale.txt" }],
      }),
    "RESOURCE_PRIVATE_OR_SOURCE",
  );
  const inventory = await op.resourceFiles({
    files: [{ source: "visible.txt", target: "assets/visible.txt" }],
  });
  assert(new TextDecoder().decode(required(inventory.files[0]).bytes) === "VISIBLE_BYTES\n", "resource bytes");
  await refused(
    () =>
      op.resourceFiles({
        files: [{ source: "private.txt", target: "private.txt" }],
      }),
    "RESOURCE_PRIVATE_OR_SOURCE",
  );
  await refused(
    () =>
      op.resourceFiles({
        files: [{ source: "index.qmd", target: "index.txt" }],
      }),
    "RESOURCE_PRIVATE_OR_SOURCE",
  );
  await refused(
    () =>
      op.resourceFiles({
        files: [{ source: "../escape", target: "escape" }],
      }),
    "RESOURCE_PATH",
  );
  await refused(
    () =>
      op.resourceFiles({
        files: [{ source: "contract.md", target: "renamed.txt" }],
      }),
    "RESOURCE_PRIVATE_OR_SOURCE",
  );
  const before = op.metrics;
  const again = await measured<Core.NativeResourceFiles>("repeated-resource-guarded-IO", () =>
    op.resourceFiles({
      files: [{ source: "visible.txt", target: "assets/visible.txt" }],
    }),
  );
  assert(new TextDecoder().decode(required(again.files[0]).bytes) === "VISIBLE_BYTES\n", "repeated resource bytes");
  assert(op.metrics.resourceCacheHits === before.resourceCacheHits + 1, "resource repeated read/hash");
  assert(op.metrics.inspectCalls === 1, "lookup changed inspect/walk budget");
  const foreign = await Deno.makeTempDir({ prefix: "a3-foreign-owner-" });
  for (const [name, text] of [
    [
      "_quarto.yml",
      "project:\n  type: website\ncourse-project:\n  build:\n    files: {build.gradle: {path: shared/build.gradle, base: config}, settings.gradle: {path: shared/settings.gradle, base: config}}\n  starter: {path: starter}\n  instructions:\n    gradle: {path: shared/gradle.md, base: config}\n",
    ],
    ["_quarto-student.yml", "course-core-projection: student\n"],
    ["shared/build.gradle", "plugins { id 'java' }"],
    ["shared/settings.gradle", "rootProject.name='foreign'"],
    ["shared/gradle.md", "gradle test"],
    ["project/starter/Main.java", "class Main {}"],
  ] as const) {
    await Deno.mkdir(dirname(join(foreign, name)), { recursive: true });
    await Deno.writeTextFile(join(foreign, name), text);
  }
  await installed.readProjectContexts(
    [
      {
        owner: foreign,
        directories: ["project"],
        profiles: ["student"],
        format: "html",
      },
    ],
    async (groups) => {
      const group = required(groups[0]);
      const plan = await installed.planProject(required(group.contexts[0]), {
        audience: "student",
      });
      await refused(
        () =>
          installed.materializeProject(plan, condition, {
            submission: { files: [], instructions: "Сдача." },
          }),
        "CONDITION_BINDING",
      );
      foreignOwnerChecks++;
    },
  );
  await refused(
    () =>
      installed.withCurrentNativeOperation(
        {
          ...expectation,
          root: foreign,
          outputDirectory: join(foreign, "_site"),
        },
        async () => {},
      ),
    "OPERATION_BINDING",
  );
  operationMetrics = op.metrics;
  await op.assertCurrent();
});
if (packaged) {
  const extraction = await Deno.makeTempDir({ prefix: "a3-extracted-" });
  await Deno.writeFile(join(extraction, "starter.zip"), packaged);
  const unzipped = await new Deno.Command("unzip", {
    args: ["-q", "starter.zip"],
    cwd: extraction,
  }).output();
  assert(unzipped.success, "actual Download ZIP extraction");
  assert(
    (await Deno.readTextFile(join(extraction, "README.md"))).includes("https://example.test/other.html#other"),
    "actual QRC destination missing in extracted README",
  );
  assert(
    (await Deno.readTextFile(join(extraction, "src/main/java/Main.java"))).includes("class Main"),
    "starter bytes lost",
  );
}
await refused(() => required(escaped).assertCurrent(), "OPERATION_EXPIRED");
await refused(() => required(escaped).document({ source: "index.qmd" }), "OPERATION_EXPIRED");
await installed.readProjectContexts(
  [
    {
      owner: root,
      directories: ["project"],
      profiles: ["student"],
      format: "html",
    },
  ],
  async (groups) => {
    const group = required(groups[0]);
    const plan = await installed.planProject(required(group.contexts[0]), {
      audience: "student",
    });
    await fixRefusal(
      "expired-structured-condition",
      () =>
        installed.materializeProject(plan, structuredClone(required(escapedCondition)), {
          submission: { files: [], instructions: "Сдайте исходник." },
        }),
      "CONDITION_AUTHORITY",
    );
    await refused(
      () =>
        installed.materializeProject(plan, required(escapedCondition), {
          submission: { files: [], instructions: "Сдайте исходник." },
        }),
      "OPERATION_EXPIRED",
    );
  },
);
await refused(
  () =>
    installed.withCurrentNativeOperation(
      {
        ...expectation,
        profiles: ["other"],
      },
      () => Promise.resolve(),
    ),
  "OPERATION_BINDING",
);
await refused(
  () =>
    installed.withCurrentNativeOperation(
      // @ts-expect-error Намеренно неподдерживаемое поле runtime запроса.
      { ...expectation, format: "revealjs" },
      () => Promise.resolve(),
    ),
  "OPERATION_BINDING",
);
await refused(
  () =>
    installed.withCurrentNativeOperation(
      {
        ...expectation,
        outputDirectory: join(root, "other-output"),
      },
      () => Promise.resolve(),
    ),
  "OPERATION_BINDING",
);
const html = await Deno.readTextFile(join(root, "_site/index.html"));
assert(
  !html.includes("data-course-core-occurrence") && !html.includes("course-core-ts-binding"),
  "internal native labels escaped writer",
);
const activeFile = join(root, "_generated/course-spec/native-ts/active.json"),
  active: unknown = JSON.parse(await Deno.readTextFile(activeFile));
const activeDirectory = fixtureAt(active, ["directory"]);
assert(typeof activeDirectory === "string", "Active directory отсутствует");
const completeFile = join(activeDirectory, "complete.json");
await Deno.rename(completeFile, completeFile + ".saved");
await refused(() => installed.withCurrentNativeOperation(expectation, async () => {}), "OPERATION_INCOMPLETE");
await Deno.rename(completeFile + ".saved", completeFile);

const afterUnrelatedMutation = await installed.withCurrentNativeOperation(expectation, async (op) => {
  await Deno.writeTextFile(join(root, "shared/unrelated.txt"), "Изменённая независимая заметка.");
  const bytes = await op.resourceFiles({
    files: [{ source: "visible.txt", target: "visible.txt" }],
  });
  fixChecks.push({
    name: "unrelated-source-preserves-observed-resource",
    passed: new TextDecoder().decode(required(bytes.files[0]).bytes) === "VISIBLE_BYTES\n",
  });
  return "unrelated mutation accepted";
});
assert(afterUnrelatedMutation === "unrelated mutation accepted", "unrelated source mutation prevented callback result");
await installed.withCurrentNativeOperation(expectation, async () => {});
// Ordinary-вход после hooks обязан проверить HTML path, даже без запроса bytes.
const ordinaryOutput = join(root, "_site/index.html");
await Deno.rename(ordinaryOutput, ordinaryOutput + ".saved");
try {
  await Deno.symlink(join(root, "index.qmd"), ordinaryOutput);
  await refused(() => installed.withCurrentNativeOperation(expectation, async () => {}), "OPERATION_CHANGED");
} finally {
  await Deno.remove(ordinaryOutput);
  await Deno.rename(ordinaryOutput + ".saved", ordinaryOutput);
}
const tampered = await new Deno.Command("quarto", {
  args: ["render", "--to", "html", "--profile", "student"],
  cwd: root,
  env: {
    QUARTO_RUN_NO_NETWORK: "true",
    A3_TAMPER_GENERATED: "1",
  },
  stdout: "piped",
  stderr: "piped",
}).output();
const tamperedLog = new TextDecoder().decode(tampered.stdout) + new TextDecoder().decode(tampered.stderr);
await Deno.writeTextFile(join(root, "_generated/tampered-render.log"), tamperedLog);
assert(tampered.success, "Postprocessing ресурса отклонён: " + tamperedLog);
await installed.withCurrentNativeOperation(expectation, async (op: Core.NativeOperation) => {
  const resource = await op.resourceFiles({
    files: [{ source: "generated.txt", target: "assets/generated.txt" }],
  });
  assert(
    new TextDecoder().decode(required(resource.files[0]).bytes) === "CHANGED_AFTER_LATE_OBSERVATION",
    "Потребитель не получил конечный postprocessed ресурс",
  );
});
const refreshed = await new Deno.Command("quarto", {
  args: ["render", "--to", "html", "--profile", "student"],
  cwd: root,
  env: { QUARTO_RUN_NO_NETWORK: "true" },
  stdout: "piped",
  stderr: "piped",
}).output();
assert(
  refreshed.success,
  "fresh generation for targeted currentness failed: " + new TextDecoder().decode(refreshed.stderr),
);
await installed.withCurrentNativeOperation(expectation, async (op: Core.NativeOperation) => {
  const value = op.condition({ source: "index.qmd", exerciseId: "exr-demo", view: "student" });
  await Deno.writeTextFile(join(root, "index.qmd"), "# Изменён source после render");
  await installed.readProjectContexts(
    [{ owner: root, directories: ["project"], profiles: ["student"], format: "html" }],
    async (groups) => {
      const group = required(groups[0]);
      const plan = await installed.planProject(required(group.contexts[0]), { audience: "student" });
      await fixRefusal(
        "json-condition-has-no-authority",
        () =>
          installed.materializeProject(plan, JSON.parse(JSON.stringify(value)), {
            submission: { files: [], instructions: "Сдайте исходник." },
          }),
        "CONDITION_AUTHORITY",
      );
    },
  );
});
const repeated = required(ioProbes.find((p) => p.name === "repeated-resource-guarded-IO"));
fixChecks.push({
  name: "targeted-repeated-IO",
  passed:
    required(repeated.calls.readDir) <= 2 &&
    required(repeated.calls.lstat) < 200 &&
    repeated.calls.readFile === 0 &&
    repeated.calls.readTextFile === 1 &&
    repeated.digestCalls === 0,
});
const getter = required(ioProbes.find((p) => p.name === "repeated-document-getter"));
fixChecks.push({
  name: "getter-complete-IO-zero",
  passed: Object.values(getter.calls).every((n) => n === 0) && getter.digestCalls === 0,
});
console.log(
  JSON.stringify({
    root,
    wallMs: performance.now() - started,
    groupMetrics,
    operationMetrics,
    foreignOwnerChecks,
    ioProbes,
    fixChecks,
    consumerZip: !!packaged,
    status: "PASS",
    producer: "actual installed pre/early/late/post",
    head: "A3",
  }),
);

assert(
  fixChecks.every((c) => c.passed),
  "A3 fix contract: " + JSON.stringify(fixChecks),
);
