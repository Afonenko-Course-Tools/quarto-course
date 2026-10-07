> Исторический материал общего каталога. Актуальный маршрут: [план от 8 октября 2026](../quarto-course/docs/plans/2026-10-08-course-tools-implementation.md).
> Этот каталог не Git-репозиторий: нужные решения и исходные снимки сохранить у владельцев до очистки.
> Старые версии, ограничения публикации и статусы реализации не являются действующим контрактом.

# Структура тестов Template и явное описание сценариев

В Template около 13 100 строк собственных проверок, runners и исполняемых fixtures. Рекомендуется выделить тесты в самостоятельный приоритет рефакторинга вместе с Core: описать цели и сценарии в небольших типизированных таблицах, отделить подготовку данных от исполнения и независимой проверки, затем использовать встроенный Deno test runner для именованных быстрых случаев. Python-проверки можно улучшать отдельно. Новый framework сам по себе не устраняет основной объём кода.

Анализ подготовлен 4 октября 2026 года тремя параллельными агентами и проверен на оригинальном Template `4c33b15`. Установленные `_extensions`, альтернативные checkout и исходники библиотек исключены. Этот документ — проект изменений для согласования; код и workflows пока не изменены.

## Что занимает место

В собственных `tests` и исполняемых `fixtures` найдено 50 файлов, 13 126 физических строк. В это число входят комментарии и пустые строки, но не Markdown/YAML, установленные расширения, зависимости и четыре обычных `_publication` адаптера. Одна строка собственного example shell script объясняет отличие от первоначального более широкого подсчёта 13 127.

| Ответственность | Строки |
| --- | ---: |
| Native consumer runners | 3 095 |
| Проверка receipts и фаз | 1 665 |
| Guards и сценарии повреждений | 2 582 |
| Helpers для evidence, файлов и процессов | 402 |
| Aggregate runners | 282 |
| Исполняемые fixtures и adapters | 3 539 |
| Остальные корневые tests и проверочные tools | 1 561 |
| Всего | 13 126 |

Семейство `actual-main` занимает 5 619 строк, около 43% всего объёма. Не всё это обычные test cases: [pages-ci.py](/home/tolya/course-tools/quarto-template-pages-profile-split/tests/pages-ci.py) — 380-строчный рабочий транспорт CI, а [pages-ci-test.py](/home/tolya/course-tools/quarto-template-pages-profile-split/tests/pages-ci-test.py) — его отдельный 423-строчный набор тестов.

Основные причины сложности подтверждены кодом:

- [actual-main-transfer-guards.ts](/home/tolya/course-tools/quarto-template-pages-profile-split/tests/probes/actual-main-transfer-guards.ts:145) после 144 строк public-transfer проверок переключается на примерно 950 строк fixtures, хранения диагностики и проверки порядка cleanup. Имя файла скрывает разные обязанности.
- [fixture state.ts](/home/tolya/course-tools/quarto-template-pages-profile-split/fixtures/probes/actual-main/state.ts:71) содержит 822 строки диагностики, проверок путей, сохранения байтов и отчётов. Обычное adapter state занимает только первые 69 строк.
- [actual-main-consumer.ts](/home/tolya/course-tools/quarto-template-pages-profile-split/tests/probes/actual-main-consumer.ts:125) объединяет authentication исходников, установку пакетов, watcher, реальное действие, construction observation и проверку результата. Похожие installation sequences повторяются у других consumer runners.
- [split guards](/home/tolya/course-tools/quarto-template-pages-profile-split/tests/probes/actual-main-split-guards.ts:2) импортируют synthetic factory из другого executable guard-файла. Данные fixture заслуживают собственного модуля без тестовых действий при импорте.
- [PORTAL_CASES](/home/tolya/course-tools/quarto-template-pages-profile-split/tests/probes/portal-contract.ts:23) уже содержит 25 сценариев, но runner отдельно повторяет их labels и ожидаемые отказы. Есть исходная опора для декларативного описания; не требуется создавать новый язык тестирования.
- Некоторые отрицательные cases принимают любой `Error`, например [receipt guards](/home/tolya/course-tools/quarto-template-pages-profile-split/tests/probes/actual-main-receipt-guards.ts:226). Посторонний сбой может выглядеть как успешная проверка нужного отказа. Для каждого случая следует явно задавать ожидаемую семью или устойчивую деталь ошибки.

