import {
  fixtureOperation,
  renderFixture,
} from "./helpers/native-operation-a3.ts";
import * as Core from "../_extensions/course-core/public.ts";
import { dirname, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "a2-closure-" });
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const refuse = async (fn: () => unknown, code: string, chain?: string[]) => {
  let error = "";
  try {
    await fn();
  } catch (e) {
    error = String(e);
  }
  assert(error.includes(code), code + ": " + error);
  for (const n of chain ?? []) {
    assert(error.includes(n), "Missing conflict chain " + n);
  }
};
async function put(name: string, text: string) {
  const path = join(root, name);
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, text);
}
await put(
  "_quarto.yml",
  `project:\n  type: default\ncourse-project:\n  starter: {path: starter}\n  instructions:\n    gradle: {path: common/gradle.md}\n  build:\n    files:\n      build.gradle: common/build.gradle\n      settings.gradle: common/settings.gradle\n  components:\n    helper: {path: common/helper}\n  testsets:\n    demo: {path: demo, requires: {helper: true}}\n    extra: {path: extra, requires: {demo: true}}\n  delivery:\n    student:\n      testsets: {demo: true}\n  verification:\n    testsets: {demo: true, extra: true}\n`,
);
await put("index.qmd", "# Closure\n");
for (
  const [n, v] of Object.entries({
    "common/build.gradle": "plugins { id 'java' }\n",
    "common/settings.gradle": "rootProject.name='closure'\n",
    "common/gradle.md": "JDK 25. `gradle test`.\n",
    "common/helper/src/test/java/Helper.java": "class Helper {}\n",
  })
) await put(n, v);
const variants = {
  "private-build":
    `build:\n    files:\n      build.gradle: reference/build.gradle`,
  "false": `delivery:\n    student:\n      testsets: {demo: false}`,
  "conflict":
    `delivery:\n    student:\n      testsets: {demo: false, extra: true}`,
  "unknown": `testsets:\n    demo: {requires: {missing: true}}`,
  "cycle": `testsets:\n    demo: {requires: {extra: true}}`,
  "collision": `components:\n    helper: {path: collision}`,
  "full":
    `solutions:\n    reference: {path: reference}\n    alternative: {path: alternative}`,
};
for (const [name, metadata] of Object.entries(variants)) {
  if (name === "private-build") {
    await put(name + "/reference/build.gradle", "plugins { id 'java' }\n");
  }
  await put(name + "/_metadata.yml", "course-project:\n  " + metadata + "\n");
  for (
    const [file, content] of Object.entries({
      "starter/src/main/java/Main.java": "class Main {}\n",
      "demo/src/test/java/Demo.java": "class Demo {}\n",
      "extra/src/test/java/Extra.java": "class Extra {}\n",
      "collision/src/main/java/Main.java": "class Collision {}\n",
      "reference/src/main/java/Main.java": "class Reference {}\n",
      "alternative/src/main/java/Main.java": "class Alternative {}\n",
    })
  ) await put(name + "/" + file, content);
}
const input = (n: string) => n + "/input.qmd";
const bindings = {
  submission: {
    files: [{ name: "Main.java", starterPath: "src/main/java/Main.java" }],
    instructions: "Сдайте исходник.",
  },
};
let native: Core.NativeOperation;
let expiredFull: Core.ResolvedCondition;
const condition = (project: string) =>
  native.condition({
    source: "index.qmd",
    exerciseId: "exr-" + project.split("/")[0],
    view: "student",
  });
let bank = "# Closure\n\n";
for (const name of Object.keys(variants)) {
  bank +=
    `::: {#exr-${name} difficulty=introductory statement-visibility=open project="${
      input(name)
    }"}\nПолное условие.\n:::\n\n`;
}
bank +=
  `::: {#exr-full-image difficulty=introductory statement-visibility=open project="full/input.qmd"}\n![Файл](missing.txt)\n:::\n\n::: {#exr-false-link difficulty=introductory statement-visibility=open project="false/input.qmd"}\n[Ссылка](other.qmd)\n:::\n\n::: {#exr-false-anchor difficulty=introductory statement-visibility=open project="false/input.qmd"}\n[Ссылка](#absent)\n:::\n`;
