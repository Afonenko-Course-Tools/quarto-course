# Опциональный нативный экспорт тела

Установленный Core может сформировать проверяемый пакет для Print из обычного
рендера одного владельца. Это явная возможность API подготовки, а не новый
авторский реестр или включённый по умолчанию режим `course-check`. Публичные
образовательные типы следуют текущему каноническому контракту Core.

## Участвующий вызов

Нужны Quarto 1.10.18/1.11.5, CUE 0.17.1, обычная установленная цепочка
`[course-core, course-presentation]` и последний pre-render hook
`_extensions/course-core/entrypoints/owner-freeze.ts`. Используйте уже выбранные
нативным default- или book-проектом корневые QMD, присутствующие в обоих
профилях.

В book-проекте обычный `book.chapters` может включать index вне body selection;
выбранные главы корпуса и работ остаются частью одного владельца. Название главы
задаётся в YAML `title`, а фиксированную работу определяет отдельный первый
сохранённый нативный Header с явным `sec-` ID, например H2. Его authored
identity, полный Header ordinal и `topLevel` доказываются той же
ordinary/no-auto парой. Поглощённый Quarto заголовок главы, `chapter-id` и
автоматический slug не заменяют этот Header. Native `@exr-` ссылки между главами
разрешает тот же единственный рендер книги; предупреждения не подавляются. В
default-проекте межфайловые crossrefs могут быть недоступны, и предупреждения
Publisher остаются ошибкой.

```ts
import {
  activateOwner,
  finishOwner,
  prepareOwner,
  validateOwnerBodies,
} from "./_extensions/course-core/owner-preflight/owner.ts";

const prepared = await prepareOwner(root, {
  attemptId: buildId,
  profile: "student",
  body: {
    sources: ["tasks/corpus.qmd", "tasks/lab.qmd", "tasks/test.qmd"],
    // Необязательно: доверенная identity участвующей сборки.
    release: buildId,
  },
});
const metadata = await activateOwner(prepared);
// Передайте metadata штатному `quarto render` этого владельца и профиля.
// Дождитесь нативного exit code 0. При ошибке НЕ вызывайте finishOwner.
const finished = await finishOwner(prepared);
if (finished.exitCode !== 0) throw new Error("Owner reconciliation failed");
const checked = await validateOwnerBodies(prepared, finished.report.body, {
  works: ["course-id/sec-lab"], // необязательно; фиксированные канонические keys
});
// checked.publicPackage передаётся публичному потребителю Print.
```

Подготовка не исполняет документные R cells. Обычный render исполняет engine
один раз; экспорт использует именно его сохранённый нативный AST и текущие
ресурсы. `finishOwner` не доказывает код завершения внешнего процесса: это
обязанность участвующего вызывающего кода. Наблюдения AST и успешные receipts не
заменяют нативный exit code. Без finish никакой текущий handle не валиден.

`body.sources` — непустой список уникальных owner-relative путей `.qmd` без
`..`, URL или абсолютных путей. Владелец берётся из реального `course.id`,
`apiVersion` — из Pandoc. `body.release` — непустая доверенная строка; без неё
используется `attemptId`, identity текущей участвующей сборки. Это не отдельная
версия курса и не версия Core. Jupyter в выбранном body-корпусе пока даёт явный
capability-отказ.

## Поддерживаемый корпус

Канонические задачи — статические Div `#exr-*` с обязательными назначением,
сложностью и доказанной исходной темой. `target` можно опустить; явный
`target="manual"` сохраняет требование ведущего Header. Решение `#sol-*` может быть соседним блоком той же задачи в том же QMD;
`.grading-notes` принадлежит одной задаче. Для закрытых компонентов действуют
существующие правила видимости. Общая CUE-модель отклоняет вложенные или
неоднозначные роли, чужие решения, orphan-банки и банки внутри закрытых заметок.

Пакет `course-body-package-v1` остаётся публичным: класс control и
`course-role="control"` отклоняются существующим `BODY.CONTRACT_INVALID`
на CUE-поле `_public`. Full control доступен в owner HTML и Core-модели;
закрытые контрольные композиции для Print/export требуют отдельного будущего
контракта. Эта поставка не расширяет publicBody до приватного транспорта.

