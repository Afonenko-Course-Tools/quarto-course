# Spec Compliance

- ✅ `95bc249..0ddb463`: **Approved** for this scoped round. Round1's new P2 attachment-fragment defect is **ADDRESSED**, and the additional ordinary native paired-conditional solution behavior is **ADDRESSED**. No new specific breakage found in the four-file fix diff. The previous five findings remain addressed.

# Findings Rechecked

- **Attachment ownership/resources — ADDRESSED.** `/home/tolya/course-tools/quarto-course/_extensions/course-core/entrypoints/preview.ts:26` assigns the sole Cite's ID unconditionally; `:27` allows a Link fallback only while no member is known and only for an exr-* fragment. A preceding fallback is replaced by the Cite, and a later auxiliary fragment cannot overwrite it. Existing whole-page resource projection/cleanup now retains the open item and its uses without promoting a restricted Cite because of an auxiliary `#exr-open` link. `/home/tolya/course-tools/quarto-course/tests/authoring-model.ts:61` asserts retained open bodyJson/resource use; its existing checks retain shared public bytes and remove private uses/bytes, closed DTO content and template wire. Actual RED `/tmp/core-runtime-20261008/public-resource-fragment-red.log` reports the authoritative-Cite failure; `/tmp/core-runtime-20261008/round2-resource-fragment-green.log` records native PASS.

- **Ordinary native unconditional paired solution — ADDRESSED.** `/home/tolya/course-tools/quarto-course/_extensions/course-core/visibility.lua:211` propagates a hidden target's policy only inside the bank or for explicit Course ownership. Native conditions on the solution and its ancestors still apply; an ordinary outside-bank exr/exm hidden by its own full condition no longer hides a separate unconditional suffix solution. `/home/tolya/course-tools/quarto-course/tests/outside-bank-parity.ts:29` adds both native exr/exm cases and compares direct native/Core payloads; the explicit Course-owned hidden reference guard remains exercised. `/tmp/core-runtime-20261008/native-conditional-pair-red.log` reports removal of UNCONDITIONAL_NATIVE_SOLUTION before the fix; `native-conditional-pair-green.log` records PASS afterward.

# Code Quality and Evidence

- ✅ **Scoped task quality: Approved.** The changes stay in existing member selection and bank/Course visibility boundaries. No schema/adapter guard weakening, parser, registry, extra render, or unrelated behavior was added.
- ✅ Read the prepared 12KB package once and inspected the named genuine RED/GREEN logs. No checkout/index/HEAD mutation, unrelated crawl, new agents, or suite rerun.
- ⚠️ Mandatory full npm/release promotion remains the controller's separate gate. `/tmp/core-runtime-20261008/full-round2.log` now contains `PASS --native; evidence /tmp/course-native-check-20261008-045220`; the controller must confirm session38878 completion/exit status before asserting that gate passed. This scoped review does not approve a release or document promotion.
- Critical: none. Important: none remaining in this scoped round. Minor: none required.
