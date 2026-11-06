import { fail } from "../_extensions/course-core/contracts/project.ts";
import { join, resolve } from "stdlib/path";
import {
  assignmentBeforeChild,
  assignmentChild,
  assignmentPandocChild,
  withAssignmentBeforeChild,
  withAssignmentExecution,
} from "../_extensions/course-core/runtime/assignment-execution.ts";
import type { AssignmentRuntimeWitness } from "../_extensions/course-core/runtime/assignment-admission.ts";
const modulePath = new URL(
  "../_extensions/course-core/runtime/.static-checkpoint-test.ts",
  import.meta.url,
);
const original = await Deno.readTextFile(
  Deno.env.get("CORE_TEST_OPERATION_SOURCE") ??
    new URL("../_extensions/course-core/runtime/operation.ts", import.meta.url),
);
await Deno.writeTextFile(
  modulePath,
  original.replace(
    "function publicOperation(",
    "export function publicOperation(",
  ),
);
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
async function refuse(use: () => Promise<unknown>, text: string) {
  let error = "";
  try {
    await use();
  } catch (e) {
    error = String(e);
  }
  assert(
    error.includes(text),
    "Отказ ожидался: " + text + "; получено " + error,
  );
}
const repeat = Number(Deno.env.get("CHECKPOINT_REPEATS") ?? "5");
if (!Number.isSafeInteger(repeat) || repeat < 1 || repeat > 1000) {
  throw Error("Неверный unit benchmark repeat");
}
const results: unknown[] = [];
const runtime: AssignmentRuntimeWitness = {
  executable: "/fixture/quarto",
  profiles: [],
  environment: {},
  outputDirectory: "/fixture/_site",
  inputs: ["index.qmd"],
};
try {
  const { publicOperation } = await import(modulePath.href);
  // Выбор native Pandoc не запускает CLI и живёт в existing operation scope.
  if (Deno.build.os === "linux") {
    const toolRoot = await Deno.makeTempDir({ prefix: "pandoc-binding-unit-" });
    try {
      const bin = join(toolRoot, "bin"),
        quarto = join(bin, "quarto"),
        bundled = join(bin, "tools", Deno.build.arch, "pandoc"),
        custom = join(toolRoot, "custom", "pandoc");
      await Deno.mkdir(join(bin, "tools", Deno.build.arch), {
        recursive: true,
      });
      await Deno.mkdir(join(toolRoot, "share"));
      await Deno.mkdir(join(toolRoot, "custom"));
      for (const path of [quarto, join(bin, "quarto.js"), bundled, custom]) {
        await Deno.writeTextFile(path, "fixture: не запускается\n");
      }
      const environment = Object.freeze({
        QUARTO: quarto,
        QUARTO_BIN_PATH: bin,
        QUARTO_SHARE_PATH: join(toolRoot, "share"),
        QUARTO_ROOT: resolve(bin, "../../.."),
        QUARTO_DENO: join(bin, "tools", Deno.build.arch, "deno"),
        DENO_DOM_PLUGIN: join(
          bin,
          "tools",
          Deno.build.arch,
          "deno_dom/libplugin.so",
        ),
        DENO_TLS_CA_STORE: "system,mozilla",
        DENO_NO_UPDATE_CHECK: "1",
      });
      const makeOperation = (
        env: Readonly<Record<string, string>>,
        version = "1.11.5",
      ) => {
        let live = true;
        const op = publicOperation(
          {
            state: {
              root: toolRoot,
              ownerWitness: { quarto: { version } },
              assignment: { runtime: { ...runtime, executable: quarto } },
            },
            documents: [],
            releaseDocuments: [],
            resources: [],
            catalog: { identity: { profiles: [] }, documents: [] },
          },
          () => {
            if (!live) fail("OPERATION_EXPIRED", "Pandoc fixture scope закрыт");
          },
          async () => {},
          {},
          { active: 0, failed: false },
          () => {},
          () => {},
          { environment: env, cwd: toolRoot },
        );
        return {
          op,
          close: () => {
            live = false;
          },
        };
      };
      const normal = makeOperation(environment);
      assert(
        typeof normal.op.pandocBinding === "function",
        "MISSING_PANDOC_BINDING",
      );
      const selected = await normal.op.pandocBinding();
      assert(
        selected?.executable === bundled && selected.cwd === toolRoot &&
          selected.environment === environment &&
          selected.diagnosticTool === quarto &&
          Object.isFrozen(selected),
        "Неверный native Pandoc binding",
      );
      const hostExtra = makeOperation(
        Object.freeze({ ...environment, HOST_CAPTURE_ONLY: "private" }),
      );
      const childArgs = [
        "pandoc",
        "--from",
        "markdown",
        "--to",
        "json",
        "--wrap=none",
      ];
      await withAssignmentExecution(
        { ...runtime, executable: quarto, environment },
        toolRoot,
        async () => {
          const life = { active: true };
          await withAssignmentBeforeChild(
            async () => {},
            async () => {
              const child = await assignmentPandocChild(
                quarto,
                childArgs,
                toolRoot,
              );
              assert(
                child?.executable === bundled &&
                  child.options.clearEnv === true &&
                  JSON.stringify(child.options.args) ===
                    JSON.stringify(childArgs.slice(1)) &&
                  child.options.cwd === toolRoot &&
                  JSON.stringify(child.options.env) ===
                    JSON.stringify(environment),
                "Materializer runner не использует существующий frozen binding",
              );
              await refuse(() =>
                assignmentPandocChild(
                  quarto,
                  ["pandoc", "--unknown"],
                  toolRoot,
                ), "BODY.PRODUCER_INPUT_CHANGED");
              await refuse(
                () =>
                  assignmentPandocChild(
                    quarto,
                    childArgs,
                    toolRoot + "/foreign",
                  ),
                "BODY.PRODUCER_INPUT_CHANGED",
              );
              await refuse(
                () =>
                  assignmentPandocChild(quarto, childArgs, toolRoot, {
                    PRIVATE_OVERRIDE: "foreign",
                  }),
                "BODY.PRODUCER_INPUT_CHANGED",
              );
              life.active = false;
              await refuse(
                () => assignmentPandocChild(quarto, childArgs, toolRoot),
                "OPERATION_EXPIRED",
              );
            },
            life,
            () => hostExtra.op.pandocBinding(),
          );
          await withAssignmentBeforeChild(
            async () => {},
            async () => {
              const child = await assignmentPandocChild(
                quarto,
                childArgs,
                toolRoot,
              );
              assert(
                child?.executable === quarto &&
                  JSON.stringify(child.options.args) ===
                    JSON.stringify(childArgs),
                "Unknown composition потеряла qualified Quarto fallback",
              );
            },
            { active: true },
            async () => undefined,
          );
        },
      );
      await withAssignmentExecution(
        {
          ...runtime,
          executable: quarto,
          environment: { ...environment, QUARTO_PANDOC: custom },
        },
        toolRoot,
        async () => {
          await withAssignmentBeforeChild(
            async () => {},
            async () => {
              const child = await assignmentPandocChild(
                quarto,
                childArgs,
                toolRoot,
              );
              assert(
                child?.executable === quarto &&
                  child.options.env.QUARTO_PANDOC === custom,
                "Host Pandoc override обошёл frozen assignment runtime",
              );
            },
            { active: true },
            () => hostExtra.op.pandocBinding(),
          );
        },
      );
      await withAssignmentExecution(
        { ...runtime, executable: quarto, environment },
        toolRoot,
        async () => {
          await withAssignmentBeforeChild(
            async () => {},
            async () => {
              const child = await assignmentPandocChild(
                quarto,
                childArgs,
                toolRoot,
              );
              assert(
                child?.executable === quarto &&
                  !Object.hasOwn(child.options.env, "HOST_CAPTURE_ONLY"),
                "Отличающийся host transport не сохранил frozen fallback",
              );
            },
            { active: true },
            () => hostExtra.op.pandocBinding(),
          );
        },
      );
      const awaitingLife = { active: true };
      await withAssignmentExecution(
        { ...runtime, executable: quarto, environment },
        toolRoot,
        async () => {
          await refuse(() =>
            withAssignmentBeforeChild(
              async () => {},
              async () => {
                await assignmentPandocChild(quarto, childArgs, toolRoot);
              },
              awaitingLife,
              async () => {
                await Promise.resolve();
                awaitingLife.active = false;
                return selected;
              },
            ), "OPERATION_EXPIRED");
        },
      );
      await Deno.remove(bundled);
      assert(
        await normal.op.pandocBinding() === selected,
        "Cached operation перевыбрала Pandoc после первого выбора",
      );
      normal.close();
      await refuse(() => normal.op.pandocBinding(), "OPERATION_EXPIRED");
      for (const override of [custom, join(toolRoot, "custom")]) {
        const op = makeOperation(
          Object.freeze({ ...environment, QUARTO_PANDOC: override }),
        ).op;
        assert(
          (await op.pandocBinding())?.executable === custom,
          "Custom file/directory Pandoc override потерян",
        );
      }
      for (
        const [env, version] of [
          [{ ...environment, QUARTO_DEBUG: "true" }, "1.11.5"],
          [{ ...environment, QUARTO_BIN_PATH: toolRoot }, "1.11.5"],
          [
            { ...environment, QUARTO_PANDOC: join(toolRoot, "missing") },
            "1.11.5",
          ],
          [{ ...environment, DENO_TLS_CA_STORE: "other" }, "1.11.5"],
          [environment, "1.12.0"],
        ] as const
      ) {
        assert(
          await makeOperation(Object.freeze(env), version).op
            .pandocBinding() === undefined,
          "Неизвестная composition не вернулась к Quarto CLI",
        );
      }
      results.push({ pandocBinding: "bundled_custom_cached_expired_fallback" });
    } finally {
      await Deno.remove(toolRoot, { recursive: true });
    }
  }
  await withAssignmentExecution(
    runtime,
    "/fixture",
    async () => {
      const life = { active: true };
      await withAssignmentBeforeChild(async () => {}, async () => {
        await assignmentBeforeChild();
        life.active = false;
        await refuse(async () => {
          assignmentChild("quarto", [], "/fixture");
        }, "OPERATION_EXPIRED");
      }, life);
    },
  );
  results.push({ beforeChildSpawnInterleaving: "refused_before_command" });
  // Исполняется точный closing run из production Source, а не его тестовая копия.
  const start = original.indexOf(
    "  const run = async () => {",
    original.indexOf("export async function withCurrentNativeOperation"),
  );
  const end = original.indexOf("\n  try {\n    await guard(true);", start);
  assert(start >= 0 && end > start, "Outer closing Source не найден");
  const executeOuter = new Function(
    "use",
    "operation",
    "projectBatches",
    "guard",
    "hostGuard",
    "fail",
    "withAssignmentBeforeChild",
    "beforeOperationChild",
    "callbackLife",
    original.slice(start, end).replace(": Deno.FileInfo", "") +
      ";return run();",
  );
  for (const mutant of ["failed", "active", "expired"]) {
    const batches = { active: 0, failed: false };
    let live = true;
    await refuse(
      () =>
        executeOuter(
          async () => "staged",
          {},
          batches,
          async () => {
            await Promise.resolve();
            if (mutant === "failed") batches.failed = true;
            if (mutant === "active") batches.active = 1;
            if (mutant === "expired") live = false;
          },
          () => {
            if (!live) throw Error("OPERATION_EXPIRED");
            if (batches.failed) throw Error("OPERATION_INCOMPLETE");
          },
          fail,
          withAssignmentBeforeChild,
          async () => {},
          { active: true },
        ),
      mutant === "expired" ? "OPERATION_EXPIRED" : "OPERATION_INCOMPLETE",
    );
    results.push({ outerClosingMutant: mutant, rejected: true });
  }
  // Реальная publicOperation batch может закончиться 0→1→0 во время outer await.
  if (!Deno.env.get("CHECKPOINT_ONLY_GENERAL")) {
    const phase = { active: true }, batches = { active: 0, failed: false };
    let lateCallbacks = 0, lateError = "";
    const callbackGuard = () => {
      if (!phase.active) {
        batches.failed = true;
        fail("OPERATION_EXPIRED", "Outer callback closed");
      }
    };
    const op = publicOperation(
      {
        state: {
          root: "/unit",
          metrics: {},
          ownerWitness: {
            quarto: { version: "1.11.5" },
            files: { config: [] },
          },
        },
        documents: [],
        releaseDocuments: [],
        resources: [],
        catalog: { identity: { profiles: [] }, documents: [] },
      },
      () => {},
      async () => {},
      {},
      batches,
      () => {},
      callbackGuard,
    );
    await refuse(
      () =>
        executeOuter(
          async () => "staged",
          op,
          batches,
          async () => {
            try {
              await op.withProjectContexts([], async (batch: any) => {
                lateCallbacks++;
                await batch.checkpoint();
              });
            } catch (e) {
              lateError = String(e);
            }
          },
          () => {},
          fail,
          withAssignmentBeforeChild,
          async () => {},
          phase,
        ),
      "OPERATION_INCOMPLETE",
    );
    assert(
      lateCallbacks === 0 && lateError.includes("OPERATION_EXPIRED") &&
        batches.active === 0 && batches.failed,
      "Late batch accepted during closing",
    );
    results.push({ outerClosingZeroOneZero: "refused_sticky_before_callback" });
  }
  if (!Deno.env.get("CHECKPOINT_ONLY_GENERAL")) {
    await withAssignmentExecution(
      runtime,
      "/fixture",
      async () => {
        const phase = { active: true }, batches = { active: 0, failed: false };
        let release!: () => void, child!: Promise<void>;
        await executeOuter(
          async () => {
            const pending = new Promise<void>((r) => release = r);
            child = pending.then(() => {
              assignmentChild("quarto", [], "/fixture");
            });
            return "staged";
          },
          {},
          batches,
          async () => {
            release();
            await refuse(() => child, "OPERATION_EXPIRED");
          },
          () => {},
          fail,
          withAssignmentBeforeChild,
          async () => {},
          phase,
        );
      },
    );
    results.push({ outerClosingRetainedChild: "refused_before_command" });
  }
  for (const mode of ["stable", "throw", "expired", "nested", "source-edit"]) {
    const root = await Deno.makeTempDir({ prefix: "operation-lifecycle-" });
    try {
      await Deno.writeTextFile(join(root, "index.qmd"), "Исходный текст");
      let live = true;
      const batches = { active: 0, failed: false };
      const sync = () => {
        if (!live) fail("OPERATION_EXPIRED", "Операция закрыта");
      };
      const op = publicOperation(
        {
          state: {
            root,
            outputDirectory: join(root, "_site"),
            profiles: [],
            projection: "student",
            ownerWitness: {
              quarto: { version: "1.11.5" },
              files: { config: [] },
            },
            metrics: {},
          },
          documents: [],
          releaseDocuments: [],
          resources: [],
          catalog: { identity: { profiles: [] }, documents: [] },
        },
        sync,
        async () => sync(),
        {},
        batches,
        sync,
        sync,
      );
      let retained: () => Promise<void> = async () => {};
      const run = () =>
        op.withProjectContexts([], async (batch: any) => {
          retained = batch.checkpoint;
          await batch.checkpoint();
          if (mode === "throw") throw Error("CALLBACK_SENTINEL");
          if (mode === "nested") {
            await op.withProjectContexts([], async () => {});
          }
          if (mode === "source-edit") {
            await Deno.writeTextFile(join(root, "index.qmd"), "Изменено");
            await Deno.writeTextFile(join(root, "new.qmd"), "Новый файл");
            await batch.checkpoint();
          }
        });
      if (mode === "throw") await refuse(run, "CALLBACK_SENTINEL");
      else if (mode === "nested") await refuse(run, "CONTEXT_REQUEST");
      else await run();
      await refuse(retained, "OPERATION_EXPIRED");
      live = false;
      await refuse(
        () => op.withProjectContexts([], async () => {}),
        "OPERATION_EXPIRED",
      );
      results.push({ mode, lifecycle: true });
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  }
  console.log(
    JSON.stringify({
      status: "PASS_PRIVATE_UNIT_NOT_NATIVE_QUALIFICATION",
      repeat,
      results,
    }),
  );
} finally {
  await Deno.remove(modulePath);
}
