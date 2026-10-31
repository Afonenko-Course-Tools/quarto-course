---
type: specification-index
component: course-core
status: current
version: 8.4.0
updated: 2026-10-31
---

# Контракты Core, Presentation и Navigation

Версия расширения определяется `_extensions/*/_extension.yml` того же Git ref;
выпущенный контракт читается по тегу. Изменения main после последнего выпуска
имеют статус **unreleased**. Тематические документы current описывают Core
8.4.0 того же Git ref. Выпущенная версия читается по неизменяемому тегу;
current определяет нормативные владельцы, а не заменяет release/check evidence.
Core 7.2.0 добавляет факты Java API-предпроверки и политики дополнительных
Java-исходников; [контракт](../docs/project-checks.md) определяет их границу.
Выпуски Core 7.2.0 и экспортёра 7.1.0 опубликованы.
Исторический Core 7.3.0 совместим с exporter 7.1.1; Body v2 не изменён.
Core 7.1.0 допускает отсутствие time задачи; при неполных оценках времени
сводка работы отсутствует целиком. Transport Body v2 сохраняет прежнюю схему.
Core 7.1.0 нормализует фиксированные и случайные AssessmentSlot до student/full.
Body v2 сохраняет позиции и всех кандидатов; прежние items/assignments отклоняются.
Этот unreleased candidate объединяет Core/Presentation/Navigation 8.4.0
с main 8.2.8, включая native JSON writer и контекст дочерних процессов.
Прежние API Core 8.1 и Body v2 сохраняются; новый native API описан
в [контракте native операции](../docs/native-operation-ts.md).
Явная unreleased assignment выдача описана в [контракте](../docs/native-assignment-ts.md);
положительная квалификация producer и actual C integration проверяются отдельно.
Точные версии и совместимость новых PrairieLearn/QRC/Download/Site/Platform
проверяются отдельно на установленном составе. Номер bundle и наличие
исходников не подтверждают выпуск, полный курс или готовность runtime/image.
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

Кандидат bundle 8.2.8 объединяет наблюдаемость, четыре batch phase ID,
контексты/env, pending Promise fix и CUE guards выпущенного 8.2.6 с
selected-boundaries оптимизациями опубликованного 8.2.7. Их BEGIN/END, локальные
FD/source проверки, hash-bound selected records и inactive fallback описаны
в контракте NativeRun. Core API 8.1, Body v2 и ABI 1 сохраняются.

JSON export со штатными multiple hooks и локальным HTML-форматом допускает
фактический native JSON writer до записи output. Конечные private intent-записи
связаны с неизменяемым pointer; они не заменяют независимую проверку готовых JSON
и полную проверку BEGIN/END. Private source-context v2 требует fresh capture;
публичные API Core 8.1, Body v2 и ABI 1 сохранены. Восстановление после ошибки и
границы допуска описаны в [контракте NativeRun](../docs/native-run.md).
До публикации неизменяемого тега эти исходники имеют статус unreleased.
Совмещение исходников не заменяет собственные suite, CI, archive/install и
course-проверки на точном новом SHA.

Тематические документы определяют текущие контракты. Неизменяемые выпуски и assets находятся в [GitHub Releases](https://github.com/Afonenko-Course-Tools/quarto-course/releases). Завершённые планы и отчёты сохраняются в Git истории.

Материализация выбранных проектов и точные student artifacts описаны в
[контракте материализации](../docs/project-materialization.md); API находится в
`artifacts/materialize.ts`, native metadata capture — в `projects.lua`.
