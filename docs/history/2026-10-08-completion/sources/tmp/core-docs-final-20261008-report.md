# Core 4.0.0 current contract and installed example gate

Final scoped commit: `2ef59370c98edf948817c13795d9515044b76c8a`.
Runtime tested: git archive 0ddb463; no runtime changes in this documentation commit.
Current topical docs/spec/README describe bundle4.0.0; release status follows the
same-ref descriptor/tag rule. Product text has no dated unpublished-tag claim.
Accepted-next is unlinked from active authority and reduced to a historical
implemented-unreleased redirect; original content preserved in17bdd7d/835d6a6.
The root 18-step plan and START were not edited.

Taskfile/BUILD dependency/source URLs now pin v4.0.0. Normal tagged installation
is documented, with local checkout workflow for development. Tool and ready
asset must be produced from the same clean final Git SHA. No ready asset or
BUILD sourceDirty:false was emitted during this preflight; network v4 install
and live tag/source URLs remain the controller's publish gate.

Installed actual example:
/tmp/core-docs-final-qrc62ext/example
Runtime archive and installation source:
/tmp/core-docs-final-qrc62ext/runtime
All three native packages install as4.0.0 through local quarto add.
Examples/pins came from the final authored documentation tree; only the runtime
was taken from the exact archive. Ownerless hook paths were adjusted in the
temporary copy. Student Code Tools was deliberately source:true/keep-source:true,
toggle:false/caption to exercise the genuine generated Source AST mask.

Commands use XDG_CACHE_HOME=/tmp/core-docs-final-qrc62ext/cache,
XDG_DATA_HOME=/tmp/core-docs-final-qrc62ext/data,
CUE=/home/tolya/course-tools/local-tools/cue/cue, QUARTO_RUN_NO_NETWORK=true.

PASS actual commands/artifacts:
- quarto render --profile student: exit0, six current documents; Source modal/QMD
  copies absent on bank/work pages, restricted bodies/links/answer partitions
  absent in HTML/search/AST; public work title/preview and one anonymous public
  demonstration retained; four totals correct. Log student.log.
- quarto render --profile full: exit0, six documents; complete bank/solutions/work
  links retained. Log full.log.
- slides/quarto render: exit0, Russian solutions/notes/Navigation retained and
  v4 Source link emitted. Log reveal.log; local install log slides-install.log.
- quarto render seminars/01.qmd --profile student: exit0, renderAll:false/one
  current document, no stale complete total after successful full renders.
  Log partial.log.
- installed export.ts --book . --work sec-seminar-01: exit0, three questions;
  actual native JSON public demonstration witness true, ordered qualified
  assignments/stages, optional/group/theory fields correct. Log seminar-export.log.
- same command sec-practical-01: exit0, one restricted participant question;
  qualified map/items, theory2.5 and internal Header preserved. Native Pandoc
  json→plain confirms condition contains inner heading but no preview/outer work
  heading/solution/gradingNotes. Log practical-export.log, condition.json/txt.
- same command sec-test-01: exit0, two restricted questions; required/optional
  individual defaults and public choices; correct0/solutions stay teacher-only.
  Log test-export.log.
- git diff --check PASS.64 local Markdown links outside code blocks,0 missing
  (previous61 plus historical redirects). Current/version4.0.0 topical status,
  no active accepted-next or implementation-in-progress authority, pins/source
  references and unchanged course-body-package-v1 consistency PASS.

Controller evidence confirmed separately: full npm test session38878 on0ddb463
exit0, PASS --native /tmp/course-native-check-20261008-045220;
/tmp/core-runtime-20261008/full-round2.log. Scoped round2 review Approved,
no remaining Important in /tmp/core-bundle-review-20261008/rereview-round2.md.
This is local validation, not CI/merge/Release approval.

Remaining controller gates: final complete-branch review, push/CI/merge,
immutable v4.0.0 publish, clean same-SHA tool/demo asset provenance/live links,
consumer release integration and final18 history/plan cleanup.
All sessions started by this documentation agent completed; no broad npm rerun.