Работа имеет `assessment.kind: lab|test|exam`, первый непосредственно
верхнеуровневый Header с **явно авторским** `#sec-*` и один `.assessment-items`
со списком прямых `@exr-*`. Состав и порядок фиксированы. Каждый элемент
разрешается в один канонический вопрос владельца; одна задача может входить в
несколько работ. Каждая экспортируемая задача должна входить хотя бы в одну
выбранную работу. Никаких отдельных экземпляров задачи, рандомизации и вариантов
пакет не создаёт.

Поддержаны manual, single-choice, numeric, multipart и matching. Numeric,
multipart и matching задаются data-only CodeBlock `.yaml .answer-spec`.
Single-choice — Div `.answer type="single-choice"` с одним BulletList и ровно
одним Span `.correct`. Все варианты сохраняются. Maintained YAML-декодер и общая
CUE-схема проверяют одинаковые объявления до engine и после него. Изменённый,
вычисленный, дублированный, перемещённый или malformed банк останавливает
попытку; неподдерживаемая форма не превращается в manual.

Обычные абзацы, списки, нативные таблицы, формулы, HTTP(S)-ссылки, статические
локальные вложения/изображения и обычный unlabelled R display-plot разрешены.
Rich QRC Cite внутри вопроса, локальные anchors, произвольный shortcode carrier,
raw HTML/TeX, inline Note и неподдерживаемый AST дают capability-отказ. Core не
сочиняет URL и не читает QMD повторно для замены этих элементов.

Авторские Header IDs сохраняются. Автоматические IDs убираются только по
принадлежащему этой попытке no-auto reader evidence, с точной корреляцией всех
Header по полному ordinal и `topLevel`. Первый автоматический slug не может
заимствовать поздний явно авторский ID работы.

## Публичная проекция и ресурсы

В выбранных student body-QMD механическая Lua-проекция применяет решение того же
producer/CUE: удаляет валидированные `.answer-spec` CodeBlocks и разворачивает
валидированные `.correct` Spans. Текст всех вариантов и Link/Image slots
сохраняются; нативные ресурсные наблюдения до/после совпадают. Это ограниченная
проекция ответов, не самостоятельный YAML validator или renderer. Без body
opt-in и в full остаётся существующая политика отображения.

`checked.publicPackage` имеет схему `course-body-package-v1`, owner, release,
apiVersion, questions, works и resources. Публичный вопрос содержит owner, id,
канонический key, source, visibility, answerType, condition и publicAnswer.
Публичный пакет не содержит closedKey, solution, gradingNotes или маркеров
правильности. `checked.privatePackage` содержит эти закрытые компоненты и
предназначен только владельцу. Не передавайте его student Print/ZIP.

Ресурс содержит
`{owner, source, effectiveBase, target, sha256, data, visibility}`: `source` —
канонический текущий путь владельца, `effectiveBase` — корневой QMD вопроса,
`data` — base64 текущих байтов, `target` — безопасный путь в публичном пакете.
Нативные Link/Image slots заменяются только после разрешения ресурса
существующей owner-политикой. Symlink и служебные файлы запрещены.

Student native plot разрешается по реально исполненному student наблюдению.
**Full-only вычисленный рисунок без исполненного student evidence запрещён.**
Провайдер не запускает student engine дополнительно. Отдельный заранее
написанный статический full-корпус может использовать static public ресурсы,
доказанные student baseline. Сохранение старого PDF/ZIP при отказе остаётся
обязанностью внешнего participating publisher.

## Handle и повторная проверка

`finishOwner(...).report.body` возвращает `OwnerBodyHandle`, связанный с root,
attemptId, profile, sessionId/sessionHash, invocationId, selectionHash,
package/public/receipt paths и SHA256, а также indexHash. API и типы
`OwnerBodyHandle`, `BodyPackage`, `PublicBodyPackage`, `BodyReceipt`
экспортируются из установленного `owner-preflight/owner.ts`.

