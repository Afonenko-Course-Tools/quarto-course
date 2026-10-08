# Core 4.0.1 student assignment native book crossrefs

Worktree: `/home/tolya/course-tools/quarto-course-assignment-fix-20261008`, branch `fix/student-assignment-native-crossrefs-20261008`, immutable base d58494171e3020957b64ed229cbc8537751e3beb. No commits, PR, release or original owner checkout mutation performed by this agent for this fix.

## Cause and narrow correction

Native Quarto 1.11.5 book post-render resolves crossrefs before configured Core post-render. Student assignment AST inside template content was invisible to that native global DOM resolver; full profile already had correct native addresses and captions. The final second public post-quarto filter serializes the already-native item once with Pandoc and contributes hidden inert after-body HTML through `quarto.doc.include_text`. The native resolver sees that carrier outside main, while native search keeps the work title/prose and excludes its assignment shadow. Core post-render relocates exact native markup only for current open declarations and removes pending carriers. Existing fail-closed declaration, source, resources and DTO guards remain. No guessed addresses, synthesized captions, private Quarto API, search parser, second source render or course vendor overlay.

Minimal native proof: `/tmp/cybersecurity-migration-20261008/afterbody-publicstage-native-proof.json`. Final focused RED: `authoring-model-red.log` exit 1 on new actual student book href/caption assertion; GREEN: `authoring-model-green.log` exit 0 with actual native 2.1 and reordered late-bank 3.1 captions, restricted/source/search/resource/partial/failed-render checks retained.

Fresh independent medium runtime review Approved: `/tmp/core-assignment-fix-review-20261008/runtime-final.md`, exact scope hashes alongside it. Ultra version/documentation owner separately updated descriptors and current implementation prose; original published 4.0.0 remains immutable.

## Full verification

Frozen manifest before full suite: `frozen-source-before-full.json`, 266 source files and 63 extension payload files. Required full command: `npm test -- /tmp/core-assignment-fix-20261008/full-native`, with writable task-specific caches, native sockets authorization, fixed local CUE and existing Playwright dependencies. First unsupported CLI setup attempt (`--evidence`) failed before tests and was preserved as `npm-test-setup-failure.log`; corrected positional invocation runs unchanged existing harness.

Corrected complete `npm test -- /tmp/core-assignment-fix-20261008/full-complete` with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` finished exit 0 (session 18011). Every native stage and all three browser suites passed. Initial full run exited 1 solely at browser launch because the fresh XDG cache lacked a bundled browser; that original `full-native/browser.log` remains preserved. A bounded unchanged browser continuation also exited 0 before the corrected complete run. No source or dependency changes occurred between these attempts. Final `verified-frozen-source.json` confirms all 266 source files and their set unchanged, 63 extension files, runtime reviewer 5-path and ultra documentation reviewer 15-path hashes unchanged (19 combined paths, descriptor shared), and git diff whitespace check passed. All agent sessions completed; none pending. Course native student/full/student and site gates remain blocked until the real patch release is installed byte-for-byte. Previously selected course backup Body export passed; the original student link failure evidence and course source are preserved.

Final combined machine receipt: `verified-fix.json` includes complete source and 63-file payload SHA-256 maps, both reviewer scopes, failure preservation, corrected full exit 0 and empty pending-session list.
