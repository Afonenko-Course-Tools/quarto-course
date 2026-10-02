# Опциональная нативная проверка владельца

Это устанавливаемый внутренний компонент Core для ограниченного корпуса HTML.
Обычная сборка без команды ниже сохраняет прежнее поведение. Публичные
`Course`, `Fragment` и образовательная схема не меняются; компонент пока не
включён в `course-check` по умолчанию и не закрывает весь A1/P1.

## Запуск

Нужны Quarto 1.10.18/1.11.5, CUE 0.17.1 и рабочий движок документа. После обычного
`quarto add` настройте реальные профили `_quarto-student.yml` и
`_quarto-full.yml`, явный `project.output-dir` и последний участвующий hook:

```yaml
project:
  output-dir: _site
  pre-render:
    # Здесь могут находиться предыдущие участвующие hooks.
    - _extensions/course-core/entrypoints/owner-freeze.ts
filters: [course-core, course-presentation]
```

Из корня владельца:

```sh
quarto run _extensions/course-core/entrypoints/owner-preflight.ts . student
# либо тот же нативный владелец в полном профиле:
quarto run _extensions/course-core/entrypoints/owner-preflight.ts . full
```

Команда создаёт отдельную временную копию владельца и выводит JSON с `stage`.
Она не публикует результат и не заменяет вывод исходного проекта. HTML находится
в `stage`/`project.output-dir`; `.course-owner` содержит журнал попытки и факты.
Код завершения: `0` — выбранная попытка прошла; `1` — CUE нашёл конфликт
объявлений; `2` — покрытие, зависимости, capability или инструмент не позволили
доказать результат. Ошибка движка сохраняет исходный код/stdout/stderr и не
классифицируется поиском фразы в stderr. Временные каталоги сохраняются для
диагностики; после изучения их можно удалить.

## Что проверяется

1. Нативный `quarto inspect` отдельно для student/full даёт объединение
   `files.input`. `includeMap` устанавливает include-only фрагменты;
   `files.resources` — выбранные ресурсные QMD. Независимый обход файлов
   отклоняет каждый прочий авторский QMD, неоднозначный root/include, symlink и выход
   include/resource за корень. Это не новый авторский реестр и не подмена
   нативного render-set. Установленные payload-каталоги определяются через
   `extensions[].path`; неизвестный QMD под `_extensions` не освобождён от аудита.
2. До обычного engine фиксируются байты авторских файлов, конфигураций,
   установленных extensions и файлов `inspect.files.configResources`.
   Последний hook проверяет тот же снимок и нативное покрытие; позднее изменение
   участвующим hook прекращает попытку до engine. Из снимка исключены точные
   выходные каталоги, `.git`, `.quarto`, `_freeze`, `.course-owner` и
   `_generated/course-spec`. Авторские исходники в этих служебных областях не
   входят в поддерживаемый корпус.
3. Каждый нативный корень каждого профиля проходит `--no-execute --no-cache`.
   Один установленный Lua collector сохраняет occurrences до grading/visibility.
   CUE сравнивает общие корни профилей и проверяет повторения ID в полном
   объединении. Include-факты имеют provenance корневого QMD, а не точную строку
   исходного фрагмента. Ресурсный QMD классифицирован как скачиваемый файл, его
   тело не объявляет сущности курса.
4. После успешной проверки фиксируются хеши baseline. Обычный нативный render
   запускает engine; тот же collector и CUE проверяют результат до проекций
   Core и Presentation. Отсутствующая/повреждённая baseline или изменение
   объявлений останавливают попытку. Неуспешный render не использует HTML от
   предварительных проходов. Успех требует reconciliation каждого выбранного
   нативного корня и повторной проверки снимка.

Предикаты охватывают текущие Div-объявления `exr-*`, `sol-*`, `.solution`,
`course-role`, их классы/атрибуты/контейнеры и мультипликативность. Для текущего
Assessment сравниваются metadata, нативная identity по chapter-id либо первому
верхнеуровневому Header, и полное нативное содержимое `.assessment-items`.
Последнее намеренно консервативно: даже недекларативное изменение внутри
контейнера состава Assessment отвергается. Неявные hints через `.callout-tip` не входят в этот reconciliation объявлений.
Обычное вычисляемое тело статической задачи и нативная таблица разрешены.
Для локальных ресурсов и новых вычисленных рисунков действует ограниченная
политика ниже.

