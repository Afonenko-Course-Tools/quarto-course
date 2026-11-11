import { required } from "./helpers/required.ts";
// Проверка реального Core runner на границе OS child; не producer positive.
import {
  assignmentBeforeChild,
  assignmentChild,
  runAssignmentCaptureChild,
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
};
function assert(v: unknown, m: string): asserts v {
  if (!v) throw Error(m);
}
let spawns = 0, guards = 0;
let observed: {executable: string | URL; options: Deno.CommandOptions} | undefined;
const original = required(Object.getOwnPropertyDescriptor(Deno, "Command"));
Object.defineProperty(Deno, "Command", {configurable: original.configurable ?? false, enumerable: original.enumerable ?? false, writable: true, value: class {
  constructor(executable: string | URL, options: Deno.CommandOptions) {
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
}});
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
    await runAssignmentCaptureChild(token, { args });
  }, async () => {
    guards++;
  });
  const actual = required(observed);
  assert(
    spawns === 1 && guards === 1 &&
      actual.executable === runtime.executable && actual.options.clearEnv &&
      actual.options.cwd === root &&
      actual.options.env?.COURSE_CORE_CAPTURE_TOKEN === token &&
      actual.options.env?.QUARTO_PROFILE === "lab,full" &&
      JSON.stringify(actual.options.args) ===
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
    "PASS exact Core render/output/profiles/token, foreign commands/env, expired execution and beforeChild refusal; zero negative spawns",
  );
} finally {
  Object.defineProperty(Deno, "Command", original);
}
