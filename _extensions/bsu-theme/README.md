# BSU Theme

Visual assets for native Quarto HTML books and Reveal.js slides. This package
contains no renderer, course semantics, navigation behaviour or custom formats.
Brand tokens come from the supplied BSU brand book (RGB palette, page 10);
Arial is its documented fallback typeface. No official logo or ornament is
redrawn, and no proprietary font is distributed.

`_extension.yml` contributes a metadata descriptor so Quarto can install the
asset bundle. It does **not** contribute `metadata.project.brand` or automatically
activate a theme: installing Course Core must not silently brand every project.
Select the assets explicitly in the consuming project's `_quarto.yml`:

```yaml
brand: _extensions/bsu-theme/_brand.yml
format:
  html:
    theme:
      - cosmo
      - brand
      - _extensions/bsu-theme/styles/common.scss
      - _extensions/bsu-theme/styles/book.scss
  revealjs:
    theme:
      - default
      - brand
      - _extensions/bsu-theme/styles/common.scss
      - _extensions/bsu-theme/styles/slides.scss
```

Declare only the format(s) used by the project. Paths above are project-relative;
if `quarto add` places the extension under an owner namespace, use that actual
installed path. An optional root `_bsu.yml` can hold this configuration and be
loaded with `metadata-files: [_bsu.yml]`. Quarto merges arrays, so do not repeat
base themes or the same SCSS in multiple presets.

To add controls, separately select `revealjs-plugins: [course-navigation]` under
the native `revealjs` format. Course Navigation's neutral interface then receives
BSU variables from `common.scss`. Remove the brand/SCSS entries to return to a
standard theme: source IDs, semantic blocks, exercise metadata, references,
collapsed answers and navigation behaviour remain unchanged.

Course Presentation's public variables are `--course-accent`, `--course-muted`,
`--course-border`, `--course-surface`. This theme sets those variables, while the
presentation extension controls layout of `.course-block`, `.course-metadata`
and `.course-answer`. Authors never need `.bsu-question`, `.bsu-reading`,
`.bsu-kicker`, or raw HTML such as `<details class="bsu-answer">`.

The SCSS applies to HTML/Reveal and browser PDF, not LaTeX or Beamer. Native PDF
outputs retain teaching content through Course Presentation's fallback; this
package does not claim to provide a LaTeX brand template.
