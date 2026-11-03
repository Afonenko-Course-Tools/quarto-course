// Проверка реального Core runner на границе OS child; не producer positive.
import {
  assignmentBeforeChild,
  assignmentChild,
  runAssignmentCaptureChild,
  withAssignmentA1Probe,
  withAssignmentExecution,
} from "../_extensions/course-core/runtime/assignment-execution.ts";
const root = "/owner",
  token = crypto.randomUUID(),
  args = ["render", "--output-dir", "_generated/out"];
const runtime = {
  executable: "/opt/quarto/bin/quarto",
  profiles: ["lab", "full"],
  environment: { MARK: "fixed" },
  outputDirectory: root + "/_generated/out",
  inputs: ["index.qmd"],
  implementationFiles: [],
};
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
let spawns = 0, guards = 0, observed: any;
const original = Deno.Command;
(Deno as any).Command = class {
  constructor(executable: string, options: any) {
    spawns++;
    observed = { executable, options };
  }
  output() {
    return Promise.resolve({
      success: true,
      code: 0,
      signal: null,
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
    });
  }
};
async function refuse(
  run: () => unknown | Promise<unknown>,
  code = "BODY.PRODUCER_INPUT_CHANGED",
) {
  const before = spawns;
  let message = "";
  try {
    await run();
  } catch (e) {
    message = String(e);
  }
  assert(
    message.includes(code) && spawns === before,
    "Неверный отказ/spawn: " + message,
  );
}
try {
  await withAssignmentExecution(runtime, root, async () => {
    for (
      const foreign of [[...args, "--execute"], ["render", "other.qmd"], [
        "render",
        "--output-dir",
        "_generated/foreign",
      ], ["pandoc"]]
    ) {
      await refuse(() => runAssignmentCaptureChild(token, { args: foreign }));
    }
    await refuse(() =>
      assignmentChild("quarto", ["inspect", "/foreign"], root)
    );
    await refuse(() =>
      assignmentChild("quarto", ["pandoc", "--lua-filter", "/foreign"], root)
    );
    await refuse(() =>
      assignmentChild(
        "/foreign",
        ["inspect", root, "--profile", "lab,full"],
        root,
      )
    );
    await refuse(() =>
      assignmentChild(
        "quarto",
        ["inspect", root, "--profile", "lab,full"],
        root,
        { MARK: "changed" },
      )
    );
    const probe = {
      originalInput: root + "/project/native-input.qmd",
      temporaryInput: "/tmp/project/native-input.qmd",
      technical: "course-a1-test",
    };
    await withAssignmentA1Probe(probe, async () => {
      const actual = assignmentChild(
        "quarto",
        [
          "inspect",
          probe.temporaryInput,
          "--profile",
          "lab,full,course-a1-test",
        ],
        root,
        { QUARTO_PROFILE: "lab,full,course-a1-test" },
      )!;
      assert(
        actual.options.args[1] === probe.temporaryInput,
        "Переписан actual probe input",
      );
      await refuse(() =>
        assignmentChild("quarto", [
          "inspect",
          "/tmp/foreign",
          "--profile",
          "lab,full,course-a1-test",
        ], root)
      );
    });
    await runAssignmentCaptureChild(token, { args });
  }, async () => {
    guards++;
  });
  assert(
    spawns === 1 && guards === 1 &&
      observed.executable === runtime.executable && observed.options.clearEnv &&
      observed.options.cwd === root &&
      observed.options.env.COURSE_CORE_CAPTURE_TOKEN === token &&
      observed.options.env.QUARTO_PROFILE === "lab,full" &&
      JSON.stringify(observed.options.args) ===
        '["render","--output-dir","_generated/out","--profile","lab,full"]',
    "Потеряна точная Core command binding",
  );
  let late!: Promise<void>, resume!: () => void;
  const gate = new Promise<void>((r) => resume = r);
  await withAssignmentExecution(runtime, root, async () => {
    late = (async () => {
      await gate;
      await assignmentBeforeChild();
    })();
  });
  resume();
  await refuse(() => late, "OPERATION_EXPIRED");
  await refuse(
    () =>
      withAssignmentExecution(
        runtime,
        root,
        () => runAssignmentCaptureChild(token, { args }),
        async () => {
          throw Error("SOURCE_CHANGED");
        },
      ),
    "SOURCE_CHANGED",
  );
  console.log(
    "PASS exact Core render/output/profiles/token, foreign commands/env, A1 binding, expired execution and beforeChild refusal; zero negative spawns",
  );
} finally {
  (Deno as any).Command = original;
}
