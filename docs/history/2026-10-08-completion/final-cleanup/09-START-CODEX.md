# Старт Codex: инструменты курса, руководство и PR Cybersecurity

Следующая работа определена согласованным планом от 8 октября 2026.
Реализация выполняется: Core и Publisher/QRC прошли финальные локальные проверки;
матрица адаптеров, итоговое review, CI, выпуски и публикация продолжаются.

1. Прочитать [текущие контракты Core](quarto-course/spec/index.md).
2. Выполнить [линейный план из 18 пунктов](quarto-course/docs/plans/2026-10-08-course-tools-implementation.md).
3. Для текущего пункта читать план владельца и проверять свежий код/refs/PR;
   предыдущие отчёты об успешных сборках не подтверждают текущее дерево.

| Владелец | Текущий план |
| --- | --- |
| Core / Presentation / Navigation | [quarto-course](quarto-course/docs/plans/2026-10-08-implementation.md) |
| Publisher | [quarto-project-publish](quarto-project-publish/docs/plans/2026-10-08-implementation.md) |
| QRC | [quarto-reference-catalog](quarto-reference-catalog/docs/plans/2026-10-08-implementation.md) |
| Print | [quarto-course-print](quarto-course-print/docs/plans/2026-10-08-implementation.md) |
| Moodle | [quarto-course-moodle](quarto-course-moodle/docs/plans/2026-10-08-implementation.md) |
| PrairieLearn | [quarto-course-prairielearn](quarto-course-prairielearn/docs/plans/2026-10-08-implementation.md) |
| Cloud | [quarto-course-cloud](quarto-course-cloud/docs/plans/2026-10-08-implementation.md) |
| Download | [quarto-project-download](quarto-project-download/docs/plans/2026-10-08-implementation.md) |
| Документация / gh-pages | [quarto-template-course](quarto-template-course/docs/plans/2026-10-08-implementation.md) |
| Открытый PR Cybersecurity | [OPEN PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4) |

`/home/tolya/course-tools` не Git-репозиторий. Не создавать новый; нужные
dirty/untracked материалы и историю разнести в существующие репозитории
владельцев до очистки. Корневой START — навигация, не ещё одна спецификация.

Реализация: 9 часов от зафиксированного старта, все доступные ресурсы ноутбука,
независимые работы параллельно. Сначала локальные проверки, CI на финальных
этапах перед merge/release. Runtime/тесты — medium; спецификации, README,
docs, инструкции и весь шаблон с проектами/примерами — ultra при поддержке
исполнителем. Детальные условия и завершение по дедлайну — в линейном плане.

Финальный маршрут: проверенные merge/main и новые выпуски инструментов →
новые закреплённые демо → полное русское authoring-руководство → merge шаблона
и штатное `quarto publish gh-pages --no-render` → новый OPEN PR Cybersecurity
([PR #3 уже MERGED](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/3); пользователь разрешил новый PR)
→ очистка LOCAL/REMOTE веток инструментов и шаблона. Сохранить `main`, служебную
`gh-pages` и heads открытых автоматических GitHub PR, теги и Releases.
Курс остаётся в открытом PR без merge/deploy и не входит в очистку веток.

Старые `specs/*`, планы 6–7 октября, probes/handoff/evidence — исторические
источники до распределения по владельцам, а не действующие требования. Их
завершённые решения и нужные незаконченные задачи включены в новый маршрут;
старые запреты Pages и поддержка Quarto 1.10.x не применяются. Последние прямые
указания пользователя имеют приоритет. По серьёзному новому расхождению показать
конкретные примеры и варианты, не возобновлять согласованные вопросы.
