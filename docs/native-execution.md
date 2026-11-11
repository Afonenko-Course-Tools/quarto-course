# Выполнение и совместимость native Core

Core поддерживает Quarto >=1.11.5. Формат публичного документа — фактический
native `base-format` `html|revealjs`; имя расширения вроде `course-theme-html`
не меняет этот тип. Core сверяет base с Pandoc `FORMAT` на ранней и поздней
стадиях. Другие bases и несовпадающие ранний/поздний formats отвергаются.
Повышение минимальной версии для custom HTML не требуется.

## Конфигурация и стадии

Отдельного Core переключателя static/executable нет. Автор использует штатные
Quarto `engine`, `execute`, `cache`, `freeze`, includes, profiles и format options.
Неизвестный исторический `course-core-source-policy` не выбирает особый режим.

1. Native pre-hook фиксирует выбранные Quarto inputs и один owner inspect.
2. Quarto выполняет engine, include и inline expressions. Core получает их
   настоящий AST на `pre-ast`, проверяет все raw declarations/answers и только
   затем применяет свою projection.
3. Late capture получает фактические conditional witnesses и `Image`/`Link`.
   Это единственная стадия зачисления ресурсов. Getters не обходят дерево,
   не вызывают inspect и не ищут дополнительные QMD.
4. Post-hook требует текущие regular HTML outputs и закрывает capture. Hooks
   после него могут менять готовые bytes; выбранный обычный ресурс читается
   из фактического regular output либо исходного файла при первом чтении.

Авторские engines/filters/hooks — доверенный код владельца. Изменение QMD,
metadata или code files во время сборки **разрешено**. Core не создаёт SHA,
source snapshot и обещание неизменности файлов. Уже прочитанный AST остаётся
результатом своего capture; чтобы увидеть новые смысловые данные, нужен новый
render. Новый QMD не входит в уже выбранный план: его может выбрать следующий
native pre-hook. Delete/rename, мешающий обязательным capture/output, даёт отказ;
удаление уже прочитанного QMD не объявляется отдельной freshness ошибкой.

## Поддержанные результаты

| Вход | Native публикация | Переносимый Assignment Body |
| --- | --- | --- |
| Обычный fenced Java/другой static code | Остаётся кодом | Поддержан как `CodeBlock` |
| Выполняемая cell, include, inline | Результат настоящего engine | Поддержаны узлы Body, например Table/Image/текст |
| Обычный генерируемый файл | Зачисляется по позднему `Image`/`Link` | Выбранные bytes с прежними roles/path guards |
| Pandoc mediabag | Quarto финализирует свой HTML/resource layout | Точные наблюдённые virtual-source bytes по исходному resource key |
| OJS | Штатный HTML/runtime Quarto | Интерактивный runtime и Raw HTML не являются переносимым Body; отказ `BODY.CAPABILITY_UNSUPPORTED` |

Для mediabag late capture сохраняет только выбранные entries в private
capture-owned byte files; ordinal привязан к выбранному input и живой операции.
Число entries ограничено 4096, одна entry — 128 MiB. Private/source/tool-cache
политика проверяется по **исходному** resource key; physical alias существующего
исходного файла сохраняется. Отсутствующий или symbolic captive source отвергается.
Одинаковый key с разными mediabag origins, в том числе из разных children,
даёт `RESOURCE_COLLISION`, даже если автор предполагает равенство bytes.

Эти bytes — виртуальный native source, а не результат поиска writer outputs.
Core не реконструирует `*_files/mediabag`, не обещает путь в нативном HTML и не
проверяет byte equality с копией Quarto writer. Публикация готового HTML должна
сохранять весь комплект Quarto supporting outputs; Body получает source bytes
отдельно. Широкого разрешения или игнорирования `*_files` нет. Raw HTML `src/href`
не создают Core resource authority. Незачисленный файл и остаток прежней сборки
не становятся публичным ресурсом от одного существования на диске.

## Cache, freeze, profiles и ручной потребитель

Cache/freeze принадлежат Quarto; Core не дублирует их общим file cache. Повторное
исполнение с native inputs должно дать новые early/late sidecars и operation ID.
Явный zero-work preview удаляет current pointer и не оживляет старый complete.
Student→author→student создаёт отдельные identities и снова применяет projection.
Раздельные outputs/cache для unmarked computed private text задаёт автор: Core
скрывает отмеченные closed роли, но не определяет секретность произвольного текста.

`target="manual"`, native assignment capture, owner validation и
`assignmentDelivery(..., {projectPlans: []})` поддержаны без PrairieLearn adapter,
если у работы нет code projects. Для projects по-прежнему нужны полные typed
student/full plans. Родительские metadata наследует Quarto; это не открывает
общего чтения родительских файлов через resource API.

Документированный `COURSE_CORE_TS_RUN` сохраняется как manual transport для
управляемого AST. Он не создаёт assignment producer authority. Строгие
`beginNativeOperation`/`finishNativeOperation` сохраняют свой контракт непустых
списков; native hook variants отдельно поддерживают zero-work preview.

## Приёмка и границы решения

`tests/native-execution-compatibility.ts` проверяет native/custom HTML, manual
Body без adapter, родительские metadata, OJS publication, mediabag bytes,
междочерний collision, фиксированный QMD plan, source edit и три profiles.
`CORE_TEST_QUARTO` позволяет проверить изолированный CLI без замены host.

`tests/release-generated-resource-currentness.ts --r-cache` требует настоящие
knitr/rmarkdown и `COURSE_DOWNLOAD_PUBLIC`. Две captures используют cache и
`freeze:auto`: ledger отличает выполнение cell от повторного capture; включённый
inline, Table, PNG, README и ZIP проверяются по реальным bytes. Это отдельная
engine qualification, а не молчаливый optional skip основного gate.

Custom-format отказ был дефектом Core: сравнивались target name и base renderer.
Отсутствие mediabag resource было дефектом Core: `io.open` не видит virtual source.
Оба исправлены без изменения minimum и без собственного Quarto resolver.
OJS→portable Body — явное ограничение продукта, а не upstream ошибка. Нативный
writer сохраняет своё владение layout; реконструировать его путь или зависеть от
закрытого `_quarto.modules` для экспорта Core не требуется.

Внутренний выбор Pandoc для materialization использует callback-local native
tool context отдельно от assignment authority. Для квалифицированных
дистрибутивов 1.11.5/1.12.1 при точном совпадении executable/cwd/environment
используется bundled либо настроенный QUARTO_PANDOC без повторного запуска
quarto.js. Иная композиция, argv или environment сохраняют Quarto CLI fallback.
После awaited binding вновь проверяется срок жизни callback и batch. Этот
путь не создаёт assignment runtime/token и не квалифицирует render/inspect.
