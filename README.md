# Учебные курсы Quarto

Предметно независимая спецификация учебной разметки и три отдельно подключаемых
расширения: `course-core`, `course-presentation`, `course-navigation`.
Книга, семинар и слайды используют обычные форматы Quarto, стандартные ссылки
и идентификаторы. Core проверяет фактический AST обычного native render и
сохраняет предметный результат текущего документа. Cloud и PrairieLearn устанавливаются отдельно и не нужны
для обсуждений, рефератов и ручного оценивания.

## Состав

| Пакет | Ответственность |
|---|---|
| `course-core` | Учебные роли, профили, связи, извлечение фактов AST и проверка спецификации CUE |
| `course-presentation` | Подписи метаданных, раскрытие подсказок и ответов, таблицы плана курса, статическое представление при печати |
| `course-navigation` | Управление Reveal, оглавление, обзор, история переходов, поиск |

Отдельные репозитории предоставляют [тему БГУ](https://github.com/BSU-RFCT-Afonenko-Courses/quarto-theme-bsu),
[скачивание материалов](https://github.com/Afonenko-Course-Tools/quarto-project-download),
[native композицию сайта](https://github.com/Afonenko-Course-Tools/quarto-project-publish)
и [каталог ссылок](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog).
Core не создаёт ZIP и не собирает подпроекты. Вычисления выполняет выбранный
штатный движок Quarto; Core принимает в том числе сгенерированную им разметку.

## Подключение

```sh
quarto add Afonenko-Course-Tools/quarto-course@v3.0.1
```

Установка пассивна: обработчики сборки не добавляются автоматически.
Ниже показаны пути после установки из GitHub; при локальной установке Quarto
может не создавать каталог владельца. Используйте фактически созданный путь.

```yaml
project:
  type: default
  output-dir: _site
  render: [index.qmd]
format: html
filters: [course-core, course-presentation]
```

Для обычных `exr-*`, `exm-*`, `sol-*` достаточно фильтра `course-core`.
`course.id` нужен только выбранному экспорту и задаётся один раз в логическом корне. Автор вызывает обычный `quarto render index.qmd --profile student`
или `quarto preview`; cache/freeze и выполнение кода остаются у Quarto.
Предметные объявления проверяются до проекции видимости, поэтому неверная
скрытая ветвь также отклоняется. IDs берутся из текущего AST; отдельного
доказательства authored/automatic происхождения нет.
`course-presentation` и `course-navigation` допускают самостоятельное использование.
Если задан `course`, фильтр Core должен предшествовать Presentation.

Для явного полного результата подключите лёгкие native hooks из
[контракта текущего запуска](docs/native-run.md). Они не запускают дополнительный
render. Полный вызывающий процесс проверяет успешный native exit и передаёт
явные текущие документы в `assembleRelease` с выбранными view/profiles.

## Разметка

````qmd
## Тема {#sec-prediction-topic}

:::: {#exr-predict course-role="discussion" difficulty="introductory" time="2" work-mode="pair"}
## Прогноз результата

Обсудите, какой результат можно ожидать и как его проверить.
::::

::: {#sol-predict for="exr-predict"}
## Объяснение
Сопоставьте гипотезу с исходными предпосылками.
:::
````

Каждый `exr-*` входит в `Exercise`. Назначение, сложность, окружающий
`sec-*`, `target` и заголовок необязательны. Если метаданные указаны, их
значения проверяются. `exm/sol` могут существовать самостоятельно; для
связи решения используйте вложение или явный `for`. Один суффикс ID не
создаёт обязательную пару. Явный `target="manual"` или зарегистрированный
адаптер сохраняет платформенную привязку и её требование ведущего заголовка.

Работа или раздатка задаёт один местный состав `.task-items`:

```qmd
::: {.task-items}
1. @exr-predict
2. [@exr-check]{requirement="optional"}
:::
```

`assessment: {id: prediction-lab, kind: lab}` задаёт устойчивый ID и вид
работы (`lab/test/exam/handout`). Без kind это неоцениваемая раздатка.
Для оцениваемой работы назначение по умолчанию required; optional относится к
назначению в этой работе. `.assessment-items` и `.print-items` удалены.

[Учебные элементы](spec/learning-elements.md), [видимость](spec/visibility.md),
[архитектура](spec/plugin-architecture.md) и [представление](docs/presentation.md)
описывают текущий единый контракт; версии схем в документах отсутствуют.

## Профили и результаты

Для двух представлений задайте отдельные штатные профили. Например,
`_quarto-student.yml`:

```yaml
project:
  output-dir: _book-student
course:
  view: student
```

В `_quarto-full.yml` используйте `_book-full` и `course.view: full`.
Student скрывает ключи, grading-notes и закрытые решения обычных задач книги;
решение демонстрации/примера доступно, если сама задача открыта. Reveal сохраняет
авторские решения. Control-страницы автор исключает из списков входных файлов student;
`course-role="control"` не скрывает текст автоматически. Для условий используйте
штатные `.content-visible/.content-hidden when-profile/unless-profile`.
Full содержит преподавательский материал. Открытый Git содержит исходники
независимо от профилей публикации.

Фильтр сохраняет `DocumentResult` с `scope: "document"`, исходным `source`,
`course`, упражнениями, assessment и педагогическими элементами. Envelope
`document` содержит `{source, format, output, profiles}`; output относится к
native output-dir. Файлы находятся в
`_generated/course-spec/documents/<student|full|default>/<hash(source,format)>.json`.
Audience и Pandoc format хранятся раздельно; например, native gfm использует
writer `commonmark`. Local render инвалидирует прежний `course.json` и свой
прежний результат перед предметной проверкой. Междокументные assessment members
сохраняются до полного финализатора; внутридокументная ссылка на скрытую Course
цель отклоняется сразу.

Чистая функция `assembleRelease(expectedSources, documents, adapters, {view, profiles, format?})` в
`domain/release.ts` возвращает `{scope: "release", documents, model}`. Она
принимает только явно переданные результаты одного текущего успешного полного
запуска, проверяет точное покрытие, одинаковые Course/view/profiles,
уникальность Exercise/Assessment IDs, targets и assessment members. Одинаковый
Header ID на разных страницах допустим. Она не читает retained каталог и не
запускает render. Установка фильтра сама не создаёт полный `course.json`.

Результат документа подтверждает предметную проверку на этапе Core, а не успех
последующих фильтров, writer или hooks. Вызывающий полный финализатор обязан
передавать только результаты успешных текущих native команд; старый локальный
файл не подтверждает успех нового запуска. Для root композиции используется отдельное опциональное расширение course-site.

## Публичный Body для потребителей

Из логического корня явно выберите банк и одну работу:

```sh
quarto run _extensions/course-core/entrypoints/export.ts \
  --book tasks --work prediction-lab \
  --output _generated/exports/prediction-lab.json
```

Команда выполняет один штатный исходный JSON-проход со штатными функциональными
профилями и полными исходниками выбранного банка, включая control вне списков
глав HTML. Native ownership ограничивает исходники выбранным book-проектом;
вложенные самостоятельные проекты не входят в банк. Полный HTML не готовится.
Сначала выбирается местный состав
работы, затем проверяется поддержка выбранных Body nodes. Выдаются закрытый
пакет и отдельный public package без ключей, решений и заметок.
`collectExport` возвращает выбранный ReleaseResult для адаптеров;
`buildBodies` отделяет публичные поля. Подробности в [Body API](docs/body-export.md).

## Границы модулей

| Каталог Core | Назначение |
|---|---|
| `domain` | Типы и объединение фактов, без файловой системы и процессов |
| `infrastructure` | Quarto, CUE, файлы и обнаружение явно выбранных адаптеров |
| `entrypoints` | Явные обработчики и команда проверки |
| `spec` | Нормативная схема CUE |

Роли, атрибуты, перечисления, подписи и предельные значения определяются в
`_extensions/course-core/contract-vocabulary.json`. Lua Core читает его напрямую;
TypeScript, CUE и независимый Presentation используют производные представления.
Они коммитятся вместе с пакетами, поэтому установленный курс не запускает генератор.

```sh
node tools/sync-contract.mjs
node tools/sync-contract.mjs --check
```

Генератор синхронизирует словарь контракта; он не компилирует курс и не создаёт
платформенные задания. CI отклоняет рассогласование производных файлов.

## Авторские материалы

[Руководство по оформлению](docs/authoring-style-guide.md) содержит русские
рекомендации и Java-примеры. Учебные роли не привязаны к программированию:
обычная задача может содержать текст, обсуждение и ручную проверку. Стартовые
файлы выдаёт отдельно подключённый Download, а запуск программ, импорт в LMS
и получение оценок относятся к соответствующей платформенной интеграции.

## Диагностика

[Русский справочник ошибок](docs/diagnostics.md) содержит стабильные ID,
контекст исходного документа/объекта/поля и действия автора. Внешний отказ
сохраняет инструмент, exit code, stdout/stderr и причину. Публичный render
сохраняет `fail-if-warnings`; внутренний source render выбранной работы явно
использует `--fail-if-warnings=false`, сохраняя предупреждения и предметные
отказы. Новый lint-набор не вводится.

## Проверка

```sh
node tools/sync-contract.mjs --check
npm test
quarto run tests/native-document.ts
quarto run tests/native-lifecycle.ts
quarto run tests/pedagogy.ts
quarto run tests/visibility.ts
quarto run tests/presentation.ts
```

Эти команды проверяют реальные сборки, ошибочные модели, изоляцию установки и активации,
профили, порядок фильтров и независимое представление. Браузерные проверки:
`npm ci`, `npx playwright install chromium`, `npm run test:navigation-model`,
`npm run test:browser`. Для проверки текста PDF нужен Poppler; generated-markup tests требуют R/knitr и Python/Jupyter. CI фиксирует Quarto 1.10.18/1.11.5 и CUE v0.17.1.

Пример `examples/course` использует локальную установку `quarto add ../..`,
профили student/full и обычный native render.
Выбранный экспорт из корня использует `--book .` и ID работы; он подключает
свои служебные hooks автоматически. Для полного NativeRun/check API нужны
явные опциональные hooks. См. [native run API](docs/native-run.md).

## Версии и обновление

Версия `v3.0.1` ограничивает исходный экспорт native владельцем выбранного
банка. Контракт v3 содержит однократную миграцию: task-items,
необязательные метаданные обычных задач, root course.id для выбранного
экспорта и штатные условия Quarto. Старый синтаксис не поддерживается.
Все три расширения устанавливаются одним bundle. После публикации тега
закрепляйте явную версию и сохраняйте `_extensions` в Git курса. Для обновления
установите следующий тег, проверьте diff и выполните проверки. Опубликованные
теги неизменяемы; исправления получают новый тег.
