import {
  assertReferenceTargets,
  resolveReferences,
} from "../_extensions/course-core/body-export/references.ts";
import { join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "native-reference-boundary-" });
const cite = (id: string) => ({
  t: "Cite",
  c: [[{
    citationId: id,
    citationPrefix: [],
    citationSuffix: [],
    citationMode: { t: "NormalCitation" },
    citationNoteNum: 0,
    citationHash: 0,
  }], [{ t: "Str", c: "[@" + id + "]" }]],
});
const errors: string[] = [];
try {
  await Deno.writeTextFile(
    join(root, "refs.bib"),
    "@book{public, title={PUBLIC_SOURCE}, year={2024}}\n@book{private, title={PRIVATE_METADATA_SOURCE}, year={2023}}",
  );
  const base: any = {
    "pandoc-api-version": [1, 23, 1],
    meta: {
      bibliography: { t: "MetaString", c: join(root, "refs.bib") },
      "link-citations": { t: "MetaBool", c: false },
    },
    blocks: [],
  };
  const doc = structuredClone(base);
  doc.meta.abstract = {
    t: "MetaBlocks",
    c: [{ t: "Para", c: [cite("private")] }],
  };
  const output = await resolveReferences(
    [{ t: "Para", c: [cite("public")] }],
    doc,
    root,
    { source: "index.qmd", id: "exr-one" },
  );
  if (JSON.stringify(output).includes("PRIVATE_METADATA_SOURCE")) {
    errors.push("abstract metadata citation leaked into public bibliography");
  }
  let warningRejected = false;
  try {
    await resolveReferences([{ t: "Para", c: [cite("unknown")] }], base, root, {
      source: "index.qmd",
      id: "exr-one",
    });
  } catch (e) {
    warningRejected = String(e).includes("BODY.CITATION_UNRESOLVED");
  }
  if (!warningRejected) {
    errors.push(
      "unknown warning-only citation accepted without link-citations",
    );
  }
  let rejected = false;
  try {
    await resolveReferences(
      [{ t: "Para", c: [cite("unknown")] }, {
        t: "Div",
        c: [["ref-unknown", ["csl-entry"], []], [{
          t: "Para",
          c: [{ t: "Str", c: "AUTHOR_SUPPLIED_REF" }],
        }]],
      }],
      base,
      root,
      { source: "index.qmd", id: "exr-one" },
    );
  } catch (e) {
    rejected = /BODY\.(CITATION_UNRESOLVED|BIBLIOGRAPHY_COLLISION)/.test(
      String(e),
    );
  }
  if (!rejected) {
    errors.push(
      "author csl-entry spoof authenticated unknown warning-only citation",
    );
  }
  let knownRejected = false;
  try {
    await resolveReferences(
      [{ t: "Para", c: [cite("public")] }, {
        t: "Div",
        c: [["ref-public", ["csl-entry"], []], [{
          t: "Para",
          c: [{ t: "Str", c: "SPOOFED_KNOWN_SOURCE" }],
        }]],
      }],
      base,
      root,
      { source: "index.qmd", id: "exr-one" },
    );
  } catch (e) {
    knownRejected = String(e).includes("BODY.BIBLIOGRAPHY_COLLISION");
  }
  if (!knownRejected) {
    errors.push(
      "author csl-entry for known citation creates forged/duplicate ref target",
    );
  }
  let duplicateRejected = false;
  try {
    const duplicate = await resolveReferences(
      [{ t: "Para", c: [cite("public")] }, {
        t: "Div",
        c: [["ref-public", [], []], [{
          t: "Para",
          c: [{ t: "Str", c: "AUTHORED_TARGET" }],
        }]],
      }],
      base,
      root,
      { source: "index.qmd", id: "exr-one" },
    );
    assertReferenceTargets(duplicate, { source: "index.qmd", id: "exr-one" });
  } catch (e) {
    duplicateRejected = String(e).includes("BODY.REFERENCE_TARGET_DUPLICATE");
  }
  if (!duplicateRejected) {
    errors.push(
      "author ref target collides with native known bibliography entry",
    );
  }
  if (errors.length) throw Error(errors.join("; "));
  console.log(
    "PASS native citation metadata boundary and authentic bibliography entry proof without link-citations",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
