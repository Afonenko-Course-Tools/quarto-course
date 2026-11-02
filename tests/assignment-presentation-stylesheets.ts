import { assertAssignmentDeclarations as check } from "../_extensions/course-core/runtime/assignment-declarations.ts";
const context: any = {
  root: "/owner",
  outputDirectory: "/owner/_generated/capture",
  xdg: "/actual/cache",
  version: "1.11.5",
  format: "html",
};
const generated = (
  family = "quarto-html",
  name = family + "-" + "a".repeat(32) + ".min.css",
  path = "/owner/.quarto/quarto-session-temp1234/native.css",
  attribs: any = { "append-hash": "true", "data-mode": "light" },
) => ({
  type: "html",
  content: { name: family, stylesheets: [{ name, path, attribs }] },
});
const invoke = (
  rows: any[],
  binding: any = context,
  known = new Set<string>(),
) => (check as any)(rows, "/owner/bank.qmd", known, binding);
const syntax = generated(
  "quarto-html",
  "quarto-syntax-highlighting-" + "b".repeat(32) + ".css",
  "/actual/cache/quarto/sass/" + "c".repeat(32) + ".css",
  { id: "quarto-text-highlighting-styles" },
);
invoke([generated(), generated("bootstrap"), syntax]);
const refuse = (rows: any[], binding: any = context) => {
  let error = "";
  try {
    invoke(rows, binding);
  } catch (e) {
    error = String(e);
  }
  if (!error.includes("BODY.PRODUCER_DEPENDENCY_UNQUALIFIED")) {
    throw Error(
      "Expected refusal: " + JSON.stringify({ rows, binding, error }),
    );
  }
};
refuse([generated()], null);
for (
  const delta of [
    { outputDirectory: "/owner/_site" },
    { xdg: "/foreign/cache" },
    { version: "1.11.6" },
    { format: "revealjs" },
  ]
) refuse([delta.xdg ? syntax : generated()], { ...context, ...delta });
for (
  const path of [
    "/owner/authored.css",
    "/owner/_generated/private.css",
    "/foreign/native.css",
    "https://host/a.css",
    "/owner/.quarto/quarto-session-temp1234/../native.css",
    "/actual/cache/quarto/sass/foreign.css",
  ]
) refuse([generated("quarto-html", undefined, path)]);
refuse([generated("foreign")]);
refuse([generated("reveal")]);
refuse([generated("quarto-html", "custom.css")]);
refuse([
  generated("quarto-html", undefined, undefined, {
    "append-hash": "true",
    "data-mode": "light",
    foreign: "x",
  }),
]);
for (const field of ["scripts", "resources", "links", "serviceworkers"]) {
  const row: any = generated();
  row.content[field] = field === "links"
    ? [{ href: "/foreign/private" }]
    : field === "serviceworkers"
    ? [{ source: "/foreign/private" }]
    : [{ path: "/foreign/private" }];
  refuse([row]);
}
const known = new Set(["/owner/authored.css"]);
invoke(
  [{
    type: "html",
    content: { name: "custom", stylesheets: [{ path: "/owner/authored.css" }] },
  }],
  context,
  known,
);
if (known.size !== 1) throw Error("Classification grants file authority");
invoke([syntax], { ...context, format: "revealjs" });
console.log(
  "PASS exact generated presentation entries only; no CSS byte reads/authority; sibling/private/format/path refusals",
);
