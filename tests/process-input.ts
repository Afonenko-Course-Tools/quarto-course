import {
  command,
  commandInput,
} from "../_extensions/course-core/infrastructure/process.ts";
import { withAssignmentExecution } from "../_extensions/course-core/runtime/assignment-execution.ts";
const assert = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const exe = Deno.execPath(),
  cwd = Deno.cwd(),
  big = "Я".repeat(2 * 1024 * 1024),
  encoder = new TextEncoder();
async function refusal(use: () => Promise<unknown>) {
  try {
    await use();
  } catch (e) {
    return e as any;
  }
  throw Error("Отсутствует ожидаемый отказ");
}
const echo = [
  "eval",
  'const s=new TextDecoder("utf-8",{ignoreBOM:true}).decode(await new Response(Deno.stdin.readable).arrayBuffer());console.log(JSON.stringify({s,mark:Deno.env.get("FIXED_STDIN_MARK"),ambient:Deno.env.get("CORE_STDIN_AMBIENT")}));',
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
for (const key of ["XDG_CACHE_HOME", "JAVA_HOME", "GRADLE_USER_HOME", "PATH"]) {
  const value = Deno.env.get(key);
  if (value !== undefined) environment[key] = value;
}
const profile: any = {
  root: cwd,
  runtime: { files: [{ path: exe }] },
  native: {
    executable: exe,
    environment,
    actualProfiles: [],
    renders: [echo, prefix, short, closed],
  },
};
const originalCommand = Deno.Command;
let spawns = 0;
(Deno as any).Command = new Proxy(originalCommand, {
  construct(target, args) {
    spawns++;
    return Reflect.construct(target, args);
  },
});
let guards = 0;
const run = <T>(use: () => Promise<T>) =>
  withAssignmentExecution(profile, use, async () => {
    guards++;
  });
const ambient = Deno.env.get("CORE_STDIN_AMBIENT");
Deno.env.set("CORE_STDIN_AMBIENT", "must-not-inherit");
try {
  const values = ["\uFEFF  Я\n", "Отдельный поток β"];
  const output = await Promise.all(
    values.map((value) => run(() => commandInput(exe, echo, cwd, value))),
  );
  output.forEach((v, i) => {
    const got = JSON.parse(v);
    assert(
      got.s === values[i] && got.mark === "approved" &&
        got.ambient === undefined,
      "UTF8/concurrent/clearEnv нарушены",
    );
  });
  const large = await run(() => commandInput(exe, prefix, cwd, big));
  assert(
    large.startsWith("x".repeat(2 * 1024 * 1024)) &&
      large.endsWith("bytes=" + encoder.encode(big).length + "\n"),
    "Двунаправленный большой pipe потерял данные",
  );
  const failed = await refusal(() =>
    run(() => commandInput(exe, short, cwd, big))
  );
  assert(
    failed.name === "ExternalToolFailure" && failed.exitCode === 7 &&
      failed.stderr.includes("EXPECTED_STDIN_EARLY_FAILURE"),
    "Early exit потерял typed tool diagnostics",
  );
  await refusal(() => run(() => commandInput(exe, closed, cwd, big)));
  const before = guards, beforeSpawns = spawns;
  const denied = await refusal(() =>
    run(() => commandInput(exe, echo, cwd, "unused", { UNQUALIFIED: "no" }))
  );
  assert(
    String(denied).includes("BODY.PRODUCER_INPUT_CHANGED") &&
      guards === before + 1 && spawns === beforeSpawns,
    "Env отказ потерял beforeChild fence",
  );
  const stale = await refusal(() =>
    withAssignmentExecution(
      profile,
      () => commandInput(exe, echo, cwd, "unused"),
      async () => {
        throw Error("SOURCE_FENCE_SENTINEL");
      },
    )
  );
  assert(
    String(stale).includes("SOURCE_FENCE_SENTINEL") && spawns === beforeSpawns,
    "Источник не отказал до child",
  );
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
    missing.name === "ExternalToolFailure" && missing.exitCode === undefined &&
      missing.stdout === "" && missing.stderr === "",
    "Missing executable contract изменён",
  );
  assert(
    await command(exe, ["eval", 'console.log("old-command");'], cwd) ===
      "old-command\n",
    "Прежний command API нарушен",
  );
  // ABI fixture наблюдает настоящий stdin child, не подменяет его выполнение.
  const metricsKey = Symbol.for("course.performance.agent.v1");
  const registry = globalThis as unknown as Record<symbol, unknown>;
  const previousAgent = registry[metricsKey],
    mode = Deno.env.get("COURSE_PERF_MODE");
  const staleParent = Deno.env.get("COURSE_PERF_PARENT_SPAN_ID");
  const events: any[] = [];
  try {
    Deno.env.set("COURSE_PERF_MODE", "summary");
    Deno.env.set("COURSE_PERF_PARENT_SPAN_ID", "stale");
    registry[metricsKey] = {
      abiVersion: 1,
      metrics: {
        wrapSync: (_s: any, f: any) => f,
        wrapWalk: (_s: any, f: any) => f,
        wrapAsync: (spec: any, fn: any) => async (...args: any[]) => {
          events.push({ phase: "begin", spec });
          try {
            return await fn(...args);
          } finally {
            events.push({ phase: "end", spec });
          }
        },
        childEnv: (env: Record<string, string>) => ({
          ...env,
          COURSE_PERF_PARENT_SPAN_ID: "stdin-parent",
        }),
      },
    };
    const measured = await import(
      "../_extensions/course-core/infrastructure/process.ts?stdin-metrics"
    );
    const observed = JSON.parse(
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
          e.spec.attributes.extension_id === "course-core"
        ),
      "Command phase BEGIN/END/extension context изменён",
    );
  } finally {
    if (previousAgent === undefined) {
      Reflect.deleteProperty(registry, metricsKey);
    } else registry[metricsKey] = previousAgent;
    if (mode === undefined) Deno.env.delete("COURSE_PERF_MODE");
    else Deno.env.set("COURSE_PERF_MODE", mode);
    if (staleParent === undefined) {
      Deno.env.delete("COURSE_PERF_PARENT_SPAN_ID");
    } else Deno.env.set("COURSE_PERF_PARENT_SPAN_ID", staleParent);
  }
  console.log(
    JSON.stringify({
      scope: "private synthetic execution, not admission/P",
      guards,
      inputBytes: encoder.encode(big).length,
      outputPrefixBytes: 2 * 1024 * 1024,
      ordinaryCommandUnchanged: true,
    }),
  );
  console.log(
    "PASS stdin UTF8/clearEnv/concurrent streams/large duplex/early exit/closed pipe/errors/warnings/fences and ordinary command/metrics BEGIN-END",
  );
} finally {
  (Deno as any).Command = originalCommand;
  if (ambient === undefined) Deno.env.delete("CORE_STDIN_AMBIENT");
  else Deno.env.set("CORE_STDIN_AMBIENT", ambient);
}
