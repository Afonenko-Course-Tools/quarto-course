# Текущая native операция Core

Текущая TS-композиция Core поддерживает Quarto >=1.11.5, точные native targets
`html|revealjs` и projections `student|author`. Независимая приёмка общей
Core/C/Publisher/Download-композиции выполняется отдельно.
Она получает объявления и фактическое позднее тело от обычного `quarto render`.
Потребителю не нужно создавать `FinalizedDocument` или читать private receipts.

В установленной композиции используются `filters: [course-core]`,
`course-core-runtime: native-ts`, `course-core-projection: student` и
`course-core-role: exercise-bank` либо `page`. Native эффективные scalar
`exercise-defaults` проходят существующий TS parser. Hooks проекта вызывают
`quarto run _extensions/Afonenko-Course-Tools/course-core/entrypoints/native-pre.ts`
и соответствующий `native-post.ts` после native writer. Старые `pre.ts/post.ts`
при выборе этой композиции заменяются этими hooks, а не запускаются дополнительно.
Root программы владеет переносом настоящих конфигураций и installed copies.

```ts
const prepared = await Core.withCurrentNativeOperation({
  root, profiles, projection: 'student', outputDirectory,
}, async operation => {
  const document = operation.document({source: 'tasks/bank.qmd'});
  const condition = Core.selectCondition(document, 'exr-example', 'student');
  // Альтернатива: operation.condition({source, exerciseId, view}).
  const links = QRC.bindConditionLinks(condition, {
    catalog: referenceCatalog, baseUrl,
    urls: publisherDestinations, // в том числе заранее выбранный starter.zip
  });
  return await operation.withProjectContexts(projectRequests, async batch => {
    const group = batch.groups[0];
    const plan = await Core.planProject(group.contexts[0], {audience: 'student'});
    const inventory = await Core.materializeProject(plan, condition, {
      links, resources: resourceBindings, submission: checkedOwnerSummary,
    });
    await operation.assertCurrent();
    return {inventory, zip: await Download.packageArtifact(inventory)};
  });
}); // Только успешный final fence отдаёт prepared вызывающему коду.
// Здесь composition owner записывает prepared.zip в назначенное место.
```

`operation.identity` содержит UUID операции, ordered profiles, projection и
runtime. Format принадлежит документу: `operation.catalog.documents` содержит
owner-relative `source`, точный `format: html|revealjs`, output-root-relative
`output`, проверенную native `role` и фактически видимые
exercise occurrences с anchor/hasPublicSolution и owner-relative project. Это семантический
каталог Core; QRC reference catalog и конечные URL принадлежат QRC/Publisher.
Document DTO содержит относительный input и только видимые определения/поздние
occurrences. В нём нет абсолютного owner, исходных metadata и grading payload.
Public схемы исполняются локальным Zod, типы выведены из схем.

`document()` и `condition()` используют уже декодированные immutable значения.
Точные document/condition значения связаны с живым callback и owner; последующая
материализация проверяет эту связь. Сериализация DTO не переносит capability. На dependent IO materializeProject точная runtime-issued authority обязательна: clone/JSON/произвольно декодированный ResolvedCondition получает CONDITION_AUTHORITY; истёкшее точное значение — OPERATION_EXPIRED. Pure normalize/finalize/select сохраняют анализ значений, но не создают полномочие на IO.
После callback методы операции отказывают с `OPERATION_EXPIRED`. Runtime,
private pointer/complete, profiles/projection/output и capture witnesses
остаются привязаны к текущей операции. Child outputs/resources больше не имеют
собственной гарантии неизменности промежуточных bytes. Initial snapshot/hash и
public `sourceRows` пока сохраняются: выбранные raw QMD проверяются по прежним
physical regular paths/signatures для совместимости source SHA consumers.
Все соседние файлы и ancestor membership не обязаны оставаться прежними.

Содержание bank/assessment и effective defaults берутся из actual Native
pre-AST/late capture, включая результат штатных cells, freeze и engine caches.
Pre-child owner inspect задаёт input selection и intent, но не замораживает
полный metadata graph. Появившийся `_metadata` или изменённый metadata-file может
участвовать в следующем actual render. Новые QMD не добавляются автоматически
в уже выбранный input plan. Проверки actual input/format/projection/role и
selected assessment ID сохраняются.

