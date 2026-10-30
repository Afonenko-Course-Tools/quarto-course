import { quartoOutputNames } from "../infrastructure/generated-paths.ts";
import {
  toolCacheContainer,
  toolCachePath,
} from "../infrastructure/tool-cache.ts";
import { validateNativeRelease } from "../release/validate.ts";
import type {
  NativeAdapterValidator,
  NativeReleaseRequest,
} from "../release/contracts.ts";
import { bindNativeValue } from "./capabilities.ts";
import { dirname, join, relative, resolve } from "stdlib/path";
// @deno-types="../vendor/zod/v4/index.d.ts"
import { z } from "../vendor/zod/v4/index.js";
import { fail } from "../contracts/project.ts";
import {
  decode,
  EarlyDocumentSchema,
  FinalizedDocumentSchema,
  LateDocumentSchema,
} from "../document/contracts.ts";
import { finalizeDocument } from "../document/finalize.ts";
import { immutable, selectCondition } from "../document/condition.ts";
import { command, quartoExecutable } from "../infrastructure/process.ts";
import { safeParent } from "../artifacts/files.ts";
import { assertArtifactTarget } from "../artifacts/project.ts";
import {
  NativeCatalogSchema,
  NativeConditionRequestSchema,
  NativeDocumentRequestSchema,
  NativeOperationExpectationSchema,
  NativeOperationIdentitySchema,
  NativeOperationMetricsSchema,
  NativePendingOperationSchema,
  NativePublicDocumentSchema,
  NativeResourceInventorySchema,
  NativeResourceRequestSchema,
} from "./contracts.ts";
import type {
  NativeConditionRequest,
  NativeDocumentRequest,
  NativeOperationExpectation,
  NativeResourceRequest,
} from "./contracts.ts";
const base = (root: string) => join(root, "_generated/course-spec/native-ts");
const pointer = (root: string) => join(base(root), "active.json");
const signature = (s: Deno.FileInfo) =>
  JSON.stringify([
    s.dev,
    s.ino,
    s.mode,
    s.size,
    s.mtime?.getTime(),
    s.ctime?.getTime(),
    s.isFile,
    s.isDirectory,
    s.isSymlink,
  ]);
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const pathSchema = z.string().min(1).refine((s) =>
  !s.startsWith("/") && !s.includes("\\") && !s.includes("\0") &&
  s.split("/").every((p) => p && p !== "." && p !== "..")
);
const rowSchema = z.strictObject({
  path: pathSchema,
  signature: z.string(),
  sha256: z.string(),
});
const nativeCaptureSchema = z.strictObject({
  output: z.string(),
  body: z.array(z.unknown()),
  role: z.enum(["exercise-bank", "page"]),
  resources: z.array(
    z.strictObject({
      source: z.string(),
      output: z.string(),
      sha1: z.string().regex(/^[a-f0-9]{40}$/),
    }),
  ),
});
const stateSchema = z.strictObject({
  schema: z.literal("course-native-operation-private-v1"),
  operation: z.uuid(),
  root: z.string(),
  directory: z.string(),
  outputDirectory: z.string(),
  profiles: z.array(z.string()),
  projection: z.enum(["student", "author"]),
  captureWitnesses: z.record(pathSchema, z.uuid()),
  invocation: z.string(),
  localInvocation: z.string(),
  inputs: z.array(pathSchema),
  rows: z.array(rowSchema),
  relevantInputs: z.array(pathSchema),
  configurationInputs: z.array(pathSchema),
  documentInputs: z.record(pathSchema, z.array(pathSchema)),
  memberships: z.record(z.string(), z.array(z.string())),
  metrics: z.strictObject({
    inspectCalls: z.number(),
    fullWalks: z.number(),
    sourceHashReads: z.number(),
    resourceHashReads: z.number(),
    nativeResourceHashReads: z.number(),
  }),
});
type State = z.output<typeof stateSchema>;
const completeSchema = z.strictObject({
  state: stateSchema,
  catalog: NativeCatalogSchema,
  documents: z.array(NativePublicDocumentSchema),
  resources: z.array(
    z.strictObject({
      source: pathSchema,
      path: z.string(),
      signature: z.string(),
      sha256: z.string(),
      documents: z.array(pathSchema),
    }),
  ),
  outputs: z.array(rowSchema),
  releaseDocuments: z.array(
    z.strictObject({
      source: pathSchema,
      early: EarlyDocumentSchema.omit({ ast: true, occurrences: true }),
      final: FinalizedDocumentSchema.pick({ hasPublicSolution: true }),
    }),
  ),
});
const privateParts =
  /(^|\/)(?:private|reference|solution|solutions|grading-notes|rubric\.md|contract\.md|closed-tests|tests)(\/|$)/i;
const sourcePart =
  /(^|\/)(?:\.[^/]+|_extensions|_freeze|_generated|_site|_book|_output|site_libs|node_modules|build|target|out|__pycache__)(\/|$)|(^|\/)(?:_quarto(?:[-.]|$)|_metadata\.ya?ml$)|\.(?:qmd|rmd|ipynb|class|jar|ya?ml|lua|ts|cue|r|py|sh|toml)$/i;