## Какие цели должны быть видны в тестах

| Цель проверки | Воздействие | Наблюдаемый критерий |
| --- | --- | --- |
| Выпуск student сохраняет full | Свежая настоящая student попытка | Student заменён; прежний полный full file-set и SHA неизменны |
| Выпуск full сохраняет student | Свежая full попытка с authenticated public baseline student | Full заменён; student неизменен; новый public baseline создан |
| Поздняя мутация прерывает выпуск | Изменить адресованный PDF после QRC и child finish | Конкретный `SOURCE.PUBLICATION_ADDRESS_CHANGED`; реальный PDF SHA изменён; promotion не выполнен |
| Отказ сохраняет обе прежние публикации | Late попытка с baseline full | Полные student/full file maps неизменны; public filesystem events отсутствуют |
| Downstream получает только публичные данные | Передать artifact с лишним private или native файлом | Отказ до использования metadata и копирования; допустимы только public archive и public receipt |
| Archive extraction сохраняет границы | Traversal, symlink, hardlink, alias, duplicate или drift | Отказ без записи за пределы destination и без частичного принятия непроверенных данных |
| Диагностика сохраняет фактические байты | Ошибка попытки или исчезновение файла при чтении | Удерживаются доступные данные и первичная ошибка; cleanup завершается после awaited retention |
| Принимается именно текущая поставка | Подменить source, provider, channel, installed map или run | Отказ по соответствующему контракту; чужой или старый результат не принимается |

В каждом сценарии нужны стабильное имя, краткая цель, уровень проверки, предусловия, точка воздействия и ожидаемые наблюдения. Исполняемые функции остаются TypeScript/Python. Таблица не должна превратиться в общий scheduler или YAML DSL.

Например, цель существующего `actual-main-late-current-address` читается так: свежая попытка получает только проверенные публичные деревья full-release; после `qrc-finished` и `child-owners-finished` меняются байты `handouts/contracts.pdf`; выпуск обязан остановиться с конкретным кодом, сохранив обе предыдущие публикации. У этого сценария должны отдельно отображаться prepare/install, action, current verification и preservation.

Механизм воздействия принадлежит fixture adapter. Независимый verifier проверяет фактические логи, metadata, порядок событий и байты. Producer не должен генерировать «успешные» наблюдения из ожидаемых результатов таблицы.

## Сравнение инструментов

| Подход | Польза для существующего Template | Решение |
| --- | --- | --- |
| Типизированные таблицы сценариев | Соединяют цель, данные воздействия и ожидаемые последствия; сокращают повторные списки labels и phase/profile mappings | Основная структурная мера |
| Deno.test и t.step | Именованные случаи, фильтрация, стандартный запуск, JUnit/TAP; заменяют ручные counters и PASS/FAIL collectors | Первый runner для pure TS и storage cases |
| pytest fixtures и parametrize | Свежие временные fixtures на каждый Python case, отдельные identifiers в отчёте | Полезен для небольших resource guard scripts; перенос существующего unittest не обязателен |
| unittest subTest | Уже используется в Pages transport tests, поддерживает именованные вариации без новой зависимости | Сохранить, пока миграция не показывает явного выигрыша |
| node:test или Vitest | Структура и отчёты хороши, но для текущего Deno-кода потребуются перенос API/импортов или subprocess wrapper | Сейчас не рекомендуются как новый основной runner |
| Cucumber и Gherkin | Хорошо выражают согласованные Given/When/Then правила | Оправданы при совместном редактировании сценариев нетехническими участниками; сейчас добавят второй слой feature files и step definitions |
| Property based testing | Проверяет сочетания повреждённых metadata и путей с воспроизводимостью и shrinking | Возможное позднее дополнение к pure contracts; фиксированные native и конечные candidate checks сохраняются |

