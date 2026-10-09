# Учебные курсы Quarto

Core, Presentation и Navigation — три отдельно подключаемых расширения одного
bundle. Quarto владеет Markdown, native exr/exm/sol, include, вычислениями,
профилями, crossref, книгами и Reveal. Core проверяет явный банк задач и состав
работы; Presentation оформляет материал; Navigation управляет готовыми слайдами.
Платформенные Print/Moodle/PrairieLearn/Cloud устанавливаются отдельно.

Контракты и их владельцы собраны в [индексе](spec/index.md). Версия определяется
`_extensions/*/_extension.yml` того же Git ref; изменения main до нового тега —
**unreleased**. Здесь описан текущий контракт bundle **4.0.1** того же Git ref.
Выпущенную версию читайте по неизменяемому тегу; изменения main после
последнего тега остаются unreleased.

## Подключение

Установите bundle с закреплённым тегом:

```sh
quarto add Afonenko-Course-Tools/quarto-course@v4.0.1
```

Для разработки выполняйте `quarto add PATH_TO_CHECKOUT --no-prompt`
в проекте-потребителе. В курсе закрепляйте неизменяемый тег и сохраняйте `_extensions`
в Git. Установка пассивна:
фильтры и hooks автор подключает явно. При GitHub-установке путь может содержать
каталог владельца; используйте фактический установленный путь.
Поддерживаемый toolchain этой ветки: Quarto **1.11.5**, CUE **0.17.1**.

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

Каждая банковская задача имеет обязательные итоговые difficulty/time;
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
ровно одна местная задача, без повторов во всей работе.
Stage demonstration/classroom/homework необязателен. Span назначения задаёт
requirement required/optional и work-mode individual/pair/group;
defaults — required/individual. Stage demonstration требует open,
каноническую роль demonstration и фактическое публичное решение.
Practical/test назначают только restricted; открытый пример можно показать
обычной ссылкой в assessment-preview вне состава.

В модели одна карта `assignments[id] = {stage?, requirement, workMode}` и
ordered items. Required/all суммы используют собственный time задач, включая
demonstration; pair/group время не масштабирует. Theory-time — необязательное
положительное конечное число минут вне уже учтённых задач. Для примера:
задачи — 35/35, теория — 15, занятие — 50/50 минут.
Partial preview пропускает недоступный итог или показывает `??`;
частичная сумма, ноль и старые sidecar не заменяют полный текущий результат.

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
