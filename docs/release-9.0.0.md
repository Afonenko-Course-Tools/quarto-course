# Кандидат 9.0.0 (unreleased)

Core, Presentation и Navigation переходят на единственный native TS runtime. Удалены заменённые Course/NativeRun API, Lua model маршрут, внешние reference schemas, schema tool setup и старые private-injected probes. Body v2 сохранён; runtime-типы Body выводятся из исполняемого договора. Ответы используют общий native YAML/choice owner.

Ordinary Core pre/post hooks ведут на native operation; явный прежний flag не обязателен, неизвестный маршрут отвергается. Student — безопасная projection по умолчанию. Presentation получает marker только после ранней TS-валидации; указатель использует текущие finalized observations. Native reader/metadata/crossref/render остаются у Quarto.

Cached resource возвращает синхронную копию после entry fence без повторного одинакового local fence, если не было await/IO. После нового чтения и на final boundaries fence сохраняется. Измерение курса и hosted CI на точном SHA, independent OTHER, installed consumers, immutable publication, actual P/OCI/all135 остаются обязательными отдельными шагами.