## Доказанные границы

Фокусный тест устанавливает пакет в чистый consumer. Локально подтверждены
нативные default и двухглавная HTML-book с реальными student/full профилями,
R-вычисление ровно один раз, generated exr и скрытый повтор до проекции,
изменение identity Assessment, таблица/рисунок и freeze-hook sentinel.
Строгий CI запускает также реальный Jupyter negative с `--require-python`;
локально его нельзя считать пройденным при недоступном kernel.

Текущий corpus — QMD, стандартные фильтры `[course-core]` либо
`[course-core, course-presentation]` либо
`[course-core, course-presentation, project-download]`. Нативно разрешённая цепочка каждого
документа также проверяется: дополнительный document/metadata filter вызывает
отказ. Website распознаётся нативным аудитом, но отдельный website integration
здесь не заявлен. Другие форматы, общие Topic-модели, произвольные дополнительные
фильтры, перенос публикации, общий pre-hook sandbox и полная модель будущих
Assessment остаются вне этой реализации.

`--no-execute` подавляет R/Jupyter cells, но не обещает подавить произвольные
hooks, shortcodes и внешние побочные эффекты. Снимок охватывает файлы владельца
и явно перечисленные нативные зависимости, а не динамические чтения произвольного
кода, сетевые источники и весь runtime R/Python/Quarto. Это проверка участвующей
сборки, а не защита от враждебного hook, переписывающего контрольные файлы.
Автоматический Header ID не объявляется явным авторским ID. Приведённая ниже
проверка происхождения Header ID даёт отдельный внутренний inventory; полная
публичная Topic-схема остаётся отдельной задачей. После завершения Core последующие встроенные
преобразования Quarto не являются вторым общим reconciliation boundary.

## Происхождение ID заголовков

Каждый покрытый корень student/full получает обычный no-execute capture и
доказанный no-auto identity. Markdown/R используют отдельный capture с
документированным `from: …-auto_identifiers`. Явная
настройка Markdown-reader берётся из нативного document inspect: его modifiers
сохраняются, добавляется только отключение `auto_identifiers`. При отсутствии
настройки проверяется штатный QMD Markdown-reader. Другой dialect/custom reader
даёт `SOURCE.HEADER_READER_UNSUPPORTED`, без разбора исходника собственным parser.

CUE сравнивает результаты настоящего reader: полный нативный AST тела должен
совпасть после очистки только Header identifiers. Уровни, богатые подписи,
классы/атрибуты, Div ancestors и нативная top-level позиция также сохраняются.
Несовпадение reader даёт `SOURCE.HEADER_IDENTITY_UNSUPPORTED`: например,
implicit reference к автоматическому Header меняет Link target при no-auto и
пока не входит в поддержанный корпус этой точной проверки. Глобальный
`PANDOC_READER_OPTIONS` Quarto относится к внешнему reader wrapper и не
выдаётся за доказательство настроек внутреннего Markdown-reader.

Нативный Jupyter получает другой ограниченный путь: каждый отдельный render
назначает новые ID безымянным ячейкам, поэтому два отдельных captures не дают
точного совпадения тела. Внутри единственного обычного capture публичный
`PANDOC_STATE.input_files` предоставляет точные байты входа, уже выданные
нативным движком. Публичный `pandoc.read` читает те же байты с сохранённым
Markdown dialect/modifiers и native ReaderOptions. Сначала всё тело повторного
обычного чтения должно совпасть с настоящим boundary AST, включая все Header и
Div ID. Затем тот же вход читается с `-auto_identifiers`; применяется прежняя
полная проверка тела и Header topology. ID ячеек и авторских `.cell` не
нормализуются и не классифицируются по виду. Нет второго Jupyter render либо
выполнения engine. Несовпадение обычного replay, несколько входов или ошибка
native reader дают явный `SOURCE.HEADER_IDENTITY_UNSUPPORTED` без fallback.
Метаданные identity сохраняются из настоящего нативного документа.

