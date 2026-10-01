# P0: структурированная диагностика CUE, граф и STYLE

Это самостоятельная проба A2/A3/A4. Производственные `spec/core.cue`, collector,
runtime и общий контракт не изменены. Проверяется небольшой экспериментальный
конверт исходных фактов, а не полнота текущего или будущего учебного контракта.

## Воспроизведение

Проверенные версии: Quarto 1.11.5, его Pandoc 3.10 и Deno 2.7.14
(V8 14.7.173.20-rusty, TypeScript 5.9.2), CUE 0.17.1,
Graphlib 4.0.5, markdownlint 0.41.1. Сборка bundle: Node 24.19.0,
esbuild 0.25.12. Go 1.26.5 указан самим CUE как компилятор бинарного файла;
новый Go helper/runtime не добавлен.

Из корня репозитория, с Quarto/CUE/Deno в PATH:

```sh
deno check tests/probes/diagnostics.ts
deno run --allow-read --allow-env --allow-run --allow-write --deny-net --no-remote tests/probes/diagnostics.ts
deno run --allow-read --allow-env --allow-run tests/probes/diagnostics/runtime.ts tests/probes/diagnostics/fixtures/duplicate.json --terminal
deno run --allow-read tests/probes/diagnostics/style.ts tests/probes/diagnostics/fixtures/style-warning.qmd --terminal
```

Последние две команды печатают JSON в stdout и представление того же объекта
в stderr. Compiler возвращает 0 для допустимых фактов, 1 для semantic diagnostics,
2 для failure на границе транспорта/инструмента. STYLE entrypoint возвращает 0
при предупреждениях и 2 при отказе инструмента. STYLE не передаётся в warning-channel
Quarto render и не меняет исходник.

## Что доказано

| Fixture | Результат |
| - | - |
| `valid.json` | Concrete JSON, пустая diagnostics, exit 0 |
| `required-field.json` | `CORE.REQUIRED_FIELD`, root QMD / ID / `difficulty`, exit 1 |
| `unknown-field.json` | `SOURCE.UNKNOWN_EDUCATIONAL_FIELD`, root QMD / ID / `dificulty`, exit 1 |
| `duplicate.json` | `CORE.DUPLICATE_ID`, обе исходные QMD через source + related, exit 1 |
| `unknown-reference.json` | `REF.UNKNOWN_TARGET`, root QMD / ID / `to`, exit 1 |
| `relationship-conflict.json` | `GRAPH.RELATION_CONFLICT`, обе исходные записи, exit 1 |
| `malformed-shape.json`, `missing-provenance.json`, `malformed-json.json` | `SOURCE.INVALID_TRANSPORT`, exit 2; сохранены исходные exit/stdout/stderr, поля diagnostics нет |
| Отсутствующий CUE binary | `INTERNAL.CUE_UNAVAILABLE`, exit 2 |
| `style.qmd` | Div, Span, attributes, math, shortcode, executable fence: предупреждений выбранного allowlist нет |
| `style-warning.qmd` | Настоящий markdownlint выдаёт `STYLE.MD009`, warning, exit 0, без fix |
| Отсутствующий bundle линтера | `INTERNAL.STYLE_TOOL_FAILURE`, exit 2; исходная причина сохранена |

Сохранённые реальные CLI-отчёты находятся в
`tests/probes/diagnostics/evidence/`. `schemaVersion` обозначает только эту пробу.
Координаты CUE не интерпретируются: root QMD/ID/field происходят из исходных
фактов, related сохраняет обе записи. Для STYLE номер строки сообщает сам готовый
линер, без обещания соответствующего диапазона Pandoc AST.

`report.cue` содержит все учебные predicates. TypeScript выбирает только
операционную политику exit по результату готового отчёта. Сначала выполняется
`cue vet report.cue input.json -d '#Transport' -c --all-errors`, затем
`cue export report.cue input.json -e report --out json`. Неуспех любой команды
возвращает failure, а не пустой список. stderr сохраняется как непрозрачный cause;
regex, сопоставление текста ошибки с кодами и Go API отсутствуют.

Строгий транспорт требует корректные списки, строки ID и provenance. Учебные
поля передаются сырыми в отдельном `fields`: это позволяет CUE сформировать
диагностику отсутствующего/неизвестного поля без bottom от преждевременного
unification с закрытой предметной схемой. Закрытие `fields` через production
schema до построения отчёта здесь намеренно не моделируется.

Graphlib выполняет `tarjan`, `isAcyclic`, `findCycles`, `dijkstra`. Проверены
isolated node, diamond, self-loop, сильный двухузловый цикл, трёхузловый цикл
и recommended cycle. SCC не используется как упорядоченная цепочка:
реальное ребро замыкается библиотечным shortest path, затем predecessor mapping
выбирает исходные occurrences с provenance. Каждое ребро witness сверяется
с оригиналом, цепочка замкнута. Multigraph сохраняет одинаковые повторные
occurrences. CUE, а не Graphlib/TypeScript, запрещает required cycle и допускает
recommended cycle. Выдаётся одно свидетельство на группу kind; полный closure
не вычисляется.

## Локальная поставка и тесты

Runtime использует только отслеживаемые `vendor/*.mjs`, локальный CUE и Deno.
Проверка выполнена без probe `node_modules`, с `--deny-net --no-remote`.
Версии, SHA-256 bundles и лицензии всех включённых зависимостей записаны в
`vendor/manifest.json` и `vendor/licenses/`. Для пересборки, не для render:

```sh
cd tests/probes/diagnostics
npm ci
npm run bundle
```

Исходная проверка с пустым report упала на required-field; исходный graph stub
упал на isolated-node. Проверка мутацией пустого STYLE report также упала
на обязательном предупреждении. После реализации все assertions проходят,
включая отдельные CLI exit codes и проверку TypeScript.

Текущие пять Quarto integration scripts (example, core-activation, pedagogy,
visibility, presentation), vocabulary sync и navigation model (4/4) прошли.
Browser suite остановился в `navigation.browser.cjs:122`: нет бинарного
Playwright Chromium headless shell revision 1234. `presentation/browser.cjs`
этим запуском не выполнен. Это записанный предел проверки среды.

## Границы доказательства

Проба не подключена к production extraction/pre-render/publication. Не доказаны
полнота всех именованных правил, применение defaults/inheritance, suppressing
каскадных unknown targets, limits/performance на большом корпусе, разрешение
внешнего QRC и точные include spans. `fields` содержит только учебные метаданные:
ordinary Pandoc/Quarto formatting attributes не должны попадать в этот map.
Текущий allowlist линтера мал и не включает численные эвристики качества слайдов.
Любые дополнительные правила требуют отдельного native-QMD corpus.

Для malformed transport минимальный отчёт failure сохраняет исходную причину,
но не обещает стабильный semantic code на каждую структурную ошибку и не
извлекает source spans из CUE stderr. Этот предел явный; helper не оказался
необходим для перечисленных A2 случаев, но это не доказывает ненужность CUE API
для всего будущего контракта. Экспериментальные коды/предикаты требуют ревизии
до переноса в production, где правило должно иметь единственное определение.

Документированные основы: [CUE export](https://cuelang.org/docs/reference/command/cue-export/),
[CUE specification](https://cuelang.org/docs/reference/spec/),
[Graphlib API](https://github.com/dagrejs/graphlib/wiki/API-Reference),
[markdownlint](https://github.com/DavidAnson/markdownlint).
