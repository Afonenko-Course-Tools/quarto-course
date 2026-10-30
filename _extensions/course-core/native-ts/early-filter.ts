import { normalizeDocument } from "../public.ts";
import { decodeDocumentContext } from "../document/contracts.ts";
import { fail } from "../contracts/project.ts";
const runPath = Deno.env.get("COURSE_CORE_TS_RUN");
if (!runPath) fail("DOCUMENT_CONTEXT", "COURSE_CORE_TS_RUN отсутствует");
const request = JSON.parse(await Deno.readTextFile(runPath)),
  context = decodeDocumentContext(request.context);
if (typeof request.capture !== "string" || !request.capture.startsWith("/")) {
  fail("DOCUMENT_CONTEXT", "Нужен абсолютный capture path");
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
const transport = ast.meta?.["course-core-ts-context"];
if (transport?.t !== "MetaString") {
  fail("DOCUMENT_BINDING", "Отсутствует native context");
}
const nativeContext = decodeDocumentContext(JSON.parse(transport.c));
if (JSON.stringify(nativeContext) !== JSON.stringify(context)) {
  fail("DOCUMENT_BINDING", "Native context не соответствует request");
}
delete ast.meta["course-core-ts-context"];
const early = normalizeDocument(ast, context);
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
await Deno.stdout.write(new TextEncoder().encode(JSON.stringify(early.ast)));
