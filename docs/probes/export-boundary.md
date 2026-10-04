# P0 export boundary probe

This is an experimental fixture bridge outside production Core. It proves a bounded handoff of native Pandoc blocks, not a new production content model or a general parser. Core's production schema and adapters remain unchanged.

The sequence is native `quarto pandoc --from=markdown-auto_identifiers --to=json` → extraction of explicit local exercise/solution Divs and one assessment per declared QMD page → bundled YAML 2.8.1 → CUE 0.17.1 → one private JSON package → explicitly selected consumers. Every work ID comes from the explicit first `sec-*` heading of a page with `assessment.kind`; its heading supplies the title and its sole `.assessment-items` list supplies Cite membership. Automatic heading identifiers are disabled by the native Pandoc reader, so absent author IDs cannot silently become keys. Source paths are provenance, never canonical keys. Work membership is explicit and fixed. CUE validates declaration uniqueness, references and answer contracts. TS performs AST transport, projection and platform capability checks, and does not parse CUE stderr into diagnostics.

The explicit three-page fixture has `corpus.qmd` with two questions plus separate `work-one.qmd` and `work-two.qmd` assessments sharing the manual question, public resources, simple math, a table, an unlabelled figure, a file and an already-resolved external URL. This URL is an ordinary link, not QRC body transport. A second native corpus exercises numeric, multipart and matching public projections without LMS. Keys/solutions/grading notes remain separate. Correct spans are unwrapped without removing their option text. The YAML policy is one mapping document, duplicate-key rejection, no aliases/custom tags; malformed or missing answer capability fails closed.

## Reproduce

Deno 2.7.14, Quarto 1.11.5 (Pandoc 3.10 / Typst 0.15.1), CUE 0.17.1, Python 3 and Poppler must be installed/on PATH. Runtime imports are local. From Core:

```sh
deno test --allow-all tests/probes/export-boundary.ts tests/probes/export-boundary/review.test.ts
deno run --allow-all tests/probes/export-boundary/package.ts tests/probes/export-boundary/fixtures/corpus.qmd /tmp/package.json \
  tests/probes/export-boundary/fixtures/work-one.qmd \
  tests/probes/export-boundary/fixtures/work-two.qmd
```

The first command writes ignored fixture package files for companion adapter tests. The second generates a package once; pass that exact file independently to the companion `quarto-course-moodle` and `quarto-course-print` entrypoints documented in their READMEs. They never open QMD/HTML. From Core, a PL proof can also consume it:

```sh
printf '{"courseInstance":"p0","assessmentSet":"Practice","topic":"P0","points":2}\n' > /tmp/pl-binding.json
deno run --allow-all tests/probes/export-boundary/pl.ts /tmp/package.json /tmp/pl-binding.json /tmp/pl-proof
```

PL output is an overlay for an already configured course/instance/topic/assessment-set, not a complete deployable course or live-platform compatibility claim. UUID 13.0.0 v5 uses a fixed adapter namespace and kind/owner/ID. No author UUID is introduced. Manual answers use `pl-rich-text-editor` with Manual grading; single-choice uses native `pl-multiple-choice`/`pl-answer`, all options, explicit fixed order. Literal source braces are encoded before the adapter inserts its own resource URL template. Assessment points are binding-owned. Same canonical question is written once and reused by fixed assessments.

Development-only library rebuild:

```sh
cd tests/probes/export-boundary
npm ci --ignore-scripts
node build-vendor.mjs
```

## Actual capability and limits

| Boundary | Result |
| - | - |
| Stable keys, explicit works, shared question reuse | Tested; source provenance changes do not change keys/UUIDs |
| YAML/CUE numeric, multipart, matching | Public AST retains labels/all bank options, omits closed key |
| Missing module, malformed/duplicate YAML, aliases/tags, duplicate declaration | Failure, no public artifact fallback |
| Moodle manual/choice | Companion XML generator; standard XML parse; no live importer |
| PL manual/choice | Native template/JSON/resource overlay proof; no live load/submissions |
| Print manual/choice and projected forms | Companion isolated default Typst PDF; public fields and header |
| Resource mapping | Embedded bytes, hash, owner, source, effective base, explicit target; adapter collisions reject |
| Rich source/includes/computed chunks/full Quarto AST | Not generalized; fixture uses native Pandoc parsing without cell execution |
| Labelled figures/equations, citations, arbitrary anchors/raw nodes | Rejected by consumers; current scope is deliberately narrower than separate rich-body experiments |
| Same-page repeated equation labels | Unsupported, explicitly rejected |
| Closed/control print policy | Public-only prototype rejects closed questions; authorized control distribution remains future work |
| print-items, full web modes, production transaction integration | Not implemented by this probe |

`ADAPTER`, `ANSWER_YAML`, `ANSWER_INVALID`, `ANSWER_MODULE_REQUIRED`, `PACKAGE_INVALID`, `PACKAGE_PRIVATE` are bounded diagnostic codes in exception messages, not the proposed production structured diagnostics implementation. Valid package input is assumed to come from this trusted prototype producer; it is not a general hostile-input schema validator. No Moodle Quiz/Assignment/.mbz/upsert, runtime grading server or delivery automation is implemented. No production PL repository is modified.

Official documentation reviewed 2026-10-01: [Moodle XML](https://docs.moodle.org/502/en/Moodle_XML_format), [PL question schema](https://docs.prairielearn.com/schemas/infoQuestion/), [PL assessment schema](https://docs.prairielearn.com/schemas/infoAssessment/), [PL rich text](https://docs.prairielearn.com/elements/pl-rich-text-editor/), [PL multiple choice](https://docs.prairielearn.com/elements/pl-multiple-choice/), [PL resources](https://docs.prairielearn.com/clientServerFiles/), [Quarto Typst](https://quarto.org/docs/output-formats/typst.html). Documentation version is not a tested target-server version.


## Review correction scope

The original prototype's `#assessment-*` multiwork Div syntax has been removed; such input fails with `PACKAGE_INVALID`. Works use accepted `assessment.kind` (`lab`/`test`/`exam`), native first `sec-*` heading and one `.assessment-items` list. CUE validates list occurrences, one citation per member and fixed references before projection. An explicit input array/CLI source list connects the same-owner native pages; no files are discovered implicitly.

Nested and sibling `sol-*` blocks share the exact canonical suffix and are separated recursively. Nested grading notes go to their separate private field. Wrong/orphan/duplicate solutions reject, and profile-conditioned source nodes fail closed in this bounded public subset. Answer occurrence arrays reach CUE before any answer projection: two answer-spec blocks, two choices or mixed choice/spec declarations reject instead of overwriting a bank. The independent public helper checks for unsplit closed markers.

All consumers collect exact resource URLs from native Image/Link slots. Text mentions and prefix matches do not select resources. Resource destinations reject empty, `.` and `..` components and duplicate separators before writes. The producer applies the same canonical path restriction before reading local resources. These corrections do not implement general profile evaluation, complex AST cloning or production adapters.
