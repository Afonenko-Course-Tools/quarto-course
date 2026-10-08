# Consumer CI pin review — 2026-10-08

**Approved.** No Critical, Important, or Minor findings in the narrow eight-line machine CI pin delta.

Scope: fresh read-only review of six owner HEAD commits, their parent diffs and actual workflow bytes, plus supplied publication receipts and the dated dependency gate. No network, test suite, owner edit, commit, push, PR, CI dispatch, merge or release performed. Only this report was written.

| Owner HEAD | Checkout location and resulting dependency |
| --- | --- |
| Publisher `9fe75a0d35022f80243bf3f2a45593b39067478a` | `.github/workflows/ci.yml`: Core `v4.0.0` at `quarto-course`; published QRC `v2.2.1` at `quarto-reference-catalog` |
| Print `ee9eead46b208ae0acc114cf0552446d98feb544` | `.github/workflows/ci.yml`: Core `v4.0.0` at `core-fixture` |
| Moodle `3c5bcaf95965081f1c21846d90d6fa636aefb173` | `.github/workflows/ci.yml`: Core `v4.0.0` at `core-fixture` |
| PrairieLearn `b0538369d5a4387d243f81dcc7df888bffa08bcf` | `.github/workflows/ci.yml`: Core `v4.0.0` at `.ci-deps/core` in both check and java-delivery jobs |
| Cloud `ad836df100388a850b941752caf1dbc8fbe0de04` | `.github/workflows/ci.yml`: Core `v4.0.0` at `.ci-deps/core` |
| Download `ffbc71eafbb0a8d9a0e7c111ef4aa03b24304b11` | `.github/workflows/check.yml`: Core `v4.0.0` at `core-fixture` |

Each current HEAD equals `actual-ci-pin-commits.json`; each parent equals the prepared reviewed parent. Each commit changes exactly its one listed workflow and only the displayed ref lines. All six owner trees are clean; each actual SHA-256 equals `actual-workflow-validation.json`. The complete actual `git show` delta matches `core-consumers-machine.diff`. No repository/path/job/action SHA/permissions/matrix/test-command changes occur. Quarto remains 1.11.5; prior job and required-check structure is preserved.

The applied receipt records Core `v4.0.0`, immutable Release ID `406364109`, exact SHA `d58494171e3020957b64ed229cbc8537751e3beb`, publication `2026-10-08T03:08:10Z`; published QRC `v2.2.1`, immutable Release ID `405730557`, exact SHA `d06adf5a30f01eec834dd5f2a34f4e6bd9ec99b7`, publication `2026-10-07T12:18:58Z`. These are supplied operation evidence, not a new network verification. Parent reports Core PR/main CI success and the 62-file three-extension native remote install PASS; this review does not rerun them.

The dependency publication gate remains intact: `release_gate.py::published` requires the exact stable published immutable tag, full caller SHA, exact release target_commitish and actual resolved remote tag SHA (including annotated tags). `apply-ci-pins.py` verifies Core and actual published QRC before consumer writes; its separate qrc-after-publisher stage requires actual immutable published Publisher `v5.0.0` and exact SHA before QRC writes. Publisher's current dependency is the actual QRC release rather than its unreleased candidate, preserving the approved release order without a cycle.

QRC is untouched: current HEAD `65ea737237116ac83d106bd0e21d4174d48ef81d`, clean tree, and workflow SHA-256 `f7b6c43e7e40eaf76688e2ea429a564f0ab10e8fa606caf30fa5fd03179b435d` exactly match staging snapshot. It still checks out Publisher candidate `f2b302e75cd764520ab118894bfb024e787abd31`; the later gated Publisher5 replacement remains outstanding by design.

Approval is for this machine CI delta and the next six consumer PR pushes/creation. Fresh final PR CI, normal merge checks, main verification and dependency release gates remain required before publication; no admin bypass is authorized or implied.

Evidence read: `/tmp/release-dependency-staging-20261008/{core-consumers-machine.diff,actual-workflow-validation.json,actual-ci-pin-commits.json,applied-core-consumers.json,report.md,release_gate.py,apply-ci-pins.py,quarto-reference-catalog-snapshot.json}` and the actual seven owner workflow files/Git objects. START and current Core index/18-step plan were read for active scope.
