import * as Core from "../_extensions/course-core/public.ts";
const context = {
  operation: crypto.randomUUID(),
  captureWitness: crypto.randomUUID(),
  input: "bank.qmd",
  format: "html",
  projection: "student" as const,
  exerciseBank: true,
  defaults: {
    difficulty: "introductory" as const,
    "statement-visibility": "open" as const,
  },
};
const str = (s: string) => ({ t: "MetaString", c: s });
const meta = {
  course: {
    t: "MetaMap",
    c: {
      id: str("demo"),
      view: str("student"),
      adapters: { t: "MetaList", c: [str("adapter-a"), str("adapter-b")] },
    },
  },
  "adapter-a": {
    t: "MetaMap",
    c: {
      policy: str("upload"),
      enabled: { t: "MetaBool", c: true },
      roots: { t: "MetaList", c: [str("a"), str("b")] },
    },
  },
  "other-secret": { t: "MetaMap", c: { secret: str("NEVER_ALL_NAMESPACE") } },
};
const early = Core.normalizeDocument({
  "pandoc-api-version": [1, 23, 1],
  meta,
  blocks: [],
}, context);
if (
  JSON.stringify(early.release?.adapterMetadata) !==
    JSON.stringify({
      "adapter-a": { policy: "upload", enabled: true, roots: ["a", "b"] },
    })
) throw Error("Native adapter namespace отсутствует/лишний");
if (JSON.stringify(early.release).includes("NEVER_ALL_NAMESPACE")) {
  throw Error("Чужой namespace в release");
}
for (
  const value of [{ t: "Custom", c: "x" }, {
    t: "MetaList",
    c: [{ t: "Custom", c: "x" }],
  }]
) {
  let error = "";
  try {
    Core.normalizeDocument({
      "pandoc-api-version": [1, 23, 1],
      meta: { ...meta, "adapter-a": value },
      blocks: [],
    }, context);
  } catch (e) {
    error = String(e);
  }
  if (!error.includes("CORE.ADAPTER_METADATA")) {
    throw Error("Unsupported native metadata accepted: " + error);
  }
}
console.log(
  JSON.stringify({
    status: "PASS",
    declaredOnly: true,
    absentPreserved: true,
    unsupportedRefused: 2,
  }),
);
