import { assertAssignmentDeclarations } from "../_extensions/course-core/runtime/assignment-declarations.ts";
const known = [
  "/owner/assets/public.svg",
  "/runtime/lib/quarto.js",
  "/runtime/lib/style.css",
];
const rows = [{ type: "resources", content: { file: known[0] } }, {
  type: "html",
  content: {
    scripts: [{ path: known[1] }],
    stylesheets: [{ path: known[2] }],
    resources: [],
    links: [],
    serviceworkers: [],
  },
}, {
  type: "text",
  content: { text: '<meta name="x">', location: "in-header" },
}];
assertAssignmentDeclarations(rows, "/owner/index.qmd", new Set(known));
for (
  const changed of [
    [{ type: "resources", content: { file: "/outside/unknown.svg" } }],
    [{ type: "html", content: { scripts: [{ path: "/outside/unknown.js" }] } }],
    [{ type: "unknown", content: {} }],
    [{ type: "file", content: { path: 17 } }],
  ]
) {
  let failed = false;
  try {
    assertAssignmentDeclarations(changed, "/owner/index.qmd", new Set(known));
  } catch (e) {
    failed = String(e).includes("BODY.PRODUCER_DEPENDENCY_UNQUALIFIED");
  }
  if (!failed) throw Error("Unknown/malformed data declaration accepted");
}
console.log(
  "PASS bounded declared data/resource paths only; no claim of loaded-module completeness",
);
