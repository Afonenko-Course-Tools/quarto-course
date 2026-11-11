import { requireNodes } from "../_extensions/course-core/document/native-ast.ts";
import { fixtureArray, fixtureAt, required } from "./helpers/required.ts";
import { strict as assert } from "node:assert";
import {
  preparePublicIntroduction,
  preparePublicQuestion,
  publicCondition,
  publicResourceUses,
} from "../_extensions/course-core/body-export/producer.ts";

// Точный Download subtree из actual late exr-numbers-console-greeting:
// 7e664767-2161-4fbe-af31-281e414abf83/2.late.json, Quarto1.11.5.
// Согласованный producer добавляет существующую роль ко всему своему wrapper.
const captured: unknown = JSON.parse(
  await Deno.readTextFile(
    new URL(
      "./fixtures/native-project-download/java-full-wrapper.json",
      import.meta.url,
    ),
  ),
);
const paragraph = (text: string) => ({ t: "Para", c: [{ t: "Str", c: text }] });
const authored = [
  paragraph("Авторское условие"),
  {
    t: "Div",
    c: [[
      "",
      ["callout", "callout-style-simple", "callout-none", "no-icon"],
      [],
    ], [
      paragraph("Авторский native callout сохраняется"),
    ]],
  },
  {
    t: "Div",
    c: [["", ["public-tests"], []], [paragraph("Обычная публичная проверка")]],
  },
  {
    t: "Para",
    c: [
      { t: "Image", c: [["", [], []], [], ["../assets/public.png", ""]] },
      {
        t: "Link",
        c: [["", [], []], [{ t: "Str", c: "Материал" }], [
          "../assets/public.txt",
          "",
        ]],
      },
    ],
  },
];
const context = {
  source: "labs/numbers.qmd",
  id: "exr-numbers-console-greeting",
};
const document = { "pandoc-api-version": [1, 23, 1, 2], meta: {}, blocks: [] };
async function question(blocks: unknown[]) {
  return await preparePublicQuestion({
    condition: publicCondition(requireNodes(blocks), false),
    publicAnswer: [],
    document: document,
    root: "/course",
    context: context,
  });
}
// Тот же RawInline вне role-bearing Download wrapper остаётся неподдержанным.
await assert.rejects(
  () => question([captured]),
  /BODY\.CAPABILITY_UNSUPPORTED/,
);
await assert.rejects(() =>
  question([{
    t: "Para",
    c: [{ t: "RawInline", c: ["html", "<b>Авторский raw</b>"] }],
  }]), /BODY\.CAPABILITY_UNSUPPORTED/);
await assert.rejects(() =>
  preparePublicQuestion({
    condition: [{
      t: "Para",
      c: [{
        t: "Span",
        c: [["", ["correct"], []], [{ t: "Str", c: "Закрытая отметка" }]],
      }],
    }],
    publicAnswer: [],
    document: document,
    root: "/course",
    context: context,
  }), /BODY\.UNPARTITIONED_PRIVATE_ROLE/);
console.log(
  "PASS unmarked actual RawInline и unpartitioned private role по-прежнему отвергаются",
);

for (const role of ["project-download", "project-download-link"]) {
  const legacy = await question([...authored, {
    t: "Para",
    c: [{
      t: "Link",
      c: [["", [role], []], [{ t: "Str", c: "Скачать" }], [
        "legacy-full.zip",
        "",
      ]],
    }],
  }]);
  assert(
    !JSON.stringify(legacy).includes("legacy-full.zip"),
    "Прежняя role-bearing Link не должна возвращаться в public Body",
  );
}
{
  const wrapper = structuredClone(captured);
  fixtureArray(fixtureAt(wrapper, ["c", 0, 1])).push("project-download");
  const blocks = [required(authored[0]), wrapper, ...authored.slice(1)];
  const original = JSON.stringify(blocks);
  const projected = publicCondition(requireNodes(blocks), false);
  assert(
    !JSON.stringify(projected).includes("⤓"),
    "Download wrapper оставил стрелку после удаления своей ссылки",
  );
  assert.deepEqual(
    projected,
    authored,
    "Download wrapper должен исключаться целиком до Body capability guards",
  );
  const prepared = await question(blocks);
  const introduction = await preparePublicIntroduction({
    blocks: requireNodes(blocks),
    document: document,
    root: "/course",
    context: context,
  });
  assert.deepEqual(prepared.condition, authored);
  assert.deepEqual(introduction, authored);
  const output = JSON.stringify([prepared, introduction]);
  for (
    const marker of [
      "RawInline",
      "callout-icon",
      "⤓",
      "full.zip",
      "project-download",
    ]
  ) {
    assert(
      !output.includes(marker),
      "Download transport попал в public Body: " + marker,
    );
  }
  assert.deepEqual(
    publicResourceUses(
      prepared.condition,
      "/course",
      context.source,
      "/course/labs",
    ),
    ["assets/public.png", "assets/public.txt"],
    "Full ZIP не должен становиться выбранным ресурсом",
  );
  assert.equal(
    JSON.stringify(blocks),
    original,
    "Raw/full source должен сохраняться",
  );
}
console.log(
  "PASS exact Download wrapper целиком исключён существующей ролью; авторские callout/public-tests/Image/Link сохранены",
);
