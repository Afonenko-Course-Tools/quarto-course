// Exact saved native Quarto1.11.5 body, no render/inspect/profile/P.
import { strict as assert } from "node:assert";
import { preparePublicIntroduction } from "../_extensions/course-core/body-export/producer.ts";
import { assertReferenceTargets } from "../_extensions/course-core/body-export/references.ts";
import {
  type HeaderNode,
  isContainer,
  type Node,
  requireNodes,
} from "../_extensions/course-core/document/native-ast.ts";
import {
  fixtureArray,
  fixtureAt,
  fixtureSet,
  required,
} from "./helpers/required.ts";
const captured = requireNodes(JSON.parse(
  await Deno.readTextFile(
    new URL(
      "./fixtures/native-public-introduction/sp-work-environment.json",
      import.meta.url,
    ),
  ),
));
const context = {
  source: "labs/work-environment.qmd",
  id: "sec-lab-work-environment",
  field: "introduction",
};
const original = JSON.stringify(captured);
const Command = Deno.Command;
let children = 0;
Deno.Command = new Proxy(Command, {
  construct() {
    children++;
    throw Error("UNEXPECTED_NATIVE_CHILD");
  },
});
try {
  const publicBody = await preparePublicIntroduction({
    blocks: captured,
    document: {
      "pandoc-api-version": [1, 23, 1, 2],
      meta: {},
      blocks: captured,
    },
    root: "/closed/owner",
    context: context,
  });
  assert(!JSON.stringify(publicBody).includes("quarto-meta-markdown"));
  assert(!JSON.stringify(publicBody).includes("quarto-navigation-envelope"));
  assert.equal(
    JSON.stringify(captured),
    original,
    "raw/full source input must remain byteequal",
  );
  assertReferenceTargets(publicBody, context);
  assert.equal(children, 0);
  console.log(
    "PASS exact actualclosedSP global introduction excludes only technical envelopes; rawinput unchanged,0children",
  );
} finally {
  Deno.Command = Command;
}
const title = (id: string): HeaderNode => ({
  t: "Header",
  c: [2, [id, [], []], [{ t: "Str", c: "Авторский заголовок" }]],
});
const duplicates = [title("actual"), title("actual")];
const document = { "pandoc-api-version": [1, 23, 1, 2], meta: {}, blocks: [] };
async function rejectsDuplicate(blocks: Node[]) {
  await assert.rejects(
    () =>
      preparePublicIntroduction({
        blocks: blocks,
        document: document,
        root: "/closed/owner",
        context: context,
      }),
    /BODY\.REFERENCE_TARGET_DUPLICATE/,
  );
}
await rejectsDuplicate(duplicates);
await rejectsDuplicate([{
  t: "Div",
  c: [["ordinary-hidden", ["hidden"], []], duplicates],
}]);
for (
  const change of [
    (n: unknown) => fixtureSet(n, ["c", 0, 0], "authored-hidden"),
    (n: unknown) => fixtureSet(n, ["c", 0, 1], []),
    (n: unknown) => fixtureArray(fixtureAt(n, ["c", 0, 1])).push("authored"),
    (n: unknown) =>
      fixtureArray(fixtureAt(n, ["c", 0, 2])).push(["authored", "true"]),
    (n: unknown) => fixtureSet(n, ["c", 1, 0, "c", 0, "c", 0, 2], []),
    (n: unknown) =>
      fixtureSet(n, ["c", 1, 0, "c", 0, "c", 0, 2], [["other", "value"]]),
    (n: unknown) =>
      fixtureSet(n, ["c", 1, 0, "c", 0, "c", 0, 2], [["render-id", ""]]),
    (n: unknown) =>
      fixtureArray(fixtureAt(n, ["c", 1])).push({
        t: "Para",
        c: [{ t: "Str", c: "Авторский текст" }],
      }),
  ]
) {
  const meta = structuredClone(
    required(
      captured.find((n) =>
        isContainer(n) && n.t === "Div" && n.c[0][0] === "quarto-meta-markdown"
      ),
    ),
  );
  change(meta);
  await rejectsDuplicate([meta]);
}
const ordinary = [
  {
    t: "Div",
    c: [["keep-hidden", ["hidden"], []], [{
      t: "Para",
      c: [{ t: "Str", c: "HIDDEN_AUTHORED_CONTENT" }],
    }]],
  },
  title("actual"),
  {
    t: "Para",
    c: [{
      t: "Link",
      c: [["", [], []], [{ t: "Str", c: "Цель" }], ["#actual", ""]],
    }],
  },
];
assert.deepEqual(
  await preparePublicIntroduction({
    blocks: ordinary,
    document: document,
    root: "/closed/owner",
    context: context,
  }),
  ordinary,
);
assert.throws(
  () =>
    assertReferenceTargets([{
      t: "Para",
      c: [{
        t: "Link",
        c: [["", [], []], [{ t: "Str", c: "Ссылка" }], ["#missing-target", ""]],
      }],
    }], context),
  /BODY\.REFERENCE_TARGET_MISSING/,
);
const withAuthoredTarget = [...captured, title("sec-lab-work-environment")];
await preparePublicIntroduction({
  blocks: withAuthoredTarget,
  document: document,
  root: "/closed/owner",
  context: context,
});
console.log(
  "PASS real duplicate/missing target guards,8malformed/lookalike envelopes refused,ordinary hidden preserved,authored target retained",
);