Identity JSON содержит приватный `readerReplay`: точные input bytes, ordinary
и no-auto reader, публичные поля native ReaderOptions и полный ordinary/native
AST witness. SHA-256 identity файла запечатывает всё это evidence. Например,
поздний shortcode placeholder, который обычный public reader не воспроизводит
точно, остаётся неподдержанным для Jupyter identity; он не разбирается отдельным
source parser.

Точные байты input также записываются реальным native capture в отдельный
`.course-owner/reader-input/<profile>/<SHA1(source)>.md`. Private `readerInputs`
и `readerInputHashes` связывают этот файл с `profile:source`; identity witness
содержит тот же точный `inputPath` и SHA-256 `inputHash`. Подготовка проверяет
совпадение реальных байтов с embedded input до seal. Последующая activation,
reconciliation и проверка ресурсов требуют неизменных пути, файла и хеша.

ID, сохранившийся в подтверждённом no-auto capture, является явной Header
identity данного замороженного нативного корпуса. Ни префикс `sec-`, ни
совпадение с automatic slug сами по себе этого не доказывают. CUE проверяет
повторы явных Header ID по полному объединению корней до engine; повторное
include сохраняет отдельные occurrences, один root в двух profiles не
создаёт второе объявление. Ошибка имеет код `CORE.DUPLICATE_HEADER_ID`.

Private session хранит `identities`, `identityHashes`, `identityReaders` по
ключам `profile:source` и CUE-производный `headers`: ID, owner/root QMD,
Header ordinal, `topLevel`, level/title/titleJson, classes/attributes/Div ancestors.
`topLevel` исходит непосредственно из нативных `doc.blocks`: Header внутри
BlockQuote/Table/Div либо Inline Note не становится верхнеуровневым при
совпадении ID или подписи.
Чтобы доказать явность первого заголовка страницы работы, нужен этот факт по
точному Header ordinal; совпадение его automatic slug с более поздним явным ID
недостаточно.
Отдельные файлы `.course-owner/identity/<profile>/…json` проверяются по точному
принадлежащему попытке пути и SHA-256; они не заменяют ordinary captures.
`identityReplays` отмечает нативно разрешённый Jupyter путь. Все identity файлы
и реальные reader-input файлы включены в точный Core service set до ресурсного индекса: raw delivery запрещён
в том числе для переименованных копий по запечатанным SHA-256 байтам.
Отсутствие/порча evidence не включает fallback на effective IDs и блокирует
activation с `SOURCE.HEADER_IDENTITY_CHANGED`. Session hash связывает inventory
с текущими owner/attempt/profile. Это внутренние факты, не публичные Topics;
Header упражнения либо страницы работы не объявляется новой Topic.

Обычный render сохраняет reader и publication anchors. Его Header-only skeleton
должен совпасть с доказанной baseline до grading/visibility/Presentation.
Новый, удалённый или изменённый computed Header даёт
`CORE.HEADER_SKELETON_CHANGED`: executed AST не доказывает происхождение нового
ID. Это первоначальная консервативная граница, без второго выполнения engine.
Таблицы и рисунки в теле статической задачи остаются допустимыми. Адресные
отношения, Topic hierarchy/task binding, public body export и late filters этой
поставкой не добавляются. Physical per-node include spans не заявлены.
Поздние custom shortcode transformations также находятся после этого raw
observation boundary; их placeholder Spans не выдаются за финальное тело или
новую доказанную Header identity. Нативный include уже развёрнут и проверяется.

Установленный native корпус:

```sh
quarto run tests/owner-identities.ts all
# Строгий runner с настоящим Jupyter, без skip:
quarto run tests/owner-identities.ts all --require-python
# Выделенный обязательный Jupyter negative в strict CI:
quarto run tests/owner-identities.ts python --require-python
# Exact native Jupyter reader replay без запуска kernel:
quarto run tests/owner-identities.ts jupyter-reader
quarto run tests/owner-identities.ts jupyter-replay
```