Существующие значения `course-core-source-policy: general|static` сохраняются;
неизвестное значение по-прежнему отклоняется. `static` теперь только сохраняет
лёгкий путь чистых getters и resource copies до внешней границы. Оно больше не
запрещает computing engines/codeCells/OJS и не обещает неизменность всего owner.
Оба значения используют actual Native metadata и выбранные raw-source guards.
Поддержка конкретного executable output зависит от конечного AST/формата:
произвольные browser widgets не становятся переносимыми README/PL автоматически.
Native cache freshness и разделение по audience задаёт автор; текущая операция
не доказывает повторное исполнение всех внешних данных и отсутствие секрета в
произвольном неразмеченном computed тексте.

Финальная полнота, privacy, output/resource ownership и lifecycle сохраняются.
Публикация допустима после успешного возврата callback. Проверки signature
для выбранных raw sources остаются вне этого изменения; подписи и hashes
промежуточных child outputs/resources удалены.

Обычные ресурсы запрашиваются отдельно:

```ts
const files = await operation.resourceInventory({
  files: [{source: 'assets/diagram.svg', target: 'images/diagram.svg'}],
});
```

Это `course-native-resource-inventory-v1`: operation, audience и файлы с
`target`, собственными `bytes`, `size`, `audience`, `reason`. Поля SHA256 нет.
DTO отличается от inventory кодового проекта с exerciseId; существующий
`Download.packageArtifact` принимает inventory проекта.

Доступность ресурса задают фактическая поздняя проекция, наблюдавшийся native
source и выбранный output. После полного child render и его обычных post hooks
Core выбирает конечный regular output; если Quarto не перенёс ресурс, используется
наблюдавшийся source. Retained output без такого source observation не даёт
доступа. Owner/role/profile/path, regular/realpath/symlink и public/closed physical
alias privacy сохраняются. Dev/inode исходного и конечного файла используются
только для privacy; их не сравнивают с прежним output inode ради неизменности.
Установленные source associations сохраняются при последующем переносе,
удалении или замене source и объединяются по child captures.

На внешнем входе ordinary операции конечные HTML paths проходят regular/realpath
проверку один раз после hooks. Первое чтение ресурса после open однократно
проверяет current regular/no-symlink pathname и его dev/inode соответствие
открытому handle, затем проверяет identity против закрытых A1 origins и копирует
фактические bytes. Это обнаруживает постоянную подмену между precheck и open;
portable Deno путь не обещает защиты от adversarial double-swap. При отсутствии
dev/inode выбранный resource I/O отказывается: переносимость этой physical-alias
границы на платформы без этих полей ещё не квалифицирована. Повторные запросы получают отдельные копии callback snapshot
без чтения диска или повторного resource guard. Native postprocessing вправе
переписывать HTML и ресурсы: сравнения с прежними SHA, size, mtime/ctime нет.
General operation guards сохраняют pointer/lifetime/raw-source договоры и больше
не обходят outputs/resources на каждом getter.

`operation.metrics` отдельно считает `inspectCalls`, initial discovery
`fullWalks`, `sourceHashReads/sourceHashBytes`, полные и локальные проверки исходников
`fullSourceFences/localSourceFences`, фактические `sourceDirectoryReads`,
`runtimeHashReads`, resource reads/cache hits, `nativeMetadataBytes` private ранних фактов и
`childRenders` состоявшихся scoped post. Полный traversal включает discovery и
полные source fences; `fullWalks=1` не означает отсутствие последующих проверок
состава. Pending вызовы внутри scope учитываются в seal receipt и используют
локальные guards. Поля `outputHashReads`, `resourceHashReads`, `nativeResourceHashReads` остаются
в существующем DTO метрик и для удалённого механизма больше не увеличиваются.
Метрики, прочитанные внутри complete callback, ещё не включают
проверку перед его возвратом. Getter сам не выполняет IO.
Отдельный `readProjectContexts` сохраняет свои необходимые native inquiries;
система не обещает один inspect на курс. Полный Publisher/Navigation rollout,
Workspace git seed и замена прежнего runtime требуют собственной сквозной проверки.
Повторная генерация поверх авторского source-файла считается изменением source;
такой producer требует отдельной квалификации владения generated inputs.