await put("index.qmd", bank);
await renderFixture(root);
let metrics: any, fullFiles: string[] = [];
const budgets: { name: string; get: () => unknown }[] = [];
const start = performance.now();
await fixtureOperation(root, async (operation) => {
  native = operation;
  expiredFull = condition(input("full"));
  await Core.readProjectContexts([{
    owner: root,
    inputs: Object.keys(variants).map(input),
    profiles: [],
    format: "html",
  }], async ([op]) => {
    budgets.push({ name: "closure-seven-inputs", get: () => op.metrics });
    const contexts = Object.fromEntries(
      op.contexts.map((ctx, i) => [Object.keys(variants)[i], ctx]),
    );
    const noDemo = await Core.planProject(contexts.false, {
      audience: "student",
    });
    assert(noDemo.testsets.length === 0, "native child false lost");
    const noDemoBytes = await Core.materializeProject(
      noDemo,
      condition(input("false")),
      bindings,
    );
    assert(
      !noDemoBytes.files.some((f) =>
        f.target === "src/test/java/Demo.java" ||
        f.target === "src/test/java/Helper.java"
      ),
      "false testset pulled its helper",
    );
    await refuse(
      () => Core.planProject(contexts.conflict, { audience: "student" }),
      "PROJECT_CONFLICT",
      ["extra", "demo"],
    );
    await refuse(
      () => Core.planProject(contexts.unknown, { audience: "student" }),
      "PROJECT_UNKNOWN",
      ["demo", "missing"],
    );
    await refuse(
      () => Core.planProject(contexts.cycle, { audience: "student" }),
      "PROJECT_CYCLE",
      ["demo", "extra"],
    );
    const colliding = await Core.planProject(contexts.collision, {
      audience: "student",
    });
    await refuse(
      () =>
        Core.materializeProject(
          colliding,
          condition(input("collision")),
          bindings,
        ),
      "ARTIFACT_COLLISION",
    );
    const privateBuild = await Core.planProject(contexts["private-build"], {
      audience: "student",
    });
    await refuse(
      () =>
        Core.materializeProject(
          privateBuild,
          condition(input("private-build")),
          bindings,
        ),
      "ARTIFACT_PRIVATE",
    );
    const full = await Core.planProject(contexts.full, { audience: "full" });
    assert(full.testsets.includes("extra"), "full verification lost");
    const inventory = await Core.materializeProject(
      full,
      condition(input("full")),
      bindings,
    );
    fullFiles = inventory.files.map((f) => f.target);
    for (const name of ["reference", "alternative"]) {
      for (
        const path of [
          "build.gradle",
          "settings.gradle",
          "src/main/java/Main.java",
          "src/test/java/Demo.java",
          "src/test/java/Extra.java",
          "src/test/java/Helper.java",
          "README.md",
        ]
      ) {
        assert(
          fullFiles.includes("author/" + name + "/" + path),
          "independent author group incomplete " + name + "/" + path,
        );
      }
    }
    assert(
      inventory.files.every((f) => f.audience === "full"),
      "author file mislabelled student",
    );
    // A different exercise/code-project cannot reuse this plan.
    await refuse(
      () => Core.materializeProject(full, condition(input("false")), bindings),
      "CONDITION_BINDING",
    );
    // Missing resource and target collision fail before returning dependent bytes.
    const withImage = native.condition({
      source: "index.qmd",
      exerciseId: "exr-full-image",
      view: "student",
    });
    await refuse(
      () => Core.materializeProject(full, withImage, bindings),
      "RESOURCE_MISSING",
    );
    metrics = {
      context: () => op.metrics,
      plan: Core.projectPlanMetrics(full),
    };
  });
  // An unsafe final link binding cannot become a complete public artifact.
  await Core.readProjectContexts([{
    owner: root,
    inputs: [input("false")],
    profiles: [],
    format: "html",
  }], async ([op]) => {
    const plan = await Core.planProject(op.contexts[0], {
      audience: "student",
    });
    budgets.push({ name: "unsafe-link", get: () => op.metrics });
    const link = native.condition({
      source: "index.qmd",
      exerciseId: "exr-false-link",
      view: "student",
    });
    await refuse(
      () =>
        Core.materializeProject(plan, link, {
          ...bindings,
          links: { "other.qmd": "javascript:alert(1)" },
        }),
      "CONDITION_LINK",
    );
  });
  // An unresolved local anchor must not be emitted as an apparently complete README.
  await Core.readProjectContexts([{
    owner: root,
    inputs: [input("false")],
    profiles: [],
    format: "html",
  }], async ([op]) => {
    const plan = await Core.planProject(op.contexts[0], {
      audience: "student",
    });
    budgets.push({ name: "missing-anchor", get: () => op.metrics });
    const missingAnchor = native.condition({
      source: "index.qmd",
      exerciseId: "exr-false-anchor",
      view: "student",
    });
    await refuse(
      () => Core.materializeProject(plan, missingAnchor, bindings),
      "CONDITION_ANCHOR",
    );
  });
});
// Snapshot currentness: a selected physical input changed before any dependent inventory.
let changed = "";
try {
  await Core.readProjectContexts([{
    owner: root,
    inputs: [input("full")],
    profiles: [],
    format: "html",
  }], async ([op]) => {
    budgets.push({ name: "currentness", get: () => op.metrics });
    const plan = await Core.planProject(op.contexts[0], {
      audience: "student",
    });
    await Deno.writeTextFile(
      join(root, "full/starter/src/main/java/Main.java"),
      "class Changed {}\n",
    );
    await Core.materializeProject(plan, expiredFull, bindings);
  });
} catch (error) {
  changed = String(error);
}
assert(
  changed.includes("CONTEXT_CHANGED"),
  "changed source accepted: " + changed,
);

console.log(JSON.stringify({
  status: "PASS",
  root,
  wallMs: Math.round(performance.now() - start),
  budget: metrics.context(),
  planMetrics: metrics.plan,
  operations: budgets.map(({ name, get }) => ({ name, metrics: get() })),
  fullFiles,
}));
