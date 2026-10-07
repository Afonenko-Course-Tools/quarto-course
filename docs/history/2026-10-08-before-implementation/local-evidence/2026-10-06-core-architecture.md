# Core/export and presentation architecture audit — 2026-10-06

Current authoritative source: quarto-course `213a77c` (v2.1.1), refreshed origin/main, implementation branch `feat/course-contract-20261006`. Earlier fe576c4 owner-preflight is retired and excluded from this implementation. Audit read START-CODEX, cross-repository Oct 6 decisions and all four owner plans/reviews. Local Quarto 1.11.5, CUE available.

## Actual dependencies

- `filter.lua` -> native-document / native-answers / native-adapters validators -> raw clone -> audience visibility / grading -> exercises / pedagogy / assessment -> native-resources / output. Core and Presentation are explicit pre-ast filters; Core must precede Presentation. Ordinary formats, engines, profiles, references stay Quarto-owned.
- `entrypoints/pre.ts` begins fresh native run; native Lua writes current document facts; `post.ts` accepts public Quarto output inventory and finishes run. Hooks perform no extra render/inspect. `assembleRelease` + `validateRelease` are explicit aggregation/CUE. Publisher imports native-run, release and validate. Download imports native-run and resource evaluator; PL/Cloud consume Core marker + matching exercise/assessment fragments.
- `body-export/producer.ts` consumes explicit document/release facts, partitions Pandoc JSON and uses shared resource evaluator + CUE package contract. Print and Moodle consume resulting package. All questions presently get built before the chosen work is known, all must be used, and target must be manual. Bodies follow student HTML projection, so control questions are lost even from full inputs.
- Presentation independently decorates metadata and answers, builds mode-specific fragment/details markup. Navigation independently uses Reveal public API, clones slide text for search, excludes native notes and returns slide-level targets.

## Required refactor and smallest interfaces

1. Separate ordinary AST formatting from explicit export identity. Remove mandatory course.id, role, difficulty, sec-topic and suffix solution pairing from ordinary rendering; validate provided metadata. Source-topic identity can be optional evidence. Logical course id is required only by export context, and native projects remain independent ID scopes.
2. Use only `.task-items`: one native bullet/ordered list and one native cross-reference per item. `[ @exr-id ]{requirement="optional"}` (without spaces in actual QMD) attaches optionality to item reference; evaluated lab/test/exam defaults required, ungraded handout omits statuses. Keep `items:string[]` plus optional `requirements:Record<id,"required"|"optional">` for adapter compatibility. No shared grading formula.
3. Split selected work closure from body construction. `buildBodies(...,{courseId,work,...})` first finds one work and referenced exercises in bank, verifies unique export keys, then partitions selected conditions/answers and evaluates only their resources/capabilities. Raw full-source facts, not student HTML projection, determine membership; private parts remain absent from public conditions.
4. Root export CLI selects bank/work and retains functional profiles. Native `--to json` is unsupported by book projects (real probe exit 1); changing project.type through metadata-file does not help. A native temporary project profile with `project.type: default` and `format: json` permits ordinary selected-source JSON render and retains effective book metadata (real probe successful). Implement isolated/reversible capture context, not a QMD parser and not full HTML pre-render. Need cover control files excluded by student chapters and generated native AST.
5. Release format must be per-document (HTML/Reveal permitted). Publishing independent projects must not create export uniqueness gates across the logical course. Explicit bank export owns uniqueness.
6. Reveal Presentation creates one public HTML and details wrappers for both runtime modes; mode affects notes visibility only. Default study, query mode priority, no persistent mode storage. Keep native `aside.notes` for S speaker view; show equivalent notes adjacent to slide with synchronized address targets or use native DOM notes directly with presentation CSS. Preserve all author solutions/hints in Reveal before Core projection.
7. Share disclosure action for direct/QRC/search targets. Search includes notes and produces block targets, revealing only ancestors. Print opens answers, hides notes, restores prior screen state; keep Reveal sizing/print API.

## Cost and public APIs

