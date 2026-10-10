---
type: api-contract
component: course-core/project-checks
status: current
release-status: unreleased
version: 5.0.0
updated: 2026-10-10
---

# Normalized projects and checks (unreleased)

Quarto owns project, directory and document metadata inheritance. Core reads that
merged metadata once. `default-exercise-target`, `default-exercise-course-role`,
`default-exercise-statement-visibility`, `default-exercise-difficulty`,
`default-exercise-time` and `default-exercise-project-check` apply only to exr
exercise declarations. `false` clears a default. An explicit different target is
an error; other explicit fields override defaults. IDs/project paths are never
inherited. `authoredTarget` records only the original attribute.

Assignments inherit requirement/work-mode from Span, then task-items, then
required/individual. Stage belongs only to task-items and may be absent.
`assessment.related-exercise` becomes `Assessment.relatedExercise`, checked
against this release's declarations. It is independent of runtime user choices.

The Core Course and DocumentResult expose projects with fields `exerciseId`,
`source`, `projectRoot`, `bankMember`, `purpose`, `statementVisibility`,
`artifactPolicy` and optional resolved `check`. Non-bank demonstrations remain
outside Course.exercises. A project's source/root are relative to its native book.

```sh
quarto run _extensions/course-core/entrypoints/project-checks.ts -- \
  --book tasks --output _generated/checks.json
```

This explicit inventory command runs a fresh full NativeRun and emits a private
schemaVersion 1 manifest. It does not invoke PrairieLearn or Java. Check defaults
merge into the named profile: maps merge, arrays/scalars replace. Unknown fields,
unknown source/check profiles and unsafe paths are rejected. Manual projects
without a check are excluded. Declared placeholders are retained with
`readiness: {ready:false,missing:[...]}`; selected delivery requires ready inputs.
All selected source, trusted test, verification, reference and contract fixture
bytes contribute to inventory and source snapshot hashes. SourceSelection fields
are `projectRelativePath`, `submissionRelativePath` and `sha256`.

`body-export/collect.ts` exports `collectNativeModel(root,{book,profiles})` for
platform-neutral current full model collection. `collectExport` additionally
selects one work and retains required related-exercise declaration evidence.

`artifacts/resolve.ts` exports `resolveArtifact(run,{source,exerciseId,kind})`.
Audience comes from the trusted NativeRun. Default student delivery is starter;
an open canonical demonstration receives full. Full audience receives full.
Conditions are resolved native Pandoc AST, with prerequisite dependencies and
approved assets, stripped of solutions, keys, notes and Download links. The
result is portable `files: {name,bytes}[]`, containing index.html and assets.
Cross-document links require website.site-url; source QMD links are rejected.

`course-exercise-index` is a native post-render request: Core replaces it using
this run's completed canonical exercises joined to `TopicFact={source,semester?,categories}`
by source. `{{< course-exercise-index role="independent-study" group-by="semester,difficulty" >}}`
filters by final purpose and groups by the requested topic/exercise fields. Role is
optional; group-by defaults to semester,difficulty and accepts either or both fields
once, in the requested order. Unknown parameters/roles/groups fail. Title, ID, time
and difficulty come from canonical exercises; the topic has no second exercise
inventory. Student output excludes restricted exercises. It never reads source
metadata again or uses an older model.
