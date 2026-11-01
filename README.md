# Учебные курсы Quarto

Core, Presentation и Navigation — три отдельно подключаемых расширения одного bundle. Необязательный `course-theme` поставляет явно включаемую тему HTML. Quarto владеет Markdown reader, include, metadata inheritance, вычислениями, crossref, книгами, HTML и Reveal. Core проверяет предметные объявления ранним TS JSON-filter и связывает их с поздними native наблюдениями. Presentation оформляет материал; Navigation управляет готовыми слайдами.

Этот Git ref содержит **Core / Presentation / Navigation 9.1.1, unreleased**. Дескрипторы `_extensions/*/_extension.yml` определяют версию исходников; опубликованный immutable tag и assets подтверждаются отдельно. Совместимость прежнего Core 8.1/NativeRun API не сохраняется. Публичный native вход `public.ts` и Body v2 продолжают действовать; Java/checks контракты и export принадлежат выбранному адаптеру. [Переход и карта гарантий](docs/migration-ts.md) описывают удалённые интерфейсы.

## Подключение

Установите локальный checkout для разработки:

```sh
quarto add /absolute/path/to/quarto-course --no-prompt
```

Для опубликованной версии используйте подтверждённый неизменяемый тег. Сохраните `_extensions` в Git. Установка пассивна: фильтры и hooks автор подключает явно. Путь может содержать каталог владельца; используйте фактический установленный путь.

```yaml
project:
  type: website
  output-dir: _site
  pre-render: [quarto run _extensions/course-core/entrypoints/pre.ts]
  post-render: [quarto run _extensions/course-core/entrypoints/post.ts]
format: html
filters: [course-core, course-presentation, course-navigation]
course:
  id: example
  view: student
```

Те же hooks доступны как `native-pre.ts`/`native-post.ts`; это один runtime. Специальный `course-core-runtime: native-ts` допускается, но больше не нужен для выбора канона. Неизвестное значение отвергается. При отсутствии view/projection действует student; full/author задаётся явно. Core требует текущий native owner и успешные hooks; старые sidecars не становятся текущими данными. Presentation/Navigation допускают самостоятельное использование. При совместном подключении Core предшествует Presentation.

Cached native preview с явно пустым списком inputs/outputs обслуживается hooks без создания пустой capture. Предыдущая ordinary operation становится недоступной через current pointer; отсутствие списка или активная capture reservation по-прежнему отвергаются. [Граница zero-work](docs/native-operation-ts.md#cached-native-preview) и [изменения 9.0.1](docs/releases/2026-11-01-native-preview.md) описывают поведение.

## Предметный договор

`exercise-bank: true` задаёт явный банк. Объявления exercise, назначений и ответов проверяются до projection; public AST не содержит closed key, grading notes и private solution. Late native conditional witness определяет, что действительно выжило. [Учебные элементы](spec/learning-elements.md), [видимость](spec/visibility.md) и [стиль автора](docs/authoring-style-guide.md) описывают разметку.

Внешние consumers используют `_extensions/course-core/public.ts`: runtime schemas, inferred types, callback-local native operations и A1 contexts. Простая копия JSON/DTO не даёт currentness authority. Native metadata передаётся через существующий Quarto protocol; собственного YAML merge/resolver или второго Course model нет.

- [Публичная native операция](docs/native-operation-ts.md): catalog, documents, resources, release validation, currentness и final fences.
- [Контексты A1](docs/native-context-ts.md): source origin, metadata, lifetime и batch reuse.
- [Материализация](docs/condition-materialization-ts.md): selected condition, README, closure и точные файлы.
- [Body](docs/body-export.md): закрытый пакет и public projection.
- [Assignment](docs/native-assignment-ts.md): qualified producer, authority и private roles.
- [Presentation](docs/presentation.md) и [Navigation](_extensions/course-navigation/README.md).

Java/checks manifests, Jobs и runtime-specific scoring проверяет владелец адаптера. Core не запускает Java/Gradle при обычном render. Schema tool setup не нужен: исполняемый канон и выведенные TS-типы находятся у владельца, локальный exact Zod входит в пакет. Старые reference schemas/CLI/model probes сохранены в Git истории.

## Проверки

Минимальная версия Quarto — 1.11.5; совместимые новые версии поддерживаются. Локальные проверки выполнены на 1.11.5 и 1.11.6 со штатным TypeScript runtime. [Изменения 9.1.0](docs/releases/2026-11-01-ui-910.md) описывают навигацию, оформление и версию runtime. Перед полным набором подготовьте точные публичные входы раннего среза по `tests/early-slice-inputs.json`:

```sh
python3 tools/prepare-early-slice-inputs.py --root /absolute/path/to/inputs
export CORE_EARLY_FIXTURES=/absolute/path/to/inputs
npm ci
npx playwright install chromium
node tools/sync-contract.mjs --check
npm test
```

`npm test` запускает полный canonical native набор: все A1/A2/A3/A4 suites, assignment boundary tests, реальные installed renders, Body/answers/child/process и Presentation/Navigation browser suites. `npm run test:quick` опускает полный ранний срез и браузер. Отдельные suites доступны через `tools/check-core-*-ts.sh`. Новые native guards не заменяются private-injected fixtures или статическими type assertions.

## Метрики и границы

Локальные фасады сохраняют ABI 1. `COURSE_PERF_MODE=off` по умолчанию сохраняет identity path и прежние разрешения вызова; активный контекст передаётся только штатным child seam. Служебные значения env не печатаются. Итоговые A1 metrics читаются после await и закрытия callback; repeated getters не делают IO. Source bytes/hash/discovery переиспользуются внутри operation. Синхронная выдача cached resource bytes сохраняет один entry fence; после нового чтения/hash и на final boundaries проверки остаются. Измерение fixture не доказывает универсального ускорения курса.

[Исправление 9.1.1](docs/releases/2026-11-01-literal-shortcodes-911.md) остаётся кандидатом; отдельная тема course-theme-html имеет версию 1.0.0. Exact hosted CI, immutable release provenance, combined installed consumers, actual qualified assignment/P, rich Body boundaries, все 135 задач и deployment проверяются отдельно. Исторические версии и отчёты находятся в Git истории и [GitHub Releases](https://github.com/Afonenko-Course-Tools/quarto-course/releases).

## Общее меню и тема

[Navigation](docs/navigation.md) предоставляет публичную композицию HTML/Reveal
для Site и режим аудитории вместе с Presentation. Для применения палитры и
системных шрифтов выберите [формат `course-theme-html`](_extensions/course-theme/README.md).
Штатные форматы и темы сохраняют прежнее поведение, пока новые возможности
не включены явно. Эти изменения находятся в разработке и не обозначают новый выпуск.
