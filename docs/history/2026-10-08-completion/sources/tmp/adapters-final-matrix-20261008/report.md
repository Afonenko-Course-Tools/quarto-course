# Frozen Core: final adapters native matrix — 2026-10-08

Scope: approved linear steps 8–11 final native validation only. No source/runtime/docs/spec/examples/descriptor/workflow mutations, no CI, push, commits, tags, releases or worktree operations. All commands run against existing clean adapter checkouts and frozen Core archive.

Core: `0ddb4638df096bf4969cb0f30c99e1e7dde9b095` at `/tmp/consumers-final-integration-20261008/snapshots/quarto-course`. Exact comparison of all 212 tracked `_extensions` and `tests` files against that Git SHA passed with zero mismatches; full per-file SHA-256 in [core-manifest.json](core-manifest.json). Existing adapter source HEADs and tracked-byte SHA-256 in [source-manifest.json](source-manifest.json); after-check evidence in [source-after.json](source-after.json).

- quarto-course-print: `37ddc8fe7afebc227ad7b56818525f4cc8ee5dd3`
- quarto-course-moodle: `da3e28bb15b7ed0df256bcb7daa159e56d74e970`
- quarto-course-prairielearn: `f12372ca7b789377e8c98c69bacf3b837c7cecb2`
- quarto-course-cloud: `d7963d6eeeedf50a4f042ba41bce7945ea376318`
- quarto-project-download: `f16f22f3fa9180e3b7d055a8481ffb01027ac532`

Environment: Quarto 1.11.5, Deno 2.9.7, CUE 0.17.1, Java 25.0.4.1 and actual Gradle 9.8.0. [environment.json](environment.json). Each owner uses separate fresh writable XDG_CACHE_HOME, XDG_DATA_HOME and IPYTHONDIR; CUE absolute local binary, JAVA_HOME=/usr/lib/jvm/java-25-openjdk. Native Java command ran with approved escalation for Gradle local socket use. Max two independent owners concurrently; all owner commands serial within each runner. [run-owner.sh](run-owner.sh) records exact commands, UTC start/end and process exits.

| Owner | Check | Exit | Command (environment from runner) | Log |
| --- | --- | --- | --- | --- |
| quarto-course-print | `check` | 0 | `bash tools/check.sh` | [check.log](quarto-course-print/check.log) |
| quarto-course-print | `demo` | 0 | `bash tools/check-demo.sh` | [demo.log](quarto-course-print/demo.log) |
| quarto-course-moodle | `check` | 0 | `bash tools/check.sh` | [check.log](quarto-course-moodle/check.log) |
| quarto-course-moodle | `demo` | 0 | `bash tools/check-demo.sh` | [demo.log](quarto-course-moodle/demo.log) |
| quarto-course-prairielearn | `identity` | 0 | `quarto run tests/identity.ts /tmp/consumers-final-integration-20261008/snapshots/quarto-course` | [identity.log](quarto-course-prairielearn/identity.log) |
| quarto-course-prairielearn | `java` | 0 | `bash tools/check-java.sh` | [java.log](quarto-course-prairielearn/java.log) |
| quarto-course-prairielearn | `model` | 0 | `quarto run tests/native-model.ts /tmp/consumers-final-integration-20261008/snapshots/quarto-course` | [model.log](quarto-course-prairielearn/model.log) |
| quarto-course-prairielearn | `ordinary` | 0 | `quarto run tests/native-ordinary.ts /tmp/consumers-final-integration-20261008/snapshots/quarto-course` | [ordinary.log](quarto-course-prairielearn/ordinary.log) |
| quarto-course-prairielearn | `policy` | 0 | `quarto run tests/check.ts /tmp/consumers-final-integration-20261008/snapshots/quarto-course` | [policy.log](quarto-course-prairielearn/policy.log) |
| quarto-course-cloud | `check` | 0 | `quarto run tests/check.ts /tmp/consumers-final-integration-20261008/snapshots/quarto-course` | [check.log](quarto-course-cloud/check.log) |
| quarto-course-cloud | `demo` | 0 | `bash tools/check-demo.sh` | [demo.log](quarto-course-cloud/demo.log) |
| quarto-course-cloud | `model` | 0 | `quarto run tests/native-model.ts /tmp/consumers-final-integration-20261008/snapshots/quarto-course` | [model.log](quarto-course-cloud/model.log) |
| quarto-course-cloud | `ordinary` | 0 | `quarto run tests/native-ordinary.ts /tmp/consumers-final-integration-20261008/snapshots/quarto-course` | [ordinary.log](quarto-course-cloud/ordinary.log) |
| quarto-project-download | `check` | 0 | `bash tools/check.sh` | [check.log](quarto-project-download/check.log) |

## Actual native results

- Print: full own suite **56 passed / 0 failed**, isolated installed CLI, student safe participant package and real PDF. Demo student→full→student passes; ordinary.pdf and two selected handout PDFs created. All three parsed with pdfinfo/pdftotext, byte hashes and extracted native text preserved in [artifacts.json](artifacts.json). [native proof](quarto-course-print/demo-proof/native-proof.json) failures empty.
- Moodle: full own suite **84 passed / 0 failed**, installed CLI, actual teacher XML and student public package/privacy, including previously blocked native search privacy. Demo student→full→student passes; real ElementTree parse confirms two questions per XML, variant-a no correct choice, variant-b exactly one 100%-correct choice. Key-use proof true only for selected variant-b. [native proof](quarto-course-moodle/demo-proof/native-proof.json) failures empty; hashes/counts in artifacts.json. No live LMS import claimed.
- PrairieLearn: actual offline Java25/Gradle9.8 reference build says **All six Clamp checks passed**; student starter intentionally fails UnsupportedOperationException. Wrapper exit0 proves expected failure assertion, actual installed CLI delivery and unknown-work/no-delivery guard, student→full→student chapter/navigation/search/private-note privacy. Full native policy/CUE suite, ordinary non-bank Quarto, identity and model/PL001 tests exit0. Named PL001 refusal retained, no adapter/Core workaround. Ready local demo BUILD.sourceDirty false and exact tested source SHA.
- Cloud: installed native full/student projection matrix and raw VM/platform guards exit0; restricted student work membership omitted and full membership preserved; unknown cross-document membership deferred locally. Existing VM refusals including CLOUD005_declaredVm retained. Ordinary non-bank model and demo wrappers exit0.
- Download: owner full wrapper uses existing tools/check.sh (no tools/precheck.sh exists). It runs diagnostics/archive/render/ownership/native/native-installed plus namespaced/plain/active install contexts. Fresh logs confirm actual ZIP/private policy, Core/CUE-free standalone route, resource/ownership/SHA-256/current document/retry/isolation guards. Final wrapper exit recorded above.

Cloud has no tools/check.sh; actual owner full native entrypoint is quarto run tests/check.ts CORE. These file-name differences were reported to root before execution; no new scripts added to owners.

## Interpretation and remaining route

Native writer crossref warnings remain visible in logs according to approved source-context policy; successful wrapper exit0 is not substituted by warning text matching. Controlled expected refusals (student starter, named policies, foreign process streams, unavailable profiles) are asserted by existing suites; no unexpected owner command failure was observed.

This report is local integration evidence only. Root owns linear completion mark, final review/CI/merge/release/demo release assets/gh-pages/Cybersecurity PR/branch cleanup. Existing outputs in this tmp directory are verification evidence, not released assets.

Final result: **14/14 owner commands exit0**, all launched sessions awaited actual completion. No unexpected failures and no new fixes required. All five source HEADs, clean status and tracked-byte hashes unchanged after final command.
