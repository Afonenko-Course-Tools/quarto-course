import * as Execution from "../_extensions/course-core/runtime/assignment-execution.ts";
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const root = "/qualified/owner",
  tool = "/qualified/quarto",
  input = root + "/projects/a/native-input.qmd",
  temporaryOwner = "/tmp/exact-contract-carrier";
const runtime: any = {
  executable: tool,
  profiles: ["full"],
  environment: { MARK: "fixed" },
  outputDirectory: root + "/_generated/out",
  inputs: ["index.qmd"],
  implementationFiles: [],
};
const probe = (Execution as any).withAssignmentContractProbe;
assert(typeof probe === "function", "AGGREGATE_PROBE_UNAVAILABLE");
let checks = 0, late!: Promise<void>, resume!: () => void;
const refuse = async (
  use: () => unknown | Promise<unknown>,
  code = "BODY.PRODUCER_INPUT_CHANGED",
) => {
  let message = "";
  try {
    await use();
  } catch (e) {
    message = String(e);
  }
  assert(message.includes(code), "Wrong refusal " + message);
};
await Execution.withAssignmentExecution(runtime, root, async () => {
  await refuse(() =>
    Execution.assignmentChild("quarto", ["inspect", temporaryOwner], root)
  );
  await refuse(() =>
    probe({
      temporaryOwner,
      originalInputs: ["/foreign/native-input.qmd"],
      format: "html",
      guard: () => {},
    }, async () => {})
  );
  await refuse(() =>
    probe({
      temporaryOwner: temporaryOwner + "/../foreign",
      originalInputs: [input],
      format: "html",
      guard: () => {},
    }, async () => {})
  );
  await refuse(() =>
    probe({
      temporaryOwner,
      originalInputs: [input],
      format: "revealjs",
      guard: () => {},
    }, async () => {})
  );
  await probe({
    temporaryOwner,
    originalInputs: [input],
    format: "html",
    guard: () => {
      checks++;
    },
  }, async () => {
    const actual = Execution.assignmentChild(
      "quarto",
      ["inspect", temporaryOwner],
      root,
      { QUARTO_PROFILE: "" },
    )!;
    assert(
      JSON.stringify(actual.options.args) ===
        JSON.stringify(["inspect", temporaryOwner]),
      "actual argv rewritten",
    );
    assert(
      actual.options.env.MARK === "fixed" && actual.options.clearEnv,
      "frozen env lost",
    );
    await Execution.assignmentBeforeChild();
    await refuse(() =>
      Execution.assignmentChild(
        "quarto",
        ["inspect", temporaryOwner + "-foreign"],
        root,
        { QUARTO_PROFILE: "" },
      )
    );
    await refuse(() =>
      Execution.assignmentChild("quarto", ["inspect", temporaryOwner], root, {
        MARK: "changed",
      })
    );
    await refuse(() =>
      Execution.assignmentChild("quarto", ["inspect", temporaryOwner], root, {
        QUARTO_PROFILE: "full",
      })
    );
    const gate = new Promise<void>((r) => resume = r);
    late = (async () => {
      await gate;
      Execution.assignmentChild("quarto", ["inspect", temporaryOwner], root);
    })();
  });
  resume();
  await refuse(() => late, "OPERATION_EXPIRED");
  await refuse(() =>
    Execution.assignmentChild("quarto", ["inspect", temporaryOwner], root)
  );
  let changed = false;
  await probe({
    temporaryOwner,
    originalInputs: [input],
    format: "html",
    guard: () => {
      if (changed) throw Error("SAME_SOURCE_CHANGED");
    },
  }, async () => {
    changed = true;
    await refuse(
      () => Execution.assignmentBeforeChild(),
      "SAME_SOURCE_CHANGED",
    );
  });
});
assert(checks >= 2, "shared Source guard missing");
console.log(
  "PASS internal aggregate exact argv/profile/env/Source/lifetime refusals; synthetic boundary only, not assignment authority",
);
