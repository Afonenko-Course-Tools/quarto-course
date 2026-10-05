# Body exports from native results

Core validates every answer declaration in the actual expanded AST before visibility projection, including hidden and generated declarations. Numeric, multipart, matching and manual YAML answer banks use `body-export/answer.cue`; single-choice lists require exactly one `.correct` marker. Banks belong to one exercise or display example and cannot nest inside solutions, grading notes or another bank.

```ts
import { buildBodies } from "./_extensions/course-core/body-export/producer.ts";
const { package: teacherPackage, publicPackage } = await buildBodies(result, {
  projectRoot,
  sources: ["assessment.qmd"],
  release: "autumn-2026",
  includeClosed: true,
});
```

`result` is an explicit `DocumentResult` or `ReleaseResult`. `includeClosed` defaults to false; true requires selected full-view results. It never reconstructs keys from student results. The release label is a user label. `owner` in package keys means the Course namespace.

Public conditions follow the student projection even when the input is full. Closed-only exercises are excluded. Public packages omit `closedKey`, `solution` and `gradingNotes`. Full packages join both nested and sibling solutions and separate grading notes. Public answer prompts and options are recorded without keys during the native AST pass, so student exports retain their real answer type. Consumers publish `publicPackage` explicitly.

The CUE package contract requires unique question/work keys, exact owner membership, every referenced question present and every exported question used in a selected work. Select all sources required by the selected assessments. Unsupported platform-specific targets fail rather than silently producing a manual question.

Resources are resolved from current AST facts and explicit selection through `infrastructure/resources.ts::evaluateResources`. Hidden-only paths, source/service files, missing files and paths or symlinks outside the project are rejected. Body embeds permitted public resource bytes with SHA-256 transport integrity. Resource `target` is a project-relative package path; packaged AST URLs are rewritten to that same path, preserving query and fragment suffixes. `effectiveBase` retains the actual native source base for diagnostics. Generated resources are observed by the native filter before the writer moves them. Optional `capturedFiles` records contain absolute logical `source`, native `output`, and SHA-1 of the observed bytes. The current native finish step validates that a contained source or output copy matches those bytes; Body resolution repeats that check. Missing-at-filter files never gain an output-directory fallback. Hidden-only observed output copies are removed for the student view, with shared public aliases protected; source files, freeze caches and full-view output are preserved. No render is performed by the producer.

Document facts describe the Core filter stage. A caller building a full release must independently require successful native process completion and current output inventory; use the optional native hooks and `loadNativeRun` after the process exits successfully. Retained document files alone are not a release inventory.

Explicitly requested student starter payloads can call `evaluateResources` with `publicPayload: true` and `authoredInputs` from current native inputs and configured build hooks. This permits README, language and ordinary project configuration files while retaining authored native-input, Quarto configuration, service-directory, hidden-resource, alias and containment checks. The default source-extension policy remains conservative. Files with `.md` are distinguished by authored input identity, not a blanket extension ban.
