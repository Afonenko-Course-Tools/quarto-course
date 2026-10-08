# Старт Codex: инструменты курса и документация

Действующие правила: [индекс Core](quarto-course/spec/index.md),
[контракт сайта](quarto-template-course/spec/site.md) и current индексы владельцев.
Проверенные releases, source SHA, история и ограничения —
[итоговый отчёт](quarto-course/docs/releases/2026-10-08-implementation.md).
[Русское руководство](https://afonenko-course-tools.github.io/quarto-template-course/).

| Владелец | Текущий контракт |
| --- | --- |
| Core / Presentation / Navigation | [quarto-course](quarto-course/spec/index.md) |
| Publisher | [quarto-project-publish](quarto-project-publish/spec/index.md) |
| QRC | [quarto-reference-catalog](quarto-reference-catalog/spec/index.md) |
| Print | [quarto-course-print](quarto-course-print/spec/index.md) |
| Moodle | [quarto-course-moodle](quarto-course-moodle/spec/index.md) |
| PrairieLearn | [quarto-course-prairielearn](quarto-course-prairielearn/spec/index.md) |
| Cloud | [quarto-course-cloud](quarto-course-cloud/spec/index.md) |
| Download | [quarto-project-download](quarto-project-download/spec/index.md) |
| Документация | [quarto-template-course](quarto-template-course/spec/index.md) |

Cybersecurity: [OPEN PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4).
Курс передаётся через OPEN PR; все его ветки и рабочие деревья сохраняются.

Этот корень не Git-репозиторий. Не создавать новый. Исторические планы,
спецификации и receipts восстанавливаются по сохранённым owner Git refs,
указанным в отчётах; completed планы не являются текущим маршрутом.
Сохранять пользовательские рабочие деревья, main, serving gh-pages, heads
OPEN автоматических PR, все теги и Releases. Последние прямые указания
пользователя имеют приоритет над историческими материалами.