Публичная ArtifactInventorySchema проверяет общую семантическую target/audience/collision policy Core, включая запрет .git для обоих audiences. Эта же target policy используется materializer и final writer; consumers импортируют её через публичную runtime-схему. Будущий Workspace seed требует отдельного объявленного договора.

## Происхождение неизменённых файлов A1

Optional `ArtifactFile.rawSource` в `course-artifact-inventory-v1` — canonical
owner-relative путь **фактически прочитанного raw файла**, чьи неизменённые bytes
уже прошли прежние source/currentness/role guards. Поле получается только из
существующего private source argument writer; оно не выводится из target или
совпадения hash. Inherited common-file path сохраняет своего native owner и не
перебазируется на выбранный проект. Raw resources имеют origin только когда
существующий captured/observed reader уже выдал bytes того же файла. Generated
README и transformed entries без такого raw source argument поля не получают.

Схема проверяет нормализованный относительный путь и прежнюю partition/cache
policy для аудитории; абсолютные и unsafe paths, unknown fields и закрытые
student origins отклоняются. Full origins закрытых файлов предназначены для
private grading transport. Core writer пишет только target/bytes; source paths
не добавляются в README, ZIP entries, public Body или assignment delivery.
Composition owner не должен сериализовать full inventory в публичный payload.
Прежние file DTO без поля принимаются; cache/clone сохраняют field и отдельные
копии bytes. Чужие copied strict schemas требуют согласованного обновления у
своего владельца.

Это data-only добавление не создаёт reader, authority или нового resolver и не
добавляет walk/read/hash. Canonical syntax не подтверждает существование или
подлинность произвольного DTO. Контрпример: JSON DTO с
`rawSource: "unknown/missing/source.txt"` и supplied bytes может быть принят
bytes writer; writer делает **ноль source reads** и пишет только supplied target.
Он не читает этот path и не подтверждает его currentness. Serialized/caller DTO
не становится genuine A1 producer, context или plan. Потребитель check provenance
сверяет актуальный live inventory с authentic same-S rows и точной selection
семантикой; отсутствие/неизвестный origin не восстанавливается по target/hash.
Дополнение не доказывает legacy check hashes, profile qualification или приёмку C.

## Ранние release и capture gates A4a

`withCurrentNativeOperation` поддерживает `html|revealjs` документы в projections
`student` и `author`.
Если явная projection отсутствует, native `course.view: student|full` определяет
`student|author`; конфликт с expectation отвергается. Проверенный early
`exercise-bank` определяет роль документа. Метаданные Quarto остаются источником
этого значения; отдельного YAML merge нет.

```ts
await Core.withCurrentNativeOperation(expectation, async operation => {
  const proof = await operation.validateRelease(
    {expectedSources: actualOwnerSourceList, courseId: 'java-semester-one'},
    [{name: 'prairielearn',
      nativeMetadataReadSet: ['configuration', 'assessment',
        'projectChecks', 'projectMaterialization'],
      validate: PL.validateNativeAdapter}],
  );
  // Зависимые reads/материализация — здесь; публикация после final fence.
});
```

Proof проверяет одну current owner operation: source coverage, course/view,
unique IDs, декларации и installed targets, native assessment composition и
assignment policy, настоящий late solution witness, source/currentness guards.
Проверка dependency subtree учитывает только ресурсы, действительно наблюдённые
этой native операцией после исходного snapshot. Проверяются выбранные пути,
роли и privacy; release не доказывает равенство промежуточных resource bytes.
Такой ресурс не разрешает посторонние новые файлы или изменение выбранного raw source. Список ресурсов caller не
расширяет этот допуск.
Он не объединяет самостоятельные owner courses в один курс. Publisher продолжает
проверять collection/output/mount coverage.

