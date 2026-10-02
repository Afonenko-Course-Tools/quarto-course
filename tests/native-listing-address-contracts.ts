// Pure finite address/auxiliary model checks; not native owner acceptance.
import {
  assertNativeListingAuxiliary,
  assertNativeListingStockRegistrations,
  nativeListingOutputURI,
} from "../_extensions/course-core/owner-preflight/native-listing-addresses.ts";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function refusal(callback: () => unknown, code: string) {
  try {
    callback();
    throw new Error("expected refusal: " + code);
  } catch (error) {
    assert(
      error instanceof Error && error.message.startsWith(code + ":"),
      "wrong refusal: " + error,
    );
  }
}
assert(
  nativeListingOutputURI("index.qmd", "text/representation/index.html") ===
    "./text/representation/index.html",
  "root source native URI",
);
assert(
  nativeListingOutputURI("text/index.qmd", "text/representation/index.html") ===
    "../text/representation/index.html",
  "nested source native URI",
);
assert(
  nativeListingOutputURI("text/index.qmd", "custom-target.html") ===
    "../custom-target.html",
  "descriptor output name; no extension replacement",
);
for (
  const target of [
    "../outside.html",
    "/outside.html",
    "text/index.qmd",
    "text/a.html?x",
    "text/a.html#x",
    "text/a%2findex.html",
    "text/a\\index.html",
  ]
) {
  refusal(
    () => nativeListingOutputURI("text/index.qmd", target),
    "SOURCE.NATIVE_LISTING_ADDRESS_INVALID",
  );
}
const expected = [
  {
    listing: "/index.html",
    items: ["/text/representation/index.html", "/text/decoding/index.html"],
  },
  {
    listing: "/text/index.html",
    items: ["/text/decoding/index.html", "/text/representation/index.html"],
  },
];
assertNativeListingAuxiliary(expected, expected);
for (
  const changed of [
    [...expected].reverse(),
    [expected[0], expected[0]],
    [{ ...expected[0], items: [...expected[0].items].reverse() }, expected[1]],
    [{ ...expected[0], arbitrary: true }, expected[1]],
    [{ ...expected[0], listing: "/index.qmd" }, expected[1]],
    [{ ...expected[0], items: ["/private/control.json"] }, expected[1]],
    { entries: expected },
    [...expected, expected[1]],
  ]
) {
  refusal(
    () => assertNativeListingAuxiliary(changed, expected),
    "SOURCE.NATIVE_LISTING_ADDRESS_CHANGED",
  );
}
const scripts = [
  "site_libs/quarto-listing/list.min.js",
  "site_libs/quarto-listing/quarto-listing.js",
];
const initializer = "\nwindow['quarto-listings'] = {};\n";
const html = '<html><head><meta name="quarto:offset" content="../">' +
  '<script src="../site_libs/quarto-listing/list.min.js"></script>' +
  '<script src="../site_libs/quarto-listing/quarto-listing.js"></script>' +
  "<script>" + initializer + "</script></head></html>";
assertNativeListingStockRegistrations(
  html,
  "text/index.qmd",
  "text/index.html",
  scripts,
  initializer,
);
for (
  const changed of [
    html.replace('content="../"', 'content="../../"'),
    html.replace("list.min.js", "list.min.js?alternate=1"),
    html.replace(
      '<script src="../site_libs/quarto-listing/list.min.js">',
      '<script defer src="../site_libs/quarto-listing/list.min.js">',
    ),
    html.replace(
      "window['quarto-listings'] = {};",
      "window['quarto-listings'] = {unknown:true};",
    ),
    html.replace(
      "</head>",
      '<script src="../site_libs/quarto-listing/list.min.js"></script></head>',
    ),
    html.replace("</head>", '<meta name="quarto:offset" content="../"></head>'),
    html.replace("</head>", "<script>" + initializer + "</script></head>"),
  ]
) {
  refusal(
    () =>
      assertNativeListingStockRegistrations(
        changed,
        "text/index.qmd",
        "text/index.html",
        scripts,
        initializer,
      ),
    "SOURCE.NATIVE_LISTING_ADDRESS_CHANGED",
  );
}
console.log(
  "PASS pure native listing nested writer and exact auxiliary URL model (no native owner acceptance)",
);
