import { collectNativeProjectFacts } from "../document/project-capture.ts";
import { assertNativeAssignmentCapture } from "../runtime/operation.ts";
import { normalizeDocument } from "../public.ts";
import {
  boundDocument,
  decodeDocumentContext,
  ExerciseDeclarationSchema,
} from "../document/contracts.ts";
import { nativeMetadata } from "../release/collect.ts";
import { NativePendingDocumentContextSchema } from "../runtime/contracts.ts";
import { decode } from "../document/contracts.ts";
import { fail } from "../contracts/project.ts";
/** Quarto уже объединил metadata; здесь декодируется только существующий namespace. */
function exerciseDefaults(meta: Record<string, unknown>, input: string) {
  for (const key of Object.keys(meta)) {
    if (key.startsWith("default-exercise-")) {
      fail(
        "CORE.METADATA_INVALID",
        "Используйте exercise-defaults вместо " + key,
        input,
      );
    }
  }
  const schema = ExerciseDeclarationSchema.partial();
  const value = nativeMetadata(meta["exercise-defaults"]) ?? {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return decode(schema, value, "CORE.METADATA_INVALID", input);
  }
  const defaults = Object.fromEntries(
    Object.entries(value).filter(([key, item]) =>
      item !== false || !Object.hasOwn(ExerciseDeclarationSchema.shape, key)
    ).map((
      [key, item],
    ) => [
      key,
      key === "time" && typeof item === "string" ? Number(item) : item,
    ]),
  );
  return decode(schema, defaults, "CORE.METADATA_INVALID", input);
}
const chunks: Uint8Array[] = [];
let length = 0;
for await (const chunk of Deno.stdin.readable) {
  length += chunk.length;
  if (length > 16 * 1024 * 1024) {
    fail("DOCUMENT_LIMIT", "JSON input больше16MiB");
  }
  chunks.push(chunk);
}
const bytes = new Uint8Array(length);
let offset = 0;
for (const chunk of chunks) {
  bytes.set(chunk, offset);
  offset += chunk.length;
}
const ast = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
boundDocument(ast);
const requestMetadata = ast.meta?.["course-core-ts-request"];
const runPath = Deno.env.get("COURSE_CORE_TS_RUN") ??
  (requestMetadata?.t === "MetaString" ? requestMetadata.c : undefined);
if (typeof runPath !== "string") {
  fail("DOCUMENT_CONTEXT", "Отсутствует native request");
}
const request = JSON.parse(await Deno.readTextFile(runPath)),
  requestedContext = Deno.env.get("COURSE_CORE_TS_RUN")
    ? decodeDocumentContext(request.context)
    : decode(
      NativePendingDocumentContextSchema,
      request.context,
      "DOCUMENT_BINDING",
    );
if (typeof request.capture !== "string" || !request.capture.startsWith("/")) {
  fail("DOCUMENT_CONTEXT", "Нужен абсолютный capture path");
}
delete ast.meta["course-core-ts-request"];
const transport = ast.meta?.["course-core-ts-context"];
if (transport?.t !== "MetaString") {
  fail("DOCUMENT_BINDING", "Отсутствует native context");
}
const nativeContext = decodeDocumentContext(JSON.parse(transport.c));
const boundContext = decodeDocumentContext(
  Deno.env.get("COURSE_CORE_TS_RUN")
    ? requestedContext
    : decodeDocumentContext({
      ...requestedContext,
      format: nativeContext.format,
      exerciseBank: nativeContext.exerciseBank,
      defaults: nativeContext.defaults,
    }),
);
if (JSON.stringify(nativeContext) !== JSON.stringify(boundContext)) {
  fail("DOCUMENT_BINDING", "Native context не соответствует request");
}
delete ast.meta["course-core-ts-context"];
const context = Deno.env.get("COURSE_CORE_TS_RUN")
  ? boundContext
  : decodeDocumentContext({
    ...boundContext,
    defaults: exerciseDefaults(ast.meta, boundContext.input),
  });
let assignmentOwner: string | undefined;
if (request.assignment) {
  assignmentOwner = await assertNativeAssignmentCapture(
    context,
    request.assignment,
    request.capture,
  );
}
const early = normalizeDocument(ast, context, request.assignment);
try {
  await Deno.writeTextFile(
    request.capture + ".early.json",
    JSON.stringify(early),
    { createNew: true },
  );
} catch (error) {
  if (error instanceof Deno.errors.AlreadyExists) {
    fail("DOCUMENT_BINDING", "Early sidecar уже существует", context.input);
  }
  throw error;
}
if (request.assignment) {
  const facts = collectNativeProjectFacts(early, assignmentOwner!);
  try {
    await Deno.writeTextFile(
      request.capture + ".project-facts.json",
      JSON.stringify(facts),
      { createNew: true, mode: 0o600 },
    );
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) {
      fail(
        "DOCUMENT_BINDING",
        "Project facts sidecar уже существует",
        context.input,
      );
    }
    throw error;
  }
}
await Deno.stdout.write(new TextEncoder().encode(JSON.stringify(early.ast)));
