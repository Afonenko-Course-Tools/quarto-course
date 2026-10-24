---
type: specification-index
component: course-core
status: current
version: 8.2.6
updated: 2026-10-24
---

# Контракты Core, Presentation и Navigation

Версия расширения определяется `_extensions/*/_extension.yml` того же Git ref;
выпущенный контракт читается по тегу. Изменения main после последнего выпуска
имеют статус **unreleased**. Тематические документы current описывают Core
8.2.6 того же Git ref. Выпущенная версия читается по неизменяемому тегу;
current определяет нормативные владельцы, а не заменяет release/check evidence.
Core 7.2.0 добавляет факты Java API-предпроверки и политики дополнительных
Java-исходников; [контракт](../docs/project-checks.md) определяет их границу.
Выпуски Core 7.2.0 и экспортёра 7.1.0 опубликованы.
Исторический Core 7.3.0 совместим с exporter 7.1.1; Body v2 не изменён.
Core 7.1.0 допускает отсутствие time задачи; при неполных оценках времени
сводка работы отсутствует целиком. Transport Body v2 сохраняет прежнюю схему.
Core 7.1.0 нормализует фиксированные и случайные AssessmentSlot до student/full.
Body v2 сохраняет позиции и всех кандидатов; прежние items/assignments отклоняются.
Текущая candidate матрица: Core/Presentation/Navigation 8.2.6, PrairieLearn exporter 8.2.2
с delivery v3, Site 5.1.4, QRC 3.1.1 и Download 3.2.2 с необязательным Core bridge.
API Core 8.1 и Body v2 сохранены; номер bundle 8.2.6 не меняет публичные schema/API
versions. Новая матрица требует собственных проверок точных refs и установленного
состава; прежние проверки не подтверждают её прохождение.
Закреплённая dependency Exporter 8.2 на API Core 8.1 не подменяется новым bundle автоматически.
`selection=choice`, project materialization и обязательный current-run proof
не объявляются совместимыми со старыми captures/consumers. Platform/Gateway
требуют отдельной exact source/digest/interface проверки; прежние service
releases не подтверждают новую совместимость.
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

Фасады наблюдения сохраняют ABI 1. `attributes.extension_id` указывает владельца;
необязательный `document_id` задаётся только на подтверждённых границах одного
документа. [Контракт NativeRun](../docs/native-run.md) определяет контекст
`commonPathDocument` и отдельные phase ID пакетных callback-операций
`withLoadedNativeRun`, `withFinishedNativeRun`, `withNativeRunProof` и
`withNativeArtifactBatch`. Эти пакетные фазы не получают `document_id` и
сохраняют `extension_id=course-core` через текущий `createMetrics` / ABI 1.
Разметка не означает
полного семантического покрытия расширений и не вводит общий runtime.
Полный снимок child env и `clearEnv` применяются только к активному контексту;
identity/off/недоступный режим/отсутствующий агент сохраняют прежние env overrides,
наследование и разрешения вызова.

Bundle 8.2.6 объединяет эту наблюдаемость линии 8.2.3 с пакетной обработкой,
границами A/use/B и исправлением CUE линии 8.2.4–8.2.5. Правила безопасности,
публичные API Core 8.1 и Body v2 сохранены; проверка выпуска требует отдельных
suite/CI/archive/install свидетельств на точном SHA.

Тематические документы определяют текущие контракты. Неизменяемые выпуски и assets находятся в [GitHub Releases](https://github.com/Afonenko-Course-Tools/quarto-course/releases). Завершённые планы и отчёты сохраняются в Git истории.

Материализация выбранных проектов и точные student artifacts описаны в
[контракте материализации](../docs/project-materialization.md); API находится в
`artifacts/materialize.ts`, native metadata capture — в `projects.lua`.
