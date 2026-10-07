---
type: specification-index
component: course-core
status: current
updated: 2026-10-08
---

# Контракты Core, Presentation и Navigation

Версия расширения определяется `_extensions/*/_extension.yml` того же Git ref;
выпущенный контракт читается по тегу. Изменения main после последнего выпуска
имеют статус **unreleased**. Документы `implementation-in-progress` описывают
внедрение принятого контракта и становятся current после проверки кода.

| Документ | Type | Component | Status | Нормативная область |
| --- | --- | --- | --- | --- |
| [Учебные элементы](learning-elements.md) | specification | course-core | implementation-in-progress | Банк, задачи, решения, работы, назначения и время |
| [Видимость](visibility.md) | specification | course-core | implementation-in-progress | Student/full, публикация условия и участнический экспорт |
| [AST-профиль](ast-profile.ebnf) | specification | course-core | implementation-in-progress | Форма извлечённого Quarto/Pandoc AST |
| [Архитектура](plugin-architecture.md) | specification | course-core | implementation-in-progress | Native границы и владельцы внешних правил |
| [Межпроектные связи](cross-references.md) | specification | course-core | current | QRC, публикация и ресурсное владение |
| [Body](../docs/body-export.md) | api-contract | course-core/body-export | implementation-in-progress | Selected export, назначения, participant/closed payload |
| [NativeRun](../docs/native-run.md) | api-contract | course-core/native-run | implementation-in-progress | Текущий запуск, Release, полные и частичные итоги |
| [Presentation](../docs/presentation.md) | component-contract | course-presentation | implementation-in-progress | Подписи, оформление, решения, Reveal и печать |
| [Navigation](../docs/navigation.md) | component-contract | course-navigation | current | Native Reveal, поиск, переходы и состояние |
| [Core CUE](../_extensions/course-core/spec/core.cue) | schema | course-core | implementation-in-progress | Самостоятельная проверка Course |
| [Body CUE](../_extensions/course-core/body-export/package.cue) | schema | course-core/body-export | implementation-in-progress | Самостоятельная проверка экспортного пакета |
| [Словарь](../_extensions/course-core/contract-vocabulary.json) | vocabulary | course-core | implementation-in-progress | Роли, атрибуты, значения и локализованные подписи |
| [Диагностика](../docs/diagnostics.md) | diagnostic-reference | course-core/course-presentation | implementation-in-progress | Стабильные ID, контекст и действия автора |

[Принятый целевой контракт](authoring-model-next.md) имеет статус accepted-next;
[линейный план](../docs/plans/2026-10-08-course-tools-implementation.md) задаёт
порядок внедрения. Новый синтаксис этой ветки ещё не означает новый выпуск.
После проверенной реализации тематические контракты заменяют переходный документ
вместе с кодом, CUE, словарём, руководством и примерами.
