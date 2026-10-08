# Exact step 17/18 execution preflight — 2026-10-08

Read-only preparation. No branch deletion, detach, refs change, file change in an owner, Release mutation, fetch or publication was executed. Course step 16 is still the parent's active work; complete its real OPEN PR/CI and live site gates before cleanup. This fresh inventory supplements the earlier 147-blob preservation verification; it does not repeat broad historical tree analysis.

## Fresh live keep-set and deletion delta

Machine source: `step17-inventory.json`. Collector: `/tmp/step17-dry-run-20261008.py`; this is a bounded one-off inspection script for the nine fixed existing repositories and never executes its proposed mutation argv. Read-only GitHub API, `git ls-remote`, local ancestry/worktree checks were actually run. All nine primary checkouts are clean; every local main equals actual live remote main; **all 44 local / 9 actual remote deletion candidates have 0 unique commits against actual remote main**. No human/unclassified OPEN PR or fork head was found.

| Owner | Keep actual branch names | Local delete candidates | Actual remote delete candidates |
| --- | --- | ---: | ---: |
| Core | main; dependabot/npm_and_yarn/playwright-1.63.0 | 9 | 1 |
| Publisher | main | 3 | 1 |
| QRC | main; dependabot/npm_and_yarn/playwright-1.63.0 | 5 | 1 |
| Print | main | 3 | 1 |
| Moodle | main | 3 | 1 |
| PrairieLearn | main | 3 | 1 |
| Cloud | main | 3 | 1 |
| Download | main | 3 | 1 |
| Template | main; gh-pages | 12 | 1 |

The **only actual remote deletion candidate in each of the nine repos** is `refs/heads/feat/authoring-model-20261008`, with its exact observed SHA in the inventory. Old remote-tracking entries printed by `git branch -a` are stale local refs, not extra live server branches; do not issue deletes for nonexistent remote names. The machine inventory contains every exact local candidate name/SHA and all remote tags, including annotated peeled refs.

API-confirmed automation keep evidence:

