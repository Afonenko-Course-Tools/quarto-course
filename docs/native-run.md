# Native операция Core 9.1.1

Прежний NativeRun/IR маршрут удалён. Его исходники и свидетельства сохранены в Git истории до Core 9.0.0. Отдельные старые pointer/JSON/CLI не являются новым контрактом и не принимаются как current capture.

Действует [публичная native операция](native-operation-ts.md), [A1 metadata context](native-context-ts.md), [материализация](condition-materialization-ts.md) и [assignment выдача](native-assignment-ts.md). `public.ts` экспортирует runtime-схемы и выведенные TS-типы. Статическая типизация не заменяет проверку источников, операции, lifetime и конечных выходов.

Обычный проект использует `entrypoints/pre.ts` и `entrypoints/post.ts`; оба направляют на ту же native operation, что `native-pre.ts`/`native-post.ts`. Ранний JSON-filter использует штатный Quarto reader, inherited metadata и crossref. Late Lua только передаёт фактические native наблюдения. Без заданной projection/view действует student; author/full задаётся явно. Неизвестный `course-core-runtime` отвергается; старый флаг `native-ts` допускается как явное обозначение единственного маршрута.

Core не создаёт второй metadata resolver, не рендерит банк повторно для чтения данных и не считает старые файлы текущей операцией. Public getters работают без IO; byte/resource/materialization boundaries и final full fence сохраняют currentness.

Core 9.1.1 имеет статус unreleased. Полный курс, qualified assignment producer/P, установленная композиция и публикация требуют отдельных точных проверок.