Приватный пакет `.course-owner/body/package.json`, публичная проекция
`public.json`, receipt `receipt.json` и точные per-source body seals
регистрируются как Core service **до** записи resource index. Receipt связывает
selection, module hashes, seals и `{source, sha256, target, effectiveBase}`
ресурсов; indexHash связывает handle, без циклического хеширования
receipt/index. Эти файлы нельзя выбрать для student delivery, включая
renamed-byte hash gate.

При body opt-in все реальные конфигурации из `inspect.files.config` обоих
профилей также получают service origin до ресурсных seals/index. Используются
точные нативные пути и замороженные байты, включая неактивный профиль; имена
файлов не распознаются собственным parser. Их SHA входят в существующий
consumer-deny набор для переименованных файлов и записей архивов. Без body
opt-in классификация конфигураций обычного owner lifecycle сохраняется.

`validateOwnerBodies(prepared, handle, {works?})` заново проверяет текущий
native audit, frozen inputs, ordinary/identity captures, invocation, seals,
service index, модули и байты ресурсов; заново воспроизводит ту же CUE-партицию
пакета. JSON round-trip самого handle поддержан. Результат —
`{publicPackage, privatePackage, receipt}`. `works` может выбирать только
уникальные существующие канонические keys работ и сохраняет заданный порядок; в
публичной выдаче остаются их канонические вопросы и используемые ресурсы.
Чужой/устаревший handle, изменённые байты или незавершённая попытка отвергаются.

Фокусные команды: `quarto run tests/owner-bodies.ts student`, `computed-bank`,
`post-failure`, `automatic-work`, `full-plot`, `full-static`. Book-маршрут:
`book-student`, `book-consumed-work`, `book-full-plot`, `book-full-static`.
Contract/integrity тесты принимают завершённый evidence-каталог student теста и
не повторяют engine: `quarto run tests/owner-body-contracts.ts <evidence>` и
`quarto run tests/owner-body-integrity.ts <evidence>`.

## Совместный Body/Navigation lifecycle

`prepareOwner(root, {attemptId, profile, body: {sources},
publicationAddresses: {navigation}})` сохраняет обе обязанности одного child
owner. `finishOwner(prepared, {publicationAddresses: {output, members}})` сначала
проверяет настоящие Listing/foreign writer addresses и Navigation, затем текущие
Core fragments, Body package и полный resource index. Bare child finish
отказывает `SOURCE.PUBLICATION_ADDRESS_FINISH_REQUIRED` и не выдаёт Body handle.
Root Navigation не становится Body owner. Публичный consumer после текущей
проверки получает только `validateOwnerBodies(...).publicPackage`.

Нативный default project допускается также без явного `project.type`, если
`inspect` вернул существующий объект `config.project`. Исходные audit/config bytes
не нормализуются. Missing/unknown project и Website остаются неподдерживаемыми.

Student answer projection выполняется после успешного actual reconcile. При
Native Listing повторная ресурсная проверка использует исходные точные RawHTML
witness/coverage и уже преобразованный документ. Она не создаёт второй Listing
witness и не разрешает произвольный RawHTML. R Body и static Listing проверяются
разными owner fixtures: Listing по-прежнему требует Markdown без code cells.

Совместные native regressions на обеих stock версиях:

- `quarto run tests/owner-publication-addresses.ts body`: installed Body + Nav +
  QRC, HTML/PDF/Reveal, единственный R pass, child-before-parent finish, служебные
  Body/config bytes и точный current отказ после изменения mounted PDF.
- `quarto run tests/native-listing-owner.ts body`: static Body/Listing, ordered
  work, numeric/choice answer projection, точные current witness/coverage и
  отказ unknown RawHTML; полный прежний mutation corpus остаётся в обычном режиме; используются те же обязательные environment settings, что в обычном
  native Listing runner.
- `quarto run tests/owner-bodies.ts implicit-default` и
  `quarto run tests/owner-body-projects.ts`: native implicit-default lifecycle и
  границы конечного project capability.

Эти Core проверки не означают отдельной consumer Print PDF/Download ZIP
acceptance: она требует настоящего установленного delivery flow.
