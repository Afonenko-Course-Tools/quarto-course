import {
  assignmentBeforeChild,
  assignmentChild,
  runAssignmentCaptureChild,
  withAssignmentA1Probe,
  withAssignmentCaptureChild,
  withAssignmentExecution,
} from "../_extensions/course-core/runtime/assignment-execution.ts";
import { withPreparedLease } from "../_extensions/course-core/runtime/prepared-operation.ts";
const root = "/qualified/owner",
  executable = "/qualified/quarto",
  token = crypto.randomUUID(),
  actualArgs = ["render", "bank.qmd", "--to", "html"],
  base = ["author"];
const profile: any = {
  root,
  runtime: {
    files: [{ path: executable }, { path: "/qualified/cue" }, {
      path: "/qualified/OTHER",
    }],
  },
  native: {
    executable,
    environment: {
      PATH: "/qualified/bin",
      MARK: "approved",
      CUE: "/qualified/cue",
      QUARTO_RUN_NO_NETWORK: "true",
    },
    actualProfiles: base,
    renders: [
      actualArgs,
      ["inspect", root],
      ["inspect", root + "/projects/a/native-input.qmd", "--profile", "author"],
      ["pandoc", "--from", "json", "--to", "html"],
      ["export", "--out", "json"],
    ],
  },
};
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const rejected: string[] = [], seen: any[] = [];
let guards = 0, spawnSuccess = true;
const original = Deno.Command;
(Deno as any).Command = class {
  constructor(executable: string, options: any) {
    seen.push({ executable, options });
  }
  output() {
    return Promise.resolve({
      success: spawnSuccess,
      code: spawnSuccess ? 0 : 7,
      signal: null,
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
    });
  }
};
async function refuse(
  name: string,
  use: () => unknown | Promise<unknown>,
  code = "BODY.PRODUCER_INPUT_CHANGED",
) {
  const before = seen.length;
  let error = "";
  try {
    await use();
  } catch (e) {
    error = String(e);
  }
  assert(error.includes(code), name + ": wrong refusal " + error);
  assert(seen.length === before, name + ": spawned");
  rejected.push(name);
}
try {
  await withAssignmentExecution(profile, async () => {
    const yes = assignmentChild("quarto", actualArgs, root)!;
    assert(
      yes.executable === executable && yes.options.clearEnv,
      "EXACT_CONTROL_REFUSED",
    );
    await refuse(
      "foreign argv",
      () =>
        assignmentChild(
          "quarto",
          ["render", "UNDECLARED.qmd", "--execute"],
          root,
        ),
    );
    await refuse(
      "undeclared inspect",
      () => assignmentChild("quarto", ["inspect", "/foreign"], root),
    );
    await refuse(
      "undeclared Pandoc",
      () =>
        assignmentChild("quarto", ["pandoc", "--lua-filter", "/unknown"], root),
    );
    await refuse(
      "undeclared CUE",
      () => assignmentChild("cue", ["eval", "/unknown"], root),
    );
    await refuse(
      "foreign executable",
      () => assignmentChild("/qualified/OTHER", actualArgs, root),
    );
    await refuse(
      "foreign cwd",
      () => assignmentChild("quarto", actualArgs, root + "/../owner"),
    );
    await refuse(
      "nested cwd",
      () => assignmentChild("quarto", actualArgs, root + "/nested"),
    );
    await refuse(
      "foreign environment",
      () =>
        assignmentChild("quarto", actualArgs, root, {
          NOT_APPROVED: "synthetic-only",
        }),
    );
    await refuse(
      "changed fixed environment",
      () => assignmentChild("quarto", actualArgs, root, { MARK: "changed" }),
    );
    await refuse(
      "foreign profiles",
      () =>
        assignmentChild("quarto", actualArgs, root, {
          QUARTO_PROFILE: "student",
        }),
    );
    await refuse(
      "unbound technical profile",
      () =>
        assignmentChild("quarto", actualArgs, root, {
          QUARTO_PROFILE: "author,course-a1-" + crypto.randomUUID(),
        }),
    );
    await refuse(
      "unbound token",
      () =>
        assignmentChild("quarto", actualArgs, root, {
          COURSE_CORE_CAPTURE_TOKEN: token,
        }),
    );
    await withAssignmentCaptureChild(token, async () => {
      await refuse(
        "foreign token",
        () =>
          assignmentChild("quarto", actualArgs, root, {
            COURSE_CORE_CAPTURE_TOKEN: crypto.randomUUID(),
          }),
      );
      assert(
        assignmentChild("quarto", actualArgs, root, {
          COURSE_CORE_CAPTURE_TOKEN: token,
        })!.options.env.COURSE_CORE_CAPTURE_TOKEN === token,
        "live token lost",
      );
    });
    const probe = {
      temporaryInput: "/tmp/owned-a1/projects/a/native-input.qmd",
      originalInput: root + "/projects/a/native-input.qmd",
      technical: "course-a1-" + crypto.randomUUID(),
    };
    await withAssignmentA1Probe(probe, async () => {
      const args = [
        "inspect",
        probe.temporaryInput,
        "--profile",
        "author," + probe.technical,
      ];
      assert(
        assignmentChild("quarto", args, root, {
          QUARTO_PROFILE: "author," + probe.technical,
        })!.options.args[1] === probe.temporaryInput,
        "probe argv rewritten on wire",
      );
      await refuse(
        "foreign temporary input",
        () =>
          assignmentChild("quarto", [
            "inspect",
            "/tmp/foreign/native-input.qmd",
            ...args.slice(2),
          ], root),
      );
      await refuse(
        "foreign technical profile",
        () =>
          assignmentChild("quarto", [
            ...args.slice(0, 3),
            "author,course-a1-" + crypto.randomUUID(),
          ], root),
      );
      await refuse(
        "technical env on unrelated command",
        () =>
          assignmentChild("quarto", actualArgs, root, {
            QUARTO_PROFILE: "author," + probe.technical,
          }),
      );
    });
    const p = profile.native.renders.find((a: string[]) => a[0] === "pandoc");
    assert(assignmentChild("quarto", p, root), "exact Pandoc refused");
    assert(
      assignmentChild("cue", ["export", "--out", "json"], root),
      "exact CUE refused",
    );
  }, async () => {
    guards++;
  });
  await withAssignmentExecution(
    profile,
    () => runAssignmentCaptureChild(token, { args: actualArgs }),
    async () => {
      guards++;
    },
  );
  assert(seen.length === 1 && guards === 1, "exact command/guard count");
  assert(
    seen[0].executable === executable && seen[0].options.cwd === root &&
      seen[0].options.clearEnv &&
      seen[0].options.env.COURSE_CORE_CAPTURE_TOKEN === token &&
      seen[0].options.env.QUARTO_PROFILE === "author" &&
      !Object.hasOwn(seen[0].options.env, "HOME"),
    "closed exact wire command",
  );
  await refuse(
    "before-child changed guard",
    () =>
      withAssignmentExecution(
        profile,
        () => runAssignmentCaptureChild(token, { args: actualArgs }),
        async () => {
          throw Error("CURRENTNESS_SENTINEL");
        },
      ),
    "CURRENTNESS_SENTINEL",
  );
  let resume!: () => void, late!: Promise<void>;
  const gate = new Promise<void>((r) => resume = r);
  await withAssignmentExecution(profile, async () => {
    late = (async () => {
      await gate;
      await assignmentBeforeChild();
      assignmentChild("quarto", actualArgs, root);
    })();
  });
  resume();
  await refuse("expired execution", () => late, "OPERATION_EXPIRED");
  const descriptor: any = {
    schema: "course-native-prepared-operation-v1",
    root,
    outputDirectory: root + "/_generated/out",
    identity: {
      operation: crypto.randomUUID(),
      profiles: base,
      projection: "author",
      runtime: "quarto-1.11.5",
    },
    inputs: [{ source: "bank.qmd", captureWitness: crypto.randomUUID() }],
    assessments: [{ source: "bank.qmd", id: "asm-work" }],
  };
  let callbacks = 0, captures = 0, retained: any;
  async function lease(use: (v: any) => Promise<void>) {
    return await withPreparedLease(
      descriptor,
      async () => {},
      async (_sources, command) => {
        captures++;
        return await withAssignmentExecution(
          profile,
          () => runAssignmentCaptureChild(token, command),
        );
      },
      async () => {},
      use,
    );
  }
  await lease(async (l) => {
    retained = l;
    await l.captureInputs(descriptor, ["bank.qmd"], {
      args: actualArgs,
      stdout: "inherit",
      stderr: "null",
      timeoutMs: 1000,
    });
  });
  assert(
    captures === 1 && seen.length === 2,
    "data overload did not use Core runner",
  );
  for (
    const [name, value] of [
      ["callback", async () => {
        callbacks++;
      }],
      ["executable", { args: actualArgs, executable: "/foreign" }],
      ["cwd", { args: actualArgs, cwd: "/foreign" }],
      ["env", { args: actualArgs, env: { COURSE_CORE_CAPTURE_TOKEN: token } }],
      ["timeout", { args: actualArgs, timeoutMs: 1200001 }],
    ] as const
  ) {
    await refuse(
      "lease " + name,
      () => lease((l) => l.captureInputs(descriptor, ["bank.qmd"], value)),
      "OPERATION_BINDING",
    );
  }
  assert(callbacks === 0 && captures === 1, "invalid command/callback effects");
  await refuse(
    "expired lease",
    () =>
      retained.captureInputs(descriptor, ["bank.qmd"], { args: actualArgs }),
    "OPERATION_EXPIRED",
  );
  spawnSuccess = false;
  let failure = "";
  try {
    await withAssignmentExecution(
      profile,
      () => runAssignmentCaptureChild(token, { args: actualArgs }),
    );
  } catch (e) {
    failure = String(e);
  }
  assert(failure.includes("OPERATION_INCOMPLETE"), "nonzero child accepted");
  console.log(JSON.stringify({
    kind:
      "synthetic internal execution+lease factory; mocked Deno.Command boundary, not authority/admission/P-positive",
    rejected,
    spawnConstructors: seen.length,
    successfulExactCommands: 2,
    nonzeroChild: 1,
    guardCalls: guards,
    closedEnvironmentKeys: Object.keys(seen[0].options.env),
    actualArgv: seen[0].options.args,
    clearEnv: seen[0].options.clearEnv,
  }));
  console.log(
    "PASS closed argv/runtime/env/cwd/live token/technical probe/expired execution and data-only prepared capture;0negative spawns",
  );
} finally {
  (Deno as any).Command = original;
}
