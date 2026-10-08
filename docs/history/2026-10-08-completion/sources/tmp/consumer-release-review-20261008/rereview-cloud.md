# Cloud wording fix — scoped rereview

Reviewed change: `d7963d6eeeedf50a4f042ba41bce7945ea376318` → `2ed1667b760507eaf270a0bf8d16ed94f98bfaea` from `/tmp/consumer-cloud-wording-fix-20261008.diff`.

- **Minor: Addressed.** `/home/tolya/course-tools/quarto-course-cloud/README.md:16`–18 now gives conditional advice only if Quarto reports `recoverEncode` on a Cyrillic path. The unsupported Quarto 1.11.5 reproduction claim and unconditional Cyrillic-path workaround are removed. Quarto/CUE requirements and the existing native no-spaces boundary at lines 14–16 are unchanged.
- **New breakage: none found.** The supplied delta replaces exactly three README lines. It changes no runtime, descriptor, source ref, example, dependency or test and makes no native Windows reproduction claim.
- **Spec compliance: Approved. Task quality: Approved.** This supersedes the sole Cloud Needs fixes assessment in `report.md`. No remaining Critical, Important or Minor finding requires an owner change; all seven reviewed prepared consumer branches are Approved for the local code/documentation gates.

Final local evidence also advanced since the first review: `/tmp/adapters-final-matrix-20261008/report.md` records **14/14 commands with actual exit 0**, including real Print PDF/installed CLI, Moodle XML/privacy, genuine Java/Gradle and PL delivery/PL001, Cloud CUE/native projection and Download ZIP/native/install routes. It identifies the same frozen Core SHA `0ddb4638df096bf4969cb0f30c99e1e7dde9b095`, exact comparison of 212 tracked Core files with zero mismatches, and unchanged five adapter source HEADs/bytes after testing. The new Cloud HEAD is README-only, so the tested runtime/examples remain applicable. This report accepts the supplied final evidence; it did not rerun those commands.

Boundary: read only the prepared wording delta, the exact current README paragraph, the documentation correction ledger and final matrix report. No broader review, test, checkout/index/HEAD mutation, remote action or additional agent occurred. Only this rereview report was created.

Actual-release dependency pin updates, required final CI, merge/SHA checks, immutable tool/demo releases, postrelease native installs/source checks and the rest of the approved root completion route remain pending. Local approval does not certify those remote/release gates.
