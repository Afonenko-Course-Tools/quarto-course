# Учебные курсы Quarto

Core, Presentation и Navigation — три отдельно подключаемых расширения одного
bundle. Необязательный `course-theme` поставляет явно включаемую тему HTML.
Quarto владеет Markdown reader, include, metadata inheritance, вычислениями,
crossref, книгами, HTML и Reveal. Core проверяет предметные объявления ранним TS
JSON-filter и связывает их с поздними native наблюдениями. Presentation
оформляет материал; Navigation управляет готовыми слайдами.

Этот Git ref содержит **Core / Presentation / Navigation 9.3.0, кандидат**.
Дескрипторы `_extensions/*/_extension.yml` определяют версию исходников;
опубликованный immutable tag и assets подтверждаются отдельно. Совместимость
прежнего Core 8.1/NativeRun API не сохраняется. Публичный native вход
`public.ts` и Body v2 продолжают действовать; Java/checks контракты и export
принадлежат выбранному адаптеру.
[Переход и карта гарантий](docs/migration-ts.md) описывают удалённые интерфейсы.

## Подключение

Установите локальный checkout для разработки:

```sh
quarto add /absolute/path/to/quarto-course --no-prompt
```

Для опубликованной версии используйте подтверждённый неизменяемый тег. Сохраните
`_extensions` в Git. Установка пассивна: фильтры и hooks автор подключает явно.
Путь может содержать каталог владельца; используйте фактический установленный
путь.

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

Те же hooks доступны как `native-pre.ts`/`native-post.ts`; это один runtime.
Специальный `course-core-runtime: native-ts` допускается, но больше не нужен для
выбора канона. Неизвестное значение отвергается. При отсутствии view/projection
действует student; full/author задаётся явно. Core требует текущий native owner
и успешные hooks; старые sidecars не становятся текущими данными.
Presentation/Navigation допускают самостоятельное использование. При совместном
подключении Core предшествует Presentation.