Deno предоставляет встроенный runner, тестовые шаги, filtering и reporters. Это позволяет улучшить видимость случаев без отдельной runtime зависимости. [Deno testing](https://docs.deno.com/runtime/test/), [Deno CLI test](https://docs.deno.com/runtime/reference/cli/test/).

pytest параметризует test functions и fixtures. Текущие `unittest.TestCase` можно запускать под pytest, но обычные fixture arguments и параметризация таких методов не становятся доступными автоматически. Поэтому массовый переход Pages suite ради названия инструмента не нужен. [Параметризация pytest](https://docs.pytest.org/en/stable/how-to/parametrize.html), [Совместимость с unittest](https://docs.pytest.org/en/stable/how-to/unittest.html).

Gherkin отделяет business rule от scenario и содержит шаги Given/When/Then. Для нынешних технических invariants эту форму можно выразить прямо в names и case tables без отдельного interpreter. [Gherkin reference](https://cucumber.io/docs/gherkin/reference/). Vitest предоставляет parameterized test API, однако это другой runner со своей конфигурацией. [Vitest test API](https://vitest.dev/api/test), [Vitest setup](https://vitest.dev/guide/).

## Проверенная совместимость с Quarto

Оба установленных канала Quarto, 1.10.18 и 1.11.5, используют Deno 2.7.14. Системный Deno — 2.9.7. Встроенный runtime поддерживает `Deno.test`, test steps, `--filter`, `--parallel`, `--junit-path` и reporters `pretty`, `dot`, `junit`, `tap`. При этом `Deno.test.each` и `Deno.test.beforeAll` в нём отсутствуют; в системном 2.9.7 они существуют. Это проверено выполнением API probe и справкой установленного CLI, без чтения исходников runtime.

Первый вариант должен регистрировать parameterized cases обычным циклом `for` с вызовом `Deno.test`. Для зависимых steps нужно явно прекращать цепочку после false result: `t.step` возвращает boolean. [TestContext.step](https://docs.deno.com/api/deno/~/Deno.TestContext.step).

`quarto run` выполняет script, а не test runner. Если существующий script просто заменить на регистрации `Deno.test`, прежняя команда сама тесты не запустит. Нужен один небольшой launcher, который использует встроенный Deno выбранного Quarto и его проверенное окружение import maps/cache. Системный Deno и новые примеры с versioned JSR imports не являются непосредственной заменой. [Project Scripts](https://quarto.org/docs/projects/scripts.html).

Прототип launcher должен доказать реальные test execution, отрицательный exit, filtering и JUnit output на обоих каналах без установок и загрузок при render. Import alias resolution подтверждается через runtime metadata, не через анализ исходников SDK. Не следует глобально отключать resource/operation sanitizers ради прохождения тестов: fixtures должны закрывать свои процессы, watchers и файлы.

pytest 9.1.1 доступен локально. Перед его использованием в CI потребуется явно закрепить зависимость; наличие на ноутбуке не доказывает готовую поставку CI.

## Предлагаемая организация

Быстрые контракты, filesystem transport и native acceptance должны иметь разные точки запуска и отдельные результаты. Внутренние модули можно разместить по ответственности: `tests/contracts/actual-main`, `tests/transport`, `tests/diagnostics`, `tests/support` и `tests/native`. Текущие CLI paths из `tests/probes` в первой поставке остаются небольшими compatibility facades.

Такой facade должен запускать test launcher отдельным процессом и передавать его exit code. Один импорт нового `_test.ts` под прежним `quarto run` только зарегистрирует тесты и может дать ложный успешный exit без их исполнения. Helpers не должны импортировать executable facades.

Synthetic receipt factories переходят в `tests/support`, без executable side effects. Нейтральные операции с временными каталогами, hashing, subprocess и archive construction могут переиспользоваться. Validators текущей публикации, правила transport и независимые expected facts не объединяются с producer только ради уменьшения строк.

Первый этап:

1. Зафиксировать соответствие нынешних cases их целям и сохранить positive controls.
2. Выделить synthetic fixture из receipt guards; перевести один полный набор split guards в именованные Deno tests с обычными case tables. Все 33 нынешних проверки должны сохраняться; небольшой эксперимент на 8–12 cases остаётся временным до полного переноса набора.
3. Разделить transfer guards на public archive/baseline, retention identity/geometry и retention storage/ordering. Сохранить исходный CLI entrypoint и 16 public плюс 38 retention случаев.
4. Проверить тот же refused behavior и результат на обоих Quarto runtime; стандартный JUnit добавить к существующим evidence files.
5. После проверки launcher и complete case mapping вынести fast contracts в ранний CI prerequisite; final aggregate продолжает проверять настоящие шесть native phases и artifacts.

На следующем этапе можно разделить installation/action/observation/verification в native consumers и diagnostics внутри fixture `state.ts`. Простое перемещение fixture code пока небезопасно: [consumer](/home/tolya/course-tools/quarto-template-pages-profile-split/tests/probes/actual-main-consumer.ts:155) копирует ровно пять adapter modules, а contracts фиксируют их paths и SHA. Новые fixture submodules потребуют явного обновления finite copied payload и authenticated receipt. Test-only первый этап этого изменения не требует.

Изменение CI prerequisite добавляет Source-defined check. Одновременно должны обновиться список required jobs, registry adapter и документация; число 22 из текущего кандидата нельзя автоматически переносить на новый Source. Pipeline `student → full → late` и окончательная агрегация сохраняются.

## Что сохраняет силу проверки

Существующее разделение runner, contract, raw-evidence validation и aggregate полезно. [Evidence loader](/home/tolya/course-tools/quarto-template-pages-profile-split/tests/probes/actual-main-evidence.ts:225) сопоставляет observation с настоящим JSONL, а [aggregate](/home/tolya/course-tools/quarto-template-pages-profile-split/tests/probes/actual-main-aggregate.ts:31) проверяет jobs, exact source и archives. JUnit означает результат тестового runner; он не заменяет source/provider provenance и доказательства native попытки.

Особенно важно сохранить независимый ожидаемый набор [228 diagnostic candidates](/home/tolya/course-tools/quarto-template-pages-profile-split/tests/probes/actual-main-transfer-guards.ts:193). Использование producer candidate builder в качестве test oracle скроет пропущенные файлы. Аналогично downstream [допускает только два публичных файла](/home/tolya/course-tools/quarto-template-pages-profile-split/tests/probes/actual-main-public-evidence.ts:19), без sessions, captures, private indexes и native logs.

Late отказ сохраняет новый attempt, реальное изменение PDF SHA, точный provider error, правильный порядок после child finish и неизменность обеих предыдущих публикаций. Snapshots подходят небольшим стабильным структурам или нормализованному trace; они не заменяют текущие file maps, fresh owner authority и raw evidence.

Для raced reads, исчезновения файла, exclusive write collision и awaited cleanup нужны явные процедурные тесты. Не вся последовательность должна превращаться в параметризованную таблицу. Partial selection помогает разработке, но не может выпустить complete acceptance receipt.

## Результаты проверки и пределы первого этапа

Четыре существующих bounded ActualMain CLI фактически выполнены заново: receipt — 63 проверки, public — 13, split — 33, transfer — 16 public и 38 retention. Всего 163 логические проверки, все успешны. При параллельном запуске самый долгий набор занял около 6,8 секунды. Логи сохранены в `local-evidence/refactoring-audit-20261004`.

Эти же дешёвые проверки сейчас находятся в [final aggregate job](/home/tolya/course-tools/quarto-template-pages-profile-split/.github/workflows/actual-main-portal.yml:398), после всей многочасовой native цепочки. Ранний запуск выявит их регрессии до дорогой работы, сохранив прежние обязательные native сценарии.

Стоимость самих native действий framework не устраняет. Текущий контракт включает 38 source/identity renders на свежую попытку; в это число не входят owner/parent inspections, native members/PDF, QRC, finalization и setup. Два канала и три фазы дают шесть настоящих попыток. Повторное использование private owners или caches ради ускорения изменит проверяемую гарантию и не входит в рефакторинг.

Для дедлайна 18:00 по Минску предлагается завершённый первый этап быстрых Template тестов вместе с небольшим выделением протокола Core. Print и более глубокую native fixture миграцию следует брать только после проверки этого этапа и при достаточном остатке времени. Критерии успеха — все прежние случаи сохранены, цель каждого видна отдельно, неправильный отказ не проходит тест, producer/verifier остаются независимыми, суммарный объём с launcher/helpers оправдан и нет новых обязательных runtime зависимостей.
