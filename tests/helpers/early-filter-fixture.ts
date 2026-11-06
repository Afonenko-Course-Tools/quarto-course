import { dirname, fromFileUrl, join } from "stdlib/path";

const filter = fromFileUrl(
  new URL(
    "../../_extensions/course-core/native-ts/early-filter.ts",
    import.meta.url,
  ),
);
export const metaString = (c: string) => ({ t: "MetaString", c });
export const metaMap = (c: Record<string, unknown>) => ({ t: "MetaMap", c });
export const paragraph = (c: string) => ({ t: "Para", c: [{ t: "Str", c }] });
export const exercise = (
  body: unknown[] = [paragraph("Условие")],
  attrs: string[][] = [],
) => ({
  t: "Div",
  c: [["exr-one", [], attrs], body],
});

/** File-backed fixture существующего TS transport; не actual Quarto capture/capability. */
export async function earlyFilterFixture(options: {
  meta?: Record<string, unknown>;
  blocks?: unknown[];
  defaults?: Record<string, unknown>;
  assignment?: boolean;
  manual?: boolean;
  context?: Record<string, unknown>;
  nativeContext?: Record<string, unknown>;
  token?: string;
} = {}) {
  const root = await Deno.makeTempDir({ prefix: "core-early-fixture-" });
  const operation = crypto.randomUUID(),
    witness = crypto.randomUUID(),
    token = crypto.randomUUID();
  const directory = join(root, "_generated/course-spec/native-ts", operation);
  await Deno.mkdir(directory, { recursive: true });
  const profiles = ["full"], inputs = ["bank.qmd", "work.qmd"];
  const assessments = [{ source: "work.qmd", id: "work" }];
  const context = {
    operation,
    captureWitness: witness,
    profiles,
    input: join(root, "bank.qmd"),
    format: "html",
    projection: "author",
    exerciseBank: true,
    defaults: options.defaults ?? {},
    ...options.context,
  };
  const {
    format: _format,
    exerciseBank: _bank,
    defaults: _defaults,
    ...pending
  } = context;
  const capture = join(directory, "0"),
    requestPath = join(directory, "0.request.json");
  const request = {
    context: options.manual ? context : pending,
    capture,
    ...(options.assignment
      ? { assignment: { source: "bank.qmd", assessments } }
      : {}),
  };
  const put = (name: string, value: unknown) =>
    Deno.writeTextFile(join(directory, name), JSON.stringify(value));
  if (options.assignment) {
    await Deno.writeTextFile(
      join(dirname(directory), "active.json"),
      JSON.stringify({ operation, directory }),
    );
    await put("reservation.json", {
      schema: "course-native-capture-reservation-v1",
      root,
      operation,
      directory,
      projection: "author",
      outputDirectory: join(root, "_generated/out"),
      expectedSources: inputs,
      status: "bound",
      children: [{ token, inputs, used: true, posted: false }],
    });
    await put("state.json", {
      schema: "course-native-operation-private-v2",
      root,
      operation,
      directory,
      projection: "author",
      outputDirectory: join(root, "_generated/out"),
      profiles,
      inputs,
      ownerInputs: inputs,
      captureWitnesses: {
        "bank.qmd": witness,
        "work.qmd": crypto.randomUUID(),
      },
      assignment: {
        assessments,
        runtime: {
          executable: "/fixture/quarto",
          environment: {},
          profiles,
          outputDirectory: join(root, "_generated/out"),
          inputs,
        },
      },
      metrics: { inspectCalls: 0, nativeMetadataBytes: 0, childRenders: 0 },
    });
  }
  await Deno.writeTextFile(requestPath, JSON.stringify(request));
  const ast = {
    "pandoc-api-version": [1, 23, 1],
    meta: {
      ...options.meta,
      "course-core-ts-request": metaString(requestPath),
      "course-core-ts-context": metaString(
        JSON.stringify({ ...context, ...options.nativeContext }),
      ),
    },
    blocks: options.blocks ?? [exercise()],
  };
  const env: Record<string, string> = {
    ...Deno.env.toObject(),
    COURSE_CORE_CAPTURE_TOKEN: options.token ?? token,
  };
  delete env.COURSE_CORE_TS_RUN;
  if (options.manual) env.COURSE_CORE_TS_RUN = requestPath;
  const importMap = join(root, "import-map.json");
  await Deno.writeTextFile(
    importMap,
    JSON.stringify({
      imports: { "stdlib/path": import.meta.resolve("stdlib/path") },
    }),
  );
  try {
    const child = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--cached-only",
        "--no-check",
        "--import-map=" + importMap,
        "--allow-read",
        "--allow-write",
        "--allow-env",
        filter,
      ],
      env,
      clearEnv: true,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(JSON.stringify(ast)));
    await writer.close();
    const result = await child.output();
    return {
      success: result.success,
      stderr: new TextDecoder().decode(result.stderr),
      early: result.success
        ? JSON.parse(await Deno.readTextFile(capture + ".early.json"))
        : undefined,
      facts: result.success && options.assignment
        ? JSON.parse(await Deno.readTextFile(capture + ".project-facts.json"))
        : undefined,
    };
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}