Cached native preview с явно пустым списком inputs/outputs обслуживается hooks
без создания пустой capture. Предыдущая ordinary operation становится
недоступной через current pointer; отсутствие списка или активная capture
reservation по-прежнему отвергаются.
[Граница zero-work](docs/native-operation-ts.md#cached-native-preview) и
[изменения 9.0.1](docs/releases/2026-11-01-native-preview.md) описывают
поведение.

## Предметный договор

`exercise-bank: true` задаёт явный банк. Объявления exercise, назначений и
ответов проверяются до projection; public AST не содержит closed key, grading
notes и private solution. Late native conditional witness определяет, что
действительно выжило. [Учебные элементы](spec/learning-elements.md),
[видимость](spec/visibility.md) и [стиль автора](docs/authoring-style-guide.md)
описывают разметку.

Внешние потребители используют `_extensions/course-core/public.ts`: исполняемые
схемы, выведенные типы и операции Quarto в пределах обработчика. Копия JSON/DTO
не продлевает срок жизни контекста. Метаданные настоящих документов передаёт
Quarto; отдельный узкий загрузчик объединяет только `course-project` для
каталогов кода.

- [Публичная native операция](docs/native-operation-ts.md): каталог, документы,
  выбранные ресурсы и проверка выпуска.
- [Контексты A1](docs/native-context-ts.md): namespace YAML, атомарные адреса,
  lifetime и batch reuse.
- [Материализация](docs/condition-materialization-ts.md): selected condition,
  README, closure и точные файлы.
- [Body](docs/body-export.md): закрытый пакет и public projection.
- [Assignment](docs/native-assignment-ts.md): текущая native generation,
  prepared lease и private roles.
- [Presentation](docs/presentation.md) и
  [Navigation](_extensions/course-navigation/README.md).

Java/checks manifests, Jobs и runtime-specific scoring проверяет владелец
адаптера. Core не запускает Java/Gradle при обычном render. Schema tool setup не
нужен: исполняемый канон и выведенные TS-типы находятся у владельца, локальный
exact Zod входит в пакет. Старые reference schemas/CLI/model probes сохранены в
Git истории.

## Проверки

Минимальная версия Quarto — 1.11.5; совместимые новые версии поддерживаются.
Локальные проверки выполнены на 1.11.5 и 1.11.6 со штатным TypeScript runtime.
[Изменения 9.1.0](docs/releases/2026-11-01-ui-910.md) описывают навигацию,
оформление и версию runtime. Перед полным набором подготовьте точные публичные
входы раннего среза по `tests/early-slice-inputs.json`:

```sh
python3 tools/prepare-early-slice-inputs.py --root /absolute/path/to/inputs
export CORE_EARLY_FIXTURES=/absolute/path/to/inputs
npm ci
npx playwright install chromium
node tools/sync-contract.mjs --check
npm test
```

`npm test` запускает полный canonical native набор: все A1/A2/A3/A4 suites,
assignment boundary tests, реальные installed renders,
Body/answers/child/process и Presentation/Navigation browser suites.
`npm run test:quick` опускает полный ранний срез и браузер. Отдельные suites
доступны через `tools/check-core-*-ts.sh`. Новые native guards не заменяются
private-injected fixtures или статическими type assertions.

Отдельная команда `npm run test:types:all` проверяет конечный собственный состав
из [typecheck/coverage.json](typecheck/coverage.json): весь TS-граф через
`tests/navigation-typecheck.ts`, JavaScript с `checkJs`, Python strict,
Lua через общий движок Performance и синтаксис Bash/Fish с ShellCheck для Bash.
Для неё после `npm ci` нужен абсолютный `COURSE_PERFORMANCE_SOURCE` на отдельный
checkout Performance с тем же ref, что в [.github/workflows/ci.yml](.github/workflows/ci.yml).
Одноразовая подготовка Ubuntu x64,
соответствующая CI:

```sh
export COURSE_PERFORMANCE_SOURCE=/absolute/path/to/quarto-course-performance
export QUARTO_PYTHON=/usr/bin/python3
core_luals_root=/absolute/existing-parent/core-luals
sudo apt-get update
sudo apt-get install -y shellcheck fish
bash "$COURSE_PERFORMANCE_SOURCE/tools/setup-lua-ci.sh" "$core_luals_root"
```

Новый каталог нужен только для setup. Последующие проверки используют уже
установленный LuaLS без повторного setup и скачивания. В новой оболочке заново
задайте показанные выше переменные путей, затем добавьте установленный `bin` в PATH:

```sh
export PATH="$core_luals_root/bin:$PATH"
npm run test:types:all
quarto run tools/check-lua.ts --probe
```

При одноразовом setup каталог `core_luals_root` должен быть новым,
его родитель — существующим;
общий setup устанавливает закреплённый LuaLS 3.19.2. Lua-проверка использует
штатные Quarto lua-types/plugin, а `--probe` отдельно проверяет отрицательный
контроль и границы выбранного состава. Статические типы и синтаксис имеют
собственный результат. Проверки выполнения, браузера и полного курса имеют отдельные результаты.

## Метрики и границы

Локальные фасады сохраняют ABI 1. `COURSE_PERF_MODE=off` по умолчанию сохраняет
обычный путь; активный контекст передаётся штатным child seam. Служебные
значения env не печатаются. Метрики загрузчика учитывают YAML reads/bytes и
чтение выбранных файлов. План учитывает реальные обходы выбранных деревьев,
включая сбор physical aliases объявленных ролей. Собственные source snapshots,
SHA, membership inventories и freshness fences удалены. Сохраняются lifetime,
containment, приватность файлов и target collisions.

Каждый участвующий YAML читается один раз за операцию Quarto; последовательные
пакетные обращения переиспользуют разобранные значения. Отдельные `inspect`
кодовых проектов, копия каталога курса и фиктивные QMD не используются.
[Точный договор слоёв и путей](docs/native-context-ts.md) задаёт применимую
семантику. Ограниченная fixture не доказывает ускорение полного курса, UI,
Docker или готовность production. Исторические версии доступны в Git и
[GitHub Releases](https://github.com/Afonenko-Course-Tools/quarto-course/releases).

## Общее меню и тема

[Navigation](docs/navigation.md) предоставляет публичную композицию HTML/Reveal
для Site и режим аудитории вместе с Presentation. Для применения палитры и
системных шрифтов выберите
[формат `course-theme-html`](_extensions/course-theme/README.md). Штатные
форматы и темы сохраняют прежнее поведение, пока новые возможности не включены
явно. Эти изменения находятся в разработке и не обозначают новый выпуск.

[Стадии native hooks 9.2.2](docs/releases/2026-11-02-own-stage-progress-922.md)
сообщают начало, завершение или ошибку и время подготовки/финализации модели в
stderr. Числа inputs/outputs берутся из уже прочитанного native selection;
`--quiet` подавляет новый progress.

`withProjectContracts` возвращает `{owner, input, profiles, format, contract}`,
где `input` — каталог кода, а пути contract абсолютны. `ArtifactFiles` и
`NativeResourceFiles` передают конечные байты/targets/audience без собственных
подписей и сертификатов. Старые origins/inventory/proof API не поддерживаются.
