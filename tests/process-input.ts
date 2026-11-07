import {
  command,
  commandInput,
} from "../_extensions/course-core/infrastructure/process.ts";
import type {
  Metrics,
  OperationSpec,
} from "../_extensions/course-core/observability/bridge.ts";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
const exe = Deno.execPath(),
  cwd = Deno.cwd(),
  big = "Я".repeat(2 * 1024 * 1024),
  encoder = new TextEncoder();
async function refusal(use: () => Promise<unknown>) {
  try {
    await use();
  } catch (e) {
    return e;
  }
  throw Error("Отсутствует ожидаемый отказ");
}
const echo = [
  "eval",
  'const s=new TextDecoder("utf-8",{ignoreBOM:true}).decode(await new Response(Deno.stdin.readable).arrayBuffer());console.log(JSON.stringify({s,mark:Deno.env.get("FIXED_STDIN_MARK")}));',
];
const prefix = [
  "eval",
  'await Deno.stdout.write(new Uint8Array(2*1024*1024).fill(120));const b=await new Response(Deno.stdin.readable).arrayBuffer();console.log("bytes="+b.byteLength);',
];
const short = [
  "eval",
  'console.error("EXPECTED_STDIN_EARLY_FAILURE");Deno.exit(7);',
];
const closed = [
  "eval",
  "Deno.stdin.close();await new Promise(r=>setTimeout(r,100));",
];
const environment: Record<string, string> = { FIXED_STDIN_MARK: "approved" };
const originalCommand = Deno.Command;
let spawns = 0;
Deno.Command = new Proxy(originalCommand, {
  construct(target, args) {
    spawns++;
    return Reflect.construct(target, args);
  },
});
try {
  const values = ["\uFEFF  Я\n", "Отдельный поток β"];
  const output = await Promise.all(
    values.map((value) => commandInput(exe, echo, cwd, value, environment)),
  );
  output.forEach((v, i) => {
    const got: unknown = JSON.parse(v);
    assert(
      got !== null && typeof got === "object" &&
        "s" in got && got.s === values[i] &&
        "mark" in got && got.mark === "approved",
      "UTF8/concurrent/functional env нарушены",
    );
  });
  const large = await commandInput(exe, prefix, cwd, big, environment);
  assert(
    large.startsWith("x".repeat(2 * 1024 * 1024)) &&
      large.endsWith("bytes=" + encoder.encode(big).length + "\n"),
    "Двунаправленный большой pipe потерял данные",
  );
  const failed = await refusal(() =>
    commandInput(exe, short, cwd, big, environment)
  );
  assert(
    failed instanceof Error && failed.name === "ExternalToolFailure" &&
      "exitCode" in failed && failed.exitCode === 7 &&
      "stderr" in failed && typeof failed.stderr === "string" &&
      failed.stderr.includes("EXPECTED_STDIN_EARLY_FAILURE"),
    "Early exit потерял typed tool diagnostics",
  );
  await refusal(() => commandInput(exe, closed, cwd, big, environment));
  const malformed = await refusal(() =>
    commandInput(
      exe,
      ["eval", "await Deno.stdout.write(new Uint8Array([195,40]));"],
      cwd,
      "",
    )
  );
  assert(
    malformed instanceof TypeError,
    "Невалидный UTF8 принят stdin transport",
  );
  assert(
    await commandInput(
      exe,
      ["eval", 'console.error("EXPECTED_STDIN_WARNING");console.log("ok");'],
      cwd,
      "",
    ) === "ok\n",
    "Warning-only result изменён",
  );
  const missing = await refusal(() =>
    commandInput("/missing/core-stdin-tool", [], cwd, "")
  );
  assert(
    missing instanceof Error && missing.name === "ExternalToolFailure" &&
      "exitCode" in missing && missing.exitCode === undefined &&
      "stdout" in missing && missing.stdout === "" &&
      "stderr" in missing && missing.stderr === "",
    "Missing executable contract изменён",
  );
  assert(
    await command(exe, ["eval", 'console.log("old-command");'], cwd) ===
      "old-command\n",
    "Прежний command API нарушен",
  );
  // ABI fixture наблюдает настоящий stdin child, не подменяет его выполнение.
  const metricsKey = Symbol.for("course.performance.agent.v1");
  const previousAgent: unknown = Reflect.get(globalThis, metricsKey),
    mode = Deno.env.get("COURSE_PERF_MODE");
  const staleParent = Deno.env.get("COURSE_PERF_PARENT_SPAN_ID");
  const events: { phase: "begin" | "end"; spec: OperationSpec }[] = [];
  try {
    Deno.env.set("COURSE_PERF_MODE", "summary");
    Deno.env.set("COURSE_PERF_PARENT_SPAN_ID", "stale");
    const metrics: Metrics = {
      wrapSync: (_spec, fn) => fn,
      wrapWalk: (_spec, fn) => fn,
      wrapAsync: (spec, fn) =>
        new Proxy(fn, {
          async apply(target, receiver, args) {
            events.push({ phase: "begin", spec });
            try {
              return await Reflect.apply(target, receiver, args);
            } finally {
              events.push({ phase: "end", spec });
            }
          },
        }),
      childEnv: (env) => ({
        ...env,
        COURSE_PERF_PARENT_SPAN_ID: "stdin-parent",
      }),
    };
    Reflect.set(globalThis, metricsKey, {
      abiVersion: 1,
      metrics,
    });
    const measured = await import(
      "../_extensions/course-core/infrastructure/process.ts?stdin-metrics"
    );
    const observed: unknown = JSON.parse(
      await measured.commandInput(
        exe,
        [
          "eval",
          'console.log(JSON.stringify([await new Response(Deno.stdin.readable).text(),Deno.env.get("COURSE_PERF_PARENT_SPAN_ID"),Deno.env.get("FUNCTIONAL")]));',
        ],
        cwd,
        "Измеряемый JSON",
        { FUNCTIONAL: "keep" },
      ),
    );
    assert(
      JSON.stringify(observed) ===
        JSON.stringify(["Измеряемый JSON", "stdin-parent", "keep"]),
      "stdin child потерял functional env или parent context",
    );
    await refusal(() =>
      measured.commandInput("/missing/core-stdin-metrics-tool", [], cwd, "")
    );
    assert(
      events.length === 4 && events.map((e) =>
            e.phase
          ).join(",") === "begin,end,begin,end" &&
        events.every((e) =>
          e.spec.id === "course-core.infrastructure.process.command" &&
          e.spec.attributes?.extension_id === "course-core"
        ),
      "Command phase BEGIN/END/extension context изменён",
    );
  } finally {
    if (previousAgent === undefined) {
      Reflect.deleteProperty(globalThis, metricsKey);
    } else Reflect.set(globalThis, metricsKey, previousAgent);
    if (mode === undefined) Deno.env.delete("COURSE_PERF_MODE");
    else Deno.env.set("COURSE_PERF_MODE", mode);
    if (staleParent === undefined) {
      Deno.env.delete("COURSE_PERF_PARENT_SPAN_ID");
    } else Deno.env.set("COURSE_PERF_PARENT_SPAN_ID", staleParent);
  }
  console.log(
    JSON.stringify({
      scope: "ordinary commandInput transport, not assignment admission",
      spawns,
      inputBytes: encoder.encode(big).length,
      outputPrefixBytes: 2 * 1024 * 1024,
      ordinaryCommandUnchanged: true,
    }),
  );
  console.log(
    "PASS ordinary stdin UTF8/concurrent streams/large duplex/early exit/closed pipe/errors/warnings/functional env and command/metrics BEGIN-END",
  );
} finally {
  Deno.Command = originalCommand;
}
