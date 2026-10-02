# Finite stock NativeListing owner

This opt-in owner capability supports the stock Quarto **table** emitter for
plain `title` and `categories`, with an optional integer `semester` column. It
does not make native output, raw HTML, source QMD or a protected marker public
by itself.

The initial model covers the original three difficulty/semester-filtered tables
and the fourth three-column table. Native public inspect must select every row
as an input of the same owner. Contents selectors are exactly `*/index.qmd` or
`*/*/index.qmd`; sort is `title`; filter and sort UI are disabled. Page size is
the stock table default 30 or explicit 10, with no active pagination. Unknown
fields, custom/grid/image emitters, arbitrary metadata, markup in cells or
attributes, unknown reader/engine preprocessing and custom project/HTML
constructors refuse. Rows retain their existing owner include and pedagogy
semantics.

## Source model

`auditNativeListings({root, profile, project, documents, provider})` consumes
the complete current public project inspect and the **already obtained**
per-document inspect map. It does not run inspect or an engine. `documents` uses
relative native input paths. `documentHashes` may carry hashes of those exact
persisted inspect values. The result is `NativeListingPlans`, keyed
`profile:source`, for the two Listing-emitting sources; each plan freezes all
selected writer descriptors.

`native-listing.cue` is a closed model. It validates finite fields and nested
writers before the TypeScript cross-model checks bind each row to its selected
source/output-file descriptor. The model hash excludes `planHash` itself.
`currentNativeListingPlans` checks source bytes, regular-file containment and
the row/emitter modification-time witnesses again. Source SHA-256, public-reader
SHA-1/byte length, native inspect hashes and provider binding are separate
facts. A model or digest alone grants no permission.

Static Markdown with no code cells is required for this bounded capability.
Listing-emitting sources also require an empty native include map. Row sources
may keep their native includes. Count/readtime are non-authoritative UI slots:
canonical positive integers with wordcount at most the frozen raw UTF-8 source
byte count plus one, and readtime exactly `ceil(wordcount/200)`. This bound
follows the pinned stock static partition used by inputTargetIndex; includes
remain syntax there. Mtime, title, categories, semester, filename, row index and
every URI are exact values, not numeric wildcard slots.

## Same-invocation constructor

`native-listing-constructors.lua` exports the pure `verify(doc, plan, context)`
function. `context` supplies the actual Listing block, reader/options and public
Source-reader Header candidates. The function never mutates the incoming
document. It reconstructs the finite table Markdown from native-inspected typed
data, reads it through public `pandoc.read` with the same options and compares
the **complete** Listing AST, including its math envelope, ordered groups, every
raw fragment and every cell. It returns exact occurrence paths and typed source
address edges only after equality succeeds.

Fallback titles come from the first plain H1 read from current frozen row bytes
in that same invocation. Normal IDs/classes remain as witnessed. A rich Header
or a lexical difference from the actual native title cell/sort value refuses.
Title ordering uses the exact native lexical string order for the bounded
Latin/Cyrillic alphabet; no HTML href extraction or general HTML parser is
involved.

The surrounding witness module separately proves the complete actual input
replay, exact authored prefix, known append wrapper order, canonical destination
survival, and exhaustive ordinary traversal of all other descendants. The stock
native renderer recreates a removed listing destination in the public body, so a
missing, ambiguous or semantically moved projected destination **refuses**. It
is never treated as a table with no uses. An unrelated sibling ordinal shift is
safe.

A public native book part may use `book-part-title-transfer` only for the frozen
unique non-index `book.render` part entry without number/appendix, stock
multi-file HTML, no authored title, static empty-include emitter and known
native constructor. The witness must prove the source H1/plain title and exact
remaining body, while the incoming native AST and Header identities remain
unchanged. No arbitrary Header dropping, source rewrite or partial-prefix search
is permitted.

## Completion and current resources

Raw table hrefs remain source-QMD addresses in the input evidence. They produce
typed same-owner native output edges, not raw source-copy permissions.
Completion requires actual successful native invocation and current
output-file/source artifacts, writer identity and mounted-stage SHA closure.
Current validation must recheck these edges. Stock `listings.json` is a closed
known auxiliary constructor with exhaustive same-owner output uses, not an
inventory exemption.

`nativeListingInitializer(plan)` returns the exact stock inline initialization
body for the bounded model. The native date/title sort descriptors and
title/author search columns remain even with their UI disabled. Registered stock
list.min.js, quarto-listing.js and HTML consumer modules are external
native-provider witnesses; they do not widen the Presentation source-service
runtime rule. Ordinary resource inventory and source-byte veto remain dominant.

## Evidence limits and checks

`tests/native-listing-contracts.ts` uses labelled synthetic Source/inspect
fixtures with the original four declaration shapes and five selected inputs. It
tests CUE closure, native selector/include semantics, writer aliases, current
bytes, unknown hooks/constructors, exact inline initialization, and a pure
public Pandoc table constructor with all 29 semester-table raw occurrences. Its
mutations cover href, title, numeric bounds and extra raw content. It creates no
native engine, owner session, successful receipt, current address certificate or
publication permission.

The retained original all-five diagnostic remains **FAIL**: one part's
H1-to-title transfer did not satisfy the initial authored-prefix rule and a row
shortcode did not satisfy generic Markdown replay. A later retained-generation
pure constructor assessment cannot replace those historical results or certify a
current provider. Fresh installed native owner and both-channel strict CI gates
are required before claiming this capability for the original course.
