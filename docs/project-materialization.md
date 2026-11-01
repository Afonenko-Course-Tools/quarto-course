# Материализация Core 9.0.0

Действующий public TS договор описан в [condition-materialization-ts.md](condition-materialization-ts.md). Экспортируются `planProject`, `materializationClosure`, `materializeCondition`, `materializeProject`, `writeArtifactInventory` и их исполняемые схемы. Старый NativeRun-based `materializeProjects`/`materializeStarterArtifact` CLI удалён; его исходники и свидетельства сохранены в Git истории.

A1 context подтверждает native owner, sources, origins, profiles/format и lifetime. Планирование использует этот context и существующие `course-project` metadata, а не второй resolver. Callback-local native operation может переиспользовать authenticated owner witness/S в одном batch; final metrics читаются только после await/закрытия.

Условие — точный выживший late native fragment, связанный с operation, source и audience. Copied JSON/foreign/expired conditions не становятся authority. README генерируется единожды через штатный GFM writer, связывается с closure/public references и точными выбранными файлами. Конечные bytes, hashes, targets, collisions, private/source exclusions, full/student policy и currentness проверяются до публикации.

Generated resources разрешаются только при реальном sealed native observation и сохранённых byte/currentness guards. Произвольный неизвестный файл или чужой output не становится ресурсом. Include, list/table/note/callout и source bases проверяются actual native suites. RawBlock/Figure и прочие неподтверждённые rich Body формы не объявляются квалифицированными.

Assignment delivery использует отдельные typed internal роли; ordinary public выдача не требует assignment P. Installed consumers, full135, final runtime qualification/OCI/release остаются отдельными проверками.
