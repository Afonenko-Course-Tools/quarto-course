# Cybersecurity step16 runtime review

Approved: no actionable runtime findings within the inspected scope.

Review base and HEAD at inspection: `6cae422bfb77c5c3fc54b24d039d624f44d6b7d5`; approval applies to the working-tree contents listed below, including the untracked narrow metadata file. Course preservation baseline is the owner-recorded merge; this review did not mutate course files, merge, deploy or clean branches.

## Inspected behavior

- Native installer uses Core v4.0.0 and QRC v3.0.0 in root/theory/task/seminars, Publisher v5.0.0 at root and Download v2.0.0 in task. No adapter activation or local runtime overlay.
- Independently recomputed every installed vendor path and SHA-256 and compared with git blobs at published source SHAs; all 614 files match (root/theory/task/seminars). Release identity comes from `/tmp/course-release-20261008/all-tools-published-verified.json`; exact set evidence is `/tmp/cybersecurity-migration-20261008/installed-exact-byte-proof.json`.
- CI singleton Quarto 1.11.5 upload condition retains `COURSE_PUBLISH_PAGES`, master and non-pull-request requirements. Deploy retains the same guards; PR checks do not publish. Existing render script keeps pipefail and actual native-command exit status.
- NativeRun CI adds only current profiles and configurationHashes pointer fields. These match installed Core output.lua and current upstream tests/native-writer-paths.lua. Existing course cases retain 4 scopes and expected path refusal/completed-run checks. Legacy fixture failure is attributable to missing current pointer schema; focused independent command `quarto pandoc --lua-filter CI/native-run.lua --to plain < /dev/null` exited 0 and reports 48 passing cases. This fixture emulates Windows paths; it does not prove native Windows operation.
- Owner CUE receipt reports 8 cases passing; unchanged CUE implementation was not broadened/retested by this review.
- Narrow data-integrity metadata marks the actual authored exercise bank and open default; backup task retains its authored role/difficulty and adds own numeric 90-minute estimate. Existing work explicitly assigns that actual backup exercise with lab kind and stable ID. No invented question, solution, stage or ZIP content was introduced in inspected authoring diff.

## Exact inspected file hashes

- `/home/tolya/Cybersecurity/CI/install-extensions.sh`: `faadcac7b84c95848abca2f726fdeff6e6237b6d4ee15462b3dc6fbf8eff0d00`
- `/home/tolya/Cybersecurity/.github/workflows/pages.yml`: `083a2ad9dbcf511afd4e9847211f42f355648fce4f2778358c7e4428c02610ed`
- `/home/tolya/Cybersecurity/CI/native-run.lua`: `9ca64a909810e6b2474892a9650783467f896cc3de0e3759f0e03d6ce979277a`
- `/home/tolya/Cybersecurity/task/data-integrity/_metadata.yml`: `9a851d91c22ad12c738681eb58fb497825573a2c7c5441653943c9a5f07bf39a`
- `/home/tolya/Cybersecurity/task/data-integrity/backup.qmd`: `20b14da64291bb6ef6b6d50ed0b3c52d26cbed4cf3c7b74dd084e1ebe67b9eba`
- `/home/tolya/Cybersecurity/task/seminar/01-introduction.qmd`: `80b92af787a1de0cc7e6f198475840e1ff61382d6789c1d1e947059fc86055f9`

## Remaining integration evidence

This approval is runtime-diff review, not a final site/export receipt. At inspection the owner recorded student-first exit 0 (97.465 s) and full exit 0 (112.243 s); student-after-full, actual Body/ZIP and site/privacy gate were still being collected. Do not claim completion from this report alone. Docs/spec/prose review belongs to the separate ultra reviewer.
