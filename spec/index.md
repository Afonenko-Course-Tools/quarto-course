---
type: specification-index
component: course-core
status: current
version: 6.0.0
updated: 2026-10-10
---

# Контракты Core, Presentation и Navigation

Версия расширения определяется `_extensions/*/_extension.yml` того же Git ref;
выпущенный контракт читается по тегу. Изменения main после последнего выпуска
имеют статус **unreleased**. Тематические документы current описывают Core
6.0.0 того же Git ref. Выпущенная версия читается по неизменяемому тегу;
current определяет нормативные владельцы, а не заменяет release/check evidence.
Core 6.0.0 нормализует фиксированные и случайные AssessmentSlot до student/full.
Body v2 сохраняет позиции и всех кандидатов; прежние items/assignments отклоняются.
Согласованные consumers: PrairieLearn exporter 6.0.0, Platform и Gateway2.0.0;
Download3.0.0 сохраняет собственный независимый artifact контракт.
Проверяемый toolchain: Quarto 1.11.5 / CUE 0.17.1. Матрица обозначает
совместимые контракты; опубликованные теги, OCI digest и evidence проверяются
отдельно у владельцев.

| Документ | Type | Component | Status | Нормативная область |
| --- | --- | --- | --- | --- |
| [Учебные элементы](learning-elements.md) | specification | course-core | current | Банк, задачи, решения, работы, назначения и время |
| [Видимость](visibility.md) | specification | course-core | current | Student/full, публикация условия и участнический экспорт |
| [AST-профиль](ast-profile.ebnf) | specification | course-core | current | Форма извлечённого Quarto/Pandoc AST |
| [Архитектура](plugin-architecture.md) | specification | course-core | current | Native границы и владельцы внешних правил |
| [Межпроектные связи](cross-references.md) | specification | course-core | current | QRC, публикация и ресурсное владение |
| [Body](../docs/body-export.md) | api-contract | course-core/body-export | current | Selected export, назначения, participant/closed payload |
| [NativeRun](../docs/native-run.md) | api-contract | course-core/native-run | current | Текущий запуск, Release, полные и частичные итоги |
| [Presentation](../docs/presentation.md) | component-contract | course-presentation | current | Подписи, оформление, решения, Reveal и печать |
| [Navigation](../docs/navigation.md) | component-contract | course-navigation | current | Native Reveal, поиск, переходы и состояние |
| [Core CUE](../_extensions/course-core/spec/core.cue) | schema | course-core | current | Самостоятельная проверка Course |
| [Body CUE](../_extensions/course-core/body-export/package.cue) | schema | course-core/body-export | current | Самостоятельная проверка экспортного пакета |
| [Словарь](../_extensions/course-core/contract-vocabulary.json) | vocabulary | course-core | current | Роли, атрибуты, значения и локализованные подписи |
| [Диагностика](../docs/diagnostics.md) | diagnostic-reference | course-core/course-presentation | current | Стабильные ID, контекст и действия автора |

Согласованный переходный контракт перенесён в тематические current документы.
Проверки, immutable releases, публикация, история и итоговая передача
зафиксированы в [отчёте реализации](../docs/releases/2026-10-08-implementation.md).
Завершённые планы сохраняются в Git истории и не задают текущих требований.
