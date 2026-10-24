# Учебные курсы Quarto

Core, Presentation и Navigation — три отдельно подключаемых расширения одного
bundle. Quarto владеет Markdown, native exr/exm/sol, include, вычислениями,
профилями, crossref, книгами и Reveal. Core проверяет явный банк задач и состав
работы; Presentation оформляет материал; Navigation управляет готовыми слайдами.
Платформенные Print/Moodle/PrairieLearn/Cloud устанавливаются отдельно.

Контракты и их владельцы собраны в [индексе](spec/index.md). Этот Git ref
содержит bundle candidate **8.2.4** с Body v2. Версию подтверждают
`_extensions/*/_extension.yml`; до публикации соответствующего immutable tag
это unreleased исходники.

## Подключение

Для проверки локальной разработки установите полный локальный checkout в проекте:

```sh
quarto add /absolute/path/to/quarto-course --no-prompt
```

Для выпущенной версии используйте её неизменяемый тег, подтверждённый GitHub
Releases владельца. В курсе сохраняйте `_extensions` в Git. Установка пассивна:
фильтры и hooks автор подключает явно. При GitHub-установке путь может содержать
каталог владельца; используйте фактический установленный путь.
Поддерживаемый toolchain этой ветки: Quarto **1.11.5**, CUE **0.17.1**.

Выпуск 7.2.0 добавил типизированные факты `api-precheck`,
`verification-api-precheck` и `additional-java-sources` для exporter 7.1.0
и Platform 2.2.0. Он также включает принятые исправления Presentation/Navigation.
Опубликованные версии устанавливаются по неизменяемым тегам.

7.1.0 разрешает не задавать `time` банковской задаче. Заданное время остаётся
положительным целым числом минут; если оценка отсутствует хотя бы у одного
кандидата, вся сводка работы скрывается. Body v2, Presentation и Navigation
сохраняют прежнее поведение и транспортный контракт.

7.0.0 — несовместимое расширение закрытого Body v2: отдельные метаданные
вопроса и публичное введение работы. `slots`, ключи и правила выбора сохраняются. Обновляйте связанные consumers вместе с Core;
совместимость с прежними major-версиями не заявляется.

| Компонент | Совместимая версия контракта |
| --- | --- |
| Core / Presentation / Navigation candidate | 8.2.4 (Body v2, совместимый API Core 8.1) |
| PrairieLearn exporter candidate | 8.2.0 (delivery v3, API Core 8.1) |
| Download | 3.2.0 (необязательный Core bridge) |
| Platform / Gateway | Нужна отдельная проверка exact source/digest и delivery v3; прежние service releases не объявляются совместимыми |

