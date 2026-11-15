import { required } from "./helpers/required.ts";
import { strict as assert } from "node:assert";
import { normalizeDocument } from "../_extensions/course-core/public.ts";

const span = (id: string, classes: string[], body: unknown[], pairs: string[][] = []) => ({
  t: "Span",
  c: [[id, classes, pairs], body],
});
const authored = [
  { t: "Str", c: "24.0.8 Числа — ёж" },
  { t: "Space" },
  { t: "Code", c: [["code-id", ["java"], [["data-note", "скрыто"]]], "x < 3"] },
  { t: "Space" },
  {
    t: "Link",
    c: [
      ["link-id", ["ref"], []],
      [{ t: "Strong", c: [{ t: "Str", c: "ссылка" }] }],
      ["https://example.invalid/target", "подсказка"],
    ],
  },
  { t: "Space" },
  span("authored-id", ["authored"], [{ t: "Str", c: "α β" }], [["key", "value"]]),
];
// Форма formatChapterTitle() Quarto 1.11.5, также сохранённая в
// fixtures/native-public-introduction/sp-work-environment.json.
const numbered = [
  span("", ["chapter-number"], [{ t: "Str", c: "3" }]),
  { t: "Str", c: "\u00a0" },
  { t: "Space" },
  span("", ["chapter-title"], authored),
];
const want = "24.0.8 Числа — ёж x < 3 ссылка α β";
const context = {
  operation: crypto.randomUUID(),
  input: "work.qmd",
  format: "html",
  projection: "student" as const,
  exerciseBank: true,
};
for (const [name, title] of [
  [
    "номер главы с идентификатором",
    { t: "MetaInlines", c: [span("sec-work", ["quarto-section-identifier"], numbered)] },
  ],
  ["номер главы без идентификатора", { t: "MetaInlines", c: numbered }],
  ["авторское числовое начало", { t: "MetaInlines", c: authored }],
  ["авторский Span без книжной пары", { t: "MetaInlines", c: [span("", ["chapter-number"], authored)] }],
  ["название из первого заголовка", undefined],
] as const) {
  const early = normalizeDocument(
    {
      "pandoc-api-version": [1, 23, 1, 2],
      meta: {
        ...(title ? { title } : {}),
        assessment: {
          t: "MetaMap",
          c: {
            id: { t: "MetaString", c: "sec-work" },
            kind: { t: "MetaString", c: "lab" },
          },
        },
      },
      blocks: [
        { t: "Header", c: [1, ["sec-work", [], []], authored] },
        {
          t: "Div",
          c: [
            [
              "exr-one",
              [],
              [
                ["difficulty", "introductory"],
                ["statement-visibility", "open"],
              ],
            ],
            [
              { t: "Header", c: [2, ["question-id", ["authored"], []], authored] },
              { t: "Para", c: [{ t: "Str", c: "Условие." }] },
            ],
          ],
        },
        {
          t: "Div",
          c: [
            ["", ["task-items"], []],
            [
              {
                t: "BulletList",
                c: [
                  [
                    {
                      t: "Plain",
                      c: [
                        {
                          t: "Cite",
                          c: [
                            [
                              {
                                citationId: "exr-one",
                                citationPrefix: [],
                                citationSuffix: [],
                                citationMode: { t: "NormalCitation" },
                              },
                            ],
                            [],
                          ],
                        },
                      ],
                    },
                  ],
                ],
              },
            ],
          ],
        },
      ],
    },
    context,
  );
  assert.equal(early.release?.assessment?.title, want, name);
  assert.equal(required(early.release?.declarations[0]).head?.title, want, name);
}
console.log("PASS названия работы и вопроса: текст Unicode, code/link/Span, авторские числа и книжное оформление");
