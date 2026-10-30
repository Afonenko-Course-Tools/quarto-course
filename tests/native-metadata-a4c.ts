import * as Core from "../_extensions/course-core/public.ts";
import { validateNativeRelease } from "../_extensions/course-core/release/validate.ts";
const check = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const meta = (v: any): any =>
  typeof v === "string"
    ? { t: "MetaString", c: v }
    : typeof v === "boolean"
    ? { t: "MetaBool", c: v }
    : Array.isArray(v)
    ? { t: "MetaList", c: v.map(meta) }
    : {
      t: "MetaMap",
      c: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, meta(x)])),
    };
const operation = crypto.randomUUID(), captureWitness = crypto.randomUUID();
const course = { id: "metadata-course", view: "student", adapters: ["pl"] };
const readSet = [
  "configuration",
  "assessment",
  "projectChecks",
  "projectMaterialization",
] as const;
const context = {
  operation,
  captureWitness,
  input: "index.qmd",
  format: "revealjs",
  projection: "student" as const,
  exerciseBank: true,
  defaults: {
    difficulty: "introductory" as const,
    "statement-visibility": "open" as const,
  },
};
const all = Core.normalizeDocument({
  "pandoc-api-version": [1, 23],
  meta: {
    course: meta(course),
    pl: meta({ runtime: "SECRET_CONFIG" }),
    assessment: meta({
      id: "lab-demo",
      title: "ignored",
      kind: "lab",
      pl: { runtime: "SECRET_ASSESSMENT" },
    }),
    "project-checks": meta({ unused: { runtime: "SECRET_CHECKS" } }),
    "project-materialization": meta({
      unused: { policy: "SECRET_MATERIALIZATION" },
    }),
  },
  blocks: [{
    t: "Header",
    c: [1, ["title", [], []], [{ t: "Str", c: "Работа" }]],
  }, {
    t: "Div",
    c: [["exr-demo", [], []], [{ t: "Para", c: [{ t: "Str", c: "Условие" }] }]],
  }, {
    t: "Div",
    c: [["", ["task-items"], []], [{
      t: "BulletList",
      c: [[{
        t: "Plain",
        c: [{ t: "Cite", c: [[{ citationId: "exr-demo" }], []] }],
      }]],
    }]],
  }],
}, context);
const absent = Core.normalizeDocument({
  "pandoc-api-version": [1, 23],
  meta: { course: meta(course) },
  blocks: [],
}, { ...context, input: "absent.qmd", captureWitness: crypto.randomUUID() });
const seen: Core.NativeAdapterValidationInput[] = [];
const validator = {
  name: "pl",
  nativeMetadataReadSet: readSet,
  validate(input: Core.NativeAdapterValidationInput) {
    seen.push(input);
    return { sources: [] };
  },
};
const proof = await validateNativeRelease(
  [{ source: "index.qmd", early: all, final: { hasPublicSolution: {} } }, {
    source: "absent.qmd",
    early: absent,
    final: { hasPublicSolution: {} },
  }],
  { operation, profiles: [], projection: "student" },
  { expectedSources: ["index.qmd", "absent.qmd"] },
  [validator],
  ["pl"],
  async () => {},
  async () => {},
);
check(
  seen.length === 2 && seen[0].nativeMetadata,
  "required metadata envelope",
);
check(
  JSON.stringify(seen[0].nativeMetadata.readSet) === JSON.stringify(readSet),
  "exact readSet",
);
check(
  Object.keys(seen[0].nativeMetadata.values).length === 4,
  "all four authority planes",
);
check(
  Object.keys(seen[1].nativeMetadata.values).length === 0,
  "absence is authoritative",
);
check(
  seen[0].origin.format === "revealjs" &&
    Object.isFrozen(seen[0].nativeMetadata.values.projectChecks),
  "actual format and immutable payload",
);
check(!Object.hasOwn(seen[0], "configuration"), "no parallel configuration");
check(!JSON.stringify(proof).includes("SECRET"), "no metadata in proof");
for (
  const value of [
    undefined,
    { readSet: ["unknown"], values: {} },
    { readSet: ["configuration", "configuration"], values: {} },
    { readSet: [], values: { configuration: {} } },
    { readSet: [], values: { foreign: {} } },
  ]
) {
  check(
    !Core.NativeAdapterValidationInputSchema.safeParse({
      ...seen[0],
      nativeMetadata: value,
    }).success,
    "invalid/missing envelope refused",
  );
}
let leaked = false;
await validateNativeRelease(
  [{ source: "index.qmd", early: all, final: { hasPublicSolution: {} } }],
  { operation, profiles: [], projection: "student" },
  { expectedSources: ["index.qmd"] },
  [{
    name: "pl",
    nativeMetadataReadSet: ["configuration"],
    validate(input) {
      leaked = Object.keys(input.nativeMetadata.values).some((k) =>
        k !== "configuration"
      );
      return { sources: [] };
    },
  }],
  ["pl"],
  async () => {},
  async () => {},
);
check(!leaked, "only requested slots");
let called = false, error = "";
try {
  await validateNativeRelease(
    [{ source: "index.qmd", early: all, final: { hasPublicSolution: {} } }],
    { operation, profiles: [], projection: "student" },
    { expectedSources: ["index.qmd"] },
    [{
      name: "pl",
      nativeMetadataReadSet: ["configuration", "configuration"],
      validate() {
        called = true;
        return { sources: [] };
      },
    }],
    ["pl"],
    async () => {},
    async () => {},
  );
} catch (e) {
  error = String(e);
}
check(
  !called && error.includes("CORE.ADAPTER_INVALID"),
  "invalid descriptor refused before callback",
);
console.log(
  "PASS four native metadata planes, absence, readSet, origin and immutability",
);
