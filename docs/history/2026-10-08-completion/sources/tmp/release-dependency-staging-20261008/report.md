# Step 12 infrastructure preparation — 2026-10-08

Preparation only. All writes were confined to `/tmp/release-dependency-staging-20261008`. No owner workflow/descriptor/runtime/test/docs/spec/README/example changes, Git fetch/checkout/reset/tag/index/commit/push, owner PR creation/update, CI dispatch, merge, release or cleanup was performed. Native installs of unpublished tags were not attempted. No model override or subagent was used. Every asynchronous command completed before this handoff.

Read START, current linear step 12 and relevant owner plans/workflow checkout blocks; no owner-local AGENTS.md was found. Existing release helpers/report were inspected but not modified. Root owns final CI/release gates. Its latest message records Core PR26 CI success and merge `d58494171e3020957b64ed229cbc8537751e3beb`; this is the expected future Core4 SHA, not a claim that Core4 is published. Snapshot release API still returned explicit HTTP 404 for Core `v4.0.0`. Application awaits a separate root publication message.

## Fixed delta

`ci-pin-delta.json` contains eight bounded records, nine exact line replacements across seven owners. It records repo/file/oldRef/newRef/dependency, expected count, current owner HEAD/branch and original workflow SHA-256. There is no dependency discovery/parser/resolver.

| Owner | File | Old | New | Count |
|---|---|---|---|---:|
| Publisher | `.github/workflows/ci.yml` | Core `v3.0.2` | Core `v4.0.0` | 1 |
| Publisher | same | QRC candidate `4a636e11f88e29a40d81d8b05ead6ef2e7cb2e82` | actual published QRC `v2.2.1` | 1 |
| Print | `.github/workflows/ci.yml` | Core `v3.0.2` | Core `v4.0.0` | 1 |
| Moodle | `.github/workflows/ci.yml` | Core `v3.0.2` | Core `v4.0.0` | 1 |
| PrairieLearn | `.github/workflows/ci.yml` | Core `v3.0.2` | Core `v4.0.0` | 2 |
| Cloud | `.github/workflows/ci.yml` | Core `v3.0.2` | Core `v4.0.0` | 1 |
| Download | `.github/workflows/check.yml` | Core `v3.0.2` | Core `v4.0.0` | 1 |
| QRC | `.github/workflows/ci.yml` | Publisher candidate `f2b302e75cd764520ab118894bfb024e787abd31` | Publisher `v5.0.0` after its publication | 1 |

QRC has no Core checkout to replace. Publisher uses actual old QRC `v2.2.1` to avoid a release cycle, following root's approved compatibility evidence. That published immutable release's API target is `d06adf5a30f01eec834dd5f2a34f4e6bd9ec99b7`; the apply gate independently verifies the actual tag target too. QRC switches to new Publisher only after Publisher5 has passed CI/merge/release gates. Prepared descriptors already have approved new versions and are untouched.

## Exact execution, after root's publication signal

Default inspection does not call APIs or write owner files:

```bash
python3 /tmp/release-dependency-staging-20261008/apply-ci-pins.py core-consumers
python3 /tmp/release-dependency-staging-20261008/apply-ci-pins.py qrc-after-publisher
```

Only after root explicitly confirms Core4 is published immutable at the expected exact SHA:

```bash
python3 /tmp/release-dependency-staging-20261008/apply-ci-pins.py core-consumers --apply --authorization CORE4-PUBLISHED --core-sha d58494171e3020957b64ed229cbc8537751e3beb --qrc-221-sha d06adf5a30f01eec834dd5f2a34f4e6bd9ec99b7
```

Later, only after Publisher5 is actually published; replace the placeholder with its verified exact merged/released SHA:

```bash
python3 /tmp/release-dependency-staging-20261008/apply-ci-pins.py qrc-after-publisher --apply --authorization CORE4-PUBLISHED --core-sha d58494171e3020957b64ed229cbc8537751e3beb --publisher-sha <ACTUAL_PUBLISHED_PUBLISHER_40_HEX_SHA>
```

The script requires lowercase full 40-hex caller SHAs, stable non-draft published immutable exact Releases, exact `target_commitish`, and exact GitHub tag resolution (including annotated tags). ALL selected owner HEADs, branches, clean porcelain state, workflow hashes and old-pin counts are validated before any write. It writes only the seven explicit workflows, preserves unrelated bytes, and does not stage/commit/push/create PR/dispatch CI. It refuses changed owner heads rather than auto-refreshing its map. Multi-file writes are not transactional against concurrent edits: root should keep selected owners exclusive during the small apply operation. Subsequent review/`git diff --check`/owner PR CI/merge/main SHA/release remain root gates.

