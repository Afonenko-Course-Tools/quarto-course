# Нормализованные проектные факты Core 9.0.0

Quarto разрешает metadata inheritance. Core сохраняет уже наблюдённые native project facts, их source/bank/visibility/artifact policy и materialization declarations, связывает их с текущими ранними декларациями и same-S sources. Wire schema находится в `document/project-facts.ts`; типы выводятся из неё. Нормализация project/check-specific metadata остаётся у соответствующего владельца и не превращается в новый общий Course model.

Public Core использует `ProjectContractSchema`, A1 `readProjectContexts`/`withProjectContexts`, планы и typed artifact inventories из `public.ts`. Пути и effective origins сохраняются; `false` и native rebasing не заменяются собственным YAML merge. Student policy не позволяет выдать full/private/config/generated sources путём переименования target.

Manifest проверок, native CheckManifest/SourceSelection, API precheck, additional Java sources, public cases, Gradle/JUnit Jobs и их закрытые runtime-specific schemas принадлежат PrairieLearn. Его executable validator подключается через `NativeAdapterValidator` и явный metadata readSet; существующий Core release validation проверяет owner, course/target, source paths и полноту области до дальнейшей выдачи. Core не содержит параллельный schema manifest и не запускает Java/Gradle при render.

Старые Core 8.1 `collectNativeModel`, `collectProjectChecks`, schemaVersion1 CLI и IR удалены вместе с заменённым runtime. Это breaking Core 9.0.0; точная новая C/Core совместимость и установленный состав проверяются на финальных commit, а не по старым hosted CI или fixtures.

Сохраняются прежние учебные возможности Java library без fake Main, lawful additional sources, optional primary, API-before-dependent-compile и private feedback. Их runtime-specific реализация и тесты остаются у владельца адаптера/Platform; Core guards не подменяют эту проверку.
