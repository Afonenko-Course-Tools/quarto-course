# Course Navigation

Optional Reveal.js navigation. The extension is independent of Course Core,
Course Presentation and BSU Theme. It adds no source markup or course metadata.
Use it with native `format: revealjs`; the ordinary Reveal `default` theme works.
Cosmo is an HTML/Bootstrap theme, not a Reveal theme.

The bundle is installed by `quarto add` from the specification repository. It is
inactive until selected by name:

```yaml
format:
  revealjs:
    theme: default
    revealjs-plugins: [course-navigation]
    navigation-mode: linear
    hash: true
    menu: false
    pdf-separate-fragments: false
    course-nav:
      language: ru
      sidebar: true
      title: "Название курса"
```

Keep existing filters, hooks and metadata; merge this configuration instead of
replacing the project's `_quarto.yml`. Do not add the plugin twice through
multiple metadata files. Remove it from `revealjs-plugins` to use native controls.
The plugin hides duplicate Reveal controls/progress only while active.

## Behaviour

- `#` section headings and `##` slide headings provide the default structure.
  Optional `data-course-section="Title"` on a slide groups unusual layouts.
- Next/previous delegate to `Reveal.next()` / `Reveal.prev()`, including fragments.
- Sections, visit history, text search and a top-aligned document-order overview
  use visible leaf slides; hidden slides, stack wrappers and speaker notes are
  excluded where appropriate. Progress counts slides, not fragment clicks.
- Desktop sections occupy a sidebar; mobile uses a dialog. `sidebar: false`
  keeps only the dialog at every width. Dialogs support keyboard focus and Escape.
- Overview thumbnails are inert copies with distinct IDs; cross-reference IDs in
  the original document are never changed. Grid rows begin at the top.
- PDF opens the same presentation with `?print-pdf` in a new tab, preserving the
  current slide. Save using the browser's Print dialog. Navigation is absent in
  print mode. **This plugin does not reveal teaching answers or modify content.**
  Course Presentation owns that behaviour, including operation without navigation.
- Reveal scroll view is disabled by the plugin's `scrollActivationWidth: 0`, so
  the canvas and controls remain coherent on narrow screens. For reading, publish
  the book/HTML version alongside slides.

## Modules and styling

`navigation/model.js` collects slide structure and bounded visit history.
`ui.js` owns native buttons/dialogs and accessible state. `plugin.js` is the small
Reveal adapter and lifecycle coordinator. `navigation.css` owns geometry and
neutral fallback styles; there is no dependency on a BSU variable or selector.
No runtime, grading, timer, answer testing, or private-content projection is here.

The visual interface is public CSS variables, e.g. `--course-nav-primary`,
`--course-nav-foreground`, `--course-nav-background`, `--course-nav-border`,
`--course-nav-surface`, `--course-nav-muted`, `--course-nav-font`. BSU Theme sets
these variables. Other themes may override them without changing JavaScript.
`--course-nav-width` (210px) and `--course-nav-footer` (76px, 110px on mobile)
control geometry; keep touch targets at least 44px.

Local model tests: `node --test navigation/model.test.cjs` from this directory.