## Fresh read-only GitHub inventory

Seven `*-snapshot.json` files retain complete live remote heads/tags, local status/HEAD/branch, settings, OPEN PRs, protection, rules and existing Releases. Eight `*-supplement.json` files retain immutable-release settings and effective `main` rules. Initial sandbox Python network calls failed, then approved read-only escalation completed; no automatic approval rejection occurred.

All seven prepared owner trees were clean at their exact recorded HEADs. All eight immutable-release settings report `enabled:true`. Seven classic protection endpoints explicitly returned `Branch not protected (HTTP 404)`; repository rulesets and all eight effective main rule sets are empty. Absence of enforced branch protection does not waive the authorized final CI gates.

Preserve automatic OPEN PR heads exactly:

- QRC #5: `dependabot/npm_and_yarn/playwright-1.63.0`, `8d88a3272d73f6d868f3c7bd2b6ad84a743081c6`.
- Core #4: `dependabot/npm_and_yarn/playwright-1.63.0`, `8968c8da141d00651606d3fdf333bab7f13b9fb0`.

No other consumer OPEN PRs were present at snapshot time. This does not assert future refs/PR state; root must refresh before eventual cleanup. No cleanup is included here.

## Every-tool postrelease native installation

`verify-tag-install.py` accepts one of the eight fixed tools and its actual released SHA. `tool-tags.json` fixes Core4/Publisher5/QRC3/Print0.3/Moodle0.3/PL3/Cloud3/Download2. Default mode prints the exact native operation without any API/install/mutation. Execution requires the same strict immutable release/tag SHA gates and Quarto **1.11.5**; it reads `_extensions` from the exact supplied SHA in the existing owner Git object database, without fetch/checkout. After native `quarto add Afonenko-Course-Tools/<repo>@<tag> --no-prompt` in a fresh dated temporary project, it verifies every installed extension and file, exact path sets and every file byte against that Git ref. Direct and GitHub-owner installed namespaces are supported; duplicate/missing extensions, symlinks, foreign extras and non-regular source files fail. Core's full three-extension bundle is checked. The API/tag gate is rechecked after installation. Logs, full SHA-256 map and verified-install receipt stay in the fresh temp project even if a failure occurs.

Run each separately after its actual publication, replacing placeholders:

```bash
python3 /tmp/release-dependency-staging-20261008/verify-tag-install.py quarto-course --execute --sha d58494171e3020957b64ed229cbc8537751e3beb
python3 /tmp/release-dependency-staging-20261008/verify-tag-install.py quarto-project-publish --execute --sha <PUBLISHER_SHA>
python3 /tmp/release-dependency-staging-20261008/verify-tag-install.py quarto-reference-catalog --execute --sha <QRC_SHA>
python3 /tmp/release-dependency-staging-20261008/verify-tag-install.py quarto-course-print --execute --sha <PRINT_SHA>
python3 /tmp/release-dependency-staging-20261008/verify-tag-install.py quarto-course-moodle --execute --sha <MOODLE_SHA>
python3 /tmp/release-dependency-staging-20261008/verify-tag-install.py quarto-course-prairielearn --execute --sha <PL_SHA>
python3 /tmp/release-dependency-staging-20261008/verify-tag-install.py quarto-course-cloud --execute --sha <CLOUD_SHA>
python3 /tmp/release-dependency-staging-20261008/verify-tag-install.py quarto-project-download --execute --sha <DOWNLOAD_SHA>
```

These byte-comparison installs supplement the existing compact-package release helper's descriptor-only installation comparison. They do not replace producer/runtime/demo content gates. Native tag installation has intentionally not executed during preparation.

## Local checks

All dated Python scripts passed `py_compile`. Both apply stages were inspected without network/writes. Every one of the eight native-install command inspections passed. Ten bounded local gate checks are recorded in `local-verification.json`: mocked exact release/tag acceptance; short/mismatched SHA, mutable/draft/prerelease/unpublished/wrong-tag rejection; all nine substitutions against current workflows in memory only; all eight install inspections. These checks verify operation inputs and guards, not actual future Releases, CI or native remote installations.

## Actual authorized Core4 stage executed

Root explicitly confirmed Core `v4.0.0` published immutable (Release ID `406364109`) at `d58494171e3020957b64ed229cbc8537751e3beb`, with both PR/main CI success, and authorized only six owner workflow commits plus actual native Core installation. The earlier preparation-only no-mutation statement describes the initial handoff; this section records the subsequent authorized operation.

