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
[native композицию сайта](https://github.com/Afonenko-Course-Tools/quarto-course-site)
и [каталог ссылок](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog).
Core не создаёт ZIP и не собирает подпроекты. Вычисления выполняет выбранный
штатный движок Quarto; Core принимает в том числе сгенерированную им разметку.

## Подключение

```sh
quarto add Afonenko-Course-Tools/quarto-course@v2.1.1
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
course:
  id: example-course
filters: [course-core, course-presentation]
```

Для учебных блоков и канонических `exr-*` достаточно фильтра `course-core` и
`course.id`. Автор вызывает обычный `quarto render index.qmd --profile student`
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

Каждый `exr-*` входит в `Exercise`, в том числе без `target`. Обязательны
`course-role` (demonstration, discussion, independent-study, control),
`difficulty` и окружающая тема с фактическим ID `sec-*`. Ведущий Header внутри задачи
без `target` не нужен. Необязательный `target="manual"` либо имя выбранного
адаптера сохраняет явную адаптерную привязку и её требование заголовка. Поля `project`
и разделы занятия нужны только там, где они используются содержанием курса.

[Учебные элементы](spec/learning-elements.md), [видимость](spec/visibility.md),
[архитектура](spec/plugin-architecture.md) и [представление](docs/presentation.md)
описывают текущий единый контракт; версии схем в документах отсутствуют.

## Профили и результаты

Для двух представлений задайте отдельные native profiles. Например,
`_quarto-student.yml`:

```yaml
project:
  output-dir: _book-student
course:
  view: student
```

В `_quarto-full.yml` используйте `_book-full` и `course.view: full`.
Обычные решения, control, ключи и grading-notes закрыты для student; решение
демонстрации доступно, если сама задача и её окружение открыты. Full содержит
преподавательский материал. Эти профили управляют публикацией; открытый Git
остаётся открытым и не становится хранилищем секретных тестов.

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
запуска, проверяет точное покрытие, одинаковые Course/view/format/profiles,
уникальность Exercise/Assessment IDs, targets и assessment members. Одинаковый
Header ID на разных страницах допустим. Она не читает retained каталог и не
запускает render. Установка фильтра сама не создаёт полный `course.json`.

Результат документа подтверждает предметную проверку на этапе Core, а не успех
последующих фильтров, writer или hooks. Вызывающий полный финализатор обязан
передавать только результаты успешных текущих native команд; старый локальный
файл не подтверждает успех нового запуска. Для root композиции используется отдельное опциональное расширение course-site.

## Публичный Body для потребителей

`buildBodies(result, {projectRoot, sources, release, includeClosed})` принимает
явный результат документа или курса. Public package не содержит ключей,
решений и заметок; закрытая выдача требует full-фактов. Подробности в
[Body API](docs/body-export.md).

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
профили student/full и явные обработчики без пространства имён владельца.
После успешного полного `quarto render --profile full` вызовите
`quarto run _extensions/course-core/entrypoints/check.ts . full`.
См. [native run API](docs/native-run.md).

## Версии и обновление

Подготовленная версия `v2.1.1` соответствует версии в `_extension.yml` всех трёх пакетов: Core, Presentation и Navigation устанавливаются одним bundle из тега репозитория. После публикации `v2.1.1` устанавливайте явный тег, как в команде выше, и сохраняйте установленные файлы `_extensions` в Git курса. Для обновления установите следующий опубликованный тег через `quarto add`, проверьте diff и выполните проверки курса. В `v2.1.1` стиль плана подключается классом `.course-plan` в атрибутах нативной таблицы, без авторского контейнера; `.responsive` обеспечивает штатную прокрутку Quarto. Опубликованные теги неизменяемы: исправления получают новую версию и новый тег.
