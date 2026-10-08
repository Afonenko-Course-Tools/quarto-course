---
type: implementation-report
component: course-tools
status: completed
updated: 2026-10-08
---

# Инструменты, руководство и Cybersecurity: результат 8 октября 2026

Текущие правила находятся в [индексе Core](../../spec/index.md) и индексах
владельцев. Этот отчёт фиксирует проверенные результаты и ограничения.
Выпущены восемь инструментов, семь demo Releases с восемью ready-группами;
русское руководство опубликовано штатно в gh-pages. Course передан в
[OPEN PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4)
с успешным CI; курс не слит и не опубликован.

| Инструмент | Immutable release | Source SHA | Main CI | Exact tag-install файлов |
| --- | --- | --- | --- | ---: |
| Core / Presentation / Navigation | [v4.0.1](https://github.com/Afonenko-Course-Tools/quarto-course/releases/tag/v4.0.1) | `a9a439bd6e6498806d4d4943efd71232e70170be` | [SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-course/actions/runs/37734901545) | 63 |
| Publisher | [v5.0.0](https://github.com/Afonenko-Course-Tools/quarto-project-publish/releases/tag/v5.0.0) | `215309b5c41669e56a857a1bc3e4f7f2ce782c5f` | [SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-project-publish/actions/runs/37722362758) | 10 |
| QRC | [v3.0.0](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog/releases/tag/v3.0.0) | `559583805a514ae8a244b6ea4cb5124867064024` | [SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog/actions/runs/37723606361) | 86 |
| Print | [v0.3.0](https://github.com/Afonenko-Course-Tools/quarto-course-print/releases/tag/v0.3.0) | `00c51f7342da376e85027a925dd9f1207783f924` | [SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-course-print/actions/runs/37722356136) | 29 |
| Moodle | [v0.3.0](https://github.com/Afonenko-Course-Tools/quarto-course-moodle/releases/tag/v0.3.0) | `60ce53d0d52a93e66ca545f2a6cd96f97f09d1e6` | [SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-course-moodle/actions/runs/37722395672) | 17 |
| PrairieLearn | [v3.0.0](https://github.com/Afonenko-Course-Tools/quarto-course-prairielearn/releases/tag/v3.0.0) | `b9821b5b62863b7e1ae380a4c1a0a0bef855f8ba` | [SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-course-prairielearn/actions/runs/37722438262) | 13 |
| Cloud | [v3.0.0](https://github.com/Afonenko-Course-Tools/quarto-course-cloud/releases/tag/v3.0.0) | `552612450b093b0cff2e33187a1cb5b9234c050a` | [SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-course-cloud/actions/runs/37722463288) | 10 |
| Download | [v2.0.0](https://github.com/Afonenko-Course-Tools/quarto-project-download/releases/tag/v2.0.0) | `ee5ae76255d265ad7c7f43a765bc061ffc8eec75` | [SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-project-download/actions/runs/37722486189) | 12 |

Теги/Releases опубликованы после проверок draft assets и повторной загрузки.
Поздние history/docs commits в main не меняют release source SHA. Quarto
1.11.5 / CUE 0.17.1 — проверенные версии. Core 4.0.1 исправляет нативные book
ссылки participant assignments; публичные model/schema/NativeRun/Body API
остаются совместимыми с 4.0.0. Первый Core 4.0.0/demo0 сохранён.

| Producer | Demo release | Source SHA | Ready группы и число файлов |
| --- | --- | --- | --- |
| quarto-course | [demo-20261008-1](https://github.com/Afonenko-Course-Tools/quarto-course/releases/tag/demo-20261008-1) | `a9a439bd6e6498806d4d4943efd71232e70170be` | core: 107 |
| quarto-project-publish | [demo-20261008](https://github.com/Afonenko-Course-Tools/quarto-project-publish/releases/tag/demo-20261008) | `215309b5c41669e56a857a1bc3e4f7f2ce782c5f` | composition: 130 |
| quarto-reference-catalog | [demo-20261008](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog/releases/tag/demo-20261008) | `559583805a514ae8a244b6ea4cb5124867064024` | qrc: 188, external: 20 |
| quarto-course-print | [demo-20261008](https://github.com/Afonenko-Course-Tools/quarto-course-print/releases/tag/demo-20261008) | `00c51f7342da376e85027a925dd9f1207783f924` | print: 26 |
| quarto-course-moodle | [demo-20261008](https://github.com/Afonenko-Course-Tools/quarto-course-moodle/releases/tag/demo-20261008) | `60ce53d0d52a93e66ca545f2a6cd96f97f09d1e6` | moodle: 21 |
| quarto-course-prairielearn | [demo-20261008](https://github.com/Afonenko-Course-Tools/quarto-course-prairielearn/releases/tag/demo-20261008) | `b9821b5b62863b7e1ae380a4c1a0a0bef855f8ba` | prairielearn: 35 |
| quarto-course-cloud | [demo-20261008](https://github.com/Afonenko-Course-Tools/quarto-course-cloud/releases/tag/demo-20261008) | `552612450b093b0cff2e33187a1cb5b9234c050a` | cloud: 22 |

Каждый BUILD имеет sourceDirty:false и собственный producer SHA. Native
sourceRef использует tool tag, catalog — demo tag. Download не имеет ready
демо. Core demo.1 содержит 107 файлов; archive SHA-256
`fe90b587569891455694836a48385d102960e906e07f2011c1f28092d4455ae4`,
2,783,070 bytes. Семь остальных catalog records и их зависимости сохранены;
всего скачано 549 ready-файлов без переписывания producer HTML/resources.
Publisher CI использовал совместимый QRC 2.2.1, ready composition — QRC 3.0.0;
это отдельные подтверждённые результаты.

Русское [руководство](https://afonenko-course-tools.github.io/quarto-template-course/)
опубликовано из source `52316a762da3a9c054b5ac6a7a89620e46c7c150`;
[PR #19](https://github.com/Afonenko-Course-Tools/quarto-template-course/pull/19)
MERGED после [CI SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-template-course/actions/runs/37737745573).
Native gh-pages `8dc11b599406f65af420aef39babdb15375df61b`, Pages built.
Пять ordered clean-main проверок и task publish: exit 0; установленный Core
63 файла byte-equal tag a9; 61 HTML / 2459 local links. 28 QMD / 95 fenced blocks
сохранены, кроме трёх shell pins. Все 599 published файлов равны checked bytes;
22 HTTP/hash checks и Root CUA Source/search/catalog/Core example прошли.
Публикация использовала `quarto publish gh-pages --no-render`; более поздние
history/docs main commits не обозначают новую публикацию сайта.

Course PR #4 остаётся OPEN на head
`b6b085cf0541785d11159bd9a106cd131dfabaf0`;
[CI 37743840665 SUCCESS](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/actions/runs/37743840665)
на exact head, publication SKIPPED. Native install 618 файлов (159/149/161/149),
NativeRun 48 / CUE 8; student 107.247 / full 120.018 / student 111.065 / site
0.358 секунд, exit 0. Обе проекции разрешили nested bank href и caption 11.1.
Selected Body: 40.629 секунд, exit 0; root-only owner, одна реальная open/manual
задача, авторская оценка 90, required/individual, 0 resources, без закрытых полей.
Student 178 файлов и 43 authored источника неизменны. Не выдуманы checksum,
control questions, решения или ZIP. По прямому запросу пользователя Course
**docs полностью удалён**: 36 файлов byte-equal сохранённому Git
`fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c` до удаления; каталог не воссоздаётся.
README / 667 runtime / 43 authored источника не менялись при docs cleanup.

Принятые правила: единый native source/projection path; actual public-solution
witness после native условий и переносимый solution для selected JSON;
Source AST mask; selected restricted participant statement без key/solution/
notes/assessment-preview; qualified membership/time и partial omission.
Core 4.0.1 использует публичный post-quarto stage и
`quarto.doc.include_text('after-body', ...)` для уже-native HTML вне main.
Native book resolver разрешает href/caption; search не получает assignment
shadow. Post переносит exact разрешённую разметку и удаляет closed carriers.
Нет второго render, Markdown parser, URL/caption builder или search rewrite.

Чужие warning streams сохраняются с actual exit: строка WARN сама по себе
не меняет Quarto exit 0. Узкие Windows path/CUE-TEMP проверки выполнены fixtures;
**native Windows session не заявляется**. Upstream recoverEncode на кириллическом
пути остаётся ограничением; путь checkout без кириллицы — проверенный обход.
Три настоящих PDF прошли visual QA. Local XML/PL/Cloud проверки не означают
live Moodle import, hosted PL execution или VM/Cloud actions.

Шаг 17: 46 LOCAL / 11 REMOTE удалений, 11 same-HEAD detaches, все 77 операций
exit 0. Все remote tags (включая peeled SHA) и 61 Releases с asset metadata
неизменны. Все 13 исходных пользовательских checkout HEAD/bytes/status
сохранены; Course исключён. Два временных чистых checkout этой реализации
удалены отдельно. Сохранённые remote ветки после cleanup:

| Владелец | LOCAL / REMOTE удалено | Сохранённые remote ветки |
| --- | ---: | --- |
| quarto-course | 10 / 2 | `dependabot/npm_and_yarn/playwright-1.63.0`, `main` |
| quarto-project-publish | 3 / 1 | `main` |
| quarto-reference-catalog | 5 / 1 | `dependabot/npm_and_yarn/playwright-1.63.0`, `main` |
| quarto-course-print | 3 / 1 | `main` |
| quarto-course-moodle | 3 / 1 | `main` |
| quarto-course-prairielearn | 3 / 1 | `main` |
| quarto-course-cloud | 3 / 1 | `main` |
| quarto-project-download | 3 / 1 | `main` |
| quarto-template-course | 13 / 2 | `gh-pages`, `main` |

API-confirmed Bot heads: Core OPEN PR #4
`8968c8da141d00651606d3fdf333bab7f13b9fb0`, QRC OPEN PR #5
`8d88a3272d73f6d868f3c7bd2b6ad84a743081c6`.
[Cleanup receipt](https://github.com/Afonenko-Course-Tools/quarto-course/blob/35ab45a60d3859c4aa584499e4a49c5b8b6f14bf/docs/history/2026-10-08-completion/final-cleanup/03-verified-cleanup.json) содержит actual before/after guards;
соседние архивные files сохраняют before/after/operations и helper sources.

До cleanup сохранены и pushed 401 input / 3,615,580 bytes в девяти owner Git.
Последние десять журналов и Core cleanup receipts затем сохранены отдельными
local checkpoints перед удалением активной истории. Все удаляемые current
files/path sets сверены с exact reachable Git blobs. Удалены только 11 известных
completed plans/stub, 24 metadata, 41 root historical files и девять новых dated
completion trees; неизвестные архивы и пользовательские checkout сохранены.

| Владелец | Первый durable SOURCE-MAP | Последний журнал checkpoint |
| --- | --- | --- |
| quarto-course | [694a52a3bad60b6830d732f4144ff4866e6bc237](https://github.com/Afonenko-Course-Tools/quarto-course/blob/694a52a3bad60b6830d732f4144ff4866e6bc237/docs/history/2026-10-08-completion/SOURCE-MAP.json) | [35ab45a60d3859c4aa584499e4a49c5b8b6f14bf](https://github.com/Afonenko-Course-Tools/quarto-course/blob/35ab45a60d3859c4aa584499e4a49c5b8b6f14bf/docs/history/2026-10-08-completion/final-journals/2026-10-08-implementation.md) |
| quarto-course-cloud | [2f8882ece4d126497956b66adfa73661b1d01941](https://github.com/Afonenko-Course-Tools/quarto-course-cloud/blob/2f8882ece4d126497956b66adfa73661b1d01941/docs/history/2026-10-08-completion/SOURCE-MAP.json) | [3c3774020191f66925b8567bbe8675aed42c01c9](https://github.com/Afonenko-Course-Tools/quarto-course-cloud/blob/3c3774020191f66925b8567bbe8675aed42c01c9/docs/history/2026-10-08-completion/final-journals/2026-10-08-implementation.md) |
| quarto-course-moodle | [95bd32d6c723868377480b7ef6add79d1e2d7694](https://github.com/Afonenko-Course-Tools/quarto-course-moodle/blob/95bd32d6c723868377480b7ef6add79d1e2d7694/docs/history/2026-10-08-completion/SOURCE-MAP.json) | [5c1609a2c79ae1f14a75fa9db4bdf012b409b72c](https://github.com/Afonenko-Course-Tools/quarto-course-moodle/blob/5c1609a2c79ae1f14a75fa9db4bdf012b409b72c/docs/history/2026-10-08-completion/final-journals/2026-10-08-implementation.md) |
| quarto-course-prairielearn | [70f62d424fb87ca2355a492123d89d32db5126dd](https://github.com/Afonenko-Course-Tools/quarto-course-prairielearn/blob/70f62d424fb87ca2355a492123d89d32db5126dd/docs/history/2026-10-08-completion/SOURCE-MAP.json) | [ff9e5684bd841be72c461eda95e18d3a789ba7f6](https://github.com/Afonenko-Course-Tools/quarto-course-prairielearn/blob/ff9e5684bd841be72c461eda95e18d3a789ba7f6/docs/history/2026-10-08-completion/final-journals/2026-10-08-implementation.md) |
| quarto-course-print | [63cc9de26a894d5b5132f6463f3bba6e044dd332](https://github.com/Afonenko-Course-Tools/quarto-course-print/blob/63cc9de26a894d5b5132f6463f3bba6e044dd332/docs/history/2026-10-08-completion/SOURCE-MAP.json) | [54b8f1439993efe1af4b38a8c041f05175567a3e](https://github.com/Afonenko-Course-Tools/quarto-course-print/blob/54b8f1439993efe1af4b38a8c041f05175567a3e/docs/history/2026-10-08-completion/final-journals/2026-10-08-implementation.md) |
| quarto-project-download | [2c807dac27b9c2a8852d6b41a49c807877bd63d4](https://github.com/Afonenko-Course-Tools/quarto-project-download/blob/2c807dac27b9c2a8852d6b41a49c807877bd63d4/docs/history/2026-10-08-completion/SOURCE-MAP.json) | [c5aaeb43b94d3ccf131b5697d104b0fc1285a119](https://github.com/Afonenko-Course-Tools/quarto-project-download/blob/c5aaeb43b94d3ccf131b5697d104b0fc1285a119/docs/history/2026-10-08-completion/final-journals/2026-10-08-implementation.md) |
| quarto-project-publish | [2e761ba3e087f2e143c61bad25c263a25b809219](https://github.com/Afonenko-Course-Tools/quarto-project-publish/blob/2e761ba3e087f2e143c61bad25c263a25b809219/docs/history/2026-10-08-completion/SOURCE-MAP.json) | [8d1c650bc92b37edeb0630d71de6f9c5737118ce](https://github.com/Afonenko-Course-Tools/quarto-project-publish/blob/8d1c650bc92b37edeb0630d71de6f9c5737118ce/docs/history/2026-10-08-completion/final-journals/2026-10-08-implementation.md) |
| quarto-reference-catalog | [1f7c89f31aa0878a6057a1edd24863eec7448f14](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog/blob/1f7c89f31aa0878a6057a1edd24863eec7448f14/docs/history/2026-10-08-completion/SOURCE-MAP.json) | [a98e9362e68d4bd8f81129e25610928d96183630](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog/blob/a98e9362e68d4bd8f81129e25610928d96183630/docs/history/2026-10-08-completion/final-journals/2026-10-08-implementation.md) |
| quarto-template-course | [d2376c0e0d555d54ad2ddcfe765af74106a5d596](https://github.com/Afonenko-Course-Tools/quarto-template-course/blob/d2376c0e0d555d54ad2ddcfe765af74106a5d596/docs/history/2026-10-08-completion/SOURCE-MAP.json) | [d3b0652fcbe19d3d3b1a80808dfcbce57245c97c](https://github.com/Afonenko-Course-Tools/quarto-template-course/blob/d3b0652fcbe19d3d3b1a80808dfcbce57245c97c/docs/history/2026-10-08-completion/final-journals/2026-10-08-implementation.md) |

Восстановление: `git show <history-SHA>:<path>`; SOURCE-MAP указывает исходный
путь, bytes и SHA-256. ROOT START/AGENTS и последний ignored root ledger
сохранены в Core final-cleanup SOURCE-MAP. Исторические контракты и планы
не оставлены активными маршрутами. Финальные documentation commits/push
проходят отдельное независимое review; их будущие SHA здесь не выдуманы.

Время финальной проверки маршрута: **2026-10-08 08:01:42 UTC**, от старта 2026-10-07
23:36 UTC — **8:25:42**, лимит 9 часов / deadline
2026-10-08 08:36 UTC. Это время документальной проверки, а не будущего push.
Runtime/тесты назначались medium, спецификации/README/docs/инструкции и весь
шаблон — ultra; финальная docs работа выполнена с inherited ultra.
