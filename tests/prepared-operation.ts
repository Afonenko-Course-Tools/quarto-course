import { required } from "./helpers/required.ts";
import { withPreparedLease, type NativePreparedOperation, type NativePreparedLease } from "../_extensions/course-core/runtime/prepared-operation.ts";
const descriptor: NativePreparedOperation = {
  schema: "course-native-prepared-operation-v1",
  root: "/owner",
  outputDirectory: "/owner/_generated/out",
  identity: {
    operation: crypto.randomUUID(),
    profiles: ["full", "lab"],
    projection: "author",
    runtime: "quarto-1.11.5",
  },
  inputs: [{ source: "work.qmd", captureWitness: crypto.randomUUID() }],
  assessments: [{ source: "work.qmd", id: "work" }],
};
let guards = 0, children = 0, failures = 0;
let escaped: NativePreparedLease | undefined;
const guard = async () => {
    guards++;
  },
  capture = async (
    _s: readonly string[],
    command: { args: readonly string[] },
  ) => {
    children++;
    if (
      JSON.stringify(command.args) !== JSON.stringify(["render", "work.qmd"])
    ) throw Error("Command DTO changed");
    return {
      code: 0,
      success: true,
      signal: null,
      stdout: new Uint8Array(),
      stderr: new Uint8Array(),
    };
  };
await withPreparedLease(descriptor, guard, capture, async () => {
  failures++;
}, async (lease) => {
  escaped = lease;
  await lease.assert(structuredClone(descriptor));
  await lease.captureInputs(
    structuredClone(descriptor),
    ["work.qmd"],
    { args: ["render", "work.qmd"] },
  );
});
if (children !== 1 || !guards) {
  throw Error("Fresh descriptor B did not reach exactly one child");
}
let expired = false;
try {
  await required(escaped).captureInputs(descriptor, ["work.qmd"], {
    args: ["render", "work.qmd"],
  });
} catch (e) {
  expired = String(e).includes("OPERATION_EXPIRED");
}
if (!expired || children !== 1) throw Error("Expired lease reached child");
for (
  const mutate of [
    (v: NativePreparedOperation) => v.identity.operation = crypto.randomUUID(),
    (v: NativePreparedOperation) => required(v.inputs[0]).captureWitness = crypto.randomUUID(),
    (v: NativePreparedOperation) => v.root = "/other",
    (v: NativePreparedOperation) => v.identity.profiles.reverse(),
    (v: NativePreparedOperation) => v.identity.projection = "student",
    (v: NativePreparedOperation) => v.outputDirectory = "/other",
  ]
) {
  const expected = structuredClone(descriptor);
  mutate(expected);
  let refused = false;
  try {
    await withPreparedLease(descriptor, guard, capture, async () => {
      failures++;
    }, async (lease) => {
      await lease.captureInputs(expected, ["work.qmd"], {
        args: ["render", "work.qmd"],
      });
    });
  } catch (e) {
    refused = String(e).includes("OPERATION_BINDING");
  }
  if (!refused || children !== 1) {
    throw Error("Forged/stale request B reached child");
  }
}
const failureCount = (): number => failures;
if (failureCount() !== 6) throw Error("Correlation failures not sticky");
for (
  const bad of [async () => {}, { args: ["render"], env: { UNTRUSTED: "1" } }, {
    args: ["render"],
    cwd: "/foreign",
  }]
) {
  let refused = false;
  try {
    await withPreparedLease(descriptor, guard, capture, async () => {
      failures++;
    }, async (lease) => {
      // @ts-expect-error Намеренно неверный DTO: callback либо неподдерживаемые env/cwd.
      await lease.captureInputs(descriptor, ["work.qmd"], bad);
    });
  } catch (e) {
    refused = String(e).includes("OPERATION_BINDING");
  }
  if (!refused || children !== 1) {
    throw Error("Callback/ambient options reached capture");
  }
}
if (failureCount() !== 9) throw Error("Closed command failures not sticky");
console.log(
  "PASS prepared lease unit correlation B, exact origin/profiles/witness/root/output, lifetime, closed data-only command/callback-env-cwd refusals and zero stale-child; not a qualified native positive or a stale check on an unused A",
);