- Core OPEN [PR #4](https://github.com/Afonenko-Course-Tools/quarto-course/pull/4): REST actor `dependabot[bot]`, type **Bot**, corresponding commit author type/login also Bot/Dependabot; same-repository head `dependabot/npm_and_yarn/playwright-1.63.0` at **`8968c8da141d00651606d3fdf333bab7f13b9fb0`**.
- QRC OPEN [PR #5](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog/pull/5): the same REST Bot and commit-origin evidence; same-repository head `dependabot/npm_and_yarn/playwright-1.63.0` at **`8d88a3272d73f6d868f3c7bd2b6ad84a743081c6`**.

These heads are kept from API actor/origin evidence, not branch spelling. No other OPEN PR was returned for the nine tools/template. Cybersecurity repositories/branches are wholly excluded from candidate generation and deletion.

Template live API now reports legacy Pages **built**, source `{branch: gh-pages, path: /}`, latest build **`a55b0e399febec10b9dec4a87273adb5b603e732`**, no build error; template main is **`8b050033b594eeae4270ca6f55f12a1d6e8f1243`**. URL: [published documentation](https://afonenko-course-tools.github.io/quarto-template-course/). This is actual API publication state; it is not a substitute for the root's live guide/source/search/resource QA.

## Worktrees/history guard and practical sequence

All **13 original additional checkout paths** retain their original HEAD and clean status. Their raw tracked bytes match the recorded HEAD's Git blobs, and no untracked files were found. The inventory records per-path HEAD, tracked-byte map digest, status/diff digests, untracked hashes and raw-blob equality. Twelve extra tool/template worktrees plus the excluded separate `cybersecurity-implementation` checkout are covered. Core's body-baseline is already detached; Core's other three and Template's eight occupy branches proposed for deletion, hence **11 same-HEAD detach operations** are needed. Keep every directory and every tracked/ignored/generated file in place. No worktree remove/archive/reset is proposed.

After step 16, root should execute this bounded sequence:

1. Save needed current ignored/untracked receipts/journals in existing owner Git. The 0-unique result means old branches' commits are already reachable from live main, but meaningful ignored new evidence still needs the pending history commit. Do not equate local `/tmp` staging with durable preservation.
2. Refresh the collector immediately before mutations, save that result as the **before** inventory and recheck the same live OPEN bot heads/keep-set/main SHA. Stop only the affected candidate if its SHA/keep status/ancestry/worktree bytes changed; preserve/integrate any new unique material before deletion. No broad historical re-analysis is needed for unchanged ancestors.
3. For each of the 11 occupied candidate branches, recheck the recorded guard then `git -C EXACT_WORKTREE switch --detach EXACT_EXISTING_HEAD`. Compare HEAD, tracked-byte digest, status and untracked hashes immediately afterward. This changes the branch attachment only; paths and contents stay intact. Do not detach a kept main/gh-pages/bot branch or any course branch.
4. Delete each exact local candidate using `git -C OWNER branch -d NAME`. The machine's `proposedMutationArgvNotExecuted` supplies exact arguments; do not use wildcard selection or force deletion to bypass a failed guard.
5. Delete each actual remote candidate with an exact SHA lease, e.g. `git -C OWNER push --force-with-lease=refs/heads/NAME:OBSERVED_SHA origin :refs/heads/NAME`, after another fresh keep-set/ref check. This protects a concurrent new commit. The inventory's nine exact remote argv are proposals only, not executed here.
6. Prune only stale origin branch-tracking refs, explicitly suppressing tag pruning: `git -C OWNER -c fetch.pruneTags=false -c remote.origin.pruneTags=false fetch --prune --no-tags origin '+refs/heads/*:refs/remotes/origin/*'`. Preserve origin/HEAD → main. Tags and Releases are never deletion targets.
7. Save an **after** inventory. Compare every remote tag SHA, including peeled annotated refs, and every Release id/tag/immutable/publishedAt/asset id/name/size/digest to the before snapshot. Compare all 13 extra checkout guards again. Verify actual heads equal the fresh keep-set, native gh-pages still serves the recorded/latest revision and the real course PR stays OPEN. Preserve the compact before/after result in Git before final history cleanup.

The inventory records all **59 existing Releases**, with exact IDs, tags, immutable flags, published timestamps and asset IDs/names/sizes/digests. Null digest/immutable values are retained honestly. It includes complete local tag refs and live remote tag/peeled maps. The comparison must tolerate API order by sorting IDs/names, while requiring metadata equality. Do not add, replace or remove tags/assets/Releases in this phase.

## Pending durable preservation

Parent's `/tmp/implementation-final-preservation-20261008/SOURCE-MAP.json` currently contains **243 files / 2,062,364 bytes**. This review verified every staged file's recorded SHA256 and every current source's current bytes: **0 staged hash mismatches; 0 changed current sources** at capture. `current-staging-check.json` records that result.

The staging map intentionally contains compact receipts/helpers/central ledger/START/AGENTS; it contains **no current owner/global plans and no Core transition stub**. Those are already tracked, but the parent must append final owner journal results and make the **first preservation commit** before their removal, or add exact latest copies/maps to staged history. Likewise add final course/step17 before-after receipts and these final preparation/review reports, then rerun the stage hashes. Do not claim the current 243-file stage alone preserves the later execution journals.

Keep original root AGENTS in place. Preserve the current START before rewriting it. Initial 147 records and two course root docs already verified historical bytes; root archives/PR snapshot/migration bundles outside those maps remain in place unless independently saved. No root directory purge is proposed.

## Step 18 exact changes after the first history commit

Fresh map: `step18-owner-link-map.json`. Current template future-policy defects are fixed; the remaining active links concern intentionally in-progress execution plans. Remove **11 exact completed-plan/stub files** after their latest versions are Git-saved: nine owner `docs/plans/2026-10-08-implementation.md`, Core `docs/plans/2026-10-08-course-tools-implementation.md`, Core `spec/authoring-model-next.md`.

Create a compact `docs/releases/2026-10-08-implementation.md` in each owner; link checks/results there and normative rules to current topical/spec indexes. Recommended active-link edits:

| Owner | Exact current locations | Replacement |
| --- | --- | --- |
| Core | spec/index.md:34 | Current release/execution report instead of linear plan. |
| Publisher | spec/index.md:20; docs/history-index.md:11 | Execution report row and concise current-result sentence. |
| QRC | spec/index.md:23; docs/history-index.md:11 | Same. |
| Print | spec/index.md:21,26 | Owner report row/trailing result link. |
| Moodle | spec/index.md:21,26 | Same. |
| PrairieLearn | spec/index.md:21,26 | Same. |
| Cloud | spec/index.md:21; docs/history-index.md:11 | Owner report row/current-result sentence. |
| Download | spec/index.md:21; docs/history-index.md:11 | Same. |
| Template | README.md:57; spec/index.md:20,23; spec/site.md:18 | Actual publication/report route, with exact published main/gh-pages/site receipt; remove completed global-plan route. |

For Print/Moodle/PL/Template, the six old historical metadata files under `docs/history/2026-10-08/` are listed exactly in the map (24 files total). If root removes them from active tree, their first preservation commit must remain reachable and spec index history rows (`:22` in adapters, `:21` Template) must use precise historical `https://github.com/OWNER/REPO/blob/HISTORY_SHA/docs/history/2026-10-08/README.md` links or a concise recovery index. Preserve actual SHA, not a fabricated tag/path. Existing historical Git-show/GitHub blob links are valid after file removal. Four current `docs/history-index.md` files can stay concise recovery links; remove obsolete future-plan wording.

In the **second commit**, perform completed-plan/stub/historical cleanup and navigation updates. Do not overwrite the immutable tool/demo tags to include documentation cleanup. Product code/examples/pins/runtime remain the released versions; a later docs/history main SHA is recorded separately from each published source SHA. If Template main advances for excluded docs/history only, record both final main and the actually published site main rather than mislabeling the site revision; parent can republish with the same native Task path when necessary.

Root START becomes a short route to Core/consumer/template current spec indexes, the published Russian guide/site, compact Core completion report and the **actual new OPEN Cybersecurity PR URL after it exists**. No completed execution plan remains a current START route. Keep original AGENTS. Run fresh diff/text/local-link checks on the exact edited files; no new parser/docs generator/runtime is needed.

## Compact current report layout

Core's report is the central handoff; other owners need only their own result plus direct source/receipt links. Keep the report factual and short:

1. Actual start 02:36 Minsk, deadline 11:36 (08:36 UTC), actual finish/elapsed; completed/remaining gates honestly, actual reasoning settings.
2. Eight-tool table: exact tag/source SHA/immutable Release URL/dependency pins/remote-tag byte-install proof; seven demo Releases/eight groups with same own-tool SHA, sourceDirty false, exact archive/tree verification.
3. Local native/five regression results and exact PR/main CI URLs, with preserved compact receipt paths rather than bulky generated artifacts. Include template 62-file vendor/549-file resources/61-page/2459-link/literal-guide proof.
4. Site: actual published main `8b050033…`, native gh-pages `a55b0e3…`, Pages legacy branch source and successful build, URL and real live QA results. Separate later docs-only main from published main.
5. Real newly created OPEN course PR/head/CI/pins/privacy/strict-child result; PR #3 remains historical MERGED, no course merge/deploy, all course branches untouched.
6. Step17 before/after counts and keep-set, tags/Releases unchanged, all13 user checkout guard comparisons, exact durable history commit/map recovery links; final active docs/README/spec/guide consistency checks.
7. Accepted rulings/limits: one native source/projection path; current actual public-solution JSON witness and portable solution container; Source AST masking and inert deferred assignment wire; qualified assignments/time/partial omission; restricted participant without key/solution/gradingNotes/preview; released-QRC Publisher compatibility CI cycle vs final ready pin; native crossref warnings remain Quarto behavior; only narrow fixture-confirmed Windows fixes/no native Windows session claim; no live PL/Moodle/Cloud platform claim, no common runtime/parser/dependency manager.

Do not fill pending course/live-QA/cleanup/final finish values from expectations. Root's actual final receipts determine them. No further questions are needed for the accepted route.