Adapter callback получает immutable runtime-validated input: `origin`
(operation, captureWitness, source, actual document format, projection, ordered
profiles), `course`, обязательный `nativeMetadata` envelope,
свои target declarations (id/attributes) и необязательную assessment composition.
Он возвращает `{sources:[{path,kind:'file'|'directory'}]}`. Core проверяет
owner-relative containment, symlink/cache/generated policy, captured membership,
тип и актуальность именно объявленного subtree, затем final full fence. Эти
пути и grading payload не входят в public proof. Core не импортирует PL и не
дублирует его business schema. Без исполняемого owner validator выбранного
adapter — `RELEASE.ADAPTER_UNQUALIFIED`; ранний A4a сам по себе не доказывает
эквивалентность полной PL release validation.

Порядок для raw adapter capture:

1. Core `entrypoints/native-pre.ts` начинает новую generation.
2. C pre-render одним `withPendingNativeOperation(expectation, callback)` на owner
   получает immutable `identity` и `inputs: [{source,captureWitness}]` и записывает
   собственный capture request.
3. C pre-ast filter **до** Core `native-ts/early-context.lua` снимает свой raw
   канон и независимо наблюдает exact target через
   `quarto.format.format_identifier()`. Он связывает capture с
   source/witness/identity. Core отдельно наблюдает этот же native target в
   early и late и выполняет обычные
   early→late/post стадии.
4. Во время `operation.validateRelease` C validator сверяет собственный capture
   с точными origin/operation/source/profiles/format/projection и witness.

Pending descriptor — только correlation, без AST/private paths или IO authority.
После завершения generation loader отказывает; после callback его getters
истекают. Старый witness не совпадёт с новой generation даже при тех же source
bytes. Missing/foreign/switch/source changes проверяются entry/final fences.
Getters не выполняют IO/inspect/hash; сам pending call имеет два validation
fences и runtime identity checks, а не нулевой IO.

Точные служебные Quarto segments `_output`, `_site`, `_book`, `_freeze`,
`site_libs` исключены из предметных inputs, disposable copies, artifact
sources/targets и final fences одинаково с прежней native source policy.
`_output-lessons` и `_output.md` не совпадают с этими segments. Учебный
`.cache/course-data` сохраняется; стабильный `.cache/codex-tools` и configured
XDG tool cache исключаются отдельно. Вложенный сегмент `_output` уже принадлежит
зарезервированному namespace, произвольное blanket исключение каталогов не вводится.

В adapter input `attributes` сохраняет все authored native/adapter attrs и
накладывает Core-validated effective поля: `difficulty`, `statement-visibility`,
`course-role`, `time`, `project`, `target`, `project-check`. Core значение имеет
приоритет; undefined ключи не добавляются. Строки сохраняются, числовой `time`
превращается в `String(number)`. Native default=false подавляет поле в transport,
а не создаёт строку `'false'` или пустой check. Так C потребляет Core defaults
без второго resolver и продолжает владеть собственным raw business каноном.

## Ограниченный checkpoint A4b: ответы и конфигурация адаптера

Новый TS-путь проверяет `answer`, `answer-spec` и `correct` в фактическом раннем
AST до student/author и штатных conditional transformations. Исполняемые
`AnswerSpecSchema` и `AnswerFactsSchema` переносят договор Core: `manual` с
`submission: text`, `numeric` с конечным `key.value` и неотрицательным
`tolerance.absolute`, `multipart` с уникальными именами manual/numeric частей,
`matching` с уникальными условиями/вариантами и полным соответствием, либо
`single-choice` с минимум двумя вариантами и ровно одним `correct`. Неизвестные
поля, повторные банки, YAML aliases/anchors/tags и ответ вне упражнения/внутри
решения отвергаются. Повреждённый restricted-ответ также останавливает запуск до
удаления закрытого условия.

Публичный AST получает только варианты/поля ответа без ключей. Это относится и к
author-проекции: закрытые факты передаются отдельно в существующий
`NativeAdapterValidator.validate(input)`. У соответствующей декларации есть
необязательное `answer: AnswerFacts`; для single-choice это
`{type: 'single-choice', count, correct}`, для остальных форм — проверенный
канонический answer-spec. Отсутствующий банк остаётся отсутствующим. Проверку
необходимости банка для конкретного вида оценивания выполняет владелец адаптера.
Core не выбирает PL grading policy.

