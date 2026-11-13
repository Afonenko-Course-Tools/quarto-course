import { strict as assert } from "node:assert";
import { join } from "stdlib/path";
import { fixtureOperation, renderFixture } from "./helpers/native-operation-a3.ts";

const root = await Deno.makeTempDir({ prefix: "native-resource-cache-" });
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Resource cache</text></svg>';
const originalOpen = Deno.open;
const outputA = join(root, "_site/a.svg"),
  outputB = join(root, "_site/b.svg");
let streams = 0,
  failNext = false;
let pause: Promise<void> | undefined;
let onRead: (() => void) | undefined;

// Observe the actual public reader's handle stream without an internal test hook.
Deno.open = (async (...args: Parameters<typeof Deno.open>) => {
  const opened = await originalOpen(...args);
  if (args[0] !== outputA && args[0] !== outputB) return opened;
  return new Proxy(opened, {
    get(target, property) {
      if (property === "readable") {
        streams++;
        const failure = failNext;
        failNext = false;
        const waiting = pause;
        onRead?.();
        return new ReadableStream<Uint8Array>({
          async start(controller) {
            await waiting;
            if (failure) {
              controller.error(new Error("fixture resource read failed"));
              return;
            }
            try {
              for await (const chunk of target.readable) {
                controller.enqueue(chunk);
              }
              controller.close();
            } catch (error) {
              controller.error(error);
            }
          },
        });
      }
      const member: unknown = Reflect.get(target, property, target);
      return typeof member === "function" ? member.bind(target) : member;
    },
  });
}) as typeof Deno.open;
const request = (source: string, target = source) => ({
  files: [{ source, target }],
});
try {
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    `project:
  type: website
  output-dir: _site
format: {html: {theme: none}}
course: {id: resource-cache, view: student}
`,
  );
  await Deno.writeTextFile(
    join(root, "index.qmd"),
    `::: {#exr-one difficulty=introductory statement-visibility=open}
![A](a.svg)

![B](b.svg)
:::
`,
  );
  await Deno.writeTextFile(join(root, "a.svg"), svg);
  await Deno.link(join(root, "a.svg"), join(root, "b.svg"));
  await renderFixture(root);
  // Two observed source addresses resolve to one final physical native resource.
  await Deno.remove(outputB);
  await Deno.link(outputA, outputB);

  await fixtureOperation(root, async (operation) => {
    let release!: () => void, started!: () => void;
    pause = new Promise<void>((resolve) => (release = resolve));
    const reading = new Promise<void>((resolve) => (started = resolve));
    onRead = started;
    const work = Promise.all([
      operation.resourceFiles(request("a.svg", "one.svg")),
      operation.resourceFiles(request("a.svg", "two.svg")),
      operation.resourceFiles(request("b.svg", "three.svg")),
    ]);
    await reading;
    // Allow all real asynchronous regular-path/handle checks to reach the blocked read.
    await new Promise((resolve) => setTimeout(resolve, 50));
    release();
    const values = await work;
    pause = undefined;
    onRead = undefined;
    assert.equal(streams, 1, "Concurrent source/physical aliases read bytes repeatedly");
    assert.equal(operation.metrics.resourceByteReads, 1);
    assert.equal(operation.metrics.resourceCacheHits, 2);
    const first = values[0]!.files[0]!.bytes;
    assert.equal(new TextDecoder().decode(first), svg);
    first[0] = 0;
    assert.equal(new TextDecoder().decode(values[1]!.files[0]!.bytes), svg);
    const repeated = await operation.resourceFiles(request("b.svg"));
    assert.equal(new TextDecoder().decode(repeated.files[0]!.bytes), svg);
    assert.equal(streams, 1);
    await assert.rejects(operation.resourceFiles(request("a.svg", "../escape")));
    await assert.rejects(operation.resourceFiles(request("missing.svg")), /RESOURCE_PRIVATE_OR_SOURCE/);
    await assert.rejects(
      operation.resourceFiles({
        files: [
          { source: "a.svg", target: "same" },
          { source: "b.svg", target: "same/child" },
        ],
      }),
      /ARTIFACT_COLLISION/,
    );
  });

  await fixtureOperation(root, async (operation) => {
    failNext = true;
    await assert.rejects(operation.resourceFiles(request("a.svg")), /fixture resource read failed/);
    const retried = await operation.resourceFiles(request("b.svg"));
    assert.equal(new TextDecoder().decode(retried.files[0]!.bytes), svg);
    assert.equal(operation.metrics.resourceByteReads, 2, "Rejected physical read poisoned retry cache");
  });

  let release!: () => void, started!: () => void;
  pause = new Promise<void>((resolve) => (release = resolve));
  const reading = new Promise<void>((resolve) => (started = resolve));
  onRead = started;
  let escaped!: Promise<unknown>;
  await fixtureOperation(root, async (operation) => {
    escaped = Promise.all([
      assert.rejects(operation.resourceFiles(request("a.svg")), /OPERATION_EXPIRED/),
      assert.rejects(operation.resourceFiles(request("b.svg")), /OPERATION_EXPIRED/),
    ]);
    await reading;
  });
  release();
  await escaped;
  console.log("PASS native resource concurrent single-flight, aliases, copied bytes, retry and per-call expiry");
} finally {
  Deno.open = originalOpen;
  await Deno.remove(root, { recursive: true });
}
