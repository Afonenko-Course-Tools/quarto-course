// Focused contract tests use a genuine completed native observation. In-memory
// mutations exercise internal semantic refusal; they never issue producer handles.
import { join, toFileUrl } from "stdlib/path";
const evidence = Deno.args[0];
if (!evidence) {
  throw new Error(
    "usage: owner-body-contracts.ts completed-owner-bodies-evidence",
  );
}
const result = JSON.parse(
  await Deno.readTextFile(join(evidence, "finished.json")),
);
const h = result.report.body;
const p = {
  protocol: 1,
  root: h.root,
  attemptId: h.attemptId,
  profile: h.profile,
  sessionId: h.sessionId,
  sessionPath: join(h.root, ".course-owner/session.json"),
  sessionHash: h.sessionHash,
};
const api = await import(
  toFileUrl(join(h.root, "_extensions/course-core/owner-preflight/owner.ts"))
    .href
);
const producer = await import(
  toFileUrl(join(h.root, "_extensions/course-core/body-export/producer.ts"))
    .href
);
const answers = await import(
  toFileUrl(join(h.root, "_extensions/course-core/body-export/answer.ts")).href
);
const s = await api.preparedSession(p);
const source = "tasks/corpus.qmd", key = p.profile + ":" + source;
const baseline = JSON.parse(await Deno.readTextFile(s.captures[key]));
const before = await producer.partitionBody(s, baseline, p.profile);
const observed = JSON.parse(
  await Deno.readTextFile(
    join(
      h.root,
      ".course-owner/render",
      p.profile,
      await api.sha(source) + ".json",
    ),
  ),
);
function walk(value: any, fn: (node: any) => void) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, fn));
    return;
  }
  if (value.t) fn(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") walk(child, fn);
  }
}
async function refuses(
  label: string,
  fn: () => Promise<unknown>,
  code?: string,
) {
  try {
    await fn();
  } catch (error) {
    if (code && !String(error).includes(code)) {
      throw new Error(label + ": unexpected refusal " + error);
    }
    console.log("PASS " + label);
    return;
  }
  throw new Error("Expected refusal: " + label);
}
async function mutate(
  label: string,
  change: (doc: any) => void,
  code = "BODY.",
) {
  const current = structuredClone(observed),
    doc = JSON.parse(current.readerShape);
  change(doc);
  current.readerShape = JSON.stringify(doc);
  await refuses(
    label,
    () => producer.partitionBody(s, current, p.profile, before.signatures),
    code,
  );
}
function numeric(doc: any) {
  let found: any;
  walk(doc.blocks, (node) => {
    if (
      node.t === "CodeBlock" && node.c[0][1].includes("answer-spec") &&
      node.c[1].startsWith("type: numeric")
    ) found = node;
  });
  if (!found) throw new Error("Native numeric bank missing");
  return found;
}
await mutate("changed valid numeric key is declaration drift", (doc) => {
  numeric(doc).c[1] = numeric(doc).c[1].replace("12.5", "13.5");
}, "BODY.CONTRACT_INVALID");
await mutate("duplicate native bank refuses", (doc) => {
  walk(doc.blocks, (node) => {
    if (node.t === "Div" && node.c[0][0] === "exr-numeric") {
      node.c[1].push(structuredClone(numeric(doc)));
    }
  });
});
await mutate("bank moved into private notes refuses", (doc) => {
  walk(doc.blocks, (node) => {
    if (node.t === "Div" && node.c[0][0] === "exr-numeric") {
      const bank = numeric(doc);
      node.c[1] = node.c[1].filter((item: any) => item !== bank);
      node.c[1].push({ t: "Div", c: [["", ["grading-notes"], []], [bank]] });
    }
  });
});
await mutate("orphan native bank refuses", (doc) => {
  doc.blocks.push(structuredClone(numeric(doc)));
});
await mutate("wrong sibling solution refuses", (doc) => {
  walk(doc.blocks, (node) => {
    if (node.t === "Div" && node.c[0][0] === "sol-manual") {
      node.c[0][0] = "sol-missing";
    }
  });
});
await mutate("duplicate sibling solution refuses", (doc) => {
  doc.blocks.push(
    structuredClone(
      doc.blocks.find((node: any) =>
        node.t === "Div" && node.c[0][0] === "sol-manual"
      ),
    ),
  );
});
await mutate("nested canonical task refuses", (doc) => {
  const choice = doc.blocks.find((node: any) =>
    node.t === "Div" && node.c[0][0] === "exr-choice"
  );
  const manual = doc.blocks.find((node: any) =>
    node.t === "Div" && node.c[0][0] === "exr-manual"
  );
  doc.blocks = doc.blocks.filter((node: any) => node !== choice);
  manual.c[1].push(choice);
});
await mutate("mixed choice and YAML banks refuse", (doc) => {
  walk(doc.blocks, (node) => {
    if (node.t === "Div" && node.c[0][0] === "exr-choice") {
      node.c[1].push(structuredClone(numeric(doc)));
    }
  });
});
await mutate("profile-conditioned public task refuses", (doc) => {
  walk(doc.blocks, (node) => {
    if (node.t === "Div" && node.c[0][0] === "exr-manual") {
      node.c[0][1].push("when-full");
    }
  });
});
await mutate("local anchor capability refuses", (doc) => {
  walk(doc.blocks, (node) => {
    if (node.t === "Div" && node.c[0][0] === "exr-manual") {
      node.c[1].push({
        t: "Para",
        c: [{
          t: "Link",
          c: [["", [], []], [{ t: "Str", c: "local" }], ["#sec-other", ""]],
        }],
      });
    }
  });
}, "BODY.CAPABILITY_UNSUPPORTED");
await mutate("labelled math capability refuses", (doc) => {
  walk(doc.blocks, (node) => {
    if (node.t === "Math") node.c[1] += "\\label{eq-extra}";
  });
}, "BODY.CAPABILITY_UNSUPPORTED");
await mutate("raw body capability refuses", (doc) => {
  walk(doc.blocks, (node) => {
    if (node.t === "Div" && node.c[0][0] === "exr-manual") {
      node.c[1].push({ t: "RawBlock", c: ["html", "<b>raw</b>"] });
    }
  });
}, "BODY.CAPABILITY_UNSUPPORTED");
await mutate("native public Cite capability refuses", (doc) => {
  walk(doc.blocks, (node) => {
    if (node.t === "Div" && node.c[0][0] === "exr-manual") {
      node.c[1].push({
        t: "Para",
        c: [{
          t: "Cite",
          c: [[{
            citationId: "sec-other",
            citationPrefix: [],
            citationSuffix: [],
            citationMode: { t: "NormalCitation" },
            citationNoteNum: 0,
            citationHash: 0,
          }], [{ t: "Str", c: "@sec-other" }]],
        }],
      });
    }
  });
}, "BODY.CAPABILITY_UNSUPPORTED");
await mutate("unclaimed native shortcode carrier refuses", (doc) => {
  walk(doc.blocks, (node) => {
    if (node.t === "Div" && node.c[0][0] === "exr-manual") {
      node.c[1].push({
        t: "Para",
        c: [{
          t: "Span",
          c: [["", ["quarto-shortcode__"], []], [{ t: "Str", c: "unclaimed" }]],
        }],
      });
    }
  });
}, "BODY.CAPABILITY_UNSUPPORTED");
for (
  const [label, yaml] of [
    [
      "duplicate YAML keys",
      "type: numeric\ntype: manual\nkey: {value: 1, tolerance: {absolute: 0}}",
    ],
    [
      "YAML aliases",
      "type: numeric\nkey: &k {value: 1, tolerance: {absolute: 0}}\nother: *k",
    ],
    [
      "YAML custom tag",
      "type: numeric\nkey: !custom {value: 1, tolerance: {absolute: 0}}",
    ],
    [
      "negative tolerance",
      "type: numeric\nkey: {value: 1, tolerance: {absolute: -1}}",
    ],
    [
      "multipart duplicate names",
      "type: multipart\nparts: [{name: x, label: X, type: manual, submission: text}, {name: x, label: Y, type: manual, submission: text}]",
    ],
    [
      "matching missing key",
      "type: matching\nprompts: [A, B]\noptions: [X, Y]\nkey: {pairs: {A: X}}",
    ],
  ] as [string, string][]
) await refuses(label, () => answers.validateAnswer(yaml));
let choice: any;
walk(JSON.parse(observed.readerShape).blocks, (node) => {
  if (node.t === "Div" && node.c[0][1].includes("answer")) choice = node;
});
await refuses("missing correct marker", async () => {
  const bad = structuredClone(choice);
  walk(bad, (node) => {
    if (node.t === "Span") node.c[0][1] = [];
  });
  await answers.projectChoice(bad);
});
await refuses("multiple correct markers", async () => {
  const bad = structuredClone(choice);
  bad.c[1][0].c[0][0].c = [{
    t: "Span",
    c: [["", ["correct"], []], [{ t: "Str", c: "HTTP" }]],
  }];
  await answers.projectChoice(bad);
});
await refuses("unsupported choice form has no manual fallback", async () => {
  const bad = structuredClone(choice);
  bad.c[0][2] = [["type", "unknown"]];
  await answers.projectChoice(bad);
});
const packageData = JSON.parse(await Deno.readTextFile(h.packagePath));
for (
  const [label, change] of [
    [
      "fixed work unknown canonical member",
      (data: any) => data.works[0].items[0] = "body-proof/exr-missing",
    ],
    [
      "fixed work duplicate member",
      (data: any) => data.works[0].items.push(data.works[0].items[0]),
    ],
    [
      "duplicate canonical question",
      (data: any) => data.questions.push(data.questions[0]),
    ],
  ] as [string, (data: any) => void][]
) {
  const data = structuredClone(packageData);
  change(data);
  const temp = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(temp, JSON.stringify({ packageData: data }));
    const result = await api.invoke(Deno.env.get("CUE") || "cue", [
      "vet",
      join(h.root, s.extension, "body-export/package.cue"),
      temp,
      "-c",
    ], h.root);
    if (!result.exitCode) {
      throw new Error("Expected package CUE refusal: " + label);
    }
    console.log("PASS " + label);
  } finally {
    await Deno.remove(temp);
  }
}
console.log("PASS common contract/refusal corpus on sealed native evidence");
