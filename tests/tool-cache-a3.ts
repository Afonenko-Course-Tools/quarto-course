import * as Core from "../_extensions/course-core/public.ts";
import {
  fixtureOperation,
  renderFixture,
} from "./helpers/native-operation-a3.ts";
import { dirname, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "a3-cache-policy-" });
const authored = new Set<string>();
const checks: { name: string; passed: boolean; code?: string }[] = [];
const check = (name: string, passed: boolean, code?: string) =>
  checks.push({ name, passed, ...(code ? { code } : {}) });
async function rejected(name: string, use: () => unknown) {
  let error = "";
  try {
    await use();
  } catch (e) {
    error = String(e);
  }
  check(
    name,
    /ORIGIN_CACHE|ARTIFACT_SOURCE|ARTIFACT_TARGET/.test(error),
    error.split(":").slice(0, 2).join(":"),
  );
}
async function put(path: string, text: string) {
  authored.add(path);
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
}
await put(
  "_quarto.yml",
  `project:\n  type: website\n  output-dir: _site\nformat:\n  html:\n    theme: none\ncourse-project:\n  starter: {path: starter}\n  instructions:\n    gradle: {path: shared/gradle.md}\n  build:\n    files:\n      build.gradle: shared/build.gradle\n      settings.gradle: shared/settings.gradle\n`,
);
for (
  const [path, text] of Object.entries({
    "shared/build.gradle": "plugins { id 'java' }",
    "shared/settings.gradle": "rootProject.name='cache-contract'",
    "shared/gradle.md": "JDK25: gradle test.",
    "shared/payload.txt": "Учебный материал.",
    ".cache/codex-tools/synthetic-marker.txt": "synthetic cache marker",
    ".cache/course-data/lesson.txt": "Обычный учебный cache input.",
  })
) await put(path, text);
const variants = {
  normal: "",
  source:
    "  build:\n    files:\n      material.txt: ../../.cache/codex-tools/synthetic-marker.txt\n",
  target:
    "  build:\n    files:\n      .cache/codex-tools/target.txt: ../../shared/payload.txt\n",
  lesson:
    "  build:\n    files:\n      material.txt: ../../.cache/course-data/lesson.txt\n",
};
let bank = "# Проверка source policy\n\n";
for (const [name, extra] of Object.entries(variants)) {
  await put(`projects/${name}/input.qmd`, "# Code\n");
  await put(`projects/${name}/starter/Main.java`, "class Main {}\n");
  if (extra) {
    await put(`projects/${name}/_metadata.yml`, "course-project:\n" + extra);
  }
  bank +=
    `::: {#exr-${name} difficulty=introductory statement-visibility=open project="projects/${name}/input.qmd"}\nОбычное полное условие ${name}.\n:::\n\n`;
}
bank +=
  `::: {#exr-cache-resource difficulty=introductory statement-visibility=open project="projects/normal/input.qmd"}
[Материал](.cache/codex-tools/synthetic-marker.txt)
:::

::: {#exr-public-resource difficulty=introductory statement-visibility=open project="projects/normal/input.qmd"}
[Материал](shared/payload.txt)
:::
`;
await put("index.qmd", bank);
const started = performance.now();
await renderFixture(root);
const cacheIO = { readFile: 0, writeFile: 0, readDir: 0 };
const readFile = Deno.readFile,
  writeFile = Deno.writeFile,
  readDir = Deno.readDir;
