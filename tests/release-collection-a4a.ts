// Чистые AST cases проверяют перенос прежних owner guards; production proof идёт в release-a4a.
import { normalizeDocument } from "../_extensions/course-core/public.ts";
import { validateNativeRelease } from "../_extensions/course-core/release/validate.ts";
const operation = crypto.randomUUID();
const context = {
  operation,
  input: "index.qmd",
  format: "html",
  projection: "student" as const,
  exerciseBank: true,
};
const attr = (
  id = "",
  classes: string[] = [],
  values: Record<string, string> = {},
) => [id, classes, Object.entries(values)];
const cite = (id: string) => ({ t: "Cite", c: [[{ citationId: id }], []] });
const span = (
  values: Record<string, string>,
  body: unknown[],
  classes: string[] = [],
  id = "",
) => ({ t: "Span", c: [attr(id, classes, values), body] });
const header = { t: "Header", c: [2, attr(), [{ t: "Str", c: "Заголовок" }]] };
const exercise = (
  values: Record<string, string>,
  body: unknown[] = [header],
) => ({
  t: "Div",
  c: [
    attr("exr-demo", [], {
      difficulty: "introductory",
      "statement-visibility": "open",
      ...values,
    }),
    body,
  ],
});
const assessment = (body: unknown[]) => ({
  t: "Div",
  c: [attr("", ["task-items"]), [{
    t: "BulletList",
    c: [[{ t: "Plain", c: body }]],
  }]],
});
const checks: { name: string; passed: boolean; error: string }[] = [];
async function refusal(
  name: string,
  blocks: unknown[],
  meta: Record<string, unknown>,
  code: string,
) {
  let error = "";
  try {
    const early = normalizeDocument({
      "pandoc-api-version": [1, 23],
      meta,
      blocks,
    }, context);
    await validateNativeRelease(
      [{ source: "index.qmd", early, final: { hasPublicSolution: {} } }],
      { operation, projection: "student", profiles: [] },
      { expectedSources: ["index.qmd"] },
      [],
      [],
      async () => {},
      async () => {},
    );
  } catch (e) {
    error = String(e);
  }
  checks.push({ name, passed: error.includes(code), error });
}
await refusal(
  "target-missing-heading",
  [exercise({ target: "manual" }, [])],
  {},
  "CORE.EXERCISE_INVALID",
);
await refusal(
  "unknown-exercise-attribute",
  [exercise({ surprise: "value" })],
  {},
  "CORE.EXERCISE_INVALID",
);
await refusal("invalid-assessment-time", [], {
  course: {
    t: "MetaMap",
    c: { "assessment-time": { t: "MetaString", c: "yes" } },
  },
}, "CORE.COURSE_INVALID");
await refusal("unsupported-course-schema", [], {
  course: { t: "MetaMap", c: { schema: { t: "MetaString", c: "legacy" } } },
}, "CORE.SCHEMA_INVALID");
const meta = {
  title: { t: "MetaString", c: "Работа" },
  assessment: {
    t: "MetaMap",
    c: {
      id: { t: "MetaString", c: "lab-demo" },
      kind: { t: "MetaString", c: "lab" },
    },
  },
};
await refusal("boolean-theory-time", [assessment([cite("exr-demo")])], {
  ...meta,
  assessment: {
    t: "MetaMap",
    c: { ...(meta.assessment.c), "theory-time": { t: "MetaBool", c: true } },
  },
}, "CORE.ASSESSMENT_INVALID");
await refusal(
  "selection-on-ordinary-span",
  [assessment([span({ selection: "random" }, [cite("exr-demo")])])],
  meta,
  "CORE.ASSESSMENT_INVALID",
);
await refusal(
  "duplicate-assignment",
  [assessment([
    span({ requirement: "required" }, [
      span({ requirement: "optional" }, [cite("exr-demo")]),
    ]),
  ])],
  meta,
  "CORE.ASSESSMENT_INVALID",
);
await refusal(
  "candidate-assignment",
  [assessment([
    span(
      { selection: "random" },
      [
        span({ requirement: "required" }, [cite("exr-demo")]),
        cite("exr-other"),
      ],
      ["task-alternatives"],
      "alt-demo",
    ),
  ])],
  meta,
  "CORE.ASSESSMENT_INVALID",
);
await refusal(
  "assignment-span-without-position",
  [assessment([span({ requirement: "required" }, []), cite("exr-demo")])],
  meta,
  "CORE.ASSESSMENT_INVALID",
);
for (const projection of ["student", "author"] as const) {
  const early = normalizeDocument({
    "pandoc-api-version": [1, 23],
    meta: {},
    blocks: [exercise({ "course-role": "demonstration" })],
  }, { ...context, projection });
  const marker = early.ast.meta["course-artifact-context"] as {
    c: Record<string, { c: Record<string, { c: string }> }>;
  };
  checks.push({
    name: `owner-shortcode-context-${projection}`,
    passed: marker.c["exr-demo"].c.view.c ===
        (projection === "author" ? "full" : "student") &&
      marker.c["exr-demo"].c.purpose.c === "demonstration" &&
      marker.c["exr-demo"].c.statementVisibility.c === "open",
    error: "",
  });
}
await refusal("authored-shortcode-context", [], {
  "course-artifact-context": { t: "MetaMap", c: {} },
}, "DOCUMENT_BINDING");
const absent = normalizeDocument({
  "pandoc-api-version": [1, 23],
  meta: {},
  blocks: [exercise({ name: "Native", "fixture-extra": "preserved" })],
}, context).release!.declarations[0].attributes;
checks.push({
  name: "undefined-effective-fields-stay-absent",
  passed: !["target", "project-check", "time", "course-role"].some((key) =>
    Object.hasOwn(absent, key)
  ) && absent.name === "Native" && absent["fixture-extra"] === "preserved",
  error: "",
});
console.log(
  JSON.stringify({
    status: checks.every((c) => c.passed) ? "PASS" : "FAIL",
    checks,
  }),
);
if (checks.some((c) => !c.passed)) throw Error("A4a release collection guards");