## Bounded native metadata и actual format A4c

Каждый `NativeAdapterValidator` объявляет обязательный readonly
`nativeMetadataReadSet` из `configuration`, `assessment`, `projectChecks`,
`projectMaterialization`. Core копирует, проверяет и замораживает descriptor до
первого await. Неизвестные и повторные slots отвергаются. Callback получает
обязательный `nativeMetadata: {readSet, values}`. `values` содержит только
присутствующие запрошенные slots:

| Slot | Раннее native значение |
| --- | --- |
| `configuration` | Namespace текущего адаптера `ast.meta[adapter.name]` |
| `assessment` | Только `ast.meta.assessment[adapter.name]` |
| `projectChecks` | Полная shared карта `project-checks` |
| `projectMaterialization` | Полная shared карта `project-materialization` |

Запрошенный slot без записи в `values` удостоверяет native отсутствие; это
позволяет владельцу применить свои defaults. Отсутствующий envelope не означает
отсутствующий namespace и отвергается. Прежнее параллельное поле
`configuration` удалено. Payload/readSet глубоко immutable и привязаны к тому же
origin. Quarto разрешает YAML aliases, profiles, `_metadata` и metadata-files;
Core декодирует штатные Meta-формы в том же раннем preprojection collector, без
нового YAML parser/merge, PL schema/defaults или чтения файлов по policy payload.
Неподдержанная Meta-форма даёт `CORE.ADAPTER_METADATA`. Чужие namespaces,
закрытые ответы и policy payload не входят в public document/catalog/condition,
HTML или release proof. C сохраняет собственный raw канон и отвечает за
проверку четырёх authoritative planes перед эффектом.

Pre request и operation identity не содержат неизвестный document format.
Core early/late независимо читают публичный `format_identifier()` и требуют
точный target `html|revealjs`, согласованный с base/writer. HTML alias не выбирает
identity. Один mixed owner render может дать HTML index и revealjs slides.
Explicit `--to` применяется самим Quarto. Дополнительного inspect ради format
нет. `NativeReleaseProof.documents: [{source,format}]` заменяет scalar `format`
и прежний `sources`. Complete expectation может задать `expectedDocuments`:
проверяется точная coverage/format карта до callback. Это проверка ожидаемого
результата, без полномочия выбрать format. Pending expectation этого поля не
имеет; profiles в обоих bound expectations обязательны и сравниваются точно.

## Последовательная bounded capture scope

```ts
await Core.withNativeCaptureScope({root, projection, outputDirectory}, {
  expectedSources: plan.map(document => document.source),
}, async scope => {
  for (const document of plan) {
    await scope.captureInputs([document.source], async token => {
      await runExistingNativeRender(document, {
        COURSE_CORE_CAPTURE_TOKEN: token,
      });
      return await readExistingCollection(document);
    });
  }
});
// Позднее: обычный withCurrentNativeOperation с проверенным record.profiles
// и expectedDocuments из существующего native плана.
```

Reservation не принимает profiles/format/snapshot и сразу делает прежнюю complete
операцию не-current. До первого действительного native pre нет inspect,
snapshot, witnesses или pending descriptor. Первый зарегистрированный child
проверяет token и actual native inputs/output/owner, получает точные ordered
`QUARTO_PROFILE` после штатных defaults/groups, выполняет один initial snapshot
и один owner inspect, затем source/runtime/current-pointer fence до публикации
bound state. До snapshot не обещается неизменность байтов с момента reservation.

Дальнейшие children используют те же profiles/snapshot/witnesses; rebind нет.
Непустые child inputs должны быть уникальным ещё не занятым subset плана, token
одноразовый, children последовательны. Native post закрывает только свой child;
exit0 без post недостаточен. Source/config guards локальны на child границах;
seal и complete consumption выполняют полные fences. Seal требует точный union,
один capture на source и отсутствие output collision. Конечные resource пути
разрешаются после всех child post hooks без сравнения прежних bytes.
Обычный render без token создаёт свою новую generation и к scope не присоединяется.

