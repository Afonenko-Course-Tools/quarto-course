# Force-add preservation bounded re-review

Approved: no actionable critical or important finding in the changed force-add operation. No helper executed or owner files mutated by reviewer.

Independently reconstructed the previously reviewed helper by replacing only the two new git add calls with its prior single ordinary add, then compared SHA-256 against the previous scopehash.json. It matches exactly; all other preservation/OPEN-course/CI/head/hash/commit/push guards are unchanged.

The actual new mutation is `git add -f -- docs/history/2026-10-08-completion`, followed separately by ordinary `git add --` of explicit tracked owner plan paths. This is needed to preserve reviewed ignored log/ledger filenames as actual Git blobs. It does not force-add repository-wide ignored caches/runtime files.

Before writes, the helper requires the dated payload directory absent. It then populates that tree only from fresh SOURCE-MAP input rows whose staged SHA-256 is reverified, explicit latest-plan snapshots, and generated README/SOURCE-MAP. Therefore the force-added scope is the newly created selected preservation payload. Original source trees and ignored files outside this dated path are not force-added. Existing source-byte Gitblob checks and snapshot-byte Gitblob checks still execute before push; no reset/overwrite/branch mutation was introduced.

Root must refresh final stager selectors/map with actual Course618/native cycle/site/Body, current OPEN PR/CI proof and operation-helper sources before execution, as already agreed. This approval does not replace those actual staged manifest and commit/push receipts or permit replay of old source maps. Mid-operation recovery boundary remains as reported in the previous review.

Current save helper SHA-256: `d805def9ff0e32c556a4b10a7b75e26a03a5b4bcc0e686422d806cf865e42f76`.
