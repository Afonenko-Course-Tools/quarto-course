import { strict as assert } from "node:assert";
import { join, resolve } from "stdlib/path";
import type { NativeOperation } from "../_extensions/course-core/public.ts";
import {
  assignmentBeforeChild,
  assignmentChild,
  assignmentPandocChild,
  withAssignmentBeforeChild,
  withAssignmentExecution,
} from "../_extensions/course-core/runtime/assignment-execution.ts";
import { selectNativePandoc } from "../_extensions/course-core/runtime/pandoc-binding.ts";
import { operationFixture } from "./helpers/operation-fixture.ts";
import { fixtureSet, required } from "./helpers/required.ts";

const refuses = (use: () => unknown | Promise<unknown>, code: string) =>
  assert.rejects(
    async () => await use(),
    (error: unknown) => error instanceof Error && error.message.includes(code),
  );
const runtime = {
  executable: "/fixture/quarto",
  profiles: [],
  environment: {},
  outputDirectory: "/fixture/_site",
  inputs: ["index.qmd"],
};
const fixture = await operationFixture();
try {
  // Чистый выбор инструмента проверяется у владельца, без private operation factory.
  if (Deno.build.os === "linux") {
    const root = await Deno.makeTempDir({ prefix: "pandoc-binding-" });
    try {
      const bin = join(root, "bin"),
        quarto = join(bin, "quarto"),
        bundled = join(bin, "tools", Deno.build.arch, "pandoc"),
        custom = join(root, "custom", "pandoc");
      await Deno.mkdir(join(bin, "tools", Deno.build.arch), {
        recursive: true,
      });
      await Deno.mkdir(join(root, "share"));
      await Deno.mkdir(join(root, "custom"));
      for (const path of [quarto, join(bin, "quarto.js"), bundled, custom]) {
        await Deno.writeTextFile(path, "fixture: не запускается\n");
      }
      const environment = Object.freeze({
        QUARTO: quarto,
        QUARTO_BIN_PATH: bin,
        QUARTO_SHARE_PATH: join(root, "share"),
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
      const select = (
        env: Readonly<Record<string, string>> = environment,
        version = "1.11.5",
      ) => selectNativePandoc(quarto, version, { environment: env, cwd: root });
      const selected = required(await select());
      assert.equal((await select(environment, "1.12.1"))?.executable, bundled);
      assert.equal(selected.executable, bundled);
      assert.equal(selected.cwd, root);
      assert.equal(selected.environment, environment);
      assert.equal(selected.diagnosticTool, quarto);
      assert.ok(Object.isFrozen(selected));
      for (const override of [custom, join(root, "custom")]) {
        assert.equal(
          (await select(
            Object.freeze({ ...environment, QUARTO_PANDOC: override }),
          ))?.executable,
          custom,
        );
      }
      for (
        const [env, version] of [
          [{ ...environment, QUARTO_DEBUG: "true" }, "1.11.5"],
          [{ ...environment, QUARTO_BIN_PATH: root }, "1.11.5"],
          [{ ...environment, QUARTO_PANDOC: join(root, "missing") }, "1.11.5"],
          [{ ...environment, DENO_TLS_CA_STORE: "other" }, "1.11.5"],
          [environment, "1.12.0"],
          [{ ...environment, BASH_ENV: join(root, "shell-setup") }, "1.12.1"],
          [{ ...environment, QUARTO_LOCK_OPTIONS: "--frozen" }, "1.12.1"],
        ] as const
      ) {
        assert.equal(
          await select(env, version),
          undefined,
          "Неизвестная composition должна использовать Quarto CLI",
        );
      }
      const args = [
        "pandoc",
        "--from",
        "markdown",
        "--to",
        "json",
        "--wrap=none",
      ];
      const fixed = { ...runtime, executable: quarto, environment };
      await withAssignmentExecution(fixed, root, async () => {
        const life = { active: true };
        await withAssignmentBeforeChild(
          async () => {},
          async () => {
            const child = required(
              await assignmentPandocChild(quarto, args, root),
            );
            assert.equal(child.executable, bundled);
            assert.equal(child.options.clearEnv, true);
            assert.deepEqual(child.options.args, args.slice(1));
            assert.deepEqual(child.options.env, { ...environment, PWD: root });
            assert.equal(child.options.cwd, root);
            await refuses(
              () =>
                assignmentPandocChild(quarto, ["pandoc", "--unknown"], root),
              "BODY.PRODUCER_INPUT_CHANGED",
            );
            await refuses(
              () => assignmentPandocChild(quarto, args, root + "/foreign"),
              "BODY.PRODUCER_INPUT_CHANGED",
            );
            await refuses(
              () =>
                assignmentPandocChild(quarto, args, root, {
                  PRIVATE_OVERRIDE: "foreign",
                }),
              "BODY.PRODUCER_INPUT_CHANGED",
            );
            life.active = false;
            await refuses(
              () => assignmentPandocChild(quarto, args, root),
              "OPERATION_EXPIRED",
            );
          },
          life,
          async () => selected,
        );
        await withAssignmentBeforeChild(
          async () => {},
          async () => {
            const child = required(
              await assignmentPandocChild(quarto, args, root),
            );
            assert.equal(child.executable, quarto);
            assert.deepEqual(child.options.args, args);
          },
          { active: true },
          async () => undefined,
        );
        const extra = required(
          await select(
            Object.freeze({ ...environment, HOST_CAPTURE_ONLY: "private" }),
          ),
        );
        await withAssignmentBeforeChild(
          async () => {},
          async () => {
            const child = required(
              await assignmentPandocChild(quarto, args, root),
            );
            assert.equal(child.executable, quarto);
            assert.ok(
              !Object.hasOwn(required(child.options.env), "HOST_CAPTURE_ONLY"),
            );
          },
          { active: true },
          async () => extra,
        );
        const awaiting = { active: true };
        await refuses(
          () =>
            withAssignmentBeforeChild(
              async () => {},
              async () => {
                await assignmentPandocChild(quarto, args, root);
              },
              awaiting,
              async () => {
                await Promise.resolve();
                awaiting.active = false;
                return selected;
              },
            ),
          "OPERATION_EXPIRED",
        );
      });
      await withAssignmentExecution(
        { ...fixed, environment: { ...environment, QUARTO_PANDOC: custom } },
        root,
        async () => {
          await withAssignmentBeforeChild(
            async () => {},
            async () => {
              const child = required(
                await assignmentPandocChild(quarto, args, root),
              );
              assert.equal(child.executable, quarto);
              assert.equal(child.options.env.QUARTO_PANDOC, custom);
            },
            { active: true },
            async () => selected,
          );
        },
      );
      // Проверяем caching/expiry настоящего public reader на внешнем capture.
      // Меняются только tool metadata fixture; исполняемый код не переписывается.
      const captured = await Deno.readTextFile(fixture.completePath);
      const complete: unknown = JSON.parse(captured);
      fixtureSet(
        complete,
        ["state", "ownerWitness", "quarto", "version"],
        "1.11.5",
      );
      fixtureSet(complete, ["state", "assignment"], {
        assessments: [{ source: "bank.qmd", id: "work" }],
        runtime: {
          ...fixed,
          profiles: ["full"],
          outputDirectory: fixture.expectation.outputDirectory,
          inputs: ["bank.qmd"],
        },
      });
      const previousEnvironment = Deno.env.toObject();
      let retainedBinding: (() => Promise<unknown>) | undefined;
      try {
        for (const key of Object.keys(previousEnvironment)) {
          Deno.env.delete(key);
        }
        for (const [key, value] of Object.entries(environment)) {
          Deno.env.set(key, value);
        }
        const ordinary: unknown = JSON.parse(captured);
        fixtureSet(
          ordinary,
          ["state", "ownerWitness", "quarto", "version"],
          "1.12.1",
        );
        await Deno.writeTextFile(
          fixture.completePath,
          JSON.stringify(ordinary),
        );
        await fixture.use(async (op) => {
          const selected = required(await op.pandocBinding());
          const direct = required(
            await assignmentPandocChild(quarto, args, fixture.expectation.root),
          );
          assert.equal(direct.executable, bundled);
          assert.equal(direct.options.env.PWD, fixture.expectation.root);
          const offline = required(
            await assignmentPandocChild(
              quarto,
              args,
              fixture.expectation.root,
              { QUARTO_RUN_NO_NETWORK: "true" },
            ),
          );
          assert.equal(offline.executable, bundled);
          assert.equal(offline.options.env.QUARTO_RUN_NO_NETWORK, "true");
          assert.equal(
            assignmentChild(quarto, ["inspect", root], root),
            undefined,
            "Ordinary tool scope created assignment authority",
          );
          assert.equal(
            await assignmentPandocChild(
              quarto,
              ["pandoc", "--unknown"],
              fixture.expectation.root,
            ),
            undefined,
          );
          assert.equal(
            await assignmentPandocChild(
              quarto,
              args,
              fixture.expectation.root,
              {
                UNQUALIFIED_ENV: "changed",
              },
            ),
            undefined,
            "Changed env bypassed launcher",
          );
          const life = { active: true };
          await withAssignmentBeforeChild(
            async () => {},
            async () => {
              life.active = false;
              await refuses(
                () =>
                  assignmentPandocChild(quarto, args, fixture.expectation.root),
                "OPERATION_EXPIRED",
              );
            },
            life,
            async () => selected,
          );
        });
        await Deno.writeTextFile(
          fixture.completePath,
          JSON.stringify(complete),
        );
        await fixture.use(async (op) => {
          retainedBinding = () => op.pandocBinding();
          const binding = required(await op.pandocBinding());
          assert.equal(binding.executable, bundled);
          assert.ok(Object.isFrozen(binding.environment));
          await Deno.remove(bundled);
          Deno.env.set("QUARTO_PANDOC", custom);
          assert.equal(
            await op.pandocBinding(),
            binding,
            "Scope перевыбрала инструмент после первого binding",
          );
        });
        await refuses(required(retainedBinding), "OPERATION_EXPIRED");
      } finally {
        for (const key of Object.keys(Deno.env.toObject())) {
          Deno.env.delete(key);
        }
        for (const [key, value] of Object.entries(previousEnvironment)) {
          Deno.env.set(key, value);
        }
        await Deno.writeTextFile(fixture.completePath, captured);
      }
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  }
  await withAssignmentExecution(runtime, "/fixture", async () => {
    const life = { active: true };
    await withAssignmentBeforeChild(async () => {}, async () => {
      await assignmentBeforeChild();
      life.active = false;
      await refuses(
        () => assignmentChild("quarto", [], "/fixture"),
        "OPERATION_EXPIRED",
      );
    }, life);
  });

  let retained: NativeOperation | undefined;
  for (const mode of ["stable", "throw", "nested", "source-edit"] as const) {
    let checkpoint = async () => {};
    const run = () =>
      fixture.use(async (op) => {
        retained = op;
        await op.withProjectContexts([], async (batch) => {
          checkpoint = batch.checkpoint;
          await batch.checkpoint();
          if (mode === "throw") throw Error("CALLBACK_SENTINEL");
          if (mode === "nested") {
            await op.withProjectContexts([], async () => {});
          }
          if (mode === "source-edit") {
            await Deno.writeTextFile(
              join(fixture.root, "bank.qmd"),
              "Изменено после capture",
            );
            await Deno.writeTextFile(
              join(fixture.root, "new.qmd"),
              "Новый файл",
            );
            await batch.checkpoint();
          }
        });
      });
    if (mode === "throw") await refuses(run, "CALLBACK_SENTINEL");
    else if (mode === "nested") await refuses(run, "CONTEXT_REQUEST");
    else await run();
    await refuses(checkpoint, "OPERATION_EXPIRED");
    await refuses(
      () => required(retained).withProjectContexts([], async () => {}),
      "OPERATION_EXPIRED",
    );
    await refuses(
      () => required(retained).pandocBinding(),
      "OPERATION_EXPIRED",
    );
  }
  // Ошибка перехвачена пользователем, но native scope всё равно не завершается успешно.
  await refuses(() =>
    fixture.use(async (op) => {
      await refuses(() =>
        op.withProjectContexts([], async () => {
          throw Error("CAUGHT_BATCH_FAILURE");
        }), "CAUGHT_BATCH_FAILURE");
    }), "OPERATION_INCOMPLETE");
  // Незавершённая batch остаётся активной на границе выхода из public callback.
  let release = () => {},
    entered = () => {},
    pending: Promise<unknown> | undefined;
  const blocked = new Promise<void>((resolve) => release = resolve);
  const started = new Promise<void>((resolve) => entered = resolve);
  try {
    await refuses(() =>
      fixture.use(async (op) => {
        pending = op.withProjectContexts([], async () => {
          entered();
          await blocked;
        });
        await started;
      }), "OPERATION_INCOMPLETE");
  } finally {
    release();
    if (pending) await refuses(() => pending, "OPERATION_EXPIRED");
  }
  // Задержанная microtask начинает и завершает batch во время финального await.
  // Никакого выполнения вырезки Source: проверяется настоящий closing lifecycle.
  let late: Promise<unknown> | undefined, lateCallbacks = 0;
  await refuses(() =>
    fixture.use(async (op) => {
      late = Promise.resolve().then(async () => {
        await Promise.resolve();
        await refuses(() =>
          op.withProjectContexts([], async () => {
            lateCallbacks++;
          }), "OPERATION_EXPIRED");
      });
    }), "OPERATION_INCOMPLETE");
  await late;
  assert.equal(lateCallbacks, 0);
  // Retained promise сохраняет child context, но утрачивает право запуска после callback.
  await withAssignmentExecution(runtime, "/fixture", async () => {
    let releaseChild = () => {}, child: Promise<unknown> | undefined;
    await fixture.use(async () => {
      const barrier = new Promise<void>((resolve) => releaseChild = resolve);
      child = barrier.then(() => assignmentChild("quarto", [], "/fixture"));
    });
    releaseChild();
    await refuses(() => child, "OPERATION_EXPIRED");
  });
  console.log(
    "PASS native public batch lifecycle, sticky failure, active/late closing, retained child, expiry и qualified tool binding",
  );
} finally {
  await fixture.close();
}
