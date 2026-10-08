# QRC release — 2026-10-08

QRC owner PR head freshly verified with successful actual PR checks, merged preserving history via `--merge --match-head-commit`. Each clean local main and origin/main equals the actual merge commit; its tree equals the tested PR head tree. Exact merged-source main CI succeeded before publication.

| Repository | Tag | Merge/source SHA | Main CI | Native installed files |
| --- | --- | --- | --- | --- |
| quarto-reference-catalog | [v3.0.0](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog/releases/tag/v3.0.0) | `559583805a514ae8a244b6ea4cb5124867064024` | [success](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog/actions/runs/37723606361) | 86 |

The corrected dated publisher verified compact local archive installation, exact draft asset set/sizes/SHA-256, actual downloaded draft asset bytes, and immutable publication with exact source target. Native `quarto add org/repo@tag --no-prompt` then verified every tracked `_extensions` file path and byte; remote tag resolution and immutable release source equal the merge SHA before/after installation. Quarto version: 1.11.5. Current QRC CI pins Publisher v5.0.0.

Receipts and detailed machine table: `verified-releases.json`; per-owner PR/CI/install receipts in this directory; publication/archive receipts under `/tmp/course-release-20261008/receipts/releases/<repo>/<tag>`.

No owner journal/doc commits were made after release; no branches, tags or releases were deleted. QRC main remains at release SHA for matching qrc/external demo builds.
