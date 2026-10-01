# P0 rich-content boundary proof

**Result: bounded proof; rich links/inline/print work with one occurrence per target document.** A separate owner process captures standard Pandoc blocks; fresh consumer processes render links HTML, a single rich inline instance on another page, and a real Typst PDF without reading owner QMD or repeating its computation. Two distinct pages each have one fully resolved inline instance, unique DOM IDs, and a technical instance anchor. The harder same-page two-instance case preserves figures/tables/callouts/citations/notes, but equation labels cannot be safely namespaced at the tested documented boundaries. That repeated-inline mode fails with an explicit ADAPTER diagnostic. `unsafe-inline.html` is intentionally broken negative evidence, never an accepted export.

No production files or schema change. This is an experimental, fixture-specific transport, not a promise to serialize arbitrary Quarto AST.

## Reproduce

Prerequisites: Quarto 1.11.5 (Pandoc 3.10, Typst 0.15.1), Deno 2.7.14, R 4.3.3 with knitr 1.45/rmarkdown 2.25, Poppler `pdftotext`. Run from the repository root:

```sh
deno run -A tests/probes/rich-content.ts
```

The command prints its retained artifact directory. `RICH_PROBE_OUTPUT` selects an **empty** output directory. `QUARTO` selects the executable. The default `RICH_COMPUTE=r` runs a genuine R cell. `RICH_COMPUTE=lua` explicitly selects a weaker Lua-only computation probe. `RICH_COMPUTE=jupyter` selects the genuine Python cell and requires Jupyter; it is never silently substituted for R/Lua. In this environment Jupyter was installed but could not start its TCP kernel (`Operation not permitted`); that attempt is blocked, not passed.

The runner returns success only when both positive observations and the named negative observations match. The machine-readable result is `status: bounded-proof`, not unrestricted rich-inline support.

## Data path and phases

1. `owner-r.qmd` executes a real R cell producing `computed.svg` and incrementing `execution-count.txt`. The included task contains a figure slot; `compute.lua` builds that figure using public Pandoc constructors. A separate Lua-filter sentinel increments `filter-count.txt`.
2. `capture.lua` runs at the documented `pre-ast` insertion point, clones the one exercise and its solution, splits them, walks images, and writes each with `pandoc.write(..., 'json')`. The bundle includes the bibliography, a resource index, bytes, and canonical count/address fixtures. It does not read HTML to recover content.
3. The runner copies only that bundle and consumer filters into a separate directory, deletes every owner QMD source there was to read, then starts separate Quarto processes. The rendered canonical owner HTML remains available at the supplied address.
4. `consume.lua` uses `pandoc.read(..., 'json')` at `pre-ast`. Quarto rebuilds its own callout/float nodes and runs native crossrefs. `namespace.lua` uses documented top-down `Div`, `FloatRefTarget`, `Span`, `Cite`, and other callbacks at `post-ast`, before native crossref resolution. It rewrites IDs/targets for this fixture; it does not assign numbers.
5. Links HTML includes the canonical condition link and local solution. Solution references become semantic links to the canonical figure/equation/table, with no invented canonical numbers. Single-instance inline and print get normal compiler numbering. Print excludes the solution and has an answer area.
6. A separate raw post-AST capture is fed into another new process. It fails while Quarto accesses missing `custom_data`: ordinary JSON cannot transport that process-local custom-node state.

## Evidence matrix

| Check | Result and evidence |
| --- | --- |
| One canonical exercise/solution | Manifest counts stay 1/1; representations have neither canonical exercise nor solution IDs |
| Owner computation | R cell count and independent Lua-filter count remain exactly 1 after all consumers |
| Web without PDF | Links, full inline, second-page inline, and unsafe negative HTML renders finish before any print render is requested |
| Figures/tables in two instances | Distinct `fig-*-one/two` and `tbl-data-one/two`; native Figure 1–6 and Table 1–2 references |
| Callout, bibliography, footnote | Native callout styling, resolved Knuth citation/bibliography, separate note anchors retained |
| Ordinary links | Body reading link remains a link; no transclusion |
| Solution → condition figure | Local correct instance in inline; existing canonical figure target in links |
| Included resource base | `assets/shared.svg` resolves at root QMD, not at the included fragment's conflicting `fragments/assets/shared.svg` |
| Same basename | Different `assets/shared.svg` / `other/shared.svg` bytes receive distinct hash-prefixed targets; copied bytes are rehashed |
| Single-instance paper | Actual 2-page PDF, native Figure/Equation/Table references, all three images, callout, note, bibliography, answer field; no solution text |
| Repeated equation | **Blocked**: native labels remain raw `Str` tokens through post-AST; unsafe output has two `eq-rule` anchors and unresolved renamed equation references |
| Raw post-AST JSON | **Blocked**: fresh process errors at absent custom-node registry data |

PDF text is checked with Poppler, and both pages were visually inspected: the task and answer area occupy page 1; the bibliography occupies page 2. No clipping or overlapping content was observed. This is a functional fixture, not the finished paper layout.

## Baselines and limits

The first namespacing attempt at `pre-ast` missed both table and equation labels: Pandoc represented them as literal label strings. Moving the consumer callback to `post-ast` fixes tables through the public `FloatRefTarget` callback. Equation labels are still strings there. The probe deliberately does **not** parse those strings. Renaming only after crossrefs would be too late to establish correct per-instance numeric references.

The unsafe render returns Quarto exit 0 even with unresolved-crossref warnings, despite `--fail-if-warnings`; assertions inspect actual anchors, refs, and warnings. An `error()` in a nested Pandoc walk likewise logged `ERROR` while Quarto returned 0 in the tested version. The explicit unsupported adapter guard writes its diagnostic to stderr and calls standard Lua `os.exit(1)`; the runner verifies rejection. A future production adapter must use a reliable failing boundary and invalidate stale artifacts.

Supported scope is exactly the fixture's standard Pandoc content, simple native callout, standalone figures/table, local links, notes, citation with supplied bibliography, and local SVG resources. The prototype ID set and scope marker are fixture-specific, and the address is supplied as a canonical-address fixture; production QRC resolution/registry integration is **not** tested. Provenance is explicitly supplied fixture knowledge, not a newly discovered general source-map API. Hashes only prevent content/path collisions, not authenticate content.

Unknown widgets, nested/multi-panel floats, arbitrary shortcodes, format-specific raw content, custom callout features, CSL dependency closure, remote resources, arbitrary node attributes, nested instance scopes, policy controls, and book numbering are unproven. The proof doesn't turn into a production adapter by removing the guard. No CUE/content contract is frozen here. The minimum rich-object pathway in §10 is supported with the stated single-occurrence limit; unrestricted repeated-instance A9 support stays open; A10 is limited to image root/collision evidence. A11 dependency discovery, invalidation matrix, and warm/no-op guarantees are not established by a single print duration.

## Documented APIs consulted

- [Quarto AST and filter insertion phases](https://quarto.org/docs/advanced/quarto-ast.html): public custom-node callbacks and pre/post phases.
- [Quarto Lua API](https://quarto.org/docs/extensions/lua-api.html): Lua/Pandoc API surface, JSON and paths.
- [Pandoc Lua filters](https://pandoc.org/lua-filters.html): `pandoc.read`, `pandoc.write`, cloning/walking, constructors.
- [Quarto include path resolution](https://quarto.org/docs/authoring/includes.html): included resource paths use the root document context.

Only these public mechanisms are used. No `_quarto`/registry/cache API, custom Markdown parser, or custom crossref numberer is used.
