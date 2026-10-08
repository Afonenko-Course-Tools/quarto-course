# Final prepared consumer branch review — 8 October 2026

Six owners are **Approved** for the prepared branch after the already scheduled final gates. Cloud needs one narrow README correction: remove an unsupported dated reproduction claim and make the path workaround conditional. No new production-runtime, Body privacy, assignment, version or source-provenance defect was found.

## Reviewed inputs and boundary

The supplied manifest and all seven prepared diffs were read directly from `/home/tolya/course-tools/quarto-course/.superpowers/sdd/2026-10-08-course-tools-implementation/consumer-final-review/`. No diff regeneration, checkout/index/HEAD change, suite rerun, CI/remote action, release, additional agent or implementation mutation occurred. Terminal-truncated sections were recovered from the supplied diff; later file reads addressed named documentation/output risks only. This report is the sole created artifact.

| Owner | Previously reviewed runtime base | Prepared HEAD | Planned tool tag |
| --- | --- | --- | --- |
| Publisher | `d8bf688` | `e75ee7e573c03503e24c139523c36dd9389d5752` | `v5.0.0` |
| QRC | `6e56a5e` | `65ea737237116ac83d106bd0e21d4174d48ef81d` | `v3.0.0` |
| Print | `a03a8d8` | `37ddc8fe7afebc227ad7b56818525f4cc8ee5dd3` | `v0.3.0` |
| Moodle | `b374f85` | `da3e28bb15b7ed0df256bcb7daa159e56d74e970` | `v0.3.0` |
| PrairieLearn | `d173cb6` | `f12372ca7b789377e8c98c69bacf3b837c7cecb2` | `v3.0.0` |
| Cloud | `2498481` | `d7963d6eeeedf50a4f042ba41bce7945ea376318` | `v3.0.0` |
| Download | `5aa3a31` | `f16f22f3fa9180e3b7d055a8481ffb01027ac532` | `v2.0.0` |

Authority is the current Core specification index, learning-elements/visibility contracts and Body contract on the prepared Core 4.0.0 ref; the old authoring-model-next document explicitly delegates to those current owners. The approved 18-step plan remains the execution route. Earlier runtime reviews used here are `/tmp/publication-consumers-review-20261008/report.md`, `/tmp/body-adapters-review-20261008/rereview-round1.md`, and `/tmp/platform-adapters-review-20261008/report.md`. Their scope limitations remain visible; this review does not turn a prior preparation pass into a fresh release claim.

The new delta promotes actual normative documentation and example/source/build pins, preserves the removed transitional documents by exact Git commit/blob provenance, and changes descriptor versions. The only test deltas are Publisher's exact missing-hooks diagnostic/assertions and the two QRC source-tag expectations. No production runtime logic changed after the reviewed bases.

## Publisher

- **Spec compliance: Approved.** `/home/tolya/course-tools/quarto-project-publish/spec/contract.md:42` preserves explicit native bank opt-in and independent project identities; line 48 follows Core student projection across mounted HTML/resources/search/catalogs. Line 54 documents native Russian language and each child's own strict-warning setting without changing source-JSON warning policy or composition ownership.
- **Task quality: Approved after remaining gates.** Descriptor `5.0.0`, README install command, Taskfile dependencies, BUILD dependency fields and producer `repo-branch: v5.0.0` agree. The ordinary Publisher/QRC example remains outside Core's bank. `/home/tolya/course-tools/quarto-project-publish/tests/site-domains.ts:410` strengthens the missing-collector assertion to the stable `NATIVE.RUN_NOT_CURRENT` ID, source and field, and checks absent current completion/root/mounted publication. It does not relax the refusal.
- **Critical: none. Important: none. Minor: none.**

Fresh supplied integration evidence covers native/warnings, default/resources/rootless/smoke, native child profiles and both preview routes against frozen Core `0ddb4638df096bf4969cb0f30c99e1e7dde9b095`, all final exit 0. The actual published QRC `v2.2.1` baseline smoke passed; its runtime was exhaustively compared with candidate QRC. Keeping that already released QRC CI dependency until sequential publication avoids the dependency cycle and is intentional staging, not a contradictory example requirement.

## QRC

- **Spec compliance: Approved.** `/home/tolya/course-tools/quarto-reference-catalog/docs/contract.md:39` keeps QRC address-only; Core owns conditions and assignments. Current student/full catalogs and search follow the chosen outputs. Line 46 preserves strict full `QRC.TARGET_UNKNOWN`, local deferral and source-export identity without importing foreign bodies or taking over preview exclusion.
- **Task quality: Approved after remaining gates.** Descriptor/install/Taskfile/BUILD pins agree on QRC `v3.0.0` and Publisher `v5.0.0`; native source refs consistently use the QRC tool tag. `/home/tolya/course-tools/quarto-reference-catalog/tests/example.ts:76` and `tests/demo-external.ts:15` update only expected source refs. Exact native action/duplicate/count/privacy guards are preserved. `/home/tolya/course-tools/quarto-reference-catalog/examples/course/README.md:25` makes tool/demo provenance and clean-source requirements explicit; both QRC groups remain ordinary Quarto without bank requirements.
- **Critical: none. Important: none. Minor: none.**

