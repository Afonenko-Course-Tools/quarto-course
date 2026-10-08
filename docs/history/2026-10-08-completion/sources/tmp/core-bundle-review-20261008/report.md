# Spec Compliance

- ❌ Issues found in `75ba768..aa5a817`: student Source and late projection leak material, the public-solution witness misses native containers, and two independent API/native-boundary guards are incomplete. Five Important findings below.
- ✅ The reviewed implementation otherwise follows the explicit-bank contract: raw own difficulty/time/visibility precede projection; assignments preserve ordered multiple lists; restricted participant Body remains separate from closed payload; current-only totals and bounded NativeRun configuration witnesses avoid historical fallback.
- ⚠️ Full `npm test` remains PENDING. `/tmp/core-runtime-20261008/full-final.log` has no final PASS; release/CI/promotion are outside this gate. Preparation statuses are intentional and are not release claims.

# Strengths

- `/home/tolya/course-tools/quarto-course/_extensions/course-core/native-document.lua:125` checks own fields before visibility; `:160` enforces one same-QMD/nested solution. `/home/tolya/course-tools/quarto-course/_extensions/course-core/exercises.lua:11` keeps ordinary outside-bank exercises out of canonical facts.
- `/home/tolya/course-tools/quarto-course/_extensions/course-core/assessment.lua:70` produces one assignment map with explicit optional stage and required/individual defaults. `/home/tolya/course-tools/quarto-course/_extensions/course-core/body-export/producer.ts:205` qualifies both assignment keys and items; `/home/tolya/course-tools/quarto-course/_extensions/course-core/body-export/package.cue:36` independently checks demonstration predicates.
- `/home/tolya/course-tools/quarto-course/_extensions/course-core/entrypoints/preview.ts:5` omits unavailable totals; `/home/tolya/course-tools/quarto-course/_extensions/course-core/infrastructure/native-run.ts:69` rejects changed configuration without historical fallback, and `:304` narrowly rebinds exporter-owned cleanup.
- All three descriptors declare 4.0.0 / Quarto >=1.11.5. `/home/tolya/course-tools/quarto-course/.github/workflows/ci.yml:28` selects 1.11.5 and `:38` selects CUE 0.17.1. `/home/tolya/course-tools/quarto-course/tools/check-canonical.sh:23` wires new native regressions into the existing suite.

# Issues

## Critical

- None.

## Important

1. **[P1] Pre-ast metadata does not disable the native Source modal.** `/home/tolya/course-tools/quarto-course/_extensions/course-core/filter.lua:27` changes keep-source/code-tools in `doc.meta`, after native writer options have resolved. An actual Cosmo student render with `code-tools: {source: true, toggle: false}` and `keep-source: true` exits 0 but retains `quarto-embedded-source-code-modal` and `RESTRICTED_SOURCE_PAYLOAD` in final HTML. The theme:none regression does not exercise this path. Evidence: `/tmp/core-bundle-review-20261008/source-bootstrap.log` and `/tmp/core-bundle-review-20261008/source-bootstrap/_site/index.html`; the frozen extension was copied before fixes. Disable/refuse native source publication through the supported boundary and preserve unrelated author toggle preferences. This case preserved toggle:false, so forcing toggle:true is unnecessary.

2. **[P1] Public projection happens after consumers have captured the unprojected assessment.** `/home/tolya/course-tools/quarto-course/_extensions/course-core/entrypoints/post.ts:19` validates adapter CUE before `finalizeAssessmentPreview` at `:21`; `/home/tolya/course-tools/quarto-course/_extensions/course-core/entrypoints/preview.ts:77` only removes final HTML assignment markup. Search was generated earlier, and `/home/tolya/course-tools/quarto-course/_extensions/course-core/infrastructure/native-run.ts:213` cleans resources before this projection. Consequently:
   - `/tmp/moodle-runtime-20261008/privacy-stage/_site-student/search.json` retains `?exr-manual`/`?exr-choice` on work-one/work-two after their HTML assignments are omitted.
   - A focused student render removes a restricted assignment's attachment link yet retains `/tmp/core-bundle-review-20261008/assignment-resource/_site/private-attachment.txt` with `PRIVATE_ASSIGNMENT_ATTACHMENT_BYTES`; the current index.qmd resource facts still list it in projectedUses. Native exit 0: `/tmp/core-bundle-review-20261008/assignment-resource.log`.
   - `/tmp/prairielearn-runtime-20261008/java.log:134` and `:139` show legitimate student works refused by PL001_externalAssessmentMembers because projected exercises are absent while the assessment DTO still names restricted members.
   Complete the existing public projection before projected-model/adapter validation and keep search/resource facts and cleanup consistent with the final output. Preserve strict raw declarations/compositions and adapter predicates; no registry, additional render, or parser is needed to justify weakening them.

