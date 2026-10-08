# Core 4.0.1: documentation/version preparation

State: scoped documentation/version checks PASS; final runtime regression freeze remains pending. This is an implementation payload, not an independent release approval.

Worktree: `/home/tolya/course-tools/quarto-course-assignment-fix-20261008`.
Base HEAD: `d58494171e3020957b64ed229cbc8537751e3beb`.
Base tree: `9ffba738224caf0a3b1ad0f85a821f1149dbcd75`.
No commit, push, release, course/template edit, runtime edit, broad native test or publication was performed by this documentation worker.

## Concrete changes

- All three bundle descriptors declare 4.0.1; their minimum Quarto remains 1.11.5. The runtime worker owns adding the thin Core `post-quarto` Lua entry under `/tmp/course-core-20261008-commit.lock`.
- Root README, current spec index/visibility/architecture and NativeRun/Presentation/diagnostics prose replace the old inert-template payload claim with the selected public `post-quarto` route. Already-native Quarto item HTML is carried through `quarto.doc.include_text('after-body', ...)` outside `main`; native book resolution supplies the exact address and numeric caption. Search retains work title/preview without deferred assignment text; existing Core post relocates permitted native HTML and removes closed assignments/carriers before publication.
- The index explicitly preserves the 4.0.0 authoring model, schemas, NativeRun and Body public API. There is no new render, hand-built URL/caption, search rewrite or general parser described.
- `examples/course` README, Task installation pins, BUILD dependency and external Source links use `v4.0.1`. Its new ready tag is `demo-20261008-1`, explicitly gated by merged source/pin verification; `BUILD.commit` must match the new immutable tool tag and `sourceDirty` must be false. Existing 4.0.0 releases/assets remain historical and untouched.

## Evidence actually checked

`doc-check-report.json` records SHA256 for each of the 15 scoped files and the exact scoped `doc.diff`.

- Scoped `git diff --check`: PASS.
- 44 prose-local Markdown links after excluding fenced author examples: all paths exist.
- Three descriptor versions, Quarto minimum and example pins: consistent.
- No stale inert-template payload assertion remains in the scoped current wire prose.
- Selected route receipt `/tmp/cybersecurity-migration-20261008/afterbody-publicstage-native-proof.json`: native exit 0; hidden carrier outside `main`; native href and numeric caption both verified. The observed href is `../data-integrity/backup.html#exr-data-integrity-backup`, with caption 2.1. This checks the selected route, not the final upstream implementation/test matrix.

## Remaining final gate

Before calling the docs implementation-ready, read the runtime worker's actual frozen Core implementation and exact privacy/Source/fail-closed/partial regression receipts. Confirm the final Core descriptor contains the agreed public stage and filename, then refresh scoped file hashes/diff. Root will perform independent review/CI/merge/tag/install/new-demo verification. No availability of future `v4.0.1` or `demo-20261008-1` is asserted by this preparation report.
