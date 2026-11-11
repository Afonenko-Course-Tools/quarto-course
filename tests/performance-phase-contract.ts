import { required } from "./helpers/required.ts";
import { strict as assert } from "node:assert";
import { fromFileUrl, join, toFileUrl } from "stdlib/path";
import {
  assertProjectContext,
  readProjectContexts,
} from "../_extensions/course-core/infrastructure/project-context.ts";
import type { ProjectContext } from "../_extensions/course-core/infrastructure/project-context.ts";

// Используем тот же checkout Performance, что и полный type gate.
const companion = await Deno.realPath(Deno.env.get("COURSE_PERFORMANCE_SOURCE") ??
  fromFileUrl(new URL("../../quarto-course-performance/", import.meta.url)));
const agentModule = toFileUrl(join(companion, "src/agents/ts/agent.ts")).href;
const { installTsAgent }: typeof import("course-performance/src/agents/ts/agent.ts") =
  await import(agentModule);

const root = await Deno.makeTempDir({ prefix: "core-phase-contract-" });
const prior = Deno.env.get("COURSE_PERF_MODE");
const key = Symbol.for("course.performance.agent.v1");
const previousAgent: unknown = Reflect.get(globalThis, key);
try {
  await Deno.mkdir(join(root, "code/starter"), { recursive: true });
  await Deno.writeTextFile(join(root, "code/starter/Main.txt"), "PUBLIC\n");
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "course-project: {starter: {path: starter}}\n",
  );
  const agent = installTsAgent({
    experimentId: "core-phase-contract",
    runId: "contract",
    processId: "contract",
    outputDirectory: root,
    mode: "summary",
  });
  const request = {
    owner: root,
    directories: ["code"],
    profiles: [],
    format: "html",
  };
  const operation = "course-core.infrastructure.project-context.acquire";
  for (const mode of [undefined, "off", "summary"]) {
    mode === undefined
      ? Deno.env.delete("COURSE_PERF_MODE")
      : Deno.env.set("COURSE_PERF_MODE", mode);
    const before = agent.events.length;
    const result = { value: "kept" };
    let escaped: ProjectContext | undefined;
    const actual: typeof result = await readProjectContexts(
      [request],
      async (fixtureGroups) => {
    const group = required(fixtureGroups[0]);
        escaped = required(group.contexts[0]);
        assert.equal(
          escaped.contract.starter?.path,
          join(root, "code/starter"),
        );
        return result;
      },
    );
    assert.equal(actual, result, "Generic callback result identity");
    await assert.rejects(
      () => assertProjectContext(required(escaped)),
      /CONTEXT_EXPIRED/,
    );
    const sentinel = Error("same callback failure");
    let caught: unknown;
    try {
      await readProjectContexts([request], async (fixtureGroups) => {
    const group = required(fixtureGroups[0]);
        escaped = required(group.contexts[0]);
        throw sentinel;
      });
    } catch (error) {
      caught = error;
    }
    assert.equal(caught, sentinel, "Original error identity");
    await assert.rejects(
      () => assertProjectContext(required(escaped)),
      /CONTEXT_EXPIRED/,
    );
    const events = agent.events.slice(before).filter((event) =>
      event.operation_id === operation
    );
    if (mode === "summary") {
      assert.deepEqual(
        events.map((event) => [event.event, event.status ?? null]),
        [["begin", null], ["end", "ok"], ["begin", null], ["end", "error"]],
      );
      assert(
        events.every((event) =>
          event.kind === "phase" &&
          event.attributes?.extension_id === "course-core"
        ),
      );
    } else {
      assert.equal(
        agent.events.length,
        before,
        "Off/absent mode must not record telemetry",
      );
    }
  }
  agent.flush();
  console.log(
    "PASS actual ABI agent: generic callback result, original error, finally expiry, off/absent identity and real success/error spans",
  );
} finally {
  prior === undefined
    ? Deno.env.delete("COURSE_PERF_MODE")
    : Deno.env.set("COURSE_PERF_MODE", prior);
  previousAgent === undefined
    ? Reflect.deleteProperty(globalThis, key)
    : Reflect.set(globalThis, key, previousAgent);
  await Deno.remove(root, { recursive: true });
}
