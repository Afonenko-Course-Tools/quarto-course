---
type: specification-index
component: course-core
status: current
version: 9.4.0
updated: 2026-11-12
---

# Контракты Core, Presentation и Navigation

Этот Git ref — candidate 9.4.0, **unreleased**. Исполняемый канон — локальные TS
schemas и native Quarto transport. Старый Course/NativeRun API удалён; Body v2 и
принятый public native API сохраняются. Версии расширений задаются стандартными
дескрипторами Quarto. Для source dependencies и fixtures `.gitmodules` задаёт
URL/path, а Git gitlink выбирает commit. Тег, CI/OCI и установленная композиция
подтверждаются собственными фактическими evidence.

| Документ                                                                   | Владелец и область                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Учебные элементы](learning-elements.md)                                   | Core: банк, упражнения, решения, назначения                       |
| [Видимость](visibility.md)                                                 | Core: raw validation и student/full                               |
| [AST-профиль](ast-profile.ebnf)                                            | Фактическая native форма, не собственный parser                   |
| [Архитектура](plugin-architecture.md)                                      | Границы владельцев и native transport                             |
| [Связи](cross-references.md)                                               | QRC, публикация и resource ownership                              |
| [Body](../docs/body-export.md)                                             | Пакет, participant и closed projection                            |
| [Выполнение и совместимость](../docs/native-execution.md)                 | Native engines, resources, custom formats и поддержанный manual   |
| [Native операция](../docs/native-operation-ts.md)                          | Public operation, catalog, currentness и final fences             |
| [Assignment](../docs/native-assignment-ts.md)                              | Native generation, roles и private provenance                     |
| [A1](../docs/native-context-ts.md)                                         | Namespace `course-project`, пути и lifecycle                      |
| [Материализация](../docs/condition-materialization-ts.md)                  | README, closure, выбранные файлы                                  |
| [Presentation](../docs/presentation.md)                                    | Представление, решения и Reveal                                   |
| [Navigation](../_extensions/course-navigation/README.md)                   | Native Reveal и управление                                        |
| [Ordinary публикация](../_extensions/course-core/release/publication.ts)   | Core-owned typed publication session без grading/certificate gate |
| [Core schemas](../_extensions/course-core/release/contracts.ts)            | Release facts и adapter validators                                |
| [Body schema](../_extensions/course-core/body-export/package-contracts.ts) | Закрытый пакет                                                    |
| [Ответы](../_extensions/course-core/document/answer-contracts.ts)          | Answer facts/spec                                                 |
| [Словарь](../_extensions/course-core/contract-vocabulary.json)             | Роли, значения и подписи                                          |
| [Диагностика](../docs/diagnostics.md)                                      | Коды, контекст и причины                                          |
| [Миграция](../docs/migration-ts.md)                                        | Удалённые интерфейсы и mapping проверок                           |

Quarto >=1.11.5 сохраняет reader, metadata реальных документов, conditions,
crossref и renderer. Узкий loader `course-project` описан отдельно. Lua остаётся
техническим early transport/late observation; новый предметный resolver или
второй Course model не вводится. TS-типы выводятся из локальных исполняемых
схем.

Наблюдаемость сохраняет ABI 1 и точный extension owner. Метрики оценивают
реальные boundaries; выбранные файлы сохраняют public/private роли и безопасные
outputs; собственных source snapshots/freshness fences нет. Code tests не
подтверждают actual assignment capture, all135, installed composition, OCI или
release.
