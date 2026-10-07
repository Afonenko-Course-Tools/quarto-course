# Independent bank-ownership patch review

Scope: pending `quarto-course` patch against main `dbfda77`; collect.ts, export-bank-ownership.ts, canonical test integration. Product files untouched; no heavy suite rerun.

## Important finding

`_extensions/course-core/body-export/collect.ts:78–79` selects inputs from lexical directory ownership, without resolving each input file. Native ownership inspection is also lexical: Quarto starts project discovery from dirname(input), normalizes spelling and does not realpath the source (`/opt/quarto/bin/quarto.js:92130`).

Tiny native repro `/tmp/review-bank-symlink-xxupq7gk` has `bank/foreign.qmd -> ../outside/foreign.qmd`. `quarto inspect bank` exits zero and includes lexical bank/foreign.qmd in files.input. `quarto inspect bank/foreign.qmd` exits zero and reports project.dir equal to bank. Therefore the patch still treats a source outside the chosen bank as bank-owned and renders it before post-render containment detects anything. This is chosen-bank identity correctness, not a request for a new security subsystem. Evidence: `review-core-symlink-inventory.json`, `review-core-symlink-inspect.json`.

Resolve every selected input before source execution and require physical containment in the chosen bank; if symlink aliases are supported, physical nested-project ownership must also be excluded. Rejecting symlink inputs/ancestors would be another simple consistent policy.

## Otherwise sound

Public native inventory and one ownership inspection per input directory are a bounded reuse of Quarto APIs; no parser, native profile engine or extra rendering. Explicit file list preserves unpublished own-bank QMD while excluding nested native projects. Profile order places the temporary service profile first, which matches Quarto reverse-merge priority. Finally removes the service profile on failures. Output verification forbids unexpected current source facts.

Red/green evidence supplied by implementer confirms nested duplicate IDs previously contaminated bank; green test passes all three scenarios in 20.4 s: foreign duplicate and invalid Core declaration excluded, foreign member cannot be implicitly imported, unpublished bank source survives. Full suite underway elsewhere.

Status: approval pending input realpath / ownership correction and focused regression.

## Follow-up physical path review

Updated collector resolves each native inventory input with realPath, rejects paths outside the chosen bank before per-document inspection, and groups/inspects physical directories and representative paths. Physical nested-project aliases no longer inherit lexical root-bank ownership. Accepted lexical paths remain the native render/provenance inputs. This directly addresses the finding without another parser or render pass. No remaining concrete Important or Critical code finding identified in this update.

Focused physical regression currently needs completion: `core-bank-ownership-physical.log` showed `CORE.UNKNOWN_MEMBER: selected/exr-alias` for an alias into `_parts/_own-source.qmd`; native hidden-input exclusions may make this an invalid fixture. Approval remains conditional on successful corrected native-supported symlink regressions and the final suite already running elsewhere.

## Final focused verification

`core-bank-ownership-physical2.log` records PASS (20.87 seconds) for the corrected native-supported fixture `alias.qmd -> own-source.md`. The earlier alias into underscore-hidden source was correctly omitted by native Quarto input semantics; the collector does not invent support for that input. Corrected tests preserve a contained own-bank alias and unpublished bank QMD, exclude both lexical nested-project inputs and physical aliases into that project, ignore foreign duplicate/invalid Core declarations, reject missing members instead of importing foreign tasks, and reject an outside-bank physical source. Updated code/tests read independently; git diff --check passes.

The Important symlink ownership finding is resolved. Approval: ready to merge conditional only on success of the final full current suite already running independently (`core-full-suite-patch1.log`) and required release-stage CI. No unresolved Critical or Important findings in the reviewed ownership patch.
