import { fail } from "../_extensions/course-core/contracts/project.ts";
import { join, resolve } from "stdlib/path";
import {
  assignmentBeforeChild,
  assignmentChild,
  withAssignmentBeforeChild,
  withAssignmentExecution,
} from "../_extensions/course-core/runtime/assignment-execution.ts";
import type { AssignmentRuntimeWitness } from "../_extensions/course-core/runtime/assignment-admission.ts";
import {
  assertSources,
  hash,
  signature,
  snapshot,
} from "../_extensions/course-core/runtime/source-snapshot.ts";
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
  implementationFiles: [],
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
      await Deno.mkdir(join(bin, "tools", Deno.build.arch), { recursive: true });
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
        DENO_DOM_PLUGIN: join(bin, "tools", Deno.build.arch, "deno_dom/libplugin.so"),
        DENO_TLS_CA_STORE: "system,mozilla",
        DENO_NO_UPDATE_CHECK: "1",
      });
      const makeOperation = (
        env: Readonly<Record<string, string>>,
        version = "1.11.5",
      ) => {
        let live = true;
        const op = publicOperation({
          state: {
            root: toolRoot,
            rows: [],
            memberships: {},
            sourcePolicy: "static",
            ownerWitness: { quarto: { version } },
            assignment: { runtime: { ...runtime, executable: quarto } },
          },
          documents: [],
          releaseDocuments: [],
          resources: [],
          catalog: { identity: { profiles: [] }, documents: [] },
        }, () => {
          if (!live) fail("OPERATION_EXPIRED", "Pandoc fixture scope закрыт");
        }, async () => {}, {}, { active: 0, failed: false }, () => {},
        () => {}, { environment: env, cwd: toolRoot });
        return { op, close: () => { live = false; } };
      };
      const normal = makeOperation(environment);
      assert(typeof normal.op.pandocBinding === "function", "MISSING_PANDOC_BINDING");
      const selected = await normal.op.pandocBinding();
      assert(selected?.executable === bundled && selected.cwd === toolRoot &&
        selected.environment === environment && selected.diagnosticTool === quarto &&
        Object.isFrozen(selected), "Неверный native Pandoc binding");
      await Deno.remove(bundled);
      assert(await normal.op.pandocBinding() === selected,
        "Cached operation перевыбрала Pandoc после первого выбора");
      normal.close();
      await refuse(() => normal.op.pandocBinding(), "OPERATION_EXPIRED");
      for (const override of [custom, join(toolRoot, "custom")]) {
        const op = makeOperation(Object.freeze({ ...environment, QUARTO_PANDOC: override })).op;
        assert((await op.pandocBinding())?.executable === custom,
          "Custom file/directory Pandoc override потерян");
      }
      for (const [env, version] of [
        [{ ...environment, QUARTO_DEBUG: "true" }, "1.11.5"],
        [{ ...environment, QUARTO_BIN_PATH: toolRoot }, "1.11.5"],
        [{ ...environment, QUARTO_PANDOC: join(toolRoot, "missing") }, "1.11.5"],
        [{ ...environment, DENO_TLS_CA_STORE: "other" }, "1.11.5"],
        [environment, "1.12.0"],
      ] as const) {
        assert(await makeOperation(Object.freeze(env), version).op.pandocBinding() === undefined,
          "Неизвестная composition не вернулась к Quarto CLI");
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
    original.slice(start, end) + ";return run();",
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
          sourcePolicy: "static",
          rows: [],
          memberships: {},
          metrics: { sourceHashBytes: 0 },
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
  for (
    const mode of [
      "stable",
      "source",
      "membership",
      "warm",
      "explicit",
      "entry",
      "host",
      "throw",
      "expired",
      "next",
      "nested",
      "child-error",
      "closing-race",
      "child-expiry",
      "symlink",
      "resource-first-read",
      "general",
    ]
  ) {
    if (Deno.env.get("CHECKPOINT_ONLY_GENERAL") && mode !== "general") continue;
    const root = await Deno.makeTempDir({ prefix: "checkpoint-unit-" });
    try {
      await Deno.writeTextFile(root + "/index.qmd", "# Исходный текст\n");
      await Deno.mkdir(root + "/empty");
      await Deno.writeTextFile(root + "/visible.txt", "VISIBLE_BYTES");
      const resource = {
        source: "visible.txt",
        path: root + "/visible.txt",
        signature: signature(await Deno.lstat(root + "/visible.txt")),
        sha256: await hash(new TextEncoder().encode("VISIBLE_BYTES")),
        size: 13,
        documents: [],
      };
      const state: any = {
        root,
        outputDirectory: root + "/_site",
        rows: [],
        memberships: {},
        relevantInputs: [],
        metrics: {
          fullWalks: 0,
          sourceDirectoryReads: 0,
          sourceHashReads: 0,
          sourceHashBytes: 0,
          fullSourceFences: 0,
          localSourceFences: 0,
        },
      };
      await snapshot(state);
      Object.assign(state, {
        sourcePolicy: mode === "general" ? "general" : "static",
        ownerWitness: { quarto: { version: "1.11.5" }, files: { config: [] } },
        profiles: [],
        projection: "student",
      });
      let live = true,
        failed = false,
        full = 0,
        host = 0,
        oldBefore = 0,
        closed: any;
      const batches = { active: 0, failed: false };
      const sync = () => {
        if (!live) throw Error("OPERATION_EXPIRED");
      };
      const savedEnvironment = JSON.stringify(
          Object.entries(Deno.env.toObject()).sort(),
        ),
        savedCwd = Deno.cwd();
      const hostGuard = () => {
        sync();
        host++;
        if (
          failed || Deno.cwd() !== savedCwd ||
          JSON.stringify(Object.entries(Deno.env.toObject()).sort()) !==
            savedEnvironment
        ) throw Error("OPERATION_CHANGED: host");
      };
      const guard = async (force = false) => {
        sync();
        if (batches.failed) throw Error("OPERATION_INCOMPLETE");
        if (force) {
          full++;
          await assertSources(state, [], true);
          if (mode === "closing-race" && full === 2) {
            await Promise.resolve();
            try {
              await closed();
            } catch {}
          }
        }
      };
      const op = publicOperation(
        {
          state,
          documents: [],
          releaseDocuments: [],
          resources: [resource],
          catalog: {
            identity: { operation: "unit", root, profiles: [] },
            documents: [],
          },
        },
        sync,
        guard,
        {},
        batches,
        hostGuard,
        () => {},
      );
      const run = async (use: any) =>
        await withAssignmentExecution(
          { ...runtime, outputDirectory: root + "/_site" },
          root,
          () => op.withProjectContexts([], use),
          async () => {
            oldBefore++;
            await guard(true);
          },
        );
      if (mode === "entry") {
        await Deno.writeTextFile(root + "/index.qmd", "Изменено");
      }
      if (mode === "warm") {
        await run(async (batch: any) => {
          await batch.checkpoint();
        });
      }
      const start = full;
      let calls = 0, retainedChild: (() => Promise<void>) | undefined;
      const body = async (batch: any) => {
        calls++;
        closed = batch.checkpoint;
        assert(typeof closed === "function", "MISSING_BATCH_CHECKPOINT");
        const baseline = full;
        if (mode === "general") {
          await batch.checkpoint();
          assert(full === baseline, "GENERAL_CHECKPOINT_FORCED_FULL");
        }
        for (let i = 0; i < repeat; i++) {
          await batch.checkpoint();
          await assignmentBeforeChild();
        }
        assert(
          mode === "general" ? full > baseline : full === baseline,
          "Повторный full fence в static batch",
        );
        if (["source", "warm", "explicit"].includes(mode)) {
          await Deno.writeTextFile(root + "/index.qmd", "Изменено");
        }
        if (mode === "membership") {
          await Deno.writeTextFile(root + "/new.qmd", "Новый файл");
        }
        if (mode === "resource-first-read") {
          await Deno.writeTextFile(root + "/visible.txt", "CHANGED_BYTES");
          await op.resourceInventory({
            files: [{ source: "visible.txt", target: "visible.txt" }],
          });
        }
        if (mode === "symlink") {
          await Deno.remove(root + "/empty");
          await Deno.symlink(root, root + "/empty");
        }
        if (mode === "child-expiry") {
          let release!: () => void;
          const pending = new Promise<void>((r) => release = r);
          const child = pending.then(() => assignmentBeforeChild());
          retainedChild = async () => {
            release();
            await child;
          };
        }
        if (mode === "explicit") await op.assertCurrent();
        if (mode === "host") {
          Deno.env.set("CORE_CHECKPOINT_HOST_MUTANT", "changed");
          try {
            await batch.checkpoint();
          } finally {
            Deno.env.delete("CORE_CHECKPOINT_HOST_MUTANT");
          }
        }
        if (mode === "throw") throw Error("CALLBACK_SENTINEL");
        if (mode === "nested") await run(async () => {});
        if (mode === "child-error") {
          failed = true;
          await assignmentBeforeChild();
        }
      };
      if (
        [
          "source",
          "membership",
          "warm",
          "explicit",
          "entry",
          "host",
          "child-error",
          "symlink",
          "resource-first-read",
        ].includes(mode)
      ) await refuse(() => run(body), "OPERATION_CHANGED");
      else if (mode === "closing-race") {
        await refuse(() => run(body), "OPERATION_INCOMPLETE");
      } else if (mode === "throw") {
        await refuse(() => run(body), "CALLBACK_SENTINEL");
      } else if (mode === "nested") {
        await refuse(() => run(body), "CONTEXT_REQUEST");
      } else await run(body);
      if (mode === "entry") {
        assert(calls === 0, "Изменённый source вошёл в callback");
      }
      if (mode === "stable") {
        assert(full - start === 2, "Не две полные границы: " + (full - start));
        assert(oldBefore === 0, "Старый beforeChild не заменён");
      }
      if (mode === "general") {
        assert(oldBefore === repeat, "General потерял старый beforeChild");
      }
      if (mode === "child-expiry") {
        await refuse(() => retainedChild!(), "OPERATION_EXPIRED");
      }
      if (mode === "expired") await refuse(() => closed(), "OPERATION_EXPIRED");
      if (mode === "next") {
        await refuse(() =>
          run(async () => {
            await closed();
          }), "OPERATION_EXPIRED");
      }
      if (mode === "throw" || mode === "child-error") {
        await refuse(() => run(async () => {}), "CONTEXT_REQUEST");
      }
      live = false;
      results.push({
        mode,
        full,
        host,
        oldBefore,
        fullSourceFences: state.metrics.fullSourceFences,
        sourceDirectoryReads: state.metrics.sourceDirectoryReads,
      });
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
