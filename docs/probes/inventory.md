# P0 native inventory probe (A1)

This standalone experiment changes no production contract. Run from the repository root:

```sh
quarto run tests/probes/inventory.ts
# Fail the process unless both engine positive controls are also demonstrated:
quarto run tests/probes/inventory.ts --require-gate
```

Requires Quarto, CUE, and installed R/knitr and Python/Jupyter runtimes for complete engine evidence. `QUARTO`, `CUE`, and `QUARTO_PYTHON` can select executables. Each run prints a fresh private temporary project and writes `evidence.json` there, including versions, every subprocess argv/environment override, exit status, stdout/stderr, captured occurrences and capability verdict. The normal command tests assertions while recording unavailable capabilities; its zero exit **does not close A1**. `--require-gate` turns missing engine evidence into a nonzero exit.

## Local evidence on 2026-10-01

Quarto 1.11.5, Pandoc 3.10/Lua 5.4, CUE 0.17.1, locally extracted R 4.3.3 with knitr 1.45/rmarkdown 2.25; exact Deno version is in generated evidence.

| Requirement | Evidence and result |
| --- | --- |
| Hidden static declarations before projection | `pre-ast` captures both `exr-duplicate` occurrences, native `content-visible`/`when-profile=full`, `.when-full`, parent visibility attributes, and a private exercise under the student profile. No deduplication or target requirement. |
| Native include expansion | `_included.qmd` contributes its Header and exercise. `inspect.fileInformation.includeMap` records the include edge. The code-fence literal `exr-literal` is absent from declarations. |
| Inventory versus selected render-set | `inspect --profile student` omits `full-only.qmd`; `inspect --profile full` includes it. The collector renders that document under **full**, its owning profile. Python/R fixtures also belong to full. |
| Explicit versus generated heading IDs | Ordinary capture has automatic IDs, including misleading `sec-looks-explicit`. A separate `-M from:markdown-auto_identifiers` capture retains explicit `sec-explicit`/`sec-included`, leaving both automatic Headers empty. Header/Div structure and text match across these two fixture passes. |
| Failed alternative retained | Raw `--from markdown-auto_identifiers` failed in Quarto 1.11.5 before collector execution (`readqmd.lua` nil `meta`). The documented Quarto `from` metadata option succeeds. No internal API workaround. |
| Hooks and shortcodes | An unguarded `--no-execute` creates pre-render, post-render and shortcode side-effect files. With `INVENTORY_ACTIVE=1`, cooperating handlers suppress those effects; shortcode expansion still occurs. Hashes and resolved configuration remain stable. |
| CUE error before ordinary execution | A dedicated probe-only CUE predicate rejects the preserved duplicate. The continuation containing ordinary render is never invoked; neither sentinel exists. This is a proof of ordering, not a new production validation schema. |
| Jupyter no-execute | Static `exr-python` captured, sentinel absent. Positive ordinary-execution control was blocked at kernel startup by this environment's socket restrictions, before the sentinel could run. **Local positive control blocked; subsequently confirmed in CI below.** |
| R no-execute | With the isolated R runtime: static `exr-r` captured and sentinel absent. Ordinary `--execute` writes the sentinel and fails with `R_EXECUTION_SENTINEL`, before `pre-ast` capture. **Confirmed for this corpus.** Initial missing-R failure is retained in the execution report. |
| Late mutations | A hook deliberately ignoring the guard writes `_metadata.yml`, changes the full profile render-set and creates `late.qmd`. File hashes and repeated native inspect detect the changes. |
| Permitted preparation | The same changes made explicitly before the snapshot are included in the resolved set; a subsequent guarded pass captures `exr-late` without changing the snapshot. |

The local strict command returned `BLOCKED_ENGINE_EVIDENCE` because the Jupyter positive control could not start. That local failure is retained; it is superseded as a corpus-level evidence gap by the successful CI run below.

## Successful strict CI evidence