- Current native hooks already avoid retired duplicate capture and identity renders. Preserve them.
- Native answers call CUE vet + export per bank, then body producer reparses YAML and CUE-vets again. Retain normalized validated answer/private key in export-only raw facts; normal public sidecars must stay private-free. Batch answer schema validation per selected document/work where practical. No fresh universal parser.
- filter.lua calls pedagogy.collect in raw validator and later on projected AST; exercises/grading/body JSON also repeat traversals. First remove redundant answer subprocesses; avoid premature generic traversal framework.
- `quarto.project.profile`, `quarto.project.directory/output_directory`, `quarto.doc.input_file/output_file/is_format`, `quarto.doc.add_html_dependency`, `quarto.Callout`, native project hook input/output inventories and Pandoc AST walk/clone/read/write are public mechanisms. Use them. Existing output.lua already uses project.profile; visibility.lua still parses env.
- Verified official sources: [Lua API](https://quarto.org/docs/extensions/lua-api.html), [native profiles](https://quarto.org/docs/projects/profiles.html), [cross-reference types](https://quarto.org/docs/authoring/cross-references.html), [Reveal notes](https://revealjs.com/speaker-view/), [Reveal API](https://revealjs.com/api/).

## Concrete implementation order and verification

1. Add real native fixture tests: ordinary exr/exm/sol with no identity/metadata/sec; given invalid role/difficulty still fail; same exr across independent native projects; mixed HTML/Reveal aggregation. Relax filter/native-document/pedagogy/type/CUE boundaries and align release tests.
2. Add task-items tests: required default/optional/ungraded, duplicate/missing bank member, native reference remains visible; replace assessment collector, model, CUE and contract vocabulary, update adapters and fixtures together.
3. Add selected work body tests with unsupported/unassigned bank question (must not fail), control selected despite student exclusion, no target, full solution/key private partitions, optionality, resource selection and moved-source stable keys. Refactor producer and package models/CUE.
4. Add root export integration test: course.id only root, nested bank selected by --book, explicit --work, export without full HTML, functional profile, control excluded student chapter list, native code-generated question, missing course id/work/duplicate bank ID failures. Native source capture and export CLI.
5. Parent handles unified presentation/navigation; its coverage must test one HTML mode switch, open-state preservation, reload default/query mode, notes S, nested hidden search/QRC target, history/overview, actual PDF notes exclusion and state restore.
6. Update README, specs learning-elements/visibility/cross-references/plugin-architecture/AST grammar, docs native-run/body-export/authoring guide, examples and owner checklist. Existing tests deliberately assert retired strict role/topic/pairing and control auto-hiding; rewrite those assertions rather than retaining compatibility.
7. Run focused tests first, `npm test` current native suite once behavior settles, browser suite and selected adapter round trips. Record elapsed times; full composition must stay <=15–20 minutes. No template Pages publication.


## Implementation follow-through (7 October)

Implemented the audited minimal Core boundary on branch
feat/course-contract-20261006: optional ordinary course/metadata/topic/target,
native independent solutions, task-items/requirements, mixed native formats,
selected root book/work collection and selected Body capability checks.
No HTML or second native render is used for source export. Quarto resolves
shortcodes after Core pre-ast capture; the same JSON pass carries an explicit
public projection wrapper. The collector reads only selected owning writer
JSON documents, substitutes native-resolved full/public exercise bodies, and
retains Core-normalized keys/resources/identity. Early profile-only AND/invert
projection avoids leaking full-only content through the native full writer;
format/metadata decisions remain Quarto's. Selected QRC references fail with
BODY.QRC_REFERENCE_UNRESOLVED. The exporter forwards native warnings and requires
native exit zero, then checks selected closure/capabilities; ordinary process
helper policy remains unchanged by default.

Meaningful native tests include root bank type/root boundaries, poison web
hooks overridden by native service hooks, all-source control QMD absent native
chapters, same-bank ID conflicts, unused unsupported body/QRC/missing member,
functional profile preservation, full-only secret branches including native
combined profile/format hidden and visible conditions, public/private keys,
and cleanup/no full HTML. Root test with three native passes: 14–36 seconds
under concurrent work. Native-document 26 commands: 77.8 seconds. Current
quick suite passed at /tmp/course-core-quick-final; full npm test is running
with complete native and browser checks. Documentation/CUE/types/tests updated
and versions prepared v3.0.0; no refs committed/pushed/released by this agent.


Final verification: complete npm test PASS at
/tmp/course-native-check-20261007-005338, summary log
local-evidence/implementation-2026-10-06/core-full-suite-verified.log (~5.6min).
Final root test: 4 native source passes33.43s; native-document26commands40.7s.
The source collector bypasses only audience predicates of whole task/work
selection scopes and their ancestors, preserving nested private projection and
native functional predicates. Native --profile script consumption is handled
through QUARTO_PROFILE; explicit forwarded flags work. Real native full
output-dir profiles are covered and service output is bound with documented
--output-dir. Native name/profile/format/meta attributes share a supported
native whitelist in validation and unknown attribute facts. .yml and .yaml
profile files both work. Independent review approved all findings; source
package Core/Presentation/Navigation version3.0.0 and native book+Reveal demo
are ready for commit/PR/CI/release. No merge/release performed by this agent.
