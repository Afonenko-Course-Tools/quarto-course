# Учебные курсы Quarto

Предметно независимая спецификация учебной разметки и три отдельно подключаемых
расширения: `course-core`, `course-presentation`, `course-navigation`.
Книга, семинар и слайды используют обычные форматы Quarto, стандартные ссылки
и идентификаторы. Cloud и PrairieLearn устанавливаются отдельно и не нужны
для обсуждений, рефератов и ручного оценивания.

## Состав

| Пакет | Ответственность |
|---|---|
| `course-core` | Учебные роли, профили, связи, извлечение фактов AST и проверка спецификации CUE |
| `course-presentation` | Подписи метаданных, раскрытие подсказок и ответов, статическое представление при печати |
| `course-navigation` | Управление Reveal, оглавление, обзор, история переходов, поиск |

Отдельные репозитории предоставляют [тему БГУ](https://github.com/BSU-RFCT-Afonenko-Courses/quarto-theme-bsu),
[скачивание материалов](https://github.com/Afonenko-Course-Tools/quarto-project-download),
[составную публикацию](https://github.com/Afonenko-Course-Tools/quarto-project-publish)
и [каталог ссылок](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog).
Core не создаёт ZIP, не собирает подпроекты и не выполняет студенческий код.

## Подключение

```sh
quarto add Afonenko-Course-Tools/quarto-course
```

Установка пассивна: обработчики сборки не добавляются автоматически.
Ниже показаны пути после установки из GitHub; при локальной установке Quarto
может не создавать каталог владельца. Используйте фактически созданный путь.

```yaml
project:
  type: book
  pre-render: _extensions/Afonenko-Course-Tools/course-core/entrypoints/pre.ts
  post-render: _extensions/Afonenko-Course-Tools/course-core/entrypoints/post.ts
course:
  id: example-course
  validate: true
  adapters: []
filters: [course-core, course-presentation]
```

Для извлечения фактов достаточно фильтра `course-core` и `course.id`.
Проверка CUE включается явно через обработчики и `course.validate: true`.
`course-presentation` и `course-navigation` допускают самостоятельное использование.
Если задан `course`, фильтр Core должен предшествовать Presentation.

`course.adapters` перечисляет имена подключаемых адаптеров, например
`[cloud, prairielearn]`; установленные, но не выбранные адаптеры не расширяют
модель и не добавляют проверки. Фильтр каждого выбранного адаптера также
включается явно после Core. Для отдельной проверки допустим
`quarto run .../entrypoints/check.ts КАТАЛОГ --adapter ПУТЬ`.

Нужны актуальные Quarto и CUE для полной проверки. Lua и TypeScript запускаются
встроенными Pandoc и Deno. Node.js нужен только разработчику для проверки
производных словарей и браузерных тестов. Пути обработчиков Quarto следует
размещать в каталогах без пробелов; кириллица допустима.

## Разметка

````qmd
:::: {#exr-predict course-role="prediction" difficulty="introductory" time="2" work-mode="pair"}
## Прогноз результата

Обсудите, какой результат можно ожидать и как его проверить.
::::

::: {#sol-predict for="exr-predict"}
## Объяснение
Сопоставьте гипотезу с исходными предпосылками.
:::
````

Для оцениваемого задания добавляется `target="manual"` либо имя выбранного
адаптера. Без `target` упражнение остаётся учебным элементом. Поля `project`
и разделы занятия нужны только там, где они используются содержанием курса.

[Учебные элементы](spec/learning-elements.md), [видимость](spec/visibility.md),
[архитектура](spec/plugin-architecture.md) и [представление](docs/presentation.md)
описывают текущий единый контракт; версии схем в документах отсутствуют.

## Границы модулей

| Каталог Core | Назначение |
|---|---|
| `domain` | Типы и объединение фактов, без файловой системы и процессов |
| `application` | Сценарий проверки через порты |
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

## Проверка

```sh
node tools/sync-contract.mjs --check
quarto run tests/example.ts
quarto run tests/core-activation.ts
quarto run tests/pedagogy.ts
quarto run tests/visibility.ts
quarto run tests/presentation.ts
```

Проверяются реальные сборки, ошибочные модели, изоляция установки и активации,
профили, порядок фильтров и независимое представление. Браузерные проверки:
`npm ci`, `npx playwright install chromium`, `npm run test:navigation-model`,
`npm run test:browser`. Для проверки текста PDF нужен Poppler.

Пример `examples/course` использует локальную установку `quarto add ../..`
и явные обработчики без пространства имён владельца. Результаты `_generated/`,
`.quarto/` и выходные каталоги не хранятся в Git. Проверенная модель находится
в `_generated/course-spec/course.json`. Core очищает только свои результаты;
фрагменты адаптеров принадлежат самим адаптерам.