Ошибка callback/bind/preparation/render/post/collection остаётся sticky даже
после внешнего catch. Пустой план отклоняется до reservation; valid reservation
без детей, пустой child, незавершённый или недожданный child не seal'ятся. Неудача
не восстанавливает старый complete/pointer. После awaited работы защищённый writer
сверяет ту же reservation; cleanup не удаляет более новую операцию. Retry — новая
scope с новыми operation/tokens/witnesses. Capability scope живёт только в
callback; в поздний post переносится обычная current complete generation.

Эта реализация Core и native probes не заменяют source-pinned C/Publisher/Download
integration, настоящие QRC→README/ZIP, полный exporter или приёмку всего состава.
`readProjectContexts` по-прежнему имеет собственные ограничения происхождения;
нейтральный metadata envelope не изменяет их автоматически.

## A1 из текущего native snapshot

`operation.withProjectContexts(requests, use)` возвращает callback genuine batch
`{groups: [{ownerMetadata, contexts}], metrics}`. Requests используют прежний
`ProjectContextRequest`: canonical owner, фактические ordered profiles,
owner-relative `inputs` и exact `format`. Поддерживаются только объявленные
private ранними фактами пары `projectRoot/native-input.qmd` и фактический формат
документа. Request не выбирает metadata и не даёт authority. Для assignment
требуются успешная текущая `validateRelease`, полный captured owner coverage и
все объявленные пары, включая hidden/non-PL/page projects. Ordinary может
запрашивать subset; пустой ordinary batch не делает A1 probe/copy/read.

A1 acquires текущий owner **после** завершённого native child. Existing Native
owner inspect, disposable owner copy и scalar instrumentation дают реальные
metadata/origins; прежние pre-child rows не являются входом этого acquisition.
Одна all-project/multiformat batch делает один owner copy, затем один Native
probe на уникальный project input; каждый probe обслуживает запрошенные реальные
форматы. Per-consumer/body/README/ZIP copy или inspect не добавляется.
`withProjectContracts` создаёт узкий schema-parsed handle того же context.

Context/plan имеют private operation generation и живут до конца batch callback.
Physical alias facts берутся из actual acquired A1 state; source roles,
student/full selections и clone/expired refusals сохраняются. Повторное чтение
выдаёт копию уже захваченных bytes. После отдельной новой batch выполняется
новый actual acquisition; cross-batch byte/contract/probe cache удалён.

Это compatibility bridge с прежней ценой A1: current full copy и полные
проверки inventory внутри короткой post-render batch остаются. Concurrent owner
mutation и symlink/special entry могут отказать. Existing A1 `metadata-file(s)`,
alias/tag и неподдержанные format contributors по-прежнему не квалифицированы;
нового YAML resolver или eligibility policy нет. Технический native-input
создаётся только в disposable copy, авторские файлы не редактируются.

Batch `metrics` остаются read-only после await. `sourceFileReads/sourceBytesRead`
считают actual acquisition reads, `sourceCopyBytes` — raw copied bytes,
`inspectCalls/fullWalks/fullFences/toolHashReads` — фактическую A1 работу.
`probeCacheHits=0`, `sourceTreeHashes=0`: ни сохранённого cross-batch probe cache,
ни source tree hashing у этого A1 acquisition нет. Initial operation hash
остаётся отдельным transitional расходом `sourceHashBytes`. Старые benchmark
counts carrier/S reuse не описывают этот bridge; ускорение не измерено.

## Cached native preview

Quarto может вызвать native pre-render с присутствующим, но точно пустым
`QUARTO_PROJECT_INPUT_FILES`, а post-render — с таким же
`QUARTO_PROJECT_OUTPUT_FILES`. Пустой файл штатного file transport означает
тот же zero-work. Только технические hooks принимают эту форму: owner/cwd,
профиль и canonical output проверяются; missing/malformed list, capture token,
assignment state и существующая capture reservation не дают этот путь.

