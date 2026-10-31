import { publicLinks } from "../_extensions/course-core/body-export/links.ts";
const assert = (v: unknown, s: string) => {
  if (!v) throw Error(s);
};
const cite = (ids: string[]) => ({
  t: "Cite",
  c: [
    ids.map((id, i) => ({
      citationId: id,
      citationMode: { t: i ? "SuppressAuthor" : "AuthorInText" },
      citationPrefix: [{ t: "Str", c: "см." }],
      citationSuffix: [{ t: "Str", c: "далее" }],
      citationNoteNum: 0,
      citationHash: 0,
    })),
    [{ t: "Str", c: "@" + ids.join("; @") }],
  ],
});
const refs: any[] = [];
const resolver = {
  namespace: "work",
  resolve: (key: string, style: string, source: string) => {
    refs.push({ key, style, source });
    if (
      !["tasks:sec-bank-text-input", "tasks:exr-text-compress-character-runs"]
        .includes(key)
    ) throw Error("QRC.UNKNOWN " + key);
    return {
      href: "https://example.test/" + key.replace(":", "/") + ".html",
      label: style === "number" ? "17" : "Настоящий заголовок",
    };
  },
};
const blocks = await publicLinks(
  [{
    t: "Para",
    c: [
      cite([
        "tasks:sec-bank-text-input",
        "tasks:exr-text-compress-character-runs",
      ]),
    ],
  }],
  { source: "bank/text.qmd", id: "exr-own" },
  resolver,
);
const text = JSON.stringify(blocks);
assert(
  refs.length === 2 && refs[1].style === "number",
  "Catalog Cite not resolved with actual style",
);
assert(
  text.includes("Настоящий заголовок") && text.includes("17") &&
    text.includes("см.") && text.includes("далее") && !text.includes("@tasks:"),
  "Default label/prefix/suffix lost",
);
const bibliography = cite(["doe2024"]);
assert(
  JSON.stringify(
    await publicLinks([{ t: "Para", c: [bibliography] }], {
      source: "bank/text.qmd",
      id: "exr-own",
    }, resolver),
  ).includes("doe2024") && refs.length === 2,
  "Bibliography reclassified as catalog",
);
for (
  const node of [
    cite(["tasks:sec-bank-text-input", "doe2024"]),
    cite(["tasks:sec-missing"]),
  ]
) {
  let failed = false;
  try {
    await publicLinks([{ t: "Para", c: [node] }], {
      source: "bank/text.qmd",
      id: "exr-own",
    }, resolver);
  } catch (e) {
    failed = /QRC.REFERENCE_INVALID|QRC.UNKNOWN/.test(String(e));
  }
  assert(failed, "Mixed/unknown Cite accepted");
}
let unresolved = false;
try {
  await publicLinks([{ t: "Para", c: [cite(["tasks:sec-bank-text-input"])] }], {
    source: "bank/text.qmd",
    id: "exr-own",
  });
} catch (e) {
  unresolved = String(e).includes("BODY.QRC_REFERENCE_UNRESOLVED");
}
assert(unresolved, "Catalog Cite silently retained without owner resolver");
console.log(
  "PASS catalogue Cite owner labels, styles, prefix/suffix, multi-cite, ordinary bibliography and mixed/unknown/no-resolver refusal",
);