const ordinary = (path: string) =>
  !privateParts.test(path) && !sourcePart.test(path) &&
  !/(^|\/)check\.sh$/.test(path);
async function ownedPhysical(root: string, path: string) {
  if (!pathSchema.safeParse(path).success) {
    fail("RESOURCE_PATH", "Нужен canonical путь внутри owner");
  }
  let current = root;
  for (const part of path.split("/")) {
    current = join(current, part);
    if ((await Deno.lstat(current)).isSymlink) {
      fail("OPERATION_CHANGED", "Символическая ссылка в native operation");
    }
  }
  if (await Deno.realPath(current) !== current) {
    fail("OPERATION_CHANGED", "Неканонический native path");
  }
  return current;
}
async function regular(root: string, path: string) {
  const current = await ownedPhysical(root, path);
  if (!(await Deno.lstat(current)).isFile) {
    fail("OPERATION_CHANGED", "Нужен regular native file");
  }
  return current;
}
async function hash(bytes: Uint8Array, algorithm = "SHA-256") {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest(algorithm, new Uint8Array(bytes)),
    ),
  ].map((v) => v.toString(16).padStart(2, "0")).join("");
}
async function runtimeIdentity(root: string, content = true) {
  const requested = quartoExecutable();
  let path: string | undefined;
  for (
    const candidate of requested.includes("/")
      ? [resolve(root, requested)]
      : (Deno.env.get("PATH") || "").split(":").map((d) =>
        resolve(root, d, requested)
      )
  ) {
    try {
      if ((await Deno.stat(candidate)).isFile) {
        path = candidate;
        break;
      }
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  }
  if (!path) fail("OPERATION_CHANGED", "Quarto executable отсутствует");
  const physical = await Deno.realPath(path), info = await Deno.lstat(physical);
  if (!info.isFile || info.isSymlink) {
    fail("OPERATION_CHANGED", "Quarto executable не regular");
  }
  return JSON.stringify({
    requested,
    path,
    physical,
    signature: signature(info),
    ...(content ? { sha256: await hash(await Deno.readFile(physical)) } : {}),
  });
}
async function json(path: string) {
  return JSON.parse(await Deno.readTextFile(path));
}
async function envFiles(root: string, key: string) {
  const file = Deno.env.get(
    key.replace("QUARTO_PROJECT_", "QUARTO_USE_FILE_FOR_PROJECT_"),
  );
  return (file ? await Deno.readTextFile(file) : Deno.env.get(key) || "").split(
    /\r?\n/,
  ).filter(Boolean).map((p) => resolve(root, p));
}
function excluded(
  state: Pick<State, "root" | "outputDirectory">,
  path: string,
) {
  const name = relative(state.root, path);
  return path === state.outputDirectory || toolCachePath(state.root, path) ||
    name.split("/").some((p) =>
      [
        ...quartoOutputNames,
        ".git",
        ".quarto",
        "_generated",
        "node_modules",
        ".gradle",
        "build",
      ]
        .includes(p)
    );
}
async function snapshot(state: State) {
  state.metrics.fullWalks++;
  async function walk(dir: string) {
    const names: string[] = [];
    for await (const e of Deno.readDir(dir)) {
      const p = join(dir, e.name);
      if (excluded(state, p)) continue;
      if (e.isSymlink || !(e.isFile || e.isDirectory)) {
        fail(
          "OPERATION_UNQUALIFIED",
          "Native source symlink/special entry не квалифицирован",
        );
      }
      names.push(e.name);
      if (e.isDirectory) await walk(p);
      else {
        const signatureBefore = signature(await Deno.lstat(p));
        const bytes = await Deno.readFile(p);
        state.metrics.sourceHashReads++;
        if (signature(await Deno.lstat(p)) !== signatureBefore) {
          fail("OPERATION_CHANGED", "Source изменён при snapshot");
        }
        state.rows.push({
          path: relative(state.root, p),
          signature: signatureBefore,
          sha256: await hash(bytes),
        });
      }
    }
    state.memberships[relative(state.root, dir)] = names.sort();
  }
  await walk(state.root);
}
async function assertSources(
  state: State,
  additions: readonly string[] = [],
  full = true,
  selectedInputs: readonly string[] = state.relevantInputs,
) {
  const relevant = new Set(selectedInputs);
  const directories = new Set(
    selectedInputs.map((p) => dirname(p) === "." ? "" : dirname(p)),
  );
  for (const input of selectedInputs) {
    if (Object.hasOwn(state.memberships, input)) directories.add(input);
    let directory = dirname(input);
    while (directory !== ".") {
      directories.add(directory);
      directory = dirname(directory);
    }
    directories.add("");
  }
  for (const row of state.rows) {
    if (!full && !relevant.has(row.path)) continue;
    const p = await regular(state.root, row.path);
    if (signature(await Deno.lstat(p)) !== row.signature) {
      fail("OPERATION_CHANGED", "Native source изменён: " + row.path);
    }
  }
  const allowed = new Set(additions);
  for (const [dir, names] of Object.entries(state.memberships)) {
    if (!full && !directories.has(dir)) continue;
    const current: string[] = [];
    for await (const entry of Deno.readDir(join(state.root, dir))) {
      const path = join(state.root, dir, entry.name);
      if (excluded(state, path)) continue;
      if (
        !names.includes(entry.name) &&
        await toolCacheContainer(state.root, path)
      ) continue;
      const local = relative(state.root, path);
      if (
        !names.includes(entry.name) &&
        [...allowed].some((p) => p === local || p.startsWith(local + "/"))
      ) continue;
      current.push(entry.name);
    }
    if (!same(current.sort(), names)) {
      fail("OPERATION_CHANGED", "Изменён состав native source: " + dir);
    }
  }
}
async function assertPrivate(state: State, full = false) {
  if (
    await Deno.realPath(state.root) !== state.root ||
    !same(await json(pointer(state.root)), {
      operation: state.operation,
      directory: state.directory,
    })
  ) fail("OPERATION_CHANGED", "Активная native операция заменена");
  const identity = await runtimeIdentity(state.root, full);
  if (identity !== (full ? state.invocation : state.localInvocation)) {
    fail("OPERATION_CHANGED", "Изменён native runtime/environment");
  }
}
/** Production pre-render: реальный native inspect, source fence и новые capture capabilities. */
export async function beginNativeOperation(root: string) {
  root = await Deno.realPath(root);
  const profiles = (Deno.env.get("QUARTO_PROFILE") || "").split(",").filter(
    Boolean,
  );
  const owner = JSON.parse(
    await command(quartoExecutable(), [
      "inspect",
      root,
      ...(profiles.length ? ["--profile", profiles.join(",")] : []),
    ], root),
  );
  const courseView = owner.config?.course?.view;
  const projection = owner.config?.["course-core-projection"] ??
    (courseView === "full"
      ? "author"
      : courseView === "student"
      ? "student"
      : undefined);
  if (
    courseView !== undefined &&
    courseView !== (projection === "author" ? "full" : "student")
  ) fail("OPERATION_BINDING", "course.view/native projection конфликтуют");
  if (
    owner.quarto?.version !== "1.11.5" || owner.dir !== root ||
    owner.config?.["course-core-runtime"] !== "native-ts" ||
    !["student", "author"].includes(projection)
  ) {
    fail(
      "OPERATION_UNQUALIFIED",
      "Требуется native-ts Quarto 1.11.5 HTML student/author",
    );
  }
  const outputDirectory = resolve(
    root,
    Deno.env.get("QUARTO_PROJECT_OUTPUT_DIR") ||
      owner.config.project?.["output-dir"] || "_site",
  );
  if (!outputDirectory.startsWith(root + "/")) {
    fail("OPERATION_BINDING", "Output должен находиться внутри owner");
  }
  const inputs = (await envFiles(root, "QUARTO_PROJECT_INPUT_FILES")).map((p) =>
    relative(root, p)
  );
  if (!inputs.length || inputs.some((p) => !pathSchema.safeParse(p).success)) {
    fail("OPERATION_BINDING", "Нет текущих native inputs");
  }
  const operation = crypto.randomUUID(),
    directory = join(base(root), operation);
  await safeParent(base(root));
  await Deno.mkdir(base(root), { recursive: true });
  await Deno.mkdir(directory, { mode: 0o700 });
  try {
    await regular(root, relative(root, pointer(root)));
    const previous = await json(pointer(root));
    if (
      !z.uuid().safeParse(previous.operation).success ||
      previous.directory !== join(base(root), previous.operation)
    ) fail("OPERATION_BINDING", "Private pointer занят чужими данными");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  const state: State = {
    schema: "course-native-operation-private-v1",
    operation,
    root,
    directory,
    outputDirectory,
    profiles,
    projection,
    captureWitnesses: Object.fromEntries(
      inputs.map((source) => [source, crypto.randomUUID()]),
    ),
    inputs,
    rows: [],
    relevantInputs: [],
    configurationInputs: [],
    documentInputs: {},
    memberships: {},
    invocation: await runtimeIdentity(root),
    localInvocation: await runtimeIdentity(root, false),
    metrics: {
      inspectCalls: 1,
      fullWalks: 0,
      sourceHashReads: 0,
      resourceHashReads: 0,
      nativeResourceHashReads: 0,
    },
  };
  await snapshot(state);
  const configuration = new Set<string>();
  for (const config of owner.files?.config ?? []) {
    configuration.add(relative(root, resolve(root, config)));
  }
  state.configurationInputs = [...configuration];
  const relevant = new Set<string>(configuration);
  for (const source of inputs) {
    const dependencies = new Set<string>([source]);
    const information = owner.fileInformation?.[source];
    if (!information || !Array.isArray(information.includeMap)) {
      fail("OPERATION_UNQUALIFIED", "Нет native include closure");
    }
    for (const edge of information.includeMap) {
      if (typeof edge.source !== "string" || typeof edge.target !== "string") {
        fail(
          "OPERATION_UNQUALIFIED",
          "Некорректное native include observation",
        );
      }
      const original = resolve(root, edge.source);
      dependencies.add(relative(root, original));
      dependencies.add(relative(root, resolve(dirname(original), edge.target)));
    }
    let directory = dirname(resolve(root, source));
    while (true) {
      for (const name of ["_metadata.yml", "_metadata.yaml"]) {
        const path = relative(root, join(directory, name));
        if (state.rows.some((r) => r.path === path)) dependencies.add(path);
      }
      if (directory === root) break;
      directory = dirname(directory);
    }
    state.documentInputs[source] = [...dependencies];
    for (const dependency of dependencies) relevant.add(dependency);
  }
  for (const input of relevant) {
    if (!state.rows.some((r) => r.path === input)) {
      fail(
        "OPERATION_BINDING",
        "Native input/config/include отсутствует в source snapshot",
      );
    }
  }
  state.relevantInputs = [...relevant];
  for (let index = 0; index < inputs.length; index++) {
    await regular(root, inputs[index]);
    await Deno.writeTextFile(
      join(directory, `${index}.request.json`),
      JSON.stringify({
        context: {
          operation,
          captureWitness: state.captureWitnesses[inputs[index]],
          profiles: state.profiles,
          input: resolve(root, inputs[index]),
          format: "html",
          projection: state.projection,
          exerciseBank: true,
        },
        capture: join(directory, String(index)),
      }),
      { createNew: true, mode: 0o600 },
    );
  }
  await Deno.writeTextFile(
    join(directory, "state.json"),
    JSON.stringify(state),
    { createNew: true, mode: 0o600 },
  );
  await Deno.writeTextFile(
    pointer(root),
    JSON.stringify({ operation, directory }),
    { mode: 0o600 },
  );
}
function localUses(value: unknown): string[] {
  const result = new Set<string>();
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as Record<string, unknown>, content = node.c;
    if ((node.t === "Link" || node.t === "Image") && Array.isArray(content)) {
      const target = content[2],
        url = Array.isArray(target) ? target[0] : undefined;
      if (
        typeof url === "string" && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)
      ) result.add(url.split(/[?#]/)[0]);
    }
    if (
      (node.t === "RawBlock" || node.t === "RawInline") &&
      Array.isArray(content) && content[0] === "html" &&
      typeof content[1] === "string"
    ) {
      for (
        const m of content[1].matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)
      ) {
        if (!/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(m[1])) {
          result.add(m[1].split(/[?#]/)[0]);
        }
      }
    }
    Object.values(node).forEach(visit);
  }
  visit(value);
  return [...result];
}
/** Production post-render: поздняя фактическая проекция и только текущие native outputs. */
export async function finishNativeOperation(root: string) {
  root = await Deno.realPath(root);
  const active = await json(pointer(root));
  if (
    !z.uuid().safeParse(active.operation).success ||
    active.directory !== join(base(root), active.operation)
  ) fail("OPERATION_BINDING", "Чужой private operation pointer");
  const state = decode(
    stateSchema,
    await json(join(active.directory, "state.json")),
    "OPERATION_BINDING",
  );
  await assertPrivate(state, true);
  if (
    !same(
      state.profiles,
      (Deno.env.get("QUARTO_PROFILE") || "").split(",").filter(Boolean),
    )
  ) fail("OPERATION_BINDING", "Native profiles изменились между hooks");
  const outputs = await envFiles(root, "QUARTO_PROJECT_OUTPUT_FILES");
  if (!outputs.length) {
    fail("OPERATION_INCOMPLETE", "Нет текущих native outputs");
  }
  const documents = [],
    catalogDocuments = [],
    resources: z.output<typeof completeSchema>["resources"] = [],
    outputRows: z.output<typeof rowSchema>[] = [];
  const additions: string[] = [];
  const releaseDocuments: z.output<typeof completeSchema>["releaseDocuments"] =
    [];
  for (let index = 0; index < state.inputs.length; index++) {
    const capture = join(state.directory, String(index));
    const early = decode(
      EarlyDocumentSchema,
      await json(capture + ".early.json"),
      "OPERATION_INCOMPLETE",
    );
    const late = decode(
      LateDocumentSchema,
      await json(capture + ".late.json"),
      "OPERATION_INCOMPLETE",
    );
    const native = decode(
      nativeCaptureSchema,
      await json(capture + ".native.json"),
      "OPERATION_INCOMPLETE",
    );
    state.metrics.nativeResourceHashReads += native.resources.length;
    if (
      early.context.captureWitness !==
        state.captureWitnesses[state.inputs[index]] ||
      !same(early.context.profiles, state.profiles) ||
      early.context.operation !== state.operation ||
      early.context.input !== resolve(root, state.inputs[index]) ||
      early.context.format !== "html" ||
      early.context.projection !== state.projection
    ) fail("OPERATION_BINDING", "Чужой native capture");
    if (early.context.exerciseBank !== (native.role === "exercise-bank")) {
      fail("OPERATION_BINDING", "Native role/capture отличаются");
    }
    const document = finalizeDocument(early, late);
    if (document.status !== "complete") {
      fail("OPERATION_INCOMPLETE", "Неполный late native capture");
    }
    const output = resolve(root, native.output);
    if (
      !outputs.includes(output) ||
      !output.startsWith(state.outputDirectory + "/") ||
      !output.endsWith(".html")
    ) fail("OPERATION_BINDING", "Документ не принадлежит текущему HTML output");
    const outputPath = relative(root, output);
    await regular(root, outputPath);
    outputRows.push({
      path: outputPath,
      signature: signature(await Deno.lstat(output)),
      sha256: await hash(await Deno.readFile(output)),
    });
    releaseDocuments.push({
      source: state.inputs[index],
      early: {
        context: early.context,
        definitions: early.definitions,
        release: early.release,
      },
      final: { hasPublicSolution: structuredClone(document.hasPublicSolution) },
    });
    const source = state.inputs[index],
      visibleIds = new Set(
        document.occurrences.filter((r) => r.kind === "exercise").map((r) =>
          r.exerciseId
        ),
      );
    document.definitions = Object.fromEntries(
      Object.entries(document.definitions).filter(([id]) => visibleIds.has(id)),
    );
    document.context = { ...document.context, input: source, defaults: {} };
    documents.push(
      decode(NativePublicDocumentSchema, document, "OPERATION_DOCUMENT"),
    );
    const role = native.role;
    if (role !== "exercise-bank" && role !== "page") {
      fail("OPERATION_UNQUALIFIED", "Не квалифицирована native document role");
    }
    catalogDocuments.push({
      source,
      output: relative(state.outputDirectory, output),
      role,
      exercises: document.occurrences.filter((r) => r.kind === "exercise").map(
        (r) => ({
          id: r.exerciseId,
          occurrence: r.key,
          anchor: r.anchor,
          hasPublicSolution: document.hasPublicSolution[r.exerciseId] === true,
          ...(document.definitions[r.exerciseId]?.project
            ? {
              project: relative(
                root,
                resolve(
                  document.definitions[r.exerciseId].project!.startsWith("/")
                    ? root
                    : dirname(resolve(root, source)),
                  document.definitions[r.exerciseId].project!.replace(
                    /^\//,
                    "",
                  ),
                ),
              ),
            }
            : {}),
        }),
      ),
    });
    for (const use of localUses(native.body)) {
      let decoded: string;
      try {
        decoded = decodeURIComponent(use);
      } catch {
        fail("RESOURCE_PATH", "Некорректный URL ресурса");
      }
      const canonical = relative(
        root,
        resolve(
          use.startsWith("/") ? root : dirname(resolve(root, source)),
          decoded.replace(/^\//, ""),
        ),
      );
      if (!pathSchema.safeParse(canonical).success) {
        fail("RESOURCE_PATH", "Ресурс выходит из owner");
      }
      if (!ordinary(canonical) || toolCachePath(root, canonical)) continue;
      // Только фактическое native наблюдение разрешает relocated fallback.
      const observed = native.resources.find((r) =>
        resolve(r.source) === resolve(root, canonical)
      );
      if (!observed) {
        try {
          await regular(root, canonical);
        } catch (e) {
          if (e instanceof Deno.errors.NotFound) continue;
          throw e;
        }
        fail(
          "RESOURCE_UNQUALIFIED",
          "Ресурс появился после native byte observation",
        );
      }
      const expectedOutput = resolve(state.outputDirectory, canonical);
      if (resolve(observed.output) !== expectedOutput) {
        fail("OPERATION_BINDING", "Native resource output отличается");
      }
      let path: string;
      try {
        path = await regular(root, canonical);
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) throw e;
        try {
          path = await regular(root, relative(root, expectedOutput));
        } catch (missing) {
          if (missing instanceof Deno.errors.NotFound) {
            fail(
              "RESOURCE_CURRENT_BYTES_MISSING",
              "Не найдены наблюдавшиеся native bytes",
            );
          }
          throw missing;
        }
      }
      const existing = resources.find((r) => r.source === canonical);
      if (existing) {
        if (!existing.documents.includes(source)) {
          existing.documents.push(source);
        }
        continue;
      }
      const bytes = await Deno.readFile(path);
      state.metrics.resourceHashReads += 2;
      if (await hash(bytes, "SHA-1") !== observed.sha1) {
        fail(
          "OPERATION_CHANGED",
          "Native resource bytes отличаются от late observation",
        );
      }
      resources.push({
        source: canonical,
        documents: [source],
        path,
        signature: signature(await Deno.lstat(path)),
        sha256: await hash(bytes),
      });
      if (!state.rows.some((r) => r.path === canonical)) {
        additions.push(canonical);
      }
    }
  }
  if (
    outputs.filter((p) => p.endsWith(".html")).some((p) =>
      !outputRows.some((r) => resolve(root, r.path) === p)
    )
  ) fail("OPERATION_INCOMPLETE", "HTML output без Core capture");
  await assertSources(state, additions);
  const identity = NativeOperationIdentitySchema.parse({
    operation: state.operation,
    profiles: state.profiles,
    format: "html",
    projection: state.projection,
    runtime: "quarto-1.11.5",
  });
  const complete = completeSchema.parse({
    state,
    catalog: { identity, documents: catalogDocuments },
    documents,
    resources,
    outputs: outputRows,
    releaseDocuments,
  });
  await Deno.writeTextFile(
    join(state.directory, "complete.json"),
    JSON.stringify(complete),
    { createNew: true, mode: 0o600 },
  );
  console.log(
    `Core: ${documents.length} текущих native-ts HTML/${state.projection} документов`,
  );
}
/** Только correlation текущей pre-фазы; DTO не даёт complete IO authority. */
export async function withPendingNativeOperation<T>(
  expectationValue: NativeOperationExpectation,
  use: (operation: z.output<typeof NativePendingOperationSchema>) => Promise<T>,
): Promise<T> {
  const expectation = decode(
    NativeOperationExpectationSchema,
    expectationValue,
    "OPERATION_BINDING",
  );
  if (await Deno.realPath(expectation.root) !== expectation.root) {
    fail("OPERATION_BINDING", "Не canonical owner");
  }
  let active: { operation: string; directory: string }, state: State;
  try {
    active = await json(
      await regular(
        expectation.root,
        relative(expectation.root, pointer(expectation.root)),
      ),
    );
    if (
      !z.uuid().safeParse(active.operation).success ||
      active.directory !== join(base(expectation.root), active.operation)
    ) fail("OPERATION_BINDING", "Чужой pending pointer");
    state = decode(
      stateSchema,
      await json(
        await regular(
          expectation.root,
          relative(expectation.root, join(active.directory, "state.json")),
        ),
      ),
      "OPERATION_INCOMPLETE",
    );
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      fail("OPERATION_INCOMPLETE", "Pending generation отсутствует");
    }
    throw error;
  }
  if (
    state.root !== expectation.root || state.operation !== active.operation ||
    state.directory !== active.directory ||
    !same(state.profiles, expectation.profiles) ||
    state.projection !== expectation.projection ||
    state.outputDirectory !== expectation.outputDirectory
  ) {
    fail(
      "OPERATION_BINDING",
      "Pending owner/profile/projection/output отличаются",
    );
  }
  const statePath = join(state.directory, "state.json"),
    stateSignature = signature(await Deno.lstat(statePath));
  const descriptor = immutable(NativePendingOperationSchema.parse({
    identity: {
      operation: state.operation,
      profiles: state.profiles,
      format: "html",
      projection: state.projection,
      runtime: "quarto-1.11.5",
    },
    inputs: state.inputs.map((source) => ({
      source,
      captureWitness: state.captureWitnesses[source],
    })),
  }));
  let live = true;
  const environment = JSON.stringify(
      Object.entries(Deno.env.toObject()).sort(),
    ),
    cwd = Deno.cwd();
  const syncGuard = () => {
    if (!live) fail("OPERATION_EXPIRED", "Pending callback завершён");
  };
  const guard = async () => {
    syncGuard();
    if (
      cwd !== Deno.cwd() ||
      environment !== JSON.stringify(Object.entries(Deno.env.toObject()).sort())
    ) fail("OPERATION_CHANGED", "Изменён pending environment");
    await assertPrivate(state, true);
    if (signature(await Deno.lstat(statePath)) !== stateSignature) {
      fail("OPERATION_CHANGED", "Изменён pending state");
    }
    try {
      await Deno.lstat(join(state.directory, "complete.json"));
      fail("OPERATION_COMPLETED", "Pending generation уже завершена");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    await assertSources(state);
  };
  const view = Object.freeze({
    get identity() {
      syncGuard();
      return descriptor.identity;
    },
    get inputs() {
      syncGuard();
      return descriptor.inputs;
    },
  });
  try {
    await guard();
    const result = await use(view);
    await guard();
    return result;
  } finally {
    live = false;
  }
}
export async function withCurrentNativeOperation<T>(
  expectationValue: NativeOperationExpectation,
  use: (operation: ReturnType<typeof publicOperation>) => Promise<T>,
): Promise<T> {
  const expectation = decode(
    NativeOperationExpectationSchema,
    expectationValue,
    "OPERATION_BINDING",
  );
  if (await Deno.realPath(expectation.root) !== expectation.root) {
    fail("OPERATION_BINDING", "Не canonical owner");
  }
  let active: { operation: string; directory: string };
  try {
    await regular(
      expectation.root,
      relative(expectation.root, pointer(expectation.root)),
    );
    active = await json(pointer(expectation.root));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      fail("OPERATION_BINDING", "В owner нет текущей native операции");
    }
    throw error;
  }
  if (
    !z.uuid().safeParse(active.operation).success ||
    active.directory !== join(base(expectation.root), active.operation)
  ) fail("OPERATION_BINDING", "Неверный operation pointer");
  const path = join(active.directory, "complete.json");
  let signatureBefore: string, complete: z.output<typeof completeSchema>;
  try {
    signatureBefore = signature(
      await Deno.lstat(
        await regular(expectation.root, relative(expectation.root, path)),
      ),
    );
    complete = decode(completeSchema, await json(path), "OPERATION_INCOMPLETE");
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      fail("OPERATION_INCOMPLETE", "Операция ещё не завершена");
    }
    throw e;
  }
  const pointerSignature = signature(
    await Deno.lstat(pointer(expectation.root)),
  );
  if (
    complete.state.root !== expectation.root ||
    complete.state.directory !== active.directory ||
    complete.state.operation !== active.operation ||
    !same(complete.state.profiles, expectation.profiles) ||
    complete.state.projection !== expectation.projection ||
    complete.state.outputDirectory !== expectation.outputDirectory
  ) fail("OPERATION_BINDING", "Ожидания root/profiles/output отличаются");
  let live = true;
  const invocationEnvironment = JSON.stringify(
      Object.entries(Deno.env.toObject()).sort(),
    ),
    invocationCwd = Deno.cwd();
  const guard = async (
    full = false,
    selectedResources?: readonly string[],
    documentSources?: readonly string[],
  ) => {
    if (!live) fail("OPERATION_EXPIRED", "Callback native операции завершён");
    if (
      Deno.cwd() !== invocationCwd ||
      JSON.stringify(Object.entries(Deno.env.toObject()).sort()) !==
        invocationEnvironment
    ) fail("OPERATION_CHANGED", "Environment/cwd изменились внутри callback");
    if (
      signature(await Deno.lstat(pointer(expectation.root))) !==
        pointerSignature
    ) fail("OPERATION_CHANGED", "Operation pointer заменён");
    metrics.currentnessChecks++;
    if (full) metrics.fullFences++;
    await assertPrivate(complete.state, full);
    if (signature(await Deno.lstat(path)) !== signatureBefore) {
      fail("OPERATION_CHANGED", "Complete capture заменён");
    }
    const documents = new Set(
      documentSources ??
        (selectedResources
          ? complete.resources.filter((r) =>
            selectedResources.includes(r.source)
          ).flatMap((r) => r.documents)
          : complete.state.inputs),
    );
    const inputs = [
      ...new Set([
        ...complete.state.configurationInputs,
        ...[...documents].flatMap((source) =>
          complete.state.documentInputs[source] ?? []
        ),
      ]),
    ];
    await assertSources(
      complete.state,
      complete.resources.map((r) => r.source).filter((p) =>
        !complete.state.rows.some((r) => r.path === p)
      ),
      full,
      inputs,
    );
    for (
      const row of [
        ...(full ? complete.outputs : []),
        ...complete.resources.filter((r) =>
          full ||
          (selectedResources
            ? selectedResources.includes(r.source)
            : r.documents.some((source) => documents.has(source)))
        ).map((r) => ({
          ...r,
          path: relative(expectation.root, r.path),
        })),
      ]
    ) {
      if (
        signature(
          await Deno.lstat(await regular(expectation.root, row.path)),
        ) !== row.signature
      ) fail("OPERATION_CHANGED", "Native output/resource изменён");
    }
  };
  const metrics = {
    ...complete.state.metrics,
    resourceByteReads: 0,
    resourceCacheHits: 0,
    fullFences: 0,
    currentnessChecks: 0,
  };
  const operation = publicOperation(
    complete,
    () => {
      if (!live) fail("OPERATION_EXPIRED", "Callback native операции завершён");
    },
    guard,
    metrics,
  );
  try {
    await guard(true);
    const result = await use(operation);
    await guard(true);
    return result;
  } finally {
    live = false;
  }
}
function publicOperation(
  complete: z.output<typeof completeSchema>,
  syncGuard: () => void,
  guard: (
    full?: boolean,
    resources?: readonly string[],
    documents?: readonly string[],
  ) => Promise<void>,
  metrics: z.output<typeof NativeOperationMetricsSchema>,
) {
  const documents = new Map(
    complete.documents.map((d) => [d.context.input, immutable(d)]),
  );
  const snapshots = new Map<string, Uint8Array>();
  async function resourceInventory(value: NativeResourceRequest) {
    const request = decode(
      NativeResourceRequestSchema,
      value,
      "RESOURCE_PATH",
    );
    await guard(false, request.files.map((f) => f.source));
    const targets = new Set<string>(), files = [];
    for (const file of request.files) {
      assertArtifactTarget(
        file.target,
        complete.state.projection === "student" ? "student" : "full",
        complete.state.root,
      );
      if (
        targets.has(file.target) ||
        [...targets].some((t) =>
          t.startsWith(file.target + "/") || file.target.startsWith(t + "/")
        )
      ) fail("ARTIFACT_COLLISION", "Повторный ресурсный target");
      targets.add(file.target);
      const row = complete.resources.find((r) => r.source === file.source);
      if (
        !ordinary(file.source) ||
        toolCachePath(complete.state.root, file.source) || !row
      ) {
        fail(
          "RESOURCE_PRIVATE_OR_SOURCE",
          "Файл не является видимым обычным native ресурсом",
        );
      }
      let bytes = snapshots.get(row.source);
      if (!bytes) {
        metrics.resourceByteReads++;
        metrics.resourceHashReads++;
        bytes = await Deno.readFile(row.path);
        if (await hash(bytes) !== row.sha256) {
          fail("OPERATION_CHANGED", "Ресурс изменён перед выдачей bytes");
        }
        snapshots.set(row.source, bytes);
      } else metrics.resourceCacheHits++;
      files.push({
        target: file.target,
        bytes: new Uint8Array(bytes),
        size: bytes.length,
        sha256: row.sha256,
        audience: complete.state.projection === "student"
          ? "student" as const
          : "full" as const,
        reason: "native-resource" as const,
      });
    }
    await guard(false, request.files.map((f) => f.source));
    return NativeResourceInventorySchema.parse({
      schema: "course-native-resource-inventory-v1",
      operation: catalog.identity.operation,
      audience: complete.state.projection === "student" ? "student" : "full",
      files,
    });
  }
  for (const doc of documents.values()) {
    bindNativeValue(
      doc,
      complete.state.root,
      () => guard(false, undefined, [doc.context.input]),
      async (source, target) => {
        const observed = complete.resources.find((r) =>
          r.source === source && r.documents.includes(doc.context.input)
        );
        if (!observed) return undefined;
        return (await resourceInventory({ files: [{ source, target }] }))
          .files[0].bytes;
      },
    );
  }
  const catalog = immutable(complete.catalog);
  const document = (value: NativeDocumentRequest) => {
    syncGuard();
    const request = decode(
      NativeDocumentRequestSchema,
      value,
      "OPERATION_DOCUMENT",
    );
    const doc = documents.get(request.source);
    if (!doc) {
      fail("OPERATION_DOCUMENT", "Документ отсутствует в текущей операции");
    }
    return doc;
  };
  return Object.freeze({
    identity: catalog.identity,
    catalog,
    get metrics() {
      syncGuard();
      return immutable(NativeOperationMetricsSchema.parse(metrics));
    },
    document,
    condition(value: NativeConditionRequest) {
      const request = decode(
        NativeConditionRequestSchema,
        value,
        "OPERATION_DOCUMENT",
      );
      return selectCondition(
        document({ source: request.source }),
        request.exerciseId,
        request.view,
      );
    },
    assertCurrent: () => guard(),
    async validateRelease(
      request: NativeReleaseRequest,
      validators: readonly NativeAdapterValidator[] = [],
    ) {
      syncGuard();
      await guard();
      const installed: string[] = [];
      for (
        const row of complete.state.rows.filter((r) =>
          r.path.startsWith("_extensions/") && r.path.endsWith("/contract.json")
        )
      ) {
        const contract = await json(
          await regular(complete.state.root, row.path),
        );
        if (typeof contract.name === "string") {
          if (installed.includes(contract.name)) {
            fail(
              "CORE.ADAPTER_INVALID",
              "Повторный installed adapter " + contract.name,
            );
          }
          installed.push(contract.name);
        }
      }
      return await validateNativeRelease(
        complete.releaseDocuments,
        catalog.identity,
        request,
        validators,
        installed,
        async (source, path, kind) => {
          const absolute = resolve(
            kind || path.startsWith("/")
              ? complete.state.root
              : dirname(resolve(complete.state.root, source)),
            path.replace(/^\//, ""),
          );
          const local = relative(complete.state.root, absolute);
          if (toolCachePath(complete.state.root, absolute)) {
            fail(
              "RESOURCE.PROJECT_PATH_INVALID",
              "Tool cache не является проектом",
            );
          }
          if (
            kind && !complete.state.rows.some((r) => r.path === local) &&
            !Object.hasOwn(complete.state.memberships, local)
          ) {
            fail(
              "RELEASE.SOURCE_POLICY",
              "Adapter source отсутствует в captured owning tree",
            );
          }
          const actual = await ownedPhysical(complete.state.root, local),
            info = await Deno.stat(actual);
          // Только объявленный dependency subtree: остальные sources проверит final full fence.
          const selected = info.isDirectory
            ? [
              local,
              ...complete.state.rows.map((r) => r.path).filter((p) =>
                p.startsWith(local + "/")
              ),
              ...Object.keys(complete.state.memberships).filter((p) =>
                p.startsWith(local + "/")
              ),
            ]
            : [local];
          await assertSources(complete.state, [], false, selected);
          if (
            (kind === "file" && !info.isFile) ||
            (kind === "directory" && !info.isDirectory) ||
            (!info.isDirectory && !info.isFile)
          ) {
            fail("RESOURCE.PROJECT_MISSING", "Нет project input");
          }
        },
        () => guard(),
      );
    },
    resourceInventory,
  });
}

export type NativeOperation = ReturnType<typeof publicOperation>;
