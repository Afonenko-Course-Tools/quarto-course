# Core 4.0.1 documentation/spec/example review

Approved. No actionable Critical, Important or Minor findings in this scope.

Independent read-only review of `/home/tolya/course-tools/quarto-course-assignment-fix-20261008` against immutable Core 4.0.0 source `d58494171e3020957b64ed229cbc8537751e3beb`. I did not author this Core patch and performed no owner edits, commits or test runs.

## Reviewed result

All three bundle descriptors use 4.0.1 and retain Quarto >=1.11.5. Core's descriptor contains the agreed public `post-quarto` stage and its thin `deferred-assignments.lua` entry; Presentation's pre-ast ordering and Navigation's separate native Reveal contribution stay consistent with README and current index.

The current visibility/architecture/NativeRun/Presentation/diagnostics prose matches the actual implementation. A deferred assignment remains native AST through Quarto filters. The late filter calls `pandoc.write(pandoc.Pandoc(native), 'html')` and public `quarto.doc.include_text('after-body', ...)`, putting its hidden/inert carrier outside `main`. The native global book resolver then supplies the href and numeric caption; native main search excludes the deferred assignment shadow. The existing Core post removes the exact generated carrier and relocates its exact resolved HTML only for a current open declaration. Closed, unknown or missing current payload is omitted. No constructed address/caption, search rewrite, general HTML/Markdown parser, private Quarto API or additional render is described or introduced by the reviewed route.

The authoring model, Body contract and schema/API payload stay at the 4.0.0 contract. Twenty-one model/Body/schema/NativeRun/vocabulary source files are byte-equal to the base, including `docs/body-export.md`. Version 4.0.1 in updated contract-document metadata identifies this patch's bundle/ref, and the index explicitly states compatibility with the 4.0.0 model and public NativeRun/Body APIs.

The course example's Task installation commands, BUILD dependency and GitHub Source URLs consistently target `v4.0.1`. README separately gates `demo-20261008-1` on merged source/pin verification, identical tool/demo producer SHA, `BUILD.commit` and `sourceDirty: false`. README/index retain unreleased-ref semantics. These are preparation pins, not evidence that the future tool/demo is already available; old immutable tags/assets are not replaced. Cross-platform Task branches and conditional Windows recoverEncode guidance do not claim a current Windows run.

## Evidence and limits

I read the focused actual RED log (`student native book assignment href/caption unresolved`) and GREEN log, the final test diff and the medium runtime review. The new assertions require the actual native `bank.html#exr-open` destination and numeric 2.1, then 3.1 when the work precedes the bank. The same focused fixture preserves checks for restricted source/search/resources/public body, hidden Source, hookless/aborted/partial guards and required/all/theory totals. The runtime review is Approved within its frozen scope.

All fifteen prepared documentation/version files still match the author's receipt; all five runtime-review file hashes match; all 266 frozen source-file hashes match. Read-only `git diff --check` passes. The author receipt's 44 local prose links all exist. No broad suite was rerun by this reviewer.

Full `npm test` final receipt, PR/main CI, published immutable `v4.0.1` and native installation byte proof, actual new core demo archive/BUILD/sourceSHA proof, and the final course native cycle/site/Body/export checks remain publication gates. This approval does not claim those pending gates passed.

Source-hash witness: `docs-final-sourcehash.json`, SHA256 `5f96817adfd1b619b91f527c3bf1a74fb7767cf0d6c52983caaec33b04fc3533`.
