# Проверка качества собственного production-кода

Локальная проверка и CI используют одни блокирующие команды:

```sh
npm ci --ignore-scripts
npm run check-quality
npm run check-quality:controls
```

`scope` в `eslint.config.mjs` задаёт production-каталоги. Все существующие и
новые tracked/untracked `.ts`, `.js`, `.cjs`, `.mjs` обнаруживаются автоматически.
Vendor, node_modules, generated и _generated не входят в собственный код.
Пустой scope и `strict: false` запрещены. Структурные правила действуют на весь
собственный production-код: `complexity <= 30`, `max-depth <= 5`, `max-params <= 5`.
Исключение PL — существующий именованный ABI `renderPublicBody` с семью аргументами.
Списка успешно прошедших старых файлов, baseline и подавлений нет.

Typed ESLint проверяет `no-explicit-any`, `no-unsafe-type-assertion`,
`no-unsafe-assignment`, `no-unsafe-argument`, `no-unsafe-call`,
`no-unsafe-member-access`, `no-unsafe-return`, `switch-exhaustiveness-check`.
`@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` и inline отключения ESLint
завершают gate ошибкой. Линтер печатает конкретные диагностики и считает
предупреждения ошибками. Типизация не заменяется произвольными any или stub API.

Для TypeScript строится строгая программа из реального `deno info --json`
graph, `deno types`, Quarto import map и фактических публичных providers.
`CORE`, `PL`, `QRC`, `DOWNLOAD`, `SITE`, `COURSE_PERFORMANCE_SOURCE` позволяют
указать source roots; существующая переданная import map сохраняет приоритет.
Проверяются диагностики собственных production `.ts`. Декларации `.d.ts`
обслуживают реальные типы потребителей; `skipLibCheck` пропускает их отдельную
семантическую проверку. Полные существующие Deno/source gates сохраняются.

JavaScript проверяется отдельной строгой `allowJs/checkJs` программой с
действующим `typecheck/javascript.json` либо `typecheck/browser.json` и настоящими
DOM/Node declarations. Deno globals в браузерный JS не подмешиваются. Структурные
и typed правила одинаково действуют на обнаруженный собственный JS. PL
`application/native-validators.js` — standalone AJV artifact генератора; его
воспроизводимость и потребляющий декларации API проверяются существующими
контрактами generated validators, а не линтером минифицированного output.

TypeScript в npm devDependencies — совместимый peer parser/ESLint. Это отдельная
зависимость линтера; системный `tsc`, Compiler API, установленный CLI и Quarto/Deno
сохраняют продуктовые проверки. Точная версия host TypeScript не требуется.
TypeScript 7.0.2 фактически отвергнут текущим parser peer `<6.1.0`; принудительная
установка с `--force` или `--legacy-peer-deps` не используется.

Dependency-cruiser проверяет разрешаемый статический TS/JS import graph,
публичные границы providers и runtime cycles. Type-only цикл допускается;
импорт внутренних provider modules запрещён и для type-only связи. Динамически
вычисленный импорт не объявляется статически доказанным. Lua, Python и shell
сохраняют собственные существующие language-server/typechecker/lint gates;
прохождение TS graph не означает проверку всего Lua или dynamic graph.

`check-quality:controls` сначала требует чистый production gate, затем по одному
создаёт новые временные production-файлы и запускает ту же `check-quality`
команду. Независимо проверяются каждое правило typed/structural набора, запрет
подавления, malformed AST, цикл и импорт внутренностей. Выход должен быть
ненулевым с диагностикой именно проверяемого правила. Файлы удаляются в `finally`.
Эту команду нельзя запускать одновременно с другим source gate того же checkout.
В CI она обязательна после положительного gate. Итоговый JSON положительного
входа сообщает TS/JS/structural counts и реальные версии parser/ESLint/compiler.

Дополнительные блокирующие команды:

```sh
npm run check:static
npm run check:static:controls
npm run test:types:all
```

Установка инструментов Arch описана в [общем руководстве](../docs/development-arch.md).
`check:static` заново обнаруживает tracked и untracked собственные файлы, включая
`course-theme`, tools, tests и examples. Prettier владеет TS/JS/JSON/YAML/CSS/SCSS/HTML,
StyLua — Lua, shfmt — shell, Ruff — Python. `npm run format` применяет те же
форматтеры. Канонические observability bridge синхронизирует Performance;
производный vocabulary TypeScript форматируется самим `sync-contract.mjs`.

yamllint проверяет синтаксис, повторы ключей и согласованное оформление;
actionlint — модель workflow и shell-команды. Настройки пробелов в YAML согласованы
с Prettier. Stylelint проверяет CSS и SCSS с настоящим `postcss-scss`; HTML Validate
проверяет найденные HTML-фрагменты, не итоговый DOM. LuaLS получает фактический Git tracked/untracked состав без обхода submodules,
поэтому новый Lua-файл проверяется сразу; Luacheck сохраняет точные read-only
Quarto/Pandoc globals. Переменная `document_output` устраняет затенение, `_meta`
сохраняет callback ABI без неиспользуемого именованного параметра.

Python проверяется строгим Pyright для tools/tests, Ruff E/F/B/I/UP и узким Bandit
B301/B307/B501/B506/B602/B605. Полный Bandit-аудит четырёх собственных tools
13 ноября 2026 дал 11 LOW-сигналов: два B404 (импорты subprocess), шесть B603
(argv subprocess без shell), три B607 (два CLI через PATH и локальный `node_modules/.bin/prettier`).
Эти вызовы запускают фиксированные команды проверок из доверенного checkout;
имена файлов обнаруживаются Git, shell не включён. PATH — явный договор локальной
среды. Сигналы прочитаны в контексте и не объявлены уязвимостями; broad rules не
отключаются inline. Узкий профиль блокирует опасные shell/deserialization/TLS APIs.

| Собственный вызов | Полные сигналы | Прочитанный контекст |
| --- | --- | --- |
| `check-static.py`: импорт, `run`, `discover` | B404, B603 ×2, B607 | `run` получает argv стандартных CLI, `discover` запускает фиксированный Git без shell. |
| `check-static-controls.py`: импорт, `check`, начало `main` | B404, B603 ×2 | Запускается текущий Python с фиксированным путём checker; controls не исполняются. |
| `check-static-controls.py`: Prettier и LuaLS | B603 ×2, B607 ×2 | Prettier берётся из npm checkout; `quarto` — разрешённый системный CLI. |


Отрицательные контроли добавляют новые CSS, SCSS, HTML, Lua, Python, shell,
JSON, YAML и workflow, требуют конкретные диагностики и всегда удаляют файлы.
Отсутствующий StyLua должен блокировать ту же команду. JS-контроли отдельно
проверяют новые `.js`, `.cjs`, `.mjs`; `.mjs` входит и в discovery, и в ESLint globs.