Проверка запускается на обоих закреплённых каналах owner CI; Jupyter Header
negative обязателен в strict native CI. Локальный kernel failure не считается
успешной проверкой Jupyter.

Основа API: [inspect](https://quarto.org/docs/advanced/inspect.html),
[project scripts](https://quarto.org/docs/projects/scripts.html),
[profiles](https://quarto.org/docs/projects/profiles.html),
[Lua filters](https://quarto.org/docs/extensions/lua.html) и
[публичный Pandoc Lua API](https://pandoc.org/lua-filters.html).

## Встраиваемая сессия владельца

Для уже изолированного снимка Publisher импортирует установленный
`owner-preflight/owner.ts`. Дополнительная копия владельца и второй вычисляющий
render не создаются. Экспортированы следующие интерфейсы:

```ts
prepareOwner(root: string, options: {
  attemptId: string;
  profile: "student" | "full";
  extension?: string;
  publicationAddresses?: { navigation: PreparedNavigationOwner };
}): Promise<PreparedOwner>
activateOwner(prepared: PreparedOwner, options?: {
  output?: string;
}): Promise<Record<string, unknown>>
finishOwner(prepared: PreparedOwner, options?: {
  publicationAddresses?: {
    output: string;
    members: Pick<NavigationPublicationMember,
      "path" | "mount" | "format" | "output">[];
  };
}): Promise<OwnerResult>
```

`prepareOwner` проверяет существующий снимок, выполняет нативные captures
`--no-execute`, проверяет CUE, удаляет частные capture outputs и запечатывает
session. Каталог `.course-owner` должен отсутствовать: повторная подготовка
или одновременная попытка в том же корне отвергается. Профиль — ровно один
`student` либо `full`; разрешённые конфигурации обоих профилей имеют
соответствующий `course.view`. Дополнительные и составные профили не поддержаны.

Handle `PreparedOwner` содержит `protocol: 1`, канонический `root`, переданный
`attemptId`, `profile`, уникальный `sessionId`, абсолютный `sessionPath` и
SHA-256 `sessionHash`. Потребитель сохраняет целый handle в своём состоянии
попытки и проверяет его `attemptId`, `root`, `profile` по собственному контексту;
вручную handle не создаёт. Он переносим между процессами и не зависит от closure.
`preparedSession(handle)` возвращает проверенную `Session`, сверяя handle,
запечатанные байты и все baselines. `assertFrozen(handle.sessionPath)` дополнительно
повторяет нативный аудит исходников/конфигурации и fingerprints. Эти функции —
внутренний seam для следующих потребителей, не авторский реестр ресурсов.

`activateOwner` вызывается непосредственно перед единственным обычным HTML
render. Она резервирует неизменяемый `render-invocation.json`, создаёт локальный
`.course-owner/active.json` и возвращает идентичную overlay
`course-owner-session` для штатного `--metadata-file`. Это явная передача двум
потребителям: последний native pre-render hook читает локальный descriptor,
Core читает metadata и требует полное совпадение и guard receipt. Пустое или
повреждённое состояние, отсутствие любой стороны передачи, stale receipt,
неверный корень/input/profile/hash вызывают отказ. Core проверяет передачу даже
у документа без metadata `course`; частная metadata удаляется до writer.
Удаление active locator не позволяет повторно активировать handle.

`output` задаётся доверенным вызывающим кодом и должен совпадать с реальным
нативным `--output-dir`. Разрешён отдельный внешний каталог Publisher либо
точный внутренний каталог без замороженных исходников; корень владельца,
его предки и служебное состояние не могут быть output. Исключение из fingerprint
касается только принятого каталога output, а не остальных исходников.
Сессия не меняет глобальный `Deno.env`: обычные Core pre/post hooks распознают
проверенный owner-local descriptor и не запускают повторный Core check.
Наследованные старые `COURSE_OWNER_*` значения при prepare отвергаются.
Standalone передаёт только старый phase-sentinel своему дочернему render для
существующих авторских hooks; идентичность проверки из него не берётся.

**Вызывающий код обязан дождаться успешного завершения обычного Quarto render
до вызова finish.** Publisher вызывает finalize только после нативного zero exit;
он явно требует выполнение cells и отключает cache/freeze для этого корпуса.
`finishOwner` не запускает render и не утверждает, что callback доказывает
успешное завершение последующих writer/post hooks. Она требует полный текущий
набор receipts каждого выбранного input, проверяет фактические bytes, sealed
session/baselines и замороженные исходники. Результат `OwnerResult` имеет
`exitCode: 0 | 1 | 2`, `stage`, `report`; успешный report включает `status`,
`profile`, `coverage`, абсолютный `outputs`, `attemptId`, `sessionId`,
`sessionHash`, `invocationId`. Декларативный конфликт даёт `exitCode: 1`;
ошибка целостности в API бросает `OwnerFailure`. Standalone `runOwner`
сохраняет прежний JSON/exit-code shape и относительный `report.outputs`.

Дополнительно нативно проверена ровно цепочка
`[course-core, course-presentation, project-download]`. Core сначала сохраняет
raw occurrences capture, затем отдаёт downstream пустое частное тело с
processed marker; скрытый full-only shortcode не создаёт request/ZIP во время
captures. Mutable область requests определяется исключительно публичным
`project-download/ownership.ts` соседнего установленного extension. Core
вызывает `inspectOwnedRequests(root, nativeSources)` и проверяет protocol,
идентичность root, containment directory/files и принадлежность sources
проверенному native coverage. Transport JSON, naming, filesystem layout и
cleanup принадлежат provider: Core их не читает и не воспроизводит.
`clearOwnedRequests(root, nativeSources)` вызывается provider после captures;
отсутствующий публичный модуль/экспорт вызывает
`SOURCE.DOWNLOAD_OWNERSHIP_UNSUPPORTED`, fallback отсутствует. Все байты helper
и установленного provider payload остаются заморожены. Core отдельно требует
нулевые selected requests во время captures по публичному результату API.
Остальной `_generated` остаётся под fingerprint. В actual render Download
получает обычную видимую проекцию и создаёт свои ZIP.
`inspectOwnerDownloads(prepared): Promise<DownloadOwnership | undefined>`
возвращает тот же проверенный публичный envelope после source/session freeze;
consumer не дублирует его validation. `DownloadOwnership` экспортирован:
`protocol:1`, `root`, `directory`, `files:{path,source,resources,sha256}[]`.
Политика подтверждённых файлов описана ниже; проверка финальных архивов
остаётся обязанностью их производителя/потребителя. Общий resource closure
здесь не объявлен решённым.

Нативные tests устанавливают provider только из явно заданного checkout;
машинного scratch fallback нет:

```sh
PROJECT_DOWNLOAD_REPO=/path/to/quarto-project-download quarto run tests/owner-session.ts
quarto run tests/owner-session.ts --locator-only
PROJECT_DOWNLOAD_REPO=/path/to/quarto-project-download quarto run tests/owner-session.ts --ownership-only
```

Dangling `active.json` является присутствующим malformed locator. TS проверяет
его через `lstat` до обычного fallback; Core использует публичный
`pandoc.system.list_directory`, чтобы отличить unreadable directory entry от
настоящего отсутствия. Нативный regression проверяет и freeze hook, и Core
без metadata/hooks у обычного документа.

## Ссылки дочернего владельца на адреса публикации

Опциональный `publicationAddresses` связывает обычного HTML-владельца с
подготовленным managed Navigation root. `PreparedNavigationOwner` экспортирован
из `owner-preflight/navigation.ts`, `NavigationPublicationMember` — из
`owner-preflight/publication-resources.ts`. Без этого контекста прежняя строгая
граница ресурсов сохраняется: относительная filesystem-ссылка за корень
владельца вызывает `RESOURCE.OUTSIDE_OWNER`.

Сначала вызывающий код готовит Navigation root, затем передаёт его настоящий
handle в `prepareOwner(childRoot, { …, publicationAddresses: { navigation } })`.
Root в этот момент может ещё не быть активирован. Проверяются его sealed
session, source/config/control/module bytes, attempt/profile и ровно один
объявленный native member, совпадающий с корнем child. Подготовка не требует
root finished marker, actual receipts либо выдуманного invocation ID. Она не
расширяет педагогическое покрытие child на root или соседние проекты.

Разрешённая адресная связь — только обычный native `Link` на точный HTML/PDF
адрес другого выбранного member. Конечный набор адресов берётся из frozen
public native inspect: выбранный формат, mount и фактический
`pandoc.output-file` для top-level native input. Имя не выводится из суффикса
QMD; nested targets, отсутствующее или неоднозначное output-file не получают
fallback. Foreign `Image`, raw resource selection, исходник или произвольный
asset сохраняют прежние отказы. Такая Link-связь хранится отдельно от
resource uses и CUE resource policy; она не создаёт file/SHA grant соседу.

Исходный URL должен совпасть по двум независимым разрешениям. Первое использует
native source/effectiveBase; второе — каталог точного mounted HTML writer
этого же source. Нужна ровно одна frozen same-source top-level HTML writer
row. Оба разрешения должны дать один выбранный foreign address. Неизвестный,
nested или неоднозначный собственный writer даёт
`SOURCE.PUBLICATION_ADDRESS_WRITER_UNSUPPORTED`, несовпадение геометрии —
`SOURCE.PUBLICATION_ADDRESS_WRITER_MISMATCH`. Actual `quarto.doc.output_file`
является абсолютным путём; его каноническое разрешение под frozen child root
сверяется с точным native inspect output-file, без сравнения только basename.
Actual output-directory должен совпасть с member output context.
URL не переписывается, HTML body
не разбирается. Пример и ограничения mount/output-file приведены в
[документации Navigation owner](navigation-owner.md#адресные-ссылки-из-дочернего-владельца).

После успешного завершения **всех** обычных native commands и существующего
QRC finalize вызывающий код передаёт в `finishOwner` настоящий QRC stage как
`publicationAddresses.output` и полный actual member map `path`, `mount`,
`format`, `output`. `output` каждого member берётся из его native metadata
context, а не вычисляется по исходному пути. Этот ранний map не содержит owner
handles; поздний publication seal использует свой обычный полный member map.

Перед записью resource index и finished marker Core требует полный успешный
набор root и child native receipts, guard и actual hashes, текущую identity
их invocation, неизменный prepared root и точное соответствие всего member map.
Для всех sealed адресных uses, включая baseline, проверяются реальные native
и mounted stage файлы без symlink/escape и их SHA-256. PDF bytes должны
совпасть; для HTML после QRC фиксируются два отдельных hash. Путь stage сам
по себе не подтверждает native zero или QRC завершение: их порядок остаётся
обязанностью участвующего Publisher lifecycle.

Own current closed/service bytes запрещают оба адресных witness по SHA.
Проверка выполняется по текущему resource-policy draft до completion и
повторяется с реальным proof service file; draft не является готовым индексом.
Частный `.course-owner/publication-addresses.json` записывается до resource
index, входит в denied Core service set и связывается с index hash. Его raw
выдача и переименованные копии не разрешаются. Если есть отложенные адресные
uses, finish без нужного контекста отказывает
`SOURCE.PUBLICATION_ADDRESS_FINISH_REQUIRED` до index/finished; неполный map
или отсутствующее actual root evidence тоже не дают завершить child.

`validateOwnerResources(child)` перед выдачей current index повторяет полный
адресный proof: prepared source/config/control/module freeze, те же root/child
invocations и все receipts, весь набор edges, writer geometry, native/stage
bytes и own current denied-byte veto. Новый invocation не перепривязывает старый
proof. Изменение proof, handle, источника, controls или любого witness отзывает
индекс. Parent finish/current index не требуется и не вызывается. Порядок
завершения — child finish, затем Navigation finish с текущим child service
inventory, затем publication seal и последний current validator перед заменой
старой публикации. Новый hook, phase или второй engine не добавляется.


## Подтверждённые ресурсы владельца

Тот же native callback сохраняет body-only `Link.target` и `Image.src` до
проекции и после `grading.prepare`/`visibility.prepare` на `doc:clone()`.
Авторская разметка и predicates видимости не дублируются в TS. Примечание
`grading-notes` должно принадлежать ровно одному заданию с `target`, как в
текущем контракте; обычный `sol-*` без ограничения профиля остаётся публичным.
Номера occurrences служат диагностике, а объединение policy выполняется по
канонической идентичности файла, независимо от root QMD и порядка после
удаления скрытых узлов.

До единственного обычного engine CUE проверяет concrete native
`inspect.files.resources` как сырые выбранные файлы. Directory edges
разворачиваются файловой системой, glob/Markdown parser не добавлен.
`configResources` — зависимости, их текущие байты заморожены; это не запрос
выдать исходники. Общий public+closed baseline-файл разрешён student, известный
closed-only файл запрещён. Поздняя вычисленная публичная ссылка на него
останавливает render и не повышает baseline. Full использует существующую full
проекцию. Service-файлы запрещены обоим профилям; публичная service-ссылка тоже
вызывает отказ. CUE возвращает решения и причины; TS проверяет только native
provenance, paths, containment, symlinks и текущие bytes.

Effective base — каталог главного native QMD. Относительная ссылка внутри
include разрешается относительно этого корня, а не физического include-файла.
Начальный `/assets/x` означает корень проекта, не абсолютный OS path.
`//host/x`, scheme URL, `data:` и `#anchor` не становятся filesystem paths;
query/fragment не входят в file identity. Link на canonical root/include QMD
разрешён как navigation. Выбор его сырых bytes для starter/ZIP запрещён CUE.
Опциональная связь с managed publication выше проверяет отдельный адресный
edge; она не меняет containment и выдачу остальных ресурсов.
Отдельный native resource-QMD и обычный unlinked starter разрешены: отсутствие
AST-ссылки само по себе не означает private. Каталог, суффикс, JSON extension
или `project-download.profiles` также не объявляют авторский файл private.

Новый generated producer ограничен нативным R plot: явный `engine: knitr`,
R `codeCells` в public inspect, Image внутри native `.cell` и
`.cell-output-display`, точное `<root>_files/figure-html/<file>` и поддержанный
image suffix. Callback читает реальные bytes до native перемещения и сохраняет
SHA-256. `finishOwner` требует тот же hash по полному подтверждённому пути в
фактическом output; basename mapping и фиктивного capture hash нет. Внешний
доверенный `output` подтверждается native `output_directory`; source base
при этом не меняется. Авторский файл, существовавший до engine, остаётся
замороженным даже по пути `figure-html`. Произвольные новые записи рядом с
исходниками, auto-selected/другие generated engines, plot под `results: asis`
без native display wrapper и более широкие computed assets не поддержаны.

Service origin берётся из actual producer evidence: замороженные
`inspect.extensions[].path` payloads, точные Core model/session/capture/receipt
файлы и файлы из публичного `inspectOwnerDownloads` envelope. Неизвестная запись
в Core generated области вызывает `RESOURCE.SERVICE_PRODUCER_UNSUPPORTED`.
Все присутствующие
bytes имеют текущий hash; произвольный авторский JSON service не становится.
Индекс сохраняет разрешённые **и** запрещённые известные пути/hashes, чтобы
потребитель мог проверить реальные bytes выбранного файла и обнаружить
переименованную копию запрещённого payload. Index и finish marker сами не
являются новым author resource registry.

После успешного `finishOwner` экспортирован дополнительный API из
`owner-preflight/owner.ts` и `owner-preflight/resources.ts`:

```ts
validateOwnerResources(prepared: PreparedOwner, options?: {
  selections?: string[];
}): Promise<OwnerResourceIndex>
```

`selections` — конкретные канонические owner-relative **файлы**, уже
native-expanded вызывающим кодом, не список navigation Links. API недоступно
до finish либо после failed render. Перед каждым использованием он повторно
проверяет session/baselines, native input/configuration freeze, index hash и
текущие source/generated/service bytes. Неверная selection, stale index,
изменение hash или symlink вызывают `OwnerFailure`; consumer не пересчитывает
видимость самостоятельно.

| Поле экспортированного `OwnerResourceIndex` | Значение |
| --- | --- |
| `protocol`, `root`, `attemptId`, `profile`, `sessionId`, `sessionHash`, `invocationId` | Проверенная identity текущей попытки |
| `files` | Полные подтверждённые records: `path`, `sha256`, `origin`, `actualPath`, `producer`, `role` |
| `evidence.baseline`, `evidence.actual` | Resolved native uses: root `source`, `effectiveBase`, profile/phase/projection, kind/target/order, canonical `path` |
| `policy.files` | CUE `allowed`, `reasons`, path/hash и baseline/public/closed/actual evidence |
| `policy.diagnostics` | CUE code/path/reasons для отказов |
| `runtimeEligibility` | Отдельные CUE producer-qualified runtime declarations; raw source остаётся service/denied |
| `indexHash` | SHA-256 sealed index body без поля собственного hash |

`RuntimeEligibility` экспортирован отдельно: `source`, `sourceSha256`,
`producer`, `dependency`, `version`, `asset`, `kind`, `descriptorPath`,
`descriptorSha256`, `registrationPath`, `registrationSha256`, `eligible`,
`reasons`. Единственный начальный producer — `course-presentation`; его
публичный `html-dependency.json` используется самим `add_html_dependency` и
создаёт точные script/link markers. Raw installed source/hash остаётся denied.
Consumer подтверждает actual HTML текущего member, собственные installed
source/descriptor/filter hashes и exact local destination/hash; только этот
native runtime destination может получить исключение. Оно не относится к
ZIP, utility/handout files, переименованным копиям, capture/stale HTML или
неизвестным JS/CSS. Core не выдаёт фиктивный pre-ast output witness для более
позднего Presentation callback; runtime output IO proof выполняет consumer.

Body-only Link/Image corpus не доказывает зависимости в metadata, CSS, raw
HTML, непрозрачных shortcodes и произвольных runtime reads. RawInline/RawBlock
HTML внутри body даёт явный `RESOURCE.OPAQUE_CARRIER_UNSUPPORTED`, а не
публичный allowlist. Для невидимой private dependency без существующего
поддержанного adapter contract результат остаётся unsupported. Доказанная
цепочка Core → Presentation → Download сохраняет native capture suppression
и public/default resource IDs; это не обещание поддержать произвольный
непрозрачный carrier или полный A9. Прямое чтение request JSON/private API/cache,
новая resource YAML-разметка и предположение о закрытости обычных решений не
используются.

Фокусный `tests/owner-resources.ts` включает pure CUE/path/provenance matrix и
установленный native corpus: public+closed union, closed-only, обычное решение,
include/root base и равные basename, R plot с текущим output/hash, navigation
vs raw canonical selection, unlinked starter resource-QMD, настоящий Core
package из native post hook без дополнительного engine, service selection и
source/generated/service hash mutation. Отдельные native режимы требуют
отказ до engine для закрытой/canonical selection, отказ после вычисленной
closed-ссылки и произвольной новой source-записи. CI `owner-native.yml`
запускает session/resources на обеих фактических версиях Quarto с точным
Download provider pin; прежний строгий real R/Jupyter workflow сохранён.

```sh
quarto run tests/owner-resources.ts
OWNER_RESOURCES_NATIVE=1 quarto run tests/owner-resources.ts
OWNER_RESOURCES_NATIVE=1 OWNER_RESOURCES_PROFILE=full quarto run tests/owner-resources.ts
OWNER_RESOURCES_NATIVE=1 OWNER_RESOURCES_FAILURE=early quarto run tests/owner-resources.ts
OWNER_RESOURCES_NATIVE=1 OWNER_RESOURCES_FAILURE=early-canonical quarto run tests/owner-resources.ts
OWNER_RESOURCES_NATIVE=1 OWNER_RESOURCES_FAILURE=late quarto run tests/owner-resources.ts
OWNER_RESOURCES_NATIVE=1 OWNER_RESOURCES_FAILURE=extra quarto run tests/owner-resources.ts
```