3. **[P2] The public-solution witness skips ordinary native containers.** `/home/tolya/course-tools/quarto-course/_extensions/course-core/filter.lua:76` only traverses Div children. BlockQuote/list/Note/table children are ignored, so an open demonstration with its anonymous solution in a normal blockquote renders that solution publicly but hasPublicSolution is overwritten false in post. Its valid stage=demonstration then fails CORE.ASSESSMENT_INVALID. One focused native RED is `/tmp/core-bundle-review-20261008/quoted-solution.log`; actual solution HTML is `/tmp/core-bundle-review-20261008/quoted-solution/_site/index.html:164`. Traverse the relevant native AST containers while retaining only opaque markers and native conditional wrappers.

4. **[P2] The independent release API accepts explicit invalid stage values.** `/home/tolya/course-tools/quarto-course/_extensions/course-core/domain/release.ts:105` uses a truthiness check for optional stage. Both stage="" and stage=null are accepted although only absence or the three vocabulary values are valid. `/tmp/core-bundle-review-20261008/invalid-stage.log` records both acceptances from a focused assembleRelease call. Lua/CUE rejection does not replace the contract's independent API guard. Test presence against undefined and validate every present value.

5. **[P2] Namespace-only reference validation still changes ordinary Quarto outside the bank.** `/home/tolya/course-tools/quarto-course/_extensions/course-core/native-document.lua:208` rejects any explicit local exr/exm/sol anchor when absent, regardless of exercise-bank or explicit Course ownership. Plain native `[Missing native anchor](#exr-missing)` renders exit 0, while the same outside-bank document with Core fails CORE.PROFILE_REFERENCE_INTEGRITY. Evidence: `/tmp/core-bundle-review-20261008/outside-bank-links-native.log` and `outside-bank-links-core.log`. Scope the guard to bank/explicit Course declarations while retaining Course-owned integrity checks.

## Minor

- None required for this gate.

# Checks and Scope

- Read the prepared diff in focused runtime/schema, docs/examples, and regression passes; no Git diff regeneration or checkout/index/HEAD mutation. Read changed producer/release/native-run fragments where hunks cut functions.
- Named unchanged-code checks: native resource collection/cleanup for late assignment resource privacy; native references for outside-bank parity; package.json for new-test dispatcher coverage. Each check addressed a concrete changed-boundary risk.
- Inspected genuine existing native GREEN logs: outside-bank-green, native-witness-green, source-nodes-green, witness-authoring-green, ownership-fingerprint, native-document-finalfocused, visibility-finalfocused, presentation-finalfocused, windows-current. Project-root CUE cleanup evidence is `/tmp/core-runtime-20261008/cue-temp-green.log` (2 cases); cue-current-green.log itself ends with canonical-model evidence.
- Inspected the existing practical/test public native Body artifacts under `/tmp/core-docs-course-check-btyhp247/_generated`: all questions are restricted, assignments keys equal qualified items, preview is absent, and closedKey/solution/gradingNotes keys are absent from both public packages. These prepared artifacts do not replace the pending final suite.
- Ran only focused tests for unanswered concrete risks: one quoted-solution render, one restricted assignment attachment render, one Bootstrap Source render, two native/Core anchor parity renders, and one small standalone API probe. No broad/repeated suites or agents.
- Native exit-0 crossref warnings are retained and accepted by the binding contract. They are not a finding or a reason to add regex refusal, stubs, or another render.

# Assessment

**Task quality: Needs fixes.** The raw/model/Body architecture is appropriately bounded, but the confirmed privacy and projection-order defects prevent approval of aa5a817. Re-review the scoped fixes and obtain the existing final-suite result before promotion.
