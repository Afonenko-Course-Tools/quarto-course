---
type: specification
component: course-core
status: current
version: 9.0.1
---

# Архитектура расширений

Quarto владеет reader, project/directory/document metadata inheritance, profiles, include, engines, crossref, HTML/Reveal и renderer. Ранний штатный JSON-filter передаёт native AST в TS owner Core. Lua технически связывает request/context с текущим запуском и поздно собирает наблюдения после native conditions/custom nodes. Legacy Lua Course model и его reference schema больше не являются исполнением или fallback.

## Владельцы

Core владеет упражнениями, ответами, назначениями, native operation, selected resources и project contexts. Presentation владеет видом блоков и ответов; Navigation — готовыми слайдами и указателем. QRC разрешает catalogue ссылки. Download/Publisher потребляют текущую public operation. PrairieLearn владеет assignment-specific checks, Jobs и delivery. Ни один consumer не получает authority из private NativeRun pointer, caller boolean, copied JSON или injected fixture.

`public.ts` — ограниченный data/runtime API. Формы задаются исполняемыми локальными TS schemas; типы выводятся. Body v2 — отдельная экспортная форма с closed package schema, а не второй общий Course DTO. Пути, origins, private facts, source/currentness и operation lifetime проверяются на соответствующей границе.

## Одна native операция

Pre hook фиксирует native owner/source snapshot и запросы. Early TS проверяет все raw факты до projection; native late pass даёт фактические conditional witnesses, bodies, anchors и resource observations. Post hook закрывает capture и конечные outputs. Ordinary проект использует тот же маршрут без assignment authority; assignment требует отдельного qualified producer и prior P.

Release validation проверяет полную объявленную область, уникальные IDs, targets, slots/cardinality, ссылочную целостность, statement policy, public-solution demonstration witness и typed adapter validators. Installed `contract.json` даёт имя владельца; исполняемые `NativeAdapterValidator` и readSet передаются через существующий public seam. Путь к внешней schema и Lua adapter registration не требуются.

Public getters не выполняют IO. Async byte/materialization boundaries используют текущие guards, а BEGIN/final fences проверяют полную operation. A1 batch переиспользует authenticated owner witness/S и заканчивает lifetime до выдачи final metrics. Нельзя сохранять expired context как provider.

## Проверки и выпуск

Canonical native suite перечислен в `tools/check-canonical.sh`; [карта миграции](../docs/migration-ts.md) связывает прежние гарантии с реальными TS/native controls. Generated vocabulary имеет TS/Presentation projections, `node tools/sync-contract.mjs --check` проверяет согласованность.

Core 9.0.1 — unreleased исходники. Actual P/RME/G/K, combined installed consumers, rich Body, all135, runtime image и release assets остаются отдельными обязательными gates. Фикстура не выдаётся за такую квалификацию.
