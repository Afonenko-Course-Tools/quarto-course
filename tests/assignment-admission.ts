import { join } from "stdlib/path";
import { withNativeCaptureScope } from "../_extensions/course-core/capture.ts";
const assert = (v: unknown, s: string) => {
  if (!v) throw Error(s);
};
const root = await Deno.makeTempDir({ prefix: "assignment-admission-" }),
  sentinel = join(root, "ENGINE_EXECUTED");
await Deno.writeTextFile(
  join(root, "_quarto.yml"),
  "project: {type: default}\nengines: [unknown.ts]\n",
);
await Deno.writeTextFile(
  join(root, "unknown.ts"),
  `Deno.writeTextFileSync(${
    JSON.stringify(sentinel)
  },'top-level'); export const engine={name:'unknown',init(){Deno.writeTextFileSync(${
    JSON.stringify(sentinel)
  },'init')}};`,
);
await Deno.writeTextFile(join(root, "index.qmd"), "# Безопасный текст\n");
const ActualCommand = Deno.Command;
let children = 0, prepared = false, used = false;
(Deno as any).Command = new Proxy(ActualCommand, {
  construct(target, args) {
    children++;
    return Reflect.construct(target, args);
  },
});
let error = "";
try {
  await withNativeCaptureScope({
    root,
    projection: "author",
    outputDirectory: join(root, "_generated/assignment-output"),
  }, {
    assignment: {
      prepare: async () => {
        prepared = true;
        return {
          expectedSources: ["index.qmd"],
          assessments: [{ source: "index.qmd", id: "work" }],
        };
      },
    },
  } as any, async () => {
    used = true;
  });
} catch (e) {
  error = String(e);
} finally {
  (Deno as any).Command = ActualCommand;
}
assert(
  error.includes("BODY.PRODUCER_INPUT_UNQUALIFIED"),
  "Wrong pre-child refusal: " + error,
);
assert(
  children === 0 && !prepared && !used,
  "Неизвестный input достиг native child/preparation",
);
try {
  await Deno.stat(sentinel);
  throw Error("UNKNOWN_ENGINE_EXECUTED");
} catch (e) {
  if (!(e instanceof Deno.errors.NotFound)) throw e;
}
console.log(
  "PASS неизвестный frozen input: 0 child, 0 callback, 0 engine sentinel",
);
