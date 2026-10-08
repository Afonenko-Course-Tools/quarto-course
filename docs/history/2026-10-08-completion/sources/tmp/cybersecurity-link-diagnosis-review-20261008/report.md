# Actual Cybersecurity student book link failure diagnosis

P1: Published Core 4.0.0 deferred student assignment wire hides native crossrefs from Quarto book finalization. Earlier runtime-diff approval remains valid for installer/CI compatibility only; it is not approval of final site correctness.

## Actual witnesses

- `/home/tolya/Cybersecurity/_site-student/task/seminar/01-introduction.html:280` retains `href="#exr-data-integrity-backup"` with `quarto-unresolved-ref` inside its caption. Site harness is correct to reject missing local anchor.
- `/home/tolya/Cybersecurity/_site-full/task/seminar/01-introduction.html:297` has the valid native `href="../data-integrity/backup.html#exr-data-integrity-backup"` and numeric caption 11.1.
- `/home/tolya/Cybersecurity/_site-student/task/data-integrity/backup.html:277` has the actual bank target; `/home/tolya/Cybersecurity/task/.quarto/xref/35ebc033:1` records canonical exercise native number 1/section 11. The task metadata and registered book target are therefore not the fault.

## Actual native pipeline evidence

Installed Quarto 1.11.5 source `/opt/quarto/bin/quarto.js:137974` executes project-type postRender before configured post-render scripts at 137982–137996. Book postRender at 154693 calls `bookCrossrefsPostRender` before website post-render.

`/opt/quarto/bin/quarto.js:153838` performs book crossref finalization; 153849 parses output HTML; 153871 selects `.quarto-unresolved-ref` via the document DOM; 153888 rewrites the native destination from the real book index and formats native captions. Its ordinary anchor pass at 153914 also queries the main document DOM.

`/home/tolya/course-tools/quarto-course/_extensions/course-core/visibility.lua:181` wraps deferred student assignment items in `<template>`. The actual Quarto DOM parser defines HTMLTemplateElement with a separate content DocumentFragment at `/opt/quarto/bin/quarto.js:22310`, exposing that separate fragment via content at 22335. Those descendants are outside the document traversal used for native book crossref repair.

`/home/tolya/course-tools/quarto-course/_extensions/course-core/entrypoints/preview.ts:83` unwraps the template only during configured Core post-render, after native book resolution. It preserves the exact native markup but that markup never received native book correction, so the originally unresolved same-page anchor becomes visible. FULL never takes this student wrapper branch and resolves normally. This explains the actual student/full difference without guessed URLs, reading stale DTOs, or blaming QRC.

## Existing proof gap

`/home/tolya/course-tools/quarto-course/tests/authoring-model.ts:50` only checks hooked HTML contains the open exercise ID and omits the restricted ID. Line 57 checks service templates removed. Neither assertion checks the actual cross-document destination or resolved numeric caption. Its current native book fixture therefore covers privacy/content but misses the broken student link. `native-lifecycle.ts` checks native book output inventory only.

## Reviewed minimal direction, not an implementation approval

The owner fix must let Quarto native book post-render see the same assignment crossrefs in normal DOM while retaining fail-closed student behavior and private-resource/search cleanup. A DOM-traversable pending container can be evaluated, but simply replacing template with a hidden div is insufficient without testing search privacy: native search runs before configured Core cleanup and may index hidden content. Preserve actual native URL/caption resolution; do not reconstruct addresses/captions, call Quarto internals, weaken site validation, or overlay vendor files.

Required focused regression: actual native book with cross-document open and restricted assignment links, student/full, nested path and work-before-bank ordering; assert open href resolves to actual bank output, numeric caption contains no unresolved span, restricted ID/attachment excluded from site/search/public service payload. Existing authoring-model native book fixture is the appropriate place to strengthen the missing witness. Reuse one native cycle; no extra full render/inspect runtime introduced.

No repository or vendor mutations performed by this reviewer. Any required published runtime correction needs a new immutable patch release and native installation refresh, not replacement of existing tags.
