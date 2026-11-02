import { fail } from "../_extensions/course-core/contracts/project.ts";
import {
  assignmentBeforeChild,
  assignmentChild,
  withAssignmentBeforeChild,
  withAssignmentExecution,
} from "../_extensions/course-core/runtime/assignment-execution.ts";
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
const results: any[] = [];
try {
  const { publicOperation } = await import(modulePath.href);
  await withAssignmentExecution(
    { native: { executable: "/fixture/quarto" } } as any,
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
    original.slice(start, end) + ";return run();",
  );
  for (const mutant of ["failed", "active", "expired"]) {
    const batches = { active: 0, failed: false };
    let live = true;
    await refuse(
      () =>
        executeOuter(async () => "staged", {}, batches, async () => {
          await Promise.resolve();
          if (mutant === "failed") batches.failed = true;
          if (mutant === "active") batches.active = 1;
          if (mutant === "expired") live = false;
        }, () => {
          if (!live) throw Error("OPERATION_EXPIRED");
          if (batches.failed) throw Error("OPERATION_INCOMPLETE");
        }, fail),
      mutant === "expired" ? "OPERATION_EXPIRED" : "OPERATION_INCOMPLETE",
    );
    results.push({ outerClosingMutant: mutant, rejected: true });
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
      );
      const run = async (use: any) =>
        await withAssignmentExecution(
          { native: { executable: "/fixture/quarto" } } as any,
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
