# Current native results

Ordinary selected render and preview need only the Core filter. Optional project hooks collect a current native run without invoking render or inspect:

```yaml
project:
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render: _extensions/course-core/entrypoints/post.ts
```

Use installed paths, including a GitHub owner directory when Quarto creates one. `beginNativeRun(projectRoot)` creates a fresh directory under `_generated/course-spec/native-runs` and resets the completion record. Core writes each current `DocumentResult` there and also retains its local per-view/per-format document result. Configured adapters validate raw declarations before projection and write matching current fragments. Installed but unconfigured adapters are passive.

`finishNativeRun(projectRoot)` uses the public post-hook output list. It checks output existence/containment, matches each document to an actual output, and requires matching adapter audience/format/source facts. The pre-hook input list is advisory because author hooks may change inputs. Final input facts come from actual captured documents. The completion is written only after validation. Post-hooks can themselves be followed by failing hooks: the caller must still check native exit code zero.

`loadNativeRun(projectRoot, {view, profiles, outputDirectory})` loads only the active run completion; expectations are optional constraints. It returns `{schema:"course-native-run-v1", projectRoot, outputDirectory, profiles, renderAll, documents, adapters, outputFiles, inputFiles}`. Filesystem paths are absolute; document source/output paths retain their native relative meaning. Adapter fragments are Maps in memory and arrays in persisted JSON.

`assembleRelease(expectedSources, documents, adapters, {view, profiles, format?})` is a pure domain finalizer. It requires exact explicit coverage, rejects mixed course/view/profile contexts and duplicate local exercise/work IDs, and checks cross-document membership and targets. `validateRelease(result, projectRoot, adapters)` checks paths and Core/adapter CUE schemas. Native HTML and Reveal results may share one context. Group independent projects by their explicit project/source scope after validating each native project's paths; optional course.id does not merge unrelated projects.

The installed `check.ts PROJECT student|full` finalizes a previously completed full native run (`renderAll` from the public hook flag). Selected partial runs are rejected. It never renders. Full site composition must ensure the native invocation was a full build; a selected run is still only current selected facts. Keep student/full output directories separate. Native caches remain in the source project.

Ordinary native documents do not require course.id. Selected source export reads the logical root identity and explicitly chooses a book and work; see [Body exports](body-export.md). Full document facts may contain normalized private keys; keep _generated and closed packages out of publication resources.
