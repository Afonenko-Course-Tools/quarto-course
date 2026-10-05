# Публикация учебного курса

`course-publication` — отдельный пассивный адаптер между публичным Owner API
Core и callback-договором Publisher. Он готовит выбранных владельцев, связывает
фактические native outputs и проверяет текущий stage перед публикацией. Он не
собирает подпроекты и не заменяет Core, Publisher, QRC или Download.

## Установка

```sh
quarto add Afonenko-Course-Tools/quarto-course
quarto add Afonenko-Course-Tools/quarto-project-publish
quarto add Afonenko-Course-Tools/quarto-course/integrations/publication
```

Core и этот адаптер устанавливаются из одного проверенного ref `quarto-course`.
Поддержанный native маршрут рассчитан на Quarto 1.10.18/1.11.5 и существующий
Core Owner protocol 1. Минимальная версия пакета — Quarto 1.10.0; другие версии
нуждаются в отдельной native проверке. Используются штатный Deno и публичные API
`owner.ts`, `navigation.ts`, `publication-resources.ts` установленного Core.

GitHub устанавливает пакет в
`_extensions/Afonenko-Course-Tools/course-publication`; команда
`quarto add /path/to/quarto-course/integrations/publication --no-prompt`
устанавливает полный локальный пакет в `_extensions/course-publication`. Пути
YAML должны соответствовать фактическим каталогам. Установка не добавляет
pre/post hooks, integrations, native test stages или selftest.

## Явное подключение

Существующие Publisher pre/post hooks и managed portal подключаются в проекте
как обычно. Добавьте конфигурацию и ordered integrations:

```yaml
course-publication:
  owned-members: [tasks]
  core-extension: _extensions/Afonenko-Course-Tools/course-core
project-publish:
  portal: index.qmd
  projects:
    tasks: { path: tasks, format: html }
    lectures: { path: lectures, format: revealjs }
  integrations:
    - _extensions/Afonenko-Course-Tools/course-publication/entrypoints/prepare.ts
    - _extensions/Afonenko-Course-Tools/reference-catalog/entrypoints/publication.ts
    - _extensions/Afonenko-Course-Tools/course-publication/entrypoints/finish.ts
    - _extensions/Afonenko-Course-Tools/course-publication/entrypoints/verify.ts
```

`owned-members` — явные namespaces из фактической конфигурации Publisher:
например `[exercises, labs]` или `[]`. Выбранные владельцы используют текущий
поддержанный Core HTML default/book маршрут. Неизвестные/повторные имена,
неподдержанные owned formats и неизвестные поля отклоняются. `core-extension`
задаётся относительно Source каждого владельца; root и выбранные владельцы
должны содержать одинаковые полные Core payloads по этому пути. Набор файлов,
байты, размеры и права сравниваются один раз при подготовке; дальнейшую
неизменность проверяет Core в текущем lifecycle.

Адаптер требует managed HTML portal и один выбранный профиль `student` или
`full`. Остальные native members остаются в поддержанном Navigation маршруте. Он
не обнаруживает задачи по имени каталога, не объединяет YAML самостоятельно и не
добавляет новые PDF/Body/platform contracts.

QRC ставится и подключается отдельно: если он выбран, его finalizer должен
предшествовать `finish`. `verify` остаётся последним configured validator после
других разрешённых stage producers. Без QRC его строка просто отсутствует.
Cloud, PrairieLearn, Print и Download не включаются установкой этого адаптера.

## Публичный договор

`publication.ts` экспортирует `prepare`, `metadata`, `finish`, `verify` и
диагностический `readPublicationStatus`. Entry points предоставляют структурные
Publisher callbacks без импорта его реализации. Подготовка, завершение и
проверка используют три отдельные `withOwnerValidationScope`; между callbacks и
native renders успешная проверка не переносится.

Закрытое attempt state хранится в `.project-publish/builds/<attemptId>/` и
связывает coordinator, Source, профиль, всю effective config, ordered members,
portal descriptor, настоящие Core handles и фактические outputs. State writer не
входит в публичный API. `readPublicationStatus` возвращает отдельную копию
краткой сводки без handles; эта диагностика не выдаёт owner proof или разрешения
ресурсов. Core заново подтверждает Source/runtime/stage и receipt при `verify`.

В установленном `_extensions/course-publication` находятся только runtime код,
метаданные и полная MIT-лицензия. Проверка учебной разметки во время render —
runtime работа Core, а не запуск тестового набора.

## Проверки разработчика

`tests/` лежит вне `_extensions` и не устанавливается через `quarto add`.
Настоящие passive installation, конфигурация, state binding и совместимость
пакетов проверяются так:

```sh
quarto run integrations/publication/tests/run.ts
```

Compile-time проверке Publisher boundary нужен соседний canonical checkout
`quarto-project-publish` в том же workspace. Она не импортируется runtime. Тесты
конфигурации/state явно синтетические и не утверждают native success. Installed
Template contracts отдельно используют настоящий выбранный Quarto, Core trace,
оба профиля и Source/module/stage mutation refusals. Полный Template CI
проверяет материалы и full→student preservation; он не входит в пакет.