Supplied final composition/example/export-context/current-output/search/native-local/HTTP imports/external/browser evidence is final exit 0. `final-tested-inputs.json` names this exact QRC HEAD and records exhaustive runtime/test/schema/example equality with tested snapshots. The future GitHub source URLs have not been treated as already published or remotely verified.

## Print

- **Spec compliance: Approved.** `/home/tolya/course-tools/quarto-course-print/docs/public-body.md:16` retains `course-body-package-v1`; lines 23–27 distinguish website statement policy from participant-safe visibility while excluding closed keys/solutions/notes for every package question. Lines 29–49 require qualified exact assignments, four kinds, optional stage and positive finite fractional theoryTime, and the Core demonstration/test/practical conjunctions. Producer-owned preview/external-prose exclusion and internal condition headings remain explicit at line 53.
- **Task quality: Approved after remaining gates.** Version/install/source/BUILD dependency fields align on Print `v0.3.0` and Core `v4.0.0`. `/home/tolya/course-tools/quarto-course-print/examples/paper/README.md:17` installs Print at the group root and Core in bank; the unchanged build resolver accepts the resulting namespaced installations and calls `collectExport` with the returned source context. Lines 24–29 require the same clean tool/demo producer SHA. Adding the bank's native repo action and removing the duplicate root code-link is coherent with the source-privacy contract.
- **Critical: none. Important: none. Minor: none.**

The prior rereview closes optional-stage and diagnostic-context findings without weakening non-undefined values or privacy/resource guards. The parent reports the final check wrapper exit 0; real final demo/PDF/install gates remain parent-owned until their complete matrix is recorded.

## Moodle

- **Spec compliance: Approved.** `/home/tolya/course-tools/quarto-course-moodle/spec/export.md:10` preserves teacher Body and explicit binding; line 12 preserves essay/manual and single-choice 100/0 capability. Lines 20–35 align independent statementVisibility/public witness/purpose and qualified exact assignments with Core. Solutions and gradingNotes remain outside questiontext, and work metadata does not create an LMS activity or access policy.
- **Task quality: Approved after remaining gates.** Descriptor/install/source/build fields align on Moodle `v0.3.0` and Core `v4.0.0`. `/home/tolya/course-tools/quarto-course-moodle/examples/questions/README.md:17` matches the unchanged root-adapter/bank-Core build resolver. Its two selected variants and open unassigned preview remain separate. Existing resources, conversion-before-write behavior and external-process evidence are unchanged by the delta.
- **Critical: none. Important: none. Minor: none.**

The prior rereview closes both optional-value findings and metadata diagnostic context while retaining strict malformed-value refusal. The parent reports the final check wrapper exit 0; complete final demo/XML/installed-CLI evidence remains a parent gate.

## PrairieLearn

- **Spec compliance: Approved.** `/home/tolya/course-tools/quarto-course-prairielearn/README.md:39` now requires own bank difficulty/time/policy while target/project remain platform bindings. `/home/tolya/course-tools/quarto-course-prairielearn/docs/authoring.md:139` agrees with Core's multiple ordered task-items, optional stage, Span requirement/work-mode and demonstration/restricted constraints. Lines 148–160 preserve participant-only Body guards and separate qualified assignments from local-ID platform binding/CUE.
- **Task quality: Approved after remaining gates.** Descriptor/install/source/build pins agree on PL `v3.0.0` and Core `v4.0.0`; all three native public projects have producer tag source actions. `/home/tolya/course-tools/quarto-course-prairielearn/docs/authoring.md:166` is confirmed by the focused unchanged writer check at `_extensions/course-prairielearn/application/export.ts:549`: `delivery.json` serializes `works: p.works`, therefore retains the complete assignment map. Client/test/reference partitions and grading behavior remain with their platform owner.
- **Critical: none. Important: none. Minor: none.**

The prior preparation approval deliberately retained PL001 and the unresolved provisional Core-order failure. The final frozen-Core native/installed/student-full-student and genuine Java/Gradle matrix must close that gate; this review has not inferred completion from the documentation promotion or static bank check.

## Cloud

- **Spec compliance: Approved for the Core/Cloud contract.** `/home/tolya/course-tools/quarto-course-cloud/spec/contract.md:41` agrees with explicit bank metadata, own task fields, four work kinds, Core assignment/privacy predicates and native preview. Lines 53–58 keep local Course/CUE identity, existing VM/action/prepare/cloud-step ownership and the absence of Body consumption or VM execution. Descriptor/install/source/build pins align on Cloud `v3.0.0` and Core `v4.0.0`.
- **Task quality: Needs fixes — one documentation finding.**
- **Critical: none. Important: none. Minor: 1.**

