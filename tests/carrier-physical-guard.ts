import { command } from "../_extensions/course-core/infrastructure/process.ts";
import * as Carrier from "../_extensions/course-core/infrastructure/contract-carrier.ts";
import {
  assignmentBeforeChild,
  withAssignmentContractProbe,
  withAssignmentExecution,
} from "../_extensions/course-core/runtime/assignment-execution.ts";
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
assert(
  typeof (Carrier as any).contractCarrierWitness === "function",
  "PHYSICAL_CARRIER_UNAVAILABLE",
);
const root = await Deno.makeTempDir({ prefix: "carrier-physical-" });
try {
  const yaml = root + "/_quarto.yml";
  await Deno.writeTextFile(yaml, "project: {type: default, render: []}\n");
  const bind = () => (Carrier as any).contractCarrierWitness(root);
  const w = await bind();
  await w.beforeChild();
  await Deno.writeTextFile(root + "/.env", "FOREIGN=1");
  let error = "";
  try {
    await w.beforeChild();
  } catch (e) {
    error = String(e);
  }
  assert(error.includes("CONTEXT_OWNER"), "extra .env allowed");
  await Deno.remove(root + "/.env");
  for (const name of ["_brand.yml", "extra.qmd", "hook.ts"]) {
    await Deno.writeTextFile(root + "/" + name, "foreign");
    error = "";
    try {
      await w.beforeChild();
    } catch (e) {
      error = String(e);
    }
    assert(
      error.includes("CONTEXT_OWNER"),
      "extra carrier source allowed: " + name,
    );
    await Deno.remove(root + "/" + name);
  }
  await Deno.symlink(yaml, root + "/.quarto");
  error = "";
  try {
    await w.afterChild();
  } catch (e) {
    error = String(e);
  }
  assert(error.includes("CONTEXT_OWNER"), "scratch symlink allowed");
  await Deno.remove(root + "/.quarto");
  const originalCommand = Deno.Command;
  let constructed = 0;
  (Deno as any).Command = class {
    constructor() {
      constructed++;
      throw Error("CONSTRUCTOR_REACHED");
    }
  };
  const p: any = {
    root: "/owner",
    runtime: { files: [{ path: "/quarto" }] },
    native: {
      executable: "/quarto",
      environment: {},
      actualProfiles: [],
      renders: [["inspect", "/owner/projects/a/native-input.qmd"]],
    },
  };
  await withAssignmentExecution(p, async () => {
    await withAssignmentContractProbe(
      {
        temporaryOwner: root,
        originalInputs: ["/owner/projects/a/native-input.qmd"],
        format: "html",
        guard: () => {},
        beforeSpawn: w.beforeChild,
      } as any,
      async () => {
        error = "";
        try {
          await command("/quarto", ["inspect", root], "/owner");
        } catch (e) {
          error = String(e);
        }
        assert(
          error.includes("CONTEXT_OWNER"),
          "async source fence mutation reached constructor boundary",
        );
      },
    );
  }, async () => {
    await Deno.writeTextFile(yaml, "CHANGED_AFTER_ASYNC_FENCE");
  });
  (Deno as any).Command = originalCommand;
  assert(constructed === 0, "mutated carrier spawned a process");
  console.log(
    "PASS local carrier/YAML/extra entry and post-async-beforeChild refusal",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
