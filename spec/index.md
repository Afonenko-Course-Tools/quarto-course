---
type: specification-index
component: course-core
status: current
---

# Контракты Core, Presentation и Navigation

Нормативные документы описывают поведение кода того же Git ref. Версия каждого
расширения определяется его `_extensions/*/_extension.yml`; точный выпущенный
контракт читается по тегу выпуска. Изменения ветки main после последнего выпуска
имеют статус **unreleased**, пока не выпущен новый тег.

| Документ | Нормативная область |
| --- | --- |
| [Учебные элементы](learning-elements.md) | Объявления задач, работ и педагогических элементов Core |
| [Видимость](visibility.md) | Проекции student/full и участнический экспорт Core |
| [AST-профиль](ast-profile.ebnf) | Форма данных извлечённого Quarto/Pandoc AST |
| [Архитектура](plugin-architecture.md) | Нативные границы Core/Presentation/Navigation и владельцы внешних правил |
| [Межпроектные связи](cross-references.md) | Разделение адресации QRC, публикации и ресурсного владения |

[NativeRun](../docs/native-run.md) описывает текущий запуск и сборку результата;
[Body](../docs/body-export.md) — selected export и разделение payload.
[Presentation](../docs/presentation.md) и [Navigation](../README.md#навигация)
принадлежат соответствующим расширениям этого bundle.
Схемы Core и Body находятся в `_extensions/course-core/spec/core.cue` и
`_extensions/course-core/body-export/package.cue`, единый словарь —
`_extensions/course-core/contract-vocabulary.json`.

Согласованный [целевой контракт](authoring-model-next.md) имеет статус
`accepted-next`: новый синтаксис пока не считается поддерживаемым.
Порядок реализации задаёт [план](../docs/plans/2026-10-08-course-tools-implementation.md).
После внедрения целевые правила заменят текущие тематические контракты вместе
с кодом, схемами, руководствами и примерами.
