const assert = (v: unknown, s: string) => {
  if (!v) throw Error(s);
};
let executed = 0;
const identity = (..._args: unknown[]) => {
  executed++;
  return (..._v: unknown[]) => undefined;
};
(globalThis as any)[Symbol.for("course.performance.agent.v1")] = {
  abiVersion: 1,
  metrics: {
    wrapSync: identity,
    wrapAsync: identity,
    wrapWalk: identity,
    childEnv: identity,
  },
};
const old = Deno.env.get("COURSE_PERF_MODE");
Deno.env.set("COURSE_PERF_MODE", "summary");
try {
  const { withNativeCaptureScope } = await import(
    "../_extensions/course-core/capture.ts"
  );
  let error = "";
  try {
    await withNativeCaptureScope({
      root: "/unqualified/frozen",
      projection: "author",
      outputDirectory: "/unqualified/frozen/_generated/assignment",
    }, {
      assignment: {
        mode: "new",
        prepare: async () => {
          throw Error("PREPARE_EXECUTED");
        },
      },
    }, async () => {
      throw Error("USE_EXECUTED");
    });
  } catch (e) {
    error = String(e);
  }
  assert(
    error.includes("BODY.PRODUCER_INPUT_UNQUALIFIED"),
    "Wrong early refusal " + error,
  );
  assert(
    executed === 0,
    "Ambient metrics agent executed before admission " + executed,
  );
  console.log("PASS inert Core bootstrap: unknown ambient agent not called");
} finally {
  if (old === undefined) Deno.env.delete("COURSE_PERF_MODE");
  else Deno.env.set("COURSE_PERF_MODE", old);
  delete (globalThis as any)[Symbol.for("course.performance.agent.v1")];
}
