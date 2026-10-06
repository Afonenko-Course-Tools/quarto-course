# Selected source Body exports

Run from the logical course root. Its `_quarto.yml` declares `course.id` once.
The selected bank has its own native `project.type: book`, Core filter and local
`.task-items` work. A bank can contain unsupported or platform-specific tasks
that are unrelated to the selected work.

```sh
quarto run _extensions/course-core/entrypoints/export.ts \
  --book tasks --work checksum-lab \
  --output _generated/exports/checksum-lab.json
```

Use the actual installed Core path (including an owner directory when present).
`--book .` is valid when the logical root itself is the bank. `--profile java,review`
selects additional native functional profiles; do not pass student/full there.
The CLI requires one book, one work and one `.json` output. It creates parent
directories and writes the closed package plus a sibling `.public.json`.
Generated exports belong under an excluded service directory and are not root
publication resources. A closed output is for the explicitly chosen consumer.

## Native collection

```ts
import { collectExport } from "./_extensions/course-core/body-export/collect.ts";
import { buildBodies } from "./_extensions/course-core/body-export/producer.ts";

const selected = await collectExport(courseRoot, {
  book: "tasks", work: "checksum-lab", profiles: ["java"],
});
const { package: teacherPackage, publicPackage } = await buildBodies(selected.result, {
  projectRoot: selected.projectRoot,
  courseId: selected.courseId,
  work: selected.work,
  includeClosed: true,
});
```

`collectExport` returns `{result: ReleaseResult, projectRoot, courseId, work}`.
Quarto performs one source pass with its JSON writer, includes, computations
and active functional profiles. A temporary native profile supplies full
source collection and Core pre/post hooks, then is removed. It overrides web
hooks while preserving native filter resolution. Core captures the actual AST and carries its independent public projection
in a service wrapper through the same native writer. The collector reads both
JSON AST projections after native shortcode resolution. No full HTML book is built. Native per-document cross-reference warnings remain
visible; the source pass requires native exit zero, then selected membership
and Body checks establish the export closure.
Control QMD outside the publication chapter lists participates in this source
pass. Native cache/freeze remains under the selected bank.

Bank ID conflicts are checked before selection. Then exactly the selected work
and its local members are retained. Body capability checks happen after this
closure; unassigned unsupported nodes are not exported. An unresolved QRC
reference in a selected condition fails with `BODY.QRC_REFERENCE_UNRESOLVED`.
QRC provides address references, not implicit body imports or fake links.

## Public and closed packages

`buildBodies` also accepts an explicit `DocumentResult` or `ReleaseResult`
from a completed native render. `courseId` supplies the logical identity;
`work` selects a local ID or `course.id/local-id`. If exactly one work is present,
the pure producer may infer it. `sources` optionally bounds input documents.
The producer does not render. Its caller verifies native completion.

Every selected question appears in work order, including control questions.
Conditions and public answer prompts/options exclude solutions, correct markers,
keys and grading-notes. `publicPackage` contains only those public fields.
`includeClosed: true` requires full facts and adds separate `closedKey`,
`solution`, `gradingNotes`; it never reconstructs keys from student facts.
Full native results carry normalized validated answer banks for reuse, so a
consumer does not reparse and revalidate the same authored bank.

Work `items: string[]` preserves order. Optional `requirements` maps local
members to `required|optional`; graded works default members to required.
Handouts need no grading status. `kind` is lab/test/exam/handout. Package keys
are `course.id/local-id`. Core does not prescribe platform points, attempts,
delivery or grader. Each chosen adapter checks the selected fields it can use.

The bounded AST capability supports ordinary paragraphs, lists, tables, figures,
math, code, native links and spans. Unsupported raw nodes/citations/notes fail
with a capability diagnostic; arbitrary Pandoc/Quarto content portability is
not promised. Keys are validated on the raw AST even if publication hides them.

## Resources and current results

`evaluateResources` resolves selected public resource facts, checks contained
paths and aliases, and excludes QMD/configuration/service files, hidden-only
resources and closed exercise project areas. Body embeds permitted bytes with
SHA-256 integrity and rewrites AST resource URLs to package-relative `target`
paths, retaining query/fragment suffixes. Missing files fail. Generated assets
are captured during the native filter before writers move/consume them;
acceptance verifies captured digests against the current run. These internal
sidecars are not publishable resource inventories.

Student/default captures contain projected public generated bytes; full may
retain raw generated bytes. Shared public resources remain eligible. Closed
project areas `reference`, `solution`, `solutions`, `tests`, `closed-tests` and
`check.sh` remain excluded from public payloads; authored `student/tests` can be
public. Starter payload consumers opt into `publicPayload` using the actual
native authored input inventory. No filesystem scan of retained document facts
establishes a successful release. See [native run API](native-run.md).

For source export, audience predicates on a whole task/work or its ancestor
selection containers do not remove its identity. Audience predicates inside
a task still project participant content and keep full-only material private.
Functional profiles remain active; they can still select task variants.
The reserved `.course-export-projection` Div carries only the service public
AST in the JSON pass. Downstream collecting adapters skip this wrapper;
it is not another authored exercise occurrence.
