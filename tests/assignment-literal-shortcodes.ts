import {
  earlyFilterFixture,
  exercise,
  metaString,
  paragraph,
} from "./helpers/early-filter-fixture.ts";
const attrs = [["difficulty", "introductory"], [
  "statement-visibility",
  "open",
]];
const shortcode = (name: string, value: string, content: unknown[] = []) => ({
  t: "Span",
  c: [
    ["", ["quarto-shortcode__"], []],
    [name, value].map((s, i) => ({
      t: "Span",
      c: [["", ["quarto-shortcode__-param"], [["data-is-shortcode", "1"], [
        "data-value",
        s,
      ], ["data-raw", s]]], i ? content : []],
    })),
  ],
});
const cases: [string, unknown[], Record<string, unknown>][] = [
  ["formatted meta title", [{ t: "Para", c: [shortcode("meta", "title")] }], {
    title: {
      t: "MetaInlines",
      c: [{ t: "Emph", c: [{ t: "Str", c: "Заголовок" }] }],
    },
  }],
  ["nested shortcode argument", [{
    t: "Para",
    c: [shortcode("xref", "{{< meta title >}}", [shortcode("meta", "title")])],
  }], { title: metaString("exr-one") }],
  ["registered/builtin name belongs to Quarto", [{
    t: "Para",
    c: [
      shortcode("var", "public.label"),
      shortcode("project-download", "exr-one"),
    ],
  }], {}],
  ["already resolved native rich AST", [{
    t: "Para",
    c: [{ t: "Strong", c: [{ t: "Str", c: "Native результат" }] }],
  }], {}],
  ["shortcode in private solution removed before native processing", [
    paragraph("Условие"),
    {
      t: "Div",
      c: [["", ["solution"], []], [{
        t: "Para",
        c: [shortcode("unknown-private-handler", "PRIVATE-SHORTCODE")],
      }]],
    },
  ], {}],
];
const failures: string[] = [];
for (const [name, body, meta] of cases) {
  const r = await earlyFilterFixture({
    assignment: true,
    blocks: [exercise(body, attrs)],
    meta,
  });
  if (
    !r.success || !r.facts ||
    JSON.stringify(r.early).includes("PRIVATE-SHORTCODE")
  ) failures.push(name + ": " + r.stderr);
}
for (
  const [name, options, code] of [
    [
      "foreign input/source",
      { context: { input: "/foreign/bank.qmd" } },
      "BODY.PRODUCER_INPUT_UNQUALIFIED",
    ],
    [
      "foreign witness",
      { context: { captureWitness: crypto.randomUUID() } },
      "OPERATION_BINDING",
    ],
    [
      "foreign projection",
      { context: { projection: "student" } },
      "OPERATION_BINDING",
    ],
    [
      "foreign profiles",
      { context: { profiles: ["other", "full"] } },
      "OPERATION_BINDING",
    ],
    ["foreign token", { token: crypto.randomUUID() }, "OPERATION_BINDING"],
    [
      "manual assignment request",
      { manual: true },
      "BODY.PRODUCER_INPUT_UNQUALIFIED",
    ],
  ] as const
) {
  const r = await earlyFilterFixture({
    assignment: true,
    blocks: [exercise([], attrs)],
    ...options,
  });
  if (r.success || !r.stderr.includes(code)) {
    failures.push(name + ": " + r.stderr);
  }
}
if (failures.length) throw Error(failures.join("\n"));
console.log(
  "PASS 5 native AST acceptance/6 existing private-binding refusals; synthetic transport, не actual Quarto capture",
);
