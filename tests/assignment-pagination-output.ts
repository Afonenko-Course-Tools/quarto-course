import { assertAssignmentDeclarations } from "../_extensions/course-core/runtime/assignment-declarations.ts";
const root = "/tmp/pagination-owner",
  outputDirectory = root + "/_generated/assigned",
  input = root + "/index.qmd",
  known = new Set([input]);
const context = {
  root,
  outputDirectory,
  xdg: "/tmp/pagination-cache",
  format: "html",
  outputs: new Set([
    outputDirectory + "/index.html",
    outputDirectory + "/labs/index.html",
  ]),
};
const row = (href = "/labs/index.html", rel = "next") => ({
  type: "html",
  content: { name: "website-pagination", links: [{ href, rel }] },
});
assertAssignmentDeclarations([row()], input, known, context);
assertAssignmentDeclarations(
  [row("/index.html", "prev")],
  root + "/labs/index.qmd",
  known,
  context,
);
for (
  const value of [
    row("/foreign.html"),
    row("/../outside.html"),
    row("//host/x.html"),
    row("https://host/x.html"),
    row("/labs/index.html?x"),
    row("/labs/%69ndex.html"),
    row("/labs/index.html", "stylesheet"),
    { ...row(), content: { ...row().content, name: "authored" } },
    {
      ...row(),
      content: { ...row().content, scripts: [{ path: "foreign.js" }] },
    },
    {
      ...row(),
      content: {
        name: "website-pagination",
        links: [{ href: "/labs/index.html", rel: "next", type: "text/html" }],
      },
    },
    { type: "resources", content: { file: "/labs/index.html" } },
    {
      type: "html",
      content: { name: "quarto-html", scripts: [{ path: "/labs/index.html" }] },
    },
  ]
) {
  let refused = false;
  try {
    assertAssignmentDeclarations([value], input, known, context);
  } catch (e) {
    refused = String(e).includes("BODY.PRODUCER_DEPENDENCY_UNQUALIFIED");
  }
  if (!refused) {
    throw Error(
      "Foreign/ambiguous pagination/resource accepted " + JSON.stringify(value),
    );
  }
}
for (
  const wrong of [{ ...context, format: "revealjs" }, {
    ...context,
    outputDirectory: root + "/_site",
  }, { ...context, outputs: new Set<string>() }]
) {
  let refused = false;
  try {
    assertAssignmentDeclarations([row()], input, known, wrong);
  } catch (e) {
    refused = String(e).includes("BODY.PRODUCER_DEPENDENCY_UNQUALIFIED");
  }
  if (!refused) throw Error("Wrong pagination context accepted");
}
console.log(
  "PASS exact native website-pagination outputs; foreign/escape/URL/shape/rel/resource/script/wrongscope refusals; no IO authority",
);
