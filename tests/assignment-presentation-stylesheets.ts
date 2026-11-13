import { assertAssignmentDeclarations as check } from "../_extensions/course-core/runtime/assignment-declarations.ts";
type PresentationContext = NonNullable<Parameters<typeof check>[2]>;
const context: PresentationContext = {
  root: "/owner",
  outputDirectory: "/owner/_generated/capture",
  xdg: "/actual/cache",
  format: "html",
};
const generated = (
  family = "quarto-html",
  name = family + "-" + "a".repeat(32) + ".min.css",
  path = "/owner/.quarto/quarto-session-temp1234/native.css",
  attribs: Record<string, string> = { "append-hash": "true", "data-mode": "light" },
) => ({
  type: "html",
  content: { name: family, stylesheets: [{ name, path, attribs }] },
});
const invoke = (rows: unknown[], binding: PresentationContext | null = context) => {
  if (binding === null) {
    // @ts-expect-error Отрицательный runtime-контроль повреждённого контекста.
    return check(rows, "/owner/bank.qmd", binding);
  }
  return check(rows, "/owner/bank.qmd", binding);
};
const syntax = generated(
  "quarto-html",
  "quarto-syntax-highlighting-" + "b".repeat(32) + ".css",
  "/actual/cache/quarto/sass/" + "c".repeat(32) + ".css",
  { id: "quarto-text-highlighting-styles" },
);
// Actual Quarto 1.11.5 Cosmo bundle: bootstrap adds this exact builtin id.
const bootstrap = generated("bootstrap", undefined, undefined, {
  "append-hash": "true",
  "data-mode": "light",
  id: "quarto-bootstrap",
});
invoke([generated(), bootstrap, syntax]);
// Quarto 1.12 разделяет Sass cache по ветви V8, не меняя роль stylesheet.
invoke([generated("quarto-html", undefined, "/actual/cache/quarto/sass/v8-15.0/" + "c".repeat(32) + ".css")]);
const refuse = (rows: unknown[], binding: PresentationContext | null = context) => {
  let error = "";
  try {
    invoke(rows, binding);
  } catch (e) {
    error = String(e);
  }
  if (!error.includes("BODY.PRODUCER_DEPENDENCY_UNQUALIFIED")) {
    throw Error("Expected refusal: " + JSON.stringify({ rows, binding, error }));
  }
};
refuse([generated()], null);
for (const path of [
  "/foreign/native.css",
  "https://host/a.css",
  "/actual/cache/quarto/sass/foreign.css",
  "/actual/cache/quarto/sass/v8-15.0/foreign.css",
  "/actual/cache/quarto/sass/v8-15.0/nested/" + "c".repeat(32) + ".css",
  "/actual/cache/quarto/sass/foreign/" + "c".repeat(32) + ".css",
  "/actual/cache/quarto/sass/v8-15.0/../" + "c".repeat(32) + ".css",
]) {
  refuse([generated("quarto-html", undefined, path)]);
}
for (const delta of [{ xdg: "/foreign/cache" }, { format: "revealjs" }]) {
  if (delta.xdg) refuse([syntax], { ...context, ...delta });
}
for (const field of ["scripts", "resources", "links", "serviceworkers"]) {
  const row = generated();
  const content: Record<string, unknown> = row.content;
  content[field] =
    field === "links"
      ? [{ href: "/foreign/private" }]
      : field === "serviceworkers"
        ? [{ source: "/foreign/private" }]
        : [{ path: "/foreign/private" }];
  refuse([row]);
}
invoke(
  [
    {
      type: "html",
      content: { name: "custom", stylesheets: [{ path: "/owner/authored.css" }] },
    },
  ],
  context,
);
invoke([syntax], { ...context, format: "revealjs" });
console.log(
  "PASS owner-scoped declarations and native stylesheet exceptions; external paths refused; no CSS byte reads",
);