Deno.readFile = ((path, ...args) => {
  if (String(path).startsWith(root + "/.cache/codex-tools/")) {
    cacheIO.readFile++;
  }
  return readFile(path, ...args);
}) as typeof Deno.readFile;
Deno.writeFile = ((path, ...args) => {
  if (String(path).includes("/.cache/codex-tools/")) cacheIO.writeFile++;
  return writeFile(path, ...args);
}) as typeof Deno.writeFile;
Deno.readDir = ((path) => {
  if (String(path).endsWith("/.cache/codex-tools")) cacheIO.readDir++;
  return readDir(path);
}) as typeof Deno.readDir;
const bindings = {
  submission: { files: [], instructions: "Сдайте исходник." },
};
try {
  let nativeError = "";
  try {
    await fixtureOperation(root, async (op) => {
      check(
        "native-source-hashes-exclude-cache",
        op.metrics.sourceHashReads ===
          [...authored].filter((p) => !p.startsWith(".cache/codex-tools/"))
            .length,
      );
      check(
        "native-late-does-not-hash-cache-resource",
        op.metrics.nativeResourceHashReads === 1,
      );
      await Core.readProjectContexts([{
        owner: root,
        inputs: [
          "projects/normal/input.qmd",
          "projects/lesson/input.qmd",
          "projects/target/input.qmd",
        ],
        profiles: [],
        format: "html",
      }], async ([group]) => {
        const normal = await Core.planProject(group.contexts[0], {
          audience: "student",
        });
        const condition = op.condition({
          source: "index.qmd",
          exerciseId: "exr-normal",
          view: "student",
        });
        await Deno.writeTextFile(
          join(root, ".cache/codex-tools/synthetic-marker.txt"),
          "normal cache update",
        );
        await Deno.writeTextFile(
          join(root, ".cache/codex-tools/new-marker.txt"),
          "normal cache addition",
        );
        await Core.materializeProject(normal, condition, bindings);
        let resourceError = "";
        try {
          await op.resourceInventory({
            files: [{
              source: ".cache/codex-tools/synthetic-marker.txt",
              target: "material.txt",
            }],
          });
        } catch (error) {
          resourceError = String(error);
        }
        check(
          "native-cache-resource-refused",
          resourceError.includes("RESOURCE_PRIVATE_OR_SOURCE"),
        );
        for (const audience of ["student", "full"] as const) {
          const resourcePlan = await Core.planProject(group.contexts[0], {
            audience,
          });
          await rejected(
            "direct-resource-cache-source-" + audience,
            () =>
              Core.materializeProject(
                resourcePlan,
                op.condition({
                  source: "index.qmd",
                  exerciseId: "exr-cache-resource",
                  view: "student",
                }),
                {
                  ...bindings,
                  resources: {
                    ".cache/codex-tools/synthetic-marker.txt": {
                      path: ".cache/codex-tools/synthetic-marker.txt",
                      target: "material.txt",
                    },
                  },
                },
              ),
          );
          await rejected(
            "direct-resource-cache-target-" + audience,
            () =>
              Core.materializeProject(
                resourcePlan,
                op.condition({
                  source: "index.qmd",
                  exerciseId: "exr-public-resource",
                  view: "student",
                }),
                {
                  ...bindings,
                  resources: {
                    "shared/payload.txt": {
                      path: "shared/payload.txt",
                      target: ".cache/codex-tools/resource.txt",
                    },
                  },
                },
              ),
          );
        }
        const lesson = await Core.planProject(group.contexts[1], {
          audience: "full",
        });
        const ordinary = await Core.materializeProject(
          lesson,
          op.condition({
            source: "index.qmd",
            exerciseId: "exr-lesson",
            view: "student",
          }),
          bindings,
        );
        check(
          "ordinary-cache-input-remains-full-source",
          ordinary.files.some((f) => f.target === "material.txt"),
        );
        for (const audience of ["student", "full"] as const) {
          const plan = await Core.planProject(group.contexts[2], { audience });
          await rejected(
            "cache-target-" + audience,
            () =>
              Core.materializeProject(
                plan,
                op.condition({
                  source: "index.qmd",
                  exerciseId: "exr-target",
                  view: "student",
                }),
                bindings,
              ),
          );
        }
      });
      check("project-context-cache-update-and-membership", true);
    });
  } catch (e) {
    nativeError = String(e);
  }
  check(
    "native-final-cache-update",
    !nativeError,
    nativeError.split(":").slice(0, 2).join(":"),
  );
  for (const audience of ["student", "full"] as const) {
    await rejected(
      "direct-cache-source-" + audience,
      () =>
        Core.readProjectContexts([{
          owner: root,
          inputs: ["projects/source/input.qmd"],
          profiles: [],
          format: "html",
        }], async ([group]) => {
          const plan = await Core.planProject(group.contexts[0], { audience });
          return plan;
        }),
    );
  }
} finally {
  Deno.readFile = readFile;
  Deno.writeFile = writeFile;
  Deno.readDir = readDir;
}
check("no-cache-input-read", cacheIO.readFile === 0);
check("no-cache-copy", cacheIO.writeFile === 0);
check("no-cache-enumeration", cacheIO.readDir === 0);
let ordinaryChanged = "";
try {
  await Core.readProjectContexts([{
    owner: root,
    inputs: ["projects/normal/input.qmd"],
    profiles: [],
    format: "html",
  }], async () => {
    await Deno.writeTextFile(
      join(root, ".cache/course-data/lesson.txt"),
      "Изменённый учебный материал.",
    );
  });
} catch (error) {
  ordinaryChanged = String(error);
}
check(
  "ordinary-cache-source-change-remains-meaningful",
  ordinaryChanged.includes("CONTEXT_CHANGED"),
);
// Новые промежуточные каталоги допустимы только для самого cache, без учебных соседей.
const fresh = await Deno.makeTempDir({ prefix: "a3-new-cache-parent-" });
for await (const entry of Deno.readDir(root)) {
  if ([".cache", "_generated", "_site", ".quarto"].includes(entry.name)) {
    continue;
  }
  const source = join(root, entry.name), destination = join(fresh, entry.name);
  if (entry.isDirectory) {
    const copied = await new Deno.Command("cp", {
      args: ["-R", source, destination],
    }).output();
    if (!copied.success) throw Error("fixture copy");
  } else await Deno.copyFile(source, destination);
}
const rendered = await new Deno.Command("quarto", {
  args: ["render", "index.qmd", "--to", "html"],
  cwd: fresh,
  env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1" },
  stdout: "piped",
  stderr: "piped",
}).output();
if (!rendered.success) throw Error(new TextDecoder().decode(rendered.stderr));
let containerError = "";
try {
  await fixtureOperation(fresh, async () => {
    await Core.readProjectContexts([{
      owner: fresh,
      inputs: ["projects/normal/input.qmd"],
      profiles: [],
      format: "html",
    }], async () => {
      await Deno.mkdir(join(fresh, ".cache/codex-tools"), { recursive: true });
      await Deno.writeTextFile(
        join(fresh, ".cache/codex-tools/new-marker.txt"),
        "synthetic new cache",
      );
    });
  });
} catch (error) {
  containerError = String(error);
}
check(
  "new-cache-parent-does-not-become-input",
  !containerError,
  containerError.split(":").slice(0, 2).join(":"),
);
const sample = {
  schema: "course-artifact-inventory-v1",
  operation: crypto.randomUUID(),
  exerciseId: "exr-cache",
  audience: "full",
  files: [{
    target: ".cache/codex-tools/state.txt",
    audience: "full",
    reason: "control",
    bytes: new Uint8Array(),
    size: 0,
    sha256: "0".repeat(64),
  }],
};
check(
  "public-full-cache-target-refused",
  !Core.ArtifactInventorySchema.safeParse(sample).success,
);
check(
  "ordinary-full-cache-target-remains-legal",
  Core.ArtifactInventorySchema.safeParse({
    ...sample,
    files: [{ ...sample.files[0], target: ".cache/course-data/lesson.txt" }],
  }).success,
);
console.log(JSON.stringify({
  status: checks.every((c) => c.passed) ? "PASS" : "FAIL",
  root,
  cacheIO,
  checks,
  wallMs: Math.round(performance.now() - started),
  xdgUnchanged:
    Deno.env.get("XDG_CACHE_HOME") === "/home/tolya/Java/.cache/codex-tools",
}));
if (checks.some((c) => !c.passed)) throw Error("A3 tool cache contract");
