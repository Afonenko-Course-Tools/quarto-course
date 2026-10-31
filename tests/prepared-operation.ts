import { withPreparedLease } from "../_extensions/course-core/runtime/prepared-operation.ts";
const descriptor: any = {
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
let guards = 0, children = 0, failures = 0, escaped: any;
const guard = async () => {
    guards++;
  },
  capture = async (
    _s: readonly string[],
    run: (token: string) => Promise<unknown>,
  ) => {
    children++;
    return await run("actual-token");
  };
await withPreparedLease(descriptor, guard, capture as any, async () => {
  failures++;
}, async (lease) => {
  escaped = lease;
  await lease.assert(structuredClone(descriptor));
  await lease.captureInputs(
    structuredClone(descriptor),
    ["work.qmd"],
    async (token) => {
      if (token !== "actual-token") throw Error("Wrong token");
    },
  );
});
if (children !== 1 || !guards) {
  throw Error("Fresh descriptor B did not reach exactly one child");
}
let expired = false;
try {
  await escaped.captureInputs(descriptor, ["work.qmd"], async () => {});
} catch (e) {
  expired = String(e).includes("OPERATION_EXPIRED");
}
if (!expired || children !== 1) throw Error("Expired lease reached child");
for (
  const mutate of [
    (v: any) => v.identity.operation = crypto.randomUUID(),
    (v: any) => v.inputs[0].captureWitness = crypto.randomUUID(),
    (v: any) => v.root = "/other",
    (v: any) => v.identity.profiles.reverse(),
    (v: any) => v.identity.projection = "student",
    (v: any) => v.outputDirectory = "/other",
  ]
) {
  const expected = structuredClone(descriptor);
  mutate(expected);
  let refused = false;
  try {
    await withPreparedLease(descriptor, guard, capture as any, async () => {
      failures++;
    }, async (lease) => {
      await lease.captureInputs(expected, ["work.qmd"], async () => {});
    });
  } catch (e) {
    refused = String(e).includes("OPERATION_BINDING");
  }
  if (!refused || children !== 1) {
    throw Error("Forged/stale request B reached child");
  }
}
if (failures !== 6) throw Error("Correlation failures not sticky");
console.log(
  "PASS prepared lease unit correlation B, exact origin/profiles/witness/root/output, lifetime and zero stale-child; not a qualified native positive or a stale check on an unused A",
);