### Minor — unsupported dated Cyrillic-path reproduction claim

**File:** `/home/tolya/course-tools/quarto-course-cloud/README.md:16`–18.

The new text says Quarto 1.11.5's `recoverEncode` failure was separately reproduced on a Cyrillic path, then gives an unconditional no-Cyrillic workaround. No precise actual 1.11.5 reproduction is present in the assigned current evidence, and the parent confirms no supporting probe is available. Current Core guidance describes a possible failure; Linux path simulations do not establish native Windows behavior. The previous Cloud README explicitly allowed Cyrillic, so this new factual support restriction should not be justified by an unrecorded run.

**Narrow correction:** use conditional handling without a dated reproduction assertion, for example: «Если Quarto сообщает `recoverEncode` на кириллическом пути, временно используйте путь без кириллицы; адаптер не исправляет это ограничение Quarto». No new runtime change, Windows test or user decision is needed. After that documentation correction, the prepared Cloud branch is Approved subject to its existing final matrix/CI/release gates.

## Download

- **Spec compliance: Approved.** `/home/tolya/course-tools/quarto-project-download/spec/contract.md:50` accurately reflects the reviewed `body.publicExercises`-only bridge: full website facts do not authorize restricted downloads, and participant export visibility does not grant website publication permission. Independent declared resources, current Core public-resource policy, containment, ZIP determinism and ownership remain intact. Line 58 retains cleanup of only the selected output's owned requests/archives.
- **Task quality: Approved after remaining gates.** Descriptor/install/source refs agree on Download `v2.0.0`. `/home/tolya/course-tools/quarto-project-download/examples/materials/_quarto.yml:1`–16 explicitly keeps native strict warnings, Russian language, ordinary resource-only content and the producer tool-tag source action. It does not create a bank or separate Download demo release; those resource scenarios belong to their producer groups.
- **Critical: none. Important: none. Minor: none.**

The prior runtime review approves the removal of raw exercise-fact fallback and its isolated plus installed-native regression coverage. Frozen-Core final native/privacy/install evidence remains a parent gate; no full-teacher fallback or public guard relaxation was introduced by this documentation delta.

## Common documentation and release coherence

- All owners define current by code/descriptor on the same Git ref, mark later main changes unreleased and direct release documentation to the immutable installed tag. Current does not assert that CI or a release already happened. Transitional authoring-next removal is accompanied by exact owner Git commit/blob recovery and source links; no history was discarded by this delta.
- The prepared normative docs remove active 1.10 support and old authoring/requirements/kind aliases. Print/Moodle/PL preserve schema name while documenting the breaking transport fields. Cloud uses local native IDs, and QRC remains address-only. No common runtime, parser, dependency manager, extra full render or docs generator was added.
- `/tmp/consumer-docs-final-20261008/report.md` records 61 duplicate-key-checked YAML/front-matter files, 190 existing local Markdown links, Russian/native-warning/source configurations, 19 canonical tasks, 9 works and 15 ordered assignments, all static checks passing. This is authored-source evidence, not a substitute for actual native outputs or remote source URLs.
- Ready producer groups require tool and `demo-20261008` tags on one clean producer SHA and actual `BUILD.sourceDirty: false`, version, dependency and projection fields. Future exact example pins are intentional pre-tag preparation so both tags can share that SHA; their presence is not a claim that releases/source URLs are already available.

## Already planned remaining gates

1. Apply the one Cloud wording correction and review its narrow delta. Complete and record the ongoing five-adapter frozen-Core matrix, including real demo/PDF/XML, installed CLI/privacy checks and genuine Java/Gradle. No incomplete runner is certified here.
2. Publish Core first after its required final review/checks. Replace consumer CI dependency refs with actually released exact pins in dependency order, preserving the tested Publisher/QRC cycle handling; run required final CI, merge, verify merged SHAs and create new immutable tool releases. Check native Quarto installation from those actual tags.
3. Build the eight authorized producer groups from their final clean merged SHAs, verify actual HTML/PDF/XML/delivery/assets and source/provenance/dependency coherence, then publish the immutable demo group releases. Download has no independent demo release. Remote source actions are checked after their tool tags exist.
4. Complete the accepted template documentation/gh-pages publication, the authorized OPEN Cybersecurity PR work and final owner branch cleanup under the linear plan. Preserve main, service gh-pages, heads of open automatic PRs, tags/Releases and the user's working trees. These are existing controller responsibilities, not a new approval flow.

**Conclusion:** no new runtime blocker. Publisher, QRC, Print, Moodle, PrairieLearn and Download are Approved for the reviewed prepared branches after their scheduled final gates. Cloud becomes Approved after the single conditional README correction and its already planned gates. This report does not certify live CI, releases, postrelease native installs, demo assets, remote source URLs or gh-pages publication.
