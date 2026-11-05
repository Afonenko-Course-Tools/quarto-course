import {
  earlyFilterFixture,
  exercise,
  metaMap,
  metaString,
  paragraph,
} from "./helpers/early-filter-fixture.ts";
const defaults = (values: Record<string, unknown>) => ({
  "exercise-defaults": metaMap(values),
});
const canonical = {
  difficulty: metaString("introductory"),
  "statement-visibility": metaString("open"),
  time: metaString("7"),
};
const failures: string[] = [];
async function check(name: string, use: () => Promise<boolean>) {
  try {
    if (!await use()) failures.push(name);
  } catch (error) {
    failures.push(name + ": " + String(error));
  }
}
await check(
  "Merged Quarto defaults сохраняются и explicit attrs имеют приоритет",
  async () => {
    const result = await earlyFilterFixture({
      meta: defaults(canonical),
      blocks: [
        exercise([paragraph("Условие")], [["difficulty", "advanced"], [
          "time",
          "9",
        ], ["statement-visibility", "restricted"]]),
      ],
    });
    const d = result.early?.definitions["exr-one"];
    return result.success && d?.difficulty === "advanced" && d?.time === 9 &&
      d?.["statement-visibility"] === "restricted" &&
      result.early.context.defaults.time === 7;
  },
);
await check(
  "Defaults принадлежат exercise-defaults, а не difficulty/time страницы",
  async () => {
    const result = await earlyFilterFixture({
      meta: {
        ...defaults(canonical),
        difficulty: metaString("advanced"),
        time: metaString("99"),
      },
    });
    const d = result.early?.definitions["exr-one"];
    return result.success && d?.difficulty === "introductory" && d?.time === 7;
  },
);
await check("false сбрасывает известные optional defaults", async () => {
  const result = await earlyFilterFixture({
    meta: defaults({
      ...canonical,
      target: { t: "MetaBool", c: false },
      "course-role": { t: "MetaBool", c: false },
      "project-check": { t: "MetaBool", c: false },
    }),
  });
  const d = result.early?.definitions["exr-one"];
  return result.success && !Object.hasOwn(d, "target") &&
    !Object.hasOwn(d, "course-role") && !Object.hasOwn(d, "project-check");
});
for (
  const [name, extra] of [
    ["unknown:false не исчезает до strict schema", {
      unknown: { t: "MetaBool", c: false },
    }],
    ["нечисловое время не игнорируется", { time: metaString("oops") }],
  ] as const
) {
  await check(name, async () => {
    const r = await earlyFilterFixture({
      meta: defaults({ ...canonical, ...extra }),
    });
    return !r.success && r.stderr.includes("CORE.METADATA_INVALID");
  });
}
await check(
  "Старый default-exercise-* не является вторым authoring API",
  async () => {
    const r = await earlyFilterFixture({
      meta: { "default-exercise-time": metaString("7") },
      blocks: [
        exercise([], [["difficulty", "introductory"], [
          "statement-visibility",
          "open",
        ]]),
      ],
    });
    return !r.success && r.stderr.includes("exercise-defaults");
  },
);
await check(
  "Manual COURSE_CORE_TS_RUN сохраняет fixed request defaults",
  async () => {
    const r = await earlyFilterFixture({
      manual: true,
      defaults: {
        difficulty: "introductory",
        "statement-visibility": "open",
        time: 11,
      },
      meta: defaults({ ...canonical, time: metaString("99") }),
    });
    return r.success && r.early?.definitions["exr-one"].time === 11;
  },
);
await check("Manual request/native context mismatch отклоняется", async () => {
  const r = await earlyFilterFixture({
    manual: true,
    defaults: { difficulty: "introductory", "statement-visibility": "open" },
    nativeContext: { format: "revealjs" },
  });
  return !r.success && r.stderr.includes("DOCUMENT_BINDING");
});
await check(
  "Глубокий native defaults AST ограничен до recursive metadata decode",
  async () => {
    let nested: unknown = metaString("конец");
    for (let i = 0; i < 160; i++) nested = metaMap({ nested });
    const r = await earlyFilterFixture({
      meta: { "exercise-defaults": nested },
    });
    return !r.success && r.stderr.includes("DOCUMENT_LIMIT") &&
      !r.stderr.includes("RangeError");
  },
);
if (failures.length) throw Error(failures.join("\n"));
console.log(
  "PASS 9 defaults/native transport fixtures; без Quarto, inheritance принадлежит уже merged metadata",
);