The apply script independently verified immutable published exact Core4 and QRC `v2.2.1` release metadata and actual tag resolution; receipts are in `applied-core-consumers.json`. All original prepared heads, clean trees and workflow hashes matched, including Cloud `2ed1667b760507eaf270a0bf8d16ed94f98bfaea`. No auto-adjustment was needed.

`actual-workflow-validation.json` proves exactly eight pin replacements in six workflows, exact original-to-planned byte delta, parsed YAML, expected checkout refs and successful Git whitespace checks. QRC checkout/HEAD/workflow was unchanged. `core-consumers-machine.diff` is the small complete reviewable delta.

| Owner | Workflow-only commit | Parent |
|---|---|---|
| quarto-project-publish | `9fe75a0d35022f80243bf3f2a45593b39067478a` | `e75ee7e573c03503e24c139523c36dd9389d5752` |
| quarto-course-print | `ee9eead46b208ae0acc114cf0552446d98feb544` | `37ddc8fe7afebc227ad7b56818525f4cc8ee5dd3` |
| quarto-course-moodle | `3c5bcaf95965081f1c21846d90d6fa636aefb173` | `da3e28bb15b7ed0df256bcb7daa159e56d74e970` |
| quarto-course-prairielearn | `b0538369d5a4387d243f81dcc7df888bffa08bcf` | `f12372ca7b789377e8c98c69bacf3b837c7cecb2` |
| quarto-course-cloud | `ad836df100388a850b941752caf1dbc8fbe0de04` | `2ed1667b760507eaf270a0bf8d16ed94f98bfaea` |
| quarto-project-download | `ffbc71eafbb0a8d9a0e7c111ef4aa03b24304b11` | `f16f22f3fa9180e3b7d055a8481ffb01027ac532` |

Every commit contains only the specified workflow, has the exact prepared parent and leaves a clean owner tree. The script staged/committed only these files. No docs/spec/README/examples/tests/runtime/descriptors/owner plans were changed; no reset/checkout/push/PR/CI/merge/release/cleanup occurred. QRC remains gated on actual Publisher5 publication. Root reviews machine diff before its next remote actions.

Actual native remote `quarto add Afonenko-Course-Tools/quarto-course@v4.0.0 --no-prompt` on Quarto `1.11.5` returned exit 0. Every installed file/path/byte matched exact Git SHA `d58494171e3020957b64ed229cbc8537751e3beb`: **62 files across course-core, course-navigation and course-presentation**. Actual immutable release/tag metadata was rechecked after installation. No descriptor-only shortcut was used. Full stdout JSON: `core4-native-install.stdout.json`; complete receipt/logs/file SHA-256 map: `/tmp/release-dependency-staging-20261008/quarto-course-v4.0.0-1aobn1ai/verified-install.json`.

All asynchronous calls were awaited and finished with exit 0 before completion. No broader native runtime suite was repeated: these mutations change only release dependency refs; final owner CI remains root responsibility.

## Actual authorized QRC-after-Publisher5 stage executed

Root confirmed Publisher `v5.0.0` published immutable at `215309b5c41669e56a857a1bc3e4f7f2ce782c5f`, with successful PR/main CI and its actual native tag install. Root authorized the single QRC workflow delta. The bounded apply script independently verified both actual immutable Core4 and Publisher5 Releases, exact target_commitish and resolved remote tags before writing. Gate receipt: `applied-qrc-after-publisher.json`.

QRC original HEAD `65ea737237116ac83d106bd0e21d4174d48ef81d`, original branch, clean status and prepared workflow hash matched exactly. One line changed in `.github/workflows/ci.yml`: Publisher candidate `f2b302e75cd764520ab118894bfb024e787abd31` → actual tag `v5.0.0`. Exact source-to-planned delta, YAML parse, checkout repository/ref and Git whitespace checks PASS in `actual-qrc-pin-validation.json`. Review diff: `qrc-after-publisher-machine.diff`.

Workflow-only commit **`4b163a8eecc83238ca58c21de9c886723b4085eb`**, exact parent `65ea737237116ac83d106bd0e21d4174d48ef81d`, clean resulting owner tree. Receipt `actual-qrc-pin-commit.json`. No other owner/files, docs/spec/README/source/runtime/tests/descriptors/plans were edited. No push/PR/CI/merge/release/reset/checkout/cleanup occurred. All asynchronous calls were awaited and completed exit 0. Root owns subsequent PR7 and final CI/merge/QRC3 release gates.
