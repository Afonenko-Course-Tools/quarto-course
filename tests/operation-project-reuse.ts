import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { assertProjectContextGeneration } from "../_extensions/course-core/infrastructure/project-context.ts";
const root = await Deno.makeTempDir({ prefix: "operation-a1-reuse-" }),
  extension = join(
    dirname(dirname(fromFileUrl(import.meta.url))),
    "_extensions/course-core",
  );
let success = false, operationId = "";
const observation = {
  io: {
    readFile: 0,
    readFileBytes: 0,
    readTextFile: 0,
    readTextBytes: 0,
    lstat: 0,
    readDir: 0,
    realPath: 0,
    digests: 0,
    digestBytes: 0,
  },
  commands: [] as any[],
  tempWrites: [] as any[],
  optionalReads: 0,
};
const ActualCommand = Deno.Command,
  actualWrite = Deno.writeTextFile,
  actualRead = Deno.readTextFile,
  baseFileRead = Deno.readFile,
  baseStat = Deno.lstat,
  baseDir = Deno.readDir,
  baseReal = Deno.realPath,
  baseDigest = crypto.subtle.digest.bind(crypto.subtle);
(Deno as any).readFile = async (...a: any[]) => {
  observation.io.readFile++;
  const b = await (baseFileRead as any)(...a);
  observation.io.readFileBytes += b.length;
  return b;
};
(Deno as any).lstat = (...a: any[]) => {
  observation.io.lstat++;
  return (baseStat as any)(...a);
};
(Deno as any).readDir = (...a: any[]) => {
  observation.io.readDir++;
  return (baseDir as any)(...a);
};
(Deno as any).realPath = (...a: any[]) => {
  observation.io.realPath++;
  return (baseReal as any)(...a);
};
(crypto.subtle as any).digest = (...a: any[]) => {
  observation.io.digests++;
  observation.io.digestBytes += a[1].byteLength;
  return (baseDigest as any)(...a);
};
(Deno as any).Command = new Proxy(ActualCommand, {
  construct(t, args: any[]) {
    observation.commands.push(args[1]?.args ?? []);
    return Reflect.construct(t, args);
  },
});
(Deno as any).writeTextFile = async (
  path: any,
  text: string,
  ...rest: any[]
) => {
  if (String(path).includes("/course-bound-context-")) {
    observation.tempWrites.push({
      path: String(path),
      bytes: new TextEncoder().encode(text).length,
    });
  }
  return (actualWrite as any)(path, text, ...rest);
};
(Deno as any).readTextFile = async (path: any, ...rest: any[]) => {
  if (
    /assignment-authority-location|\/(anchor|manifest|profiles)\.json$/.test(
      String(path),
    )
  ) observation.optionalReads++;
  observation.io.readTextFile++;
  const text = await (actualRead as any)(path, ...rest);
  observation.io.readTextBytes += new TextEncoder().encode(text).length;
  return text;
};
const put = async (name: string, text: string) => {
  await Deno.mkdir(dirname(join(root, name)), { recursive: true });
  await Deno.writeTextFile(join(root, name), text);
};
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
try {
  await put(".gitignore", "/.quarto/\n**/*.quarto_ipynb\n");
  await put(
    "_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]\n  post-render: [quarto run ${extension}/entrypoints/native-post.ts]\nformat:\n  html: {theme: none}\ncourse: {id: reuse, view: student}\ncourse-core-runtime: native-ts\ncourse-core-role: exercise-bank\ncourse-core-projection: student\nfilters:\n  - at: pre-ast\n    path: ${extension}/native-ts/early-context.lua\n  - at: post-quarto\n    path: ${extension}/native-ts/late-kind.lua\n  - at: post-render\n    path: ${extension}/native-ts/late-filter.lua\ncourse-project:\n  starter: {path: student}\n`,
  );
  await put(
    "index.qmd",
    '::: {#exr-one project="/projects/a" difficulty=introductory statement-visibility=open}\nУсловие.\n:::\n',
  );
  await put("projects/a/student/main.txt", "RAW_STARTER");
  const rendered = await new Deno.Command("quarto", {
    args: ["render", "index.qmd", "--to", "html"],
    cwd: root,
    env: { QUARTO_RUN_NO_NETWORK: "true" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(rendered.success, new TextDecoder().decode(rendered.stderr));
  await Core.withCurrentNativeOperation({
    root,
    profiles: [],
    projection: "student",
    outputDirectory: join(root, "_site"),
  }, async (op) => {
    assert(
      typeof (op as any).withProjectContexts === "function",
      "REUSE_PUBLIC_BOUNDARY_MISSING",
    );
    operationId = op.identity.operation;
    let retained: any,
      escaped: any,
      inside: any,
      metadata: any,
      origins: any,
      firstFiles: any,
      legacy: any,
      planCosts: any;
    const requests = [{
      owner: root,
      inputs: ["projects/a/native-input.qmd"],
      profiles: [],
      format: "html",
    }];
    await (op as any).withProjectContexts(requests, async (batch: any) => {
      retained = batch;
      inside = batch.metrics;
      escaped = batch.groups[0].contexts[0];
      metadata = escaped.effectiveMetadata["course-project"];
      origins = escaped.origins;
      const plan = await Core.planProject(escaped, { audience: "student" });
      const inventory = await Core.materializeProject(
        plan,
        op.condition({
          source: "index.qmd",
          exerciseId: "exr-one",
          view: "student",
        }),
        { submission: { files: [], instructions: "Сдайте файлы." } },
      );
      firstFiles = inventory.files;
      planCosts = Core.projectPlanMetrics(plan);
      assert(
        (inventory.files.find((f) => f.target === "main.txt") as any)
          .rawSource === "projects/a/student/main.txt",
        "Genuine raw origin changed",
      );
    });
    assert(
      retained.metrics.inspectCalls === 1 && retained.metrics.fullWalks === 0 &&
        op.metrics.inspectCalls === 1 && op.metrics.fullWalks === 1,
      "Owner inspect/discovery repeated",
    );
    assert(
      retained.metrics.fullFences > inside.fullFences,
      "Terminal metrics missed closing checks",
    );
    let expired = false;
    try {
      await Core.planProject(escaped, { audience: "student" });
    } catch (e) {
      expired = String(e).includes("CONTEXT_EXPIRED");
    }
    assert(expired, "Context revived after callback");
    let cloneRejected = false;
    try {
      await Core.planProject(structuredClone(escaped), { audience: "student" });
    } catch (e) {
      cloneRejected = String(e).includes("CONTEXT_EXPIRED");
    }
    assert(cloneRejected, "DTO context gained authority");
    await Core.readProjectContexts(requests, async ([group]) => {
      legacy = group;
      const context = group.contexts[0];
      assert(
        JSON.stringify(context.effectiveMetadata["course-project"]) ===
            JSON.stringify(metadata) &&
          JSON.stringify(context.origins) === JSON.stringify(origins),
        "Existing A1 domain/origins parity lost",
      );
      const plan = await Core.planProject(context, { audience: "student" });
      const inventory = await Core.materializeProject(
        plan,
        op.condition({
          source: "index.qmd",
          exerciseId: "exr-one",
          view: "student",
        }),
        { submission: { files: [], instructions: "Сдайте файлы." } },
      );
      assert(
        JSON.stringify(inventory.files) === JSON.stringify(firstFiles),
        "Legacy A1 inventory bytes/rawSource parity lost",
      );
      assert(
        group.metrics.inspectCalls === 2 && group.metrics.fullWalks === 1,
        "Old same-fixture baseline changed",
      );
      let rejected = false;
      try {
        assertProjectContextGeneration(context, {});
      } catch (e) {
        rejected = String(e).includes("BODY.ASSIGNMENT_PROJECT_PLANS");
      }
      assert(rejected, "Standalone context got same-S authority");
    });
    await (op as any).withProjectContexts([], async (batch: any) => {
      assert(
        batch.groups.length === 0 &&
          Object.values(batch.metrics).every((v) => v === 0),
        "Empty ordinary batch did A1 work",
      );
    });
    let previous = escaped;
    await (op as any).withProjectContexts(requests, async (batch: any) => {
      assert(batch.groups[0].contexts[0] !== previous, "Old context revived");
      assert(
        batch.metrics.inspectCalls === 0 && batch.metrics.probeCacheHits === 1,
        "Repeated batch re-probed",
      );
    });
    assert(
      op.metrics.sourceHashBytes === retained.metrics.sourceBytesRead,
      "sourceHashBytes is not actual S hash volume",
    );
    console.log(
      JSON.stringify({
        root,
        inside,
        terminal: retained.metrics,
        legacyTerminal: legacy.metrics,
        planCosts,
        operation: op.metrics,
      }),
    );
  });
  console.log(JSON.stringify({
    wholeFirstParentHostObservation: structuredClone(observation.io),
    nativePreChildSHashes:
      "reported separately by operation.sourceHashBytes; host observer excludes child internals",
    wholeParentIncludesFinal: true,
  }));
  const expectation = {
    root,
    profiles: [],
    projection: "student" as const,
    outputDirectory: join(root, "_site"),
  };
  const negative = async (
    action: (op: any) => Promise<unknown>,
    pattern: RegExp,
  ) => {
    let error = "";
    try {
      await Core.withCurrentNativeOperation(expectation, action);
    } catch (e) {
      error = String(e);
    }
    assert(
      pattern.test(error),
      "Expected bounded refusal " + pattern + " got " + error,
    );
  };
  for (
    const request of [{
      owner: root + "/foreign",
      inputs: ["projects/a/native-input.qmd"],
      profiles: [],
      format: "html",
    }, {
      owner: root,
      inputs: ["projects/a/native-input.qmd"],
      profiles: ["other"],
      format: "html",
    }, {
      owner: root,
      inputs: ["projects/a/native-input.qmd"],
      profiles: [],
      format: "revealjs",
    }, { owner: root, inputs: ["index.qmd"], profiles: [], format: "html" }]
  ) {
    const before = observation.commands.length;
    await negative(
      (op) => op.withProjectContexts([request], async () => {}),
      /CONTEXT_REQUEST/,
    );
    assert(
      observation.commands.length === before,
      "Invalid request started child",
    );
  }
  let failedContext: any;
  await negative(
    (op) =>
      op.withProjectContexts([{
        owner: root,
        inputs: ["projects/a/native-input.qmd"],
        profiles: [],
        format: "html",
      }], async (batch: any) => {
        failedContext = batch.groups[0].contexts[0];
        throw Error("CALLBACK_SENTINEL");
      }),
    /CALLBACK_SENTINEL/,
  );
  let expiredFailure = false;
  try {
    await Core.planProject(failedContext, { audience: "student" });
  } catch (e) {
    expiredFailure = String(e).includes("CONTEXT_EXPIRED");
  }
  assert(expiredFailure, "Failed callback context revived");
  await negative(
    (op) =>
      op.withProjectContexts([{
        owner: root,
        inputs: ["projects/a/native-input.qmd"],
        profiles: [],
        format: "html",
      }], async () => {
        await op.withProjectContexts([], async () => {});
      }),
    /CONTEXT_REQUEST/,
  );
  const complete = join(
      root,
      "_generated/course-spec/native-ts",
      operationId,
      "complete.json",
    ),
    original = await Deno.readTextFile(complete),
    old = JSON.parse(original);
  (observation as any).ownerWitnessBytes =
    new TextEncoder().encode(JSON.stringify(old.state.ownerWitness)).length;
  delete old.state.ownerWitness;
  delete old.state.metrics.sourceHashBytes;
  await Deno.writeTextFile(complete, JSON.stringify(old));
  try {
    const before = observation.commands.length;
    await negative(async (op) => {
      assert(
        op.document({ source: "index.qmd" }).status === "complete",
        "Old lawful document getter refused",
      );
      let unavailable = false;
      try {
        op.metrics;
      } catch (e) {
        unavailable = String(e).includes("METRICS_UNAVAILABLE");
      }
      assert(unavailable, "Old missing metric invented zero");
      await op.withProjectContexts([], async () => {});
    }, /CONTEXT_OWNER_WITNESS/);
    assert(
      before === observation.commands.length,
      "Old complete launched fallback child",
    );
  } finally {
    await Deno.writeTextFile(complete, original);
  }
  const actualFileRead = Deno.readFile,
    raw = join(root, "projects/a/student/main.txt"),
    originalRaw = await Deno.readTextFile(raw);
  let triggered = false;
  const beforeMutationChild = observation.commands.length;
  (Deno as any).readFile = async (path: any, ...rest: any[]) => {
    const bytes = await (actualFileRead as any)(path, ...rest);
    if (String(path) === raw && !triggered) {
      triggered = true;
      await Deno.writeTextFile(raw, "SOURCE_CHANGED_DURING_COPY");
    }
    return bytes;
  };
  try {
    await negative(
      (op) =>
        op.withProjectContexts([{
          owner: root,
          inputs: ["projects/a/native-input.qmd"],
          profiles: [],
          format: "html",
        }], async () => {
          throw Error("UNSAFE_COPY_CALLBACK");
        }),
      /OPERATION_CHANGED/,
    );
  } finally {
    (Deno as any).readFile = actualFileRead;
    if (triggered) await Deno.writeTextFile(raw, originalRaw);
  }
  assert(
    triggered && observation.commands.length === beforeMutationChild,
    "Changed S reached native A1 probe",
  );
  assert(
    observation.optionalReads === 0,
    "Ordinary reuse read optional I3 authority",
  );
  assert(
    observation.tempWrites.length > 0,
    "Instrumented/generated writes omitted",
  );
  console.log(
    JSON.stringify({
      observation,
      scope:
        "whole host call including parent final guards; native pre child counters in operation sample",
    }),
  );
  success = true;
  console.log(
    "PASS genuine ordinary operation A1 reuse,2inspect/1discovery/1render,terminal metrics,repeated probe cache and context expiry; not assignment qualification",
  );
} finally {
  (Deno as any).Command = ActualCommand;
  (Deno as any).writeTextFile = actualWrite;
  (Deno as any).readTextFile = actualRead;
  (Deno as any).readFile = baseFileRead;
  (Deno as any).lstat = baseStat;
  (Deno as any).readDir = baseDir;
  (Deno as any).realPath = baseReal;
  (crypto.subtle as any).digest = baseDigest;
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Preserved reuse fixture " + root);
}