[GitHub Actions run 36867880658](https://github.com/Afonenko-Course-Tools/quarto-course/actions/runs/36867880658), job [110387874189](https://github.com/Afonenko-Course-Tools/quarto-course/actions/runs/36867880658/job/110387874189), successfully ran `quarto run tests/probes/inventory.ts --require-gate` on `ubuntu-24.04` at commit `2ee1695e1bd7c48e56553ef01aaaaba0d82f299f`, with Quarto 1.11.5, CUE 0.17.1 and R 4.3.3. Actual job logs report `A1 capability verdict: CONFIRMED_WITH_LIMITS`.

| Engine | No-execute declaration captured | Ordinary execution positive control |
| --- | --- | --- |
| Python/Jupyter | `noExecuteCaptured: true` | `positiveControlFired: true`; `PYTHON_EXECUTION_SENTINEL` |
| R/knitr | `noExecuteCaptured: true` | `positiveControlFired: true`; `R_EXECUTION_SENTINEL` |

The strict corpus engine-evidence gap is closed. This confirms the tested native path and controls, **not production readiness or completion of all A1/P0/P1 requirements**. General author-source discovery, frozen dependencies and final computed-AST reconciliation remain subject to the limits below. Production `application/check.ts` still renders normally before validation and is unchanged. [Compact CI evidence](../../tests/probes/inventory/ci-evidence.json) records the tested revision and results; this documentation update did not rerun the probe.

## Integration boundaries

- A document excluded from the active profile may render without that project's configuration. The first attempted student-profile render of `full-only.qmd` produced HTML but no collector file. Do not enumerate full pages and render them all under student. Preserve the profile responsible for each native input set and its effective metadata.
- The union of student/full `inspect.files.input` covers this corpus; it is not proof of discovery of all author documents omitted from **both** profiles. No guessed glob or hand-written configuration/include resolver is substituted here. General author-source discovery remains a production gate.
- Capture is performed in an isolated temporary project with `_private` output. It is not safe to run unguarded hooks against author sources or public output. The probe does not publish anything and does not install hooks into a real project. Its guard is a cooperative contract, **not a sandbox** for arbitrary hooks/filters/shortcodes. `--no-execute` does not prevent them from running. No nested render is issued by the cooperating hooks.
- Source hashes cover the fixture's QMD, YAML, Lua, TypeScript and CUE files; resolved student/full configuration is re-inspected. Production needs a frozen, complete dependency/source/extension manifest, symlink policy and a final check before ordinary render. The prototype does not prevent mutate-then-restore attacks or arbitrary external side effects.
- Occurrence provenance is the owner QMD supplied by the orchestrator, plus native include edges. It does **not** identify the physical included file/line for each Header/Div or each repeated include occurrence. Ancestor visibility is retained; no student projection is built here.
- Disabling `auto_identifiers` is used only for identity capture. The fixture comparison verifies the tested structure; do not use the resulting empty automatic IDs as publication anchors or assume arbitrary shortcode-generated headers retain the same shape. Existing nondefault reader extensions need preservation in any production implementation.
- No R/Jupyter execution engine extension, internal caches, internal Quarto APIs, or custom Markdown parser is used. The collector uses public Pandoc traversal and `quarto.json.encode`; source-file enumeration/hashing does not parse Markdown. Final computed AST versus static declaration reconciliation remains a separate required integration check.

## Documented interfaces

- [Quarto AST phases](https://quarto.org/docs/advanced/quarto-ast.html#targeting-of-ast-processing-phases): filter placement; these phases do not promise execution-engine ordering.
- [Quarto render CLI](https://quarto.org/docs/cli/render.html): `--no-execute`.
- [Quarto inspect](https://quarto.org/docs/advanced/inspect/index.html): resolved configuration/input files/include map/code-cell metadata.
- [Project scripts](https://quarto.org/docs/projects/scripts.html#pre-and-post-render): hooks and post-hook configuration/render-list recomputation.
- [Format `from` option](https://quarto.org/docs/reference/formats/html.html#rendering) and [Pandoc auto identifiers](https://pandoc.org/MANUAL.html#extension-auto_identifiers): native identity pass.
- [Includes](https://quarto.org/docs/authoring/includes.html), [shortcode handlers](https://quarto.org/docs/extensions/shortcodes.html), and [Pandoc Lua filters](https://pandoc.org/lua-filters.html): native expansion and AST traversal.
