# Core final branch review — 2026-10-08

## Spec compliance

**Approved** for the Core branch readiness gate at `da6d68f2ef6be56cdf3a2a8f9cc9fca13f6478a9`. No new Critical, Important, or required Minor findings.

The full runtime review chain is retained: original `75ba768..aa5a817` review found five Important issues; round1 corrections addressed them; round2 `95bc249..0ddb463` review approved the authoritative assignment Cite and ordinary native paired-solution corrections. The final `0ddb463..da6d68f` delta contains 21 documentation/example-pin files and no changes under `_extensions`, `tools`, `tests`, package metadata/lock, or workflows. Runtime remains exactly the reviewed and locally tested `0ddb463` tree.

The final preparation package was read in focused passes and independently compared with the actual Git range: both SHA-256 digests are `6789ea3121bbbcc4b51e24a86d013e183b50a47def3329387c2f291589db6165`. HEAD was still `da6d68f2ef6be56cdf3a2a8f9cc9fca13f6478a9`, with a clean working tree, at the final check.

## Strengths and alignment

- `spec/index.md:11` distinguishes current normative ownership from immutable-tag release evidence; all three extension descriptors declare 4.0.0 and require Quarto >=1.11.5. The current topical contracts, README, and version pins agree. The accepted-next document is a historical redirect; the original accepted content remains in Git and final step 18 owns its deletion.
- `spec/learning-elements.md:158` retains actual native `hasPublicSolution` rather than raw existence for demonstration, including the native JSON-format limitation. Optional stage, required/individual defaults, ordered assignments, restricted-only practical/test, and finite theory time remain consistent with the already reviewed runtime and CUE/API guards.
- `docs/body-export.md:118` explicitly separates local Core assignment keys from qualified Body items/map keys. `:128` distinguishes restricted website policy from participant-safe `visibility: public`; closed keys, solutions, grading notes, preview, and external work structure remain excluded from participant conditions. Internal task headings remain supported.
- README/spec/NativeRun describe the real Bootstrap Source AST removal, inert native assignment markup during search indexing, late resource cleanup, raw validation before projection, and bounded current-run configuration witness. They preserve ordinary outside-bank native behavior and do not add a second render, parser, or shared runtime.
- `examples/course/README.md:52`, Taskfile, BUILD dependency, and source URLs consistently pin v4.0.0 and require the same clean producer SHA for tool/demo. Preparing pins does not assert an existing ready asset. The README minimal book configuration now uses native `book.chapters`.
- Global steps 3–7 record implementation/local gates; 8–11 and 12 onward remain pending. The new OPEN Cybersecurity PR route at `docs/plans/2026-10-08-course-tools-implementation.md:173` reflects the recorded direct user authorization and preserves the no-merge/no-deploy course boundary.

## Verification evidence inspected

- Fresh read-only `git diff --check 0ddb463..da6d68f`: exit 0.
- Fresh `node tools/sync-contract.mjs --check`: exit 0, Lua/TypeScript/CUE dictionaries agree.
- Fresh local Markdown target check over the explicitly selected topical documents, historical redirect, and example READMEs: 65 links, zero missing, exit 0. This selected set also includes the ordinary style-guide example README; it is slightly larger than the previous 64-link gate.
- Inspected `/tmp/core-bundle-review-20261008/rereview-round2.md`: scoped Approved; all five original issues and the round1 attachment-fragment issue addressed.
- Inspected the final section of `/tmp/core-runtime-20261008/report.md` and `/tmp/core-runtime-20261008/full-round2.log`: controller records actual session38878 exit 0 at frozen runtime `0ddb463`; log ends `PASS --native; evidence /tmp/course-native-check-20261008-045220`. This report supersedes its explicitly historical pending/environment-failure sections.
- Inspected `/tmp/course-native-check-20261008-045220/browser.log`: navigation, Presentation, and unified native browser commands are present; final unified notes/session/hash/print/PDF PASS is recorded.
- Inspected final authored-example report and student/full/Reveal/selected-export log tails under `/tmp/core-docs-final-qrc62ext`: current six-document books, native Reveal output, and selected seminar/practical/test 3/1/2-question exports. The report records exit 0 for each, deliberate Bootstrap Source override, current-only partial render, participant privacy, qualified assignments, and correct totals. `condition.txt` independently retains the practical task's internal heading and condition without preview/work heading/private content.

The full npm/native/browser suites were not rerun by this reviewer. Their actual completed result belongs to the controller's frozen-runtime gate, whose artifacts were inspected and whose runtime equality was checked. No checkout/index/HEAD mutation, broad crawl, or additional agent was used.

## Issues

- Critical: none.
- Important: none remaining.
- Minor requiring correction before the next gate: none.

## Considered but deferred to the planned owner gates

- Remote CI, PR checks, merge, immutable v4.0.0 publication, tagged installation/live Source links, and ready asset hashes/provenance: these are explicitly upcoming controller gates, not assertions made by this local review.
- Actual Windows execution or a new upstream recoverEncode reproduction: not performed here. Core's existing conditional “может” guidance does not claim an actual Windows pass or a Quarto fix; the recorded 13 writer-path cases are Linux/native Lua simulations.
- Final adapter matrix, consumer release integration, template/gh-pages publication, Cybersecurity PR, and branch/history cleanup: separate active steps and owner gates, with no new implementation in this Core final delta.
- Historical preparation blobs and the initial 147-record snapshot audit: already reviewed preparation history, intentionally not redundantly re-audited.

## Task quality and assessment

**Task quality: Approved.** The final delta promotes the implemented contract accurately, keeps release evidence separate, and aligns native examples/pins without changing the frozen runtime or weakening its independent guards.

**Ready to advance to PR/CI: Yes.** This is a local complete-branch review gate, not a claim that remote checks, merge, release, or the overall 18-step user plan are complete. Proceed with the planned Core PR/CI/merge/release sequence and same-SHA demo provenance checks.
