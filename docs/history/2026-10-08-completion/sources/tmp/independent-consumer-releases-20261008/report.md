# Five independent consumer releases — 2026-10-08

All five owner PR heads freshly verified with successful actual PR checks, merged preserving history via `--merge --match-head-commit`. Each clean local main and origin/main equals the actual merge commit; its tree equals the tested PR head tree. Exact merged-source main CI succeeded before publication.

| Repository | Tag | Merge/source SHA | Main CI | Native installed files |
| --- | --- | --- | --- | --- |
| quarto-course-print | [v0.3.0](https://github.com/Afonenko-Course-Tools/quarto-course-print/releases/tag/v0.3.0) | `00c51f7342da376e85027a925dd9f1207783f924` | [success](https://github.com/Afonenko-Course-Tools/quarto-course-print/actions/runs/37722356136) | 29 |
| quarto-course-moodle | [v0.3.0](https://github.com/Afonenko-Course-Tools/quarto-course-moodle/releases/tag/v0.3.0) | `60ce53d0d52a93e66ca545f2a6cd96f97f09d1e6` | [success](https://github.com/Afonenko-Course-Tools/quarto-course-moodle/actions/runs/37722395672) | 17 |
| quarto-course-prairielearn | [v3.0.0](https://github.com/Afonenko-Course-Tools/quarto-course-prairielearn/releases/tag/v3.0.0) | `b9821b5b62863b7e1ae380a4c1a0a0bef855f8ba` | [success](https://github.com/Afonenko-Course-Tools/quarto-course-prairielearn/actions/runs/37722438262) | 13 |
| quarto-course-cloud | [v3.0.0](https://github.com/Afonenko-Course-Tools/quarto-course-cloud/releases/tag/v3.0.0) | `552612450b093b0cff2e33187a1cb5b9234c050a` | [success](https://github.com/Afonenko-Course-Tools/quarto-course-cloud/actions/runs/37722463288) | 10 |
| quarto-project-download | [v2.0.0](https://github.com/Afonenko-Course-Tools/quarto-project-download/releases/tag/v2.0.0) | `ee5ae76255d265ad7c7f43a765bc061ffc8eec75` | [success](https://github.com/Afonenko-Course-Tools/quarto-project-download/actions/runs/37722486189) | 12 |

The corrected dated publisher verified compact local archive installation, exact draft asset set/sizes/SHA-256, actual downloaded draft asset bytes, and immutable publication with exact source target. Native `quarto add org/repo@tag --no-prompt` then verified every tracked `_extensions` file path and byte; remote tag resolution and immutable release source equal the merge SHA before/after installation. Quarto version: 1.11.5. All five current CI pins are Core v4.0.0.

Receipts and detailed machine table: `verified-releases.json`; per-owner PR/CI/install receipts in this directory; publication/archive receipts under `/tmp/course-release-20261008/receipts/releases/<repo>/<tag>`.

No owner journal/doc commits were made after release; no branches, tags or releases were deleted. All owner mains remain at release SHA for matching demo builds. Download has no separate demo release.