При zero-work прежний ordinary current pointer удаляется под существующим
writer lock после проверки принадлежности state и неизменности pointer.
Hooks не создают новую generation, sidecars или complete.
`withCurrentNativeOperation` после этого отказывает до нового настоящего
render; прежняя completion не оживает. Строгие `beginNativeOperation` и
`finishNativeOperation` продолжают отвергать пустые списки. Это не пустая
assignment capture, не A1 command и не замена source/currentness fences.

Cached preview может обслуживать статические ресурсы без render. Запрос HTML
страницы способен запустить настоящий on-demand render и дать новую genuine
operation; это отдельная работа Quarto, а не completion zero-work hook.
Обычный непустой transport читается один раз, без дополнительного owner
inspect, discovery, whole-S hash или перечисления каталогов на zero-work пути.

`withProjectContracts` и `withProjectContexts` используют общий admission, request coverage и failed/reentrant guard. Первый возвращает узкий `ProjectContractContext` без `effectiveMetadata`; второй сохраняет полный прежний API. [Actual A1 acquisition](native-context-ts.md) не изменяет public operation identity или assignment release/currentness guards.


## Контроль внутри статической партии (9.3.4)

`withProjectContexts` и `withProjectContracts` передают callback тот же batch с методом
`checkpoint(): Promise<void>`. Он принадлежит ровно этой callback и после её выхода
отказывает, в том числе во время следующей партии. Metrics остаются read-only и
после `await` содержат окончательные расходы A1; сами contexts и plans не оживают.

Outer static entry/exit проверяют runtime/private/output и выбранные raw QMD.
Checkpoint проверяет callback life, failure state, cwd/env; general путь также
использует свой dependent guard. Actual A1 contexts имеют собственные captured
bytes/identity checks и истекают после batch. Вложенные children сохраняют
argv/env/profile/token и before-child lifetime проверки. `assertCurrent()` не
возвращает blanket metadata/source-tree freeze.

Это deferred-currentness: persistent drift отвергается closing fence, а временная
подмена с восстановлением между границами этим договором не покрывается. Ошибка
checkpoint или closing необратимо проваливает операцию. После каждого closing await
повторно проверяются жизнь/failed/active. Staged publication разрешена только после
успешного закрытия batch и outer operation; при ошибке stage отбрасывается.

Перед outer final fence фаза пользовательской callback закрывается. Новая batch
после этого отвергается sticky, даже если могла бы закончиться внутри closing await.
Retained children наследуют истёкший callback-local ALS life; внутренний final fence
не зависит от пользовательской фазы. Чтение read-only metrics не получает новую
capability и сохраняет прежний lifecycle.


Пустой supporting scratch, cache/sibling entries и unrelated owner edits не
аннулируют raw-QMD provenance. Исчезновение/подмена выбранного QMD либо его
physical ancestor по-прежнему отклоняется.

## Ordinary Native publication

`withNativePublication(expectation, selection, use)` использует тот же actual
capture/acquisition/closing fence, что NativeOperation. `selection` —
`NativePublicationSelection` (NativeReleaseRequest либо undefined для всех completed
sources). Core один раз проверяет общую семантику coverage/course/assessment/ролей
и owned paths, не исполняя installed adapter validators/full grading/seed gate.
Assignment capture использует отдельный course-export API и здесь отказывается.

`NativePublication` экспортируется из public.ts: root/outputDirectory принадлежат
actual capture, identity/catalog сохраняют canonical NativeOperation types.
`document`, `condition`, `resourceInventory`, `withProjectContracts`, `assertCurrent`
имеют исходные Core signatures и callback lifetime. `adapterInputs(name, readSet)`
выдаёт Core-owned metadata input; `checkSources(source, references)` проверяет
использованные business пути. Нового proof/certificate/session registry нет.
Общая private/physical/runtime/profile/currentness защита остаётся, весь механизм
source-currentness этой задачей не удалён. Role projection не обещает приватность
произвольного немаркированного cached computed текста.

Полная `operation.validateRelease(request, validators)` остаётся для отдельного
course-export; ordinary Site/Download не должны вызывать её как publication gate.