Матрица задаёт совместимые контракты. Наличие опубликованного тега проверяется
в репозитории владельца; registry runtime image должен содержать опубликованный
OCI digest. Матрица сама по себе не подтверждает публикацию или готовность курса.
CI проверяет Core на Quarto 1.11.5 и CUE 0.17.1. Выпущенные версии и их assets доступны в [GitHub Releases](https://github.com/Afonenko-Course-Tools/quarto-course/releases); завершённые планы остаются в Git истории.


```yaml
project:
  type: book
  output-dir: _book
book:
  title: Учебный курс
  chapters: [index.qmd, tasks/index.qmd, seminar.qmd]
format: html
filters: [course-core, course-presentation]
```

Для обычных native упражнений вне банка специальные метаданные не нужны.
`course.id` нужен выбранному экспорту и задаётся один раз в логическом корне.
Presentation/Navigation допускают standalone использование. При подключении
Core он должен предшествовать Presentation.

## Явный банк и решение

Банк включает только `exercise-bank: true` в штатных метаданных Quarto:

```yaml
# tasks/_metadata.yml
exercise-bank: true
default-exercise-statement-visibility: open
```

```qmd
::: {#exr-checksum difficulty="introductory" time="10" course-role="demonstration"}
Покажите, как изменение байта влияет на контрольную сумму.

::: {.solution}
Вычислите сумму исходного файла, измените байт и сравните результаты.
:::
:::

::: {#exr-collision difficulty="intermediate" time="25"}
Объясните отличие случайной коллизии от намеренного подбора.
:::

::: {#sol-collision}
Случайная коллизия и поиск выбранного результата имеют разные предпосылки.
:::
```

Каждая банковская задача имеет обязательное итоговое difficulty; time необязательно;
time — положительное целое число минут. Эффективная statement visibility
обязательна: атрибут задачи имеет приоритет над default-exercise-statement-visibility.
Имя папки, book, course.id и `--book` банк не включают. Вне банка native
exr/exm/sol сохраняют Quarto и не входят автоматически в Course.

Именованное решение связывается с задачей того же QMD по suffix
`exr-collision → sol-collision`; анонимное solution вложено в задачу.
У банковского решения нет for, допускается один контейнер. Student показывает
решение только открытой канонической demonstration. Общие default-exercise-difficulty/time наследуются через штатные metadata Quarto; work-mode задаётся назначению. [Правила](spec/learning-elements.md).

## Работа, stage и время

```qmd
---
assessment:
  kind: seminar
  theory-time: 15
---

# Семинар по целостности {#sec-integrity-seminar}

::: {.task-items stage="demonstration"}
1. @exr-checksum
:::

::: {.task-items stage="classroom"}
1. [@exr-collision]{work-mode="pair"}
:::
```

Один QMD — одна работа; явные виды: lab, seminar, practical, test.
Экзамен использует test. ID задаётся assessment.id, chapter-id либо первым
заголовком. Несколько task-items сохраняют общий порядок; в каждом пункте
одна позиция fixed либо random, без повторов кандидатов во всей работе.
Stage demonstration/classroom/homework необязателен. Span назначения задаёт
requirement required/optional и work-mode individual/pair/group;
defaults — required/individual. Stage demonstration требует open,
каноническую роль demonstration и фактическое публичное решение.
Practical/test назначают только restricted; открытый пример можно показать
обычной ссылкой в assessment-preview вне состава.

В модели ordered `slots`: `{id,selection,candidates,assignment}`. Fixed имеет
одного кандидата, random — явный alt-* и минимум два:

```qmd
::: {.task-items stage="homework"}
1. [@exr-lunar-weight; @exr-gallon-conversion]{.task-alternatives #alt-numbers-conversion selection="random"}
:::
```

Обязательность и work-mode принадлежат всей позиции. Время группы — min–max
кандидатов; диапазоны суммируются, theory-time учитывается отдельно один раз.
Body v2 сохраняет весь канонический состав до audience фильтрации.

## Student/full и выбранный экспорт

Student/full — штатные профили с отдельными output-dir и course.view.
Student скрывает restricted условия и ссылки назначений, ключи, grading-notes
и решения обычных банковских задач. Full сохраняет банк. Полные raw объявления
проверяются до скрытия; student не сохраняет удалённые закрытые AST.
Публичный сайт, поиск, QRC, ресурсы и ZIP проверяются на отсутствие закрытых тел.
В student-профиле банка отключите нативное встраивание QMD в HTML Source;
Core дополнительно убирает уже созданный нативный source AST-контейнер на
страницах банка и работ, сохраняя прочие настройки Code Tools.
Внешняя ссылка на открытый GitHub допустима. [Видимость](spec/visibility.md).

```sh
quarto run _extensions/course-core/entrypoints/export.ts \
  --book tasks --work sec-integrity-seminar \
  --output _generated/exports/integrity.json
```

Selected export выполняет один native JSON-проход по полным исходникам
выбранного native book-владельца, включая QMD вне HTML chapters.
После выбора одной работы остаются её условия, поля ответа и ресурсы;
assessment-preview, внешние headings и окружающая проза исключены.
Внутренние headings задачи сохраняются. Restricted условие разрешено выдать
участнику Print/PrairieLearn; Body statementVisibility отдельно от
participant-safe `visibility: public`. Ключи/solution/gradingNotes остаются
в закрытом payload; рядом записывается `.public.json`.
Moodle использует преподавательские ключи по собственному контракту.
[Body API](docs/body-export.md) описывает выбор и границы ресурсов.

## Компоненты и текущий запуск

| Компонент | Ответственность |
| --- | --- |
| course-core | Явный банк, raw проверка, назначения, AST facts, CUE и selected Body |
| course-presentation | Подписи, готовые сведения о времени, раскрытие публичных ответов, Reveal и печать |
| course-navigation | Оглавление, обзор, поиск и история готовых native слайдов |
| [Publisher](https://github.com/Afonenko-Course-Tools/quarto-project-publish) | Явная композиция native подпроектов |
| [QRC](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog) | Адресные межпроектные ссылки без импорта тел |
| [Download](https://github.com/Afonenko-Course-Tools/quarto-project-download) | Архив явно выбранных разрешённых ресурсов |

Native pre/post hooks требуются для междокументной student-проекции,
строгой полной проверки и времени; дополнительный render они не запускают.
В student filters-only неизвестные назначения пропускаются. Указатель связан с
отпечатками root/активной profile конфигурации, без исторического fallback;
это ограниченная проверка конфигурации, а не процессный runtime.
`assembleRelease` объединяет только
явные документы одного успешного run; retained JSON не доказывает успех.
Raw declarations/assessmentCompositions не содержат тел и нужны для
междокументных guards и сумм. Публичное solution witness подтверждается после
native условий; для demonstration в выбранном JSON-экспорте используйте
переносимый solution, существующий в этом source формате. Для отложенных
HTML-назначений Core использует публичный этап `post-quarto`: уже обработанный
Quarto элемент переносится через `quarto.doc.include_text('after-body', ...)`
в скрытый служебный контейнер вне `main`. Нативный resolver книги сохраняет
точные адрес и подпись ссылки; native search индексирует публичные название
и preview работы без отложенных ссылок. Core post переносит разрешённую
нативную разметку на место назначения, удаляет служебные контейнеры и завершает
проекцию DTO и ресурсов перед full guards и downstream QRC.
[NativeRun](docs/native-run.md),
[архитектура](spec/plugin-architecture.md), [Presentation](docs/presentation.md),
[Navigation](docs/navigation.md).

Единый словарь читается Lua напрямую; TS/CUE/Presentation производные коммитятся
вместе с bundle и проверяются `node tools/sync-contract.mjs --check`.
Установленный курс не запускает генератор. Новый общий runtime и Markdown-парсер
не вводятся; cache/freeze остаются у Quarto.

## Авторская работа и проверка

[Русское руководство](docs/authoring-style-guide.md) содержит копируемую разметку
всех ролей, банковских задач, работ и профилей. [Демонстрация](examples/course/README.md)
показывает отдельные банк и Reveal; [обычные примеры стиля](examples/style-guide/README.md)
остаются native Quarto вне банка. [Диагностики](docs/diagnostics.md) сохраняют
стабильные ID, source/id/field и причины внешних отказов.
Нативный [пример презентации](examples/presentation/README.md) показывает
выравнивание абзацев, содержательные начала разделов и слайды-продолжения.
Публичный render использует fail-if-warnings; внутренний selected JSON pass
явно разрешает native warnings и сохраняет semantic errors.

```sh
node tools/sync-contract.mjs --check
npm test
quarto run tests/native-document.ts
quarto run tests/native-lifecycle.ts
quarto run tests/pedagogy.ts
quarto run tests/visibility.ts
quarto run tests/presentation.ts
npm run test:navigation-model
npm run test:browser
```

Браузерные проверки требуют Playwright/Chromium; текст PDF — Poppler;
проверка generated markup — R/knitr и Python/Jupyter. CI использует только
Quarto 1.11.5 / CUE 0.17.1. Локальная проверка нового checkout и опубликованный
тег подтверждаются отдельно.
На Windows Quarto 1.11.5 возможен upstream recoverEncode на кириллическом пути;
временный обход — путь без кириллицы. Это не исправление Quarto.

## Метрики производительности

Значимые операции и явные обходы AST размечены локальным фасадом ABI 1.
В обычной сборке (`off`, по умолчанию) фабрики возвращают исходные функции:
агент, hooks, часы телеметрии и журналы не загружаются. Расширение самодостаточно.
Сбор метрик включается launcher проекта `quarto-course-performance`; установка
`COURSE_PERF_MODE` сама по себе агент не загружает и не обеспечивает валидные данные.
TypeScript использует wall time, Lua — CPU процесса; шкалы анализируются раздельно.
Counters обходов не являются числом посещённых AST-узлов.

Прежний `COURSE_BUILD_TRACE` удалён; для новых измерений используются фасады ABI 1.
Копии `observability/bridge.ts` и `bridge.lua` синхронизируются из проекта Performance.

## Основание выпущенного контракта 8.0.0

Bundle Core/Presentation/Navigation выпускается с одним номером. Core добавляет
`selection=choice`, материализацию выбранных проектов и точный student inventory.
Native capture требует текущий закрытый pointer/witness, original inspection
preimages и проверку source/currentness до и после чтения; прежние captures и
consumers не объявляются совместимыми. Body остаётся `course-body-package-v2`.

Exporter8 использует delivery v3; Download3.2 получает готовый Core inventory.
Устанавливайте согласованные immutable refs после публикации и проверяйте курс
отдельно. Source release не означает готовность банка, native runtime или Moodle.
Точный ref 8.0.0 и его опубликованные assets неизменны; новый candidate требует собственные CI, tag и archive receipts.

## Выпуск 7.3.0

`course.assessment-time: false` скрывает сводку и подписи времени, сохраняя
исходные оценки в модели и Body. Без настройки прежнее поведение сохраняется.
Исправлено размещение условий назначений в итоговом HTML. Подписи поиска,
якорей и отсутствующих заметок лектора локализуются только для русского документа.
Выпуски 7.1.0 и 7.2.0 опубликованы; новый тег 7.3.0 обозначает эту поставку.

## Локальный кандидат Core 8.1.0

Закрытый optional `java-build` включает только opt-in `java25-gradle-junit-v1`
implementation. Record и его hash closure описаны в [контракте project checks](docs/project-checks.md).
Core не собирает и не запускает Java/Gradle. Для нового runtime нужен Exporter
8.1.0 и отдельные exact Platform registry/image proofs; published теги 8.0.0
не меняются. Поведение Presentation/Navigation и Body v2 сохранено. Source candidate
не закрывает archive/install/CI/image/course gates.

## История bundle 8.2.1

Сокращены повторные вызовы `quarto inspect` при чтении common-path binding.
В 8.2.1 producer записывает новые original preimages без перечитывания всех
прежних файлов после каждого append. Полные свежие проверки store и source
closure выполняются на фиксированных границах фаз до использования original
данных и до публикации witness, pointer или результата. Consumer повторно
использует только неизменяемый разобранный proof внутри конечной фазы A/B;
проверки текущего источника, pointer, профиля и инструмента остаются внутри callbacks.
Свежие проверки source/currentness, pointer/witness и точных original inspection
preimages сохранены; постоянный cache не вводится. API Core 8.1, Body v2 и
поведение Presentation/Navigation не изменены. Все три расширения получают
один номер bundle 8.2.1.

Exporter 8.2 использует совместимый API Core 8.1; его закреплённая dependency
сама по себе не меняется при подготовке этого bundle. Перед установкой в курс
нужны принятые exact refs и собственные CI/archive/install receipts. Кандидат
не подтверждает публикацию, whole-course производительность, готовность банка
или Platform runtime/image.

## Кандидат bundle 8.2.2

При выбранном экспорте с составными hooks исходная конфигурация сохраняется
в закрытом контексте запуска. На время выполнения producer использует отдельную
конфигурацию того же владельца с единственной парой Core hooks, затем восстанавливает
исходный файл с теми же байтами, inode, владельцем, правами и mtime до возврата
результата. Подмена чужого файла, коллизии путей и изменение исходников отклоняются.
Производные значения `book.render` и добавленный native engine отделяются от
авторских значений по точному сохранённому inspection; произвольного слияния нет.

Этот режим использует закрытые pointer v3 и common-path witness v2 вместе с
свидетельством восстановления. Обычный режим сохраняет прежние pointer v2 и
witness v1. Публичные API Core 8.1, Body v2 и авторская конфигурация не меняются.
Контролируемая замена поддержана на Linux x86_64 с проверенными системными
примитивами; неподдерживаемая среда отклоняется до записи. Проверка Windows
не заявляется. Все три расширения получают номер 8.2.2.

Адресный локальный сценарий неизменённого Site подтвердил экспорт ресурсов и
восстановление конфигурации. Полная hosted CI, совместимость внешнего Exporter
с новым закрытым режимом, выпуск и установка в курсы проверяются отдельно.
Номер кандидата не означает опубликованный тег или готовность всего банка.

## Кандидат bundle 8.2.4

Это независимая линия публикации от 8.2.2 с оптимизациями текущего Git ref:
повторным использованием исходного native stdout, пакетной consumer-операцией,
immutable принятой моделью и проверками на границах операции. Новые изменения
параллельной линии Performance, включая её bridge/env-контексты, сюда не перенесены.
Публичный тег `v8.2.3` принадлежит линии Performance и не обозначает эти исходники.

Для этого кандидата планируется отдельная ветка
`codex/course-publication-core-20261024`, тег `v8.2.4` на точном проверенном
source commit и GitHub release с `latest=false`. Это план выпуска; данный Git ref
сам по себе не подтверждает опубликованный тег, release или завершённую CI.

Native producer повторно использует исходный stdout только для одинакового
actual вызова stock Quarto; alias сохраняет отдельные physical/lexical роли.
Одна consumer-операция объединяет вложенные load/finish/save/materialize,
сохраняя независимые живые A/B проверки и полный original union до и после
использования. Завершённый NativeRun и materialization публикуются после B.
Внутренний межпакетный `withNativeArtifactBatch` связывает загрузку и подготовку
архивов одной callback-фазой; сохранённый resolver вне callback отказывает.
Операция работает в отдельном checkout с одним владельцем. Полные проверки
входов выполняются на границах A/use/B и перед публикацией; локальные вызовы
используют одну immutable принятую модель и проверяют свою фазу. Сохраняющееся изменение входов
отвергается на следующей границе до выдачи результата; непрерывная глобальная
неизменность filesystem между этими границами не обещается.

Публичные схемы, Body v2 и API Core 8.1 сохраняются. Все три расширения получают
номер 8.2.4. Измеренные бюджеты малых сценариев не заменяют проверку полного
банка, hosted CI, совместимости и опубликованной установки.

QMD metadata извлекаются одним stock Pandoc subprocess на закрытый preload:
каждый UTF-8/LF origin отдельно проходит native Markdown reader и native JSON
writer. YAML, BOM/CRLF/TAB и неподтверждённые формы сохраняют прежний CLI path.
Typed metadata/hash, diagnostics, path/bytes/tool guards и scope не меняются;
результаты не сохраняются между операциями или процессами.
