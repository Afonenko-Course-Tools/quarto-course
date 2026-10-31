# Текущая native операция Core

Текущая TS-композиция Core поддерживает Quarto 1.11.5, точные native targets
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
  return await Core.readProjectContexts(projectRequests, async ([group]) => {
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
После callback методы операции отказывают с `OPERATION_EXPIRED`. Операция
проверяет source identities/состав каталогов, native tool, output/resource
identities, active generation и private complete identity; внутри callback
также фиксируются environment и cwd. Полные source/tool fences стоят до callback
и перед возвратом его результата. Между ними проверяются только native input/include/config closure конкретного document/resource и необходимые resource identities; новый inspect/owner discovery walk для getter не выполняется. Это защита текущей выдачи; уже записанные
потребителем внешние данные callback откатить не может, поэтому publish идёт
после успешного возврата.

Обычные ресурсы запрашиваются отдельно:

```ts
const files = await operation.resourceInventory({
  files: [{source: 'assets/diagram.svg', target: 'images/diagram.svg'}],
});
```

Это `course-native-resource-inventory-v1`: operation, student audience и файлы
с target/собственными bytes/size/SHA256/reason. Он отличается от inventory
кодового проекта с exerciseId; `Download.packageArtifact` принимает именно
inventory проекта. Ordinary resource DTO предназначен для отдельного
resource consumer, которому больше не нужны private resource facts.
Возможность файла определяется фактической поздней проекцией и native byte
observation. Закрытые, исходные, служебные и generated/config targets
отклоняются. При native relocation допускаются только наблюдавшиеся source и
назначенный output с совпавшими байтами. Один retained output по URL такой
возможности не даёт. Повторный запрос возвращает копию сохранённых bytes,
без повторного resource hash; currentness guards продолжают исполняться.

`operation.metrics` отдельно считает `inspectCalls`, initial discovery
`fullWalks`, `sourceHashReads`, полные и локальные проверки исходников
`fullSourceFences/localSourceFences`, фактические `sourceDirectoryReads`,
`runtimeHashReads/outputHashReads`, native resource observations, resource
hashes/reads/cache hits, `nativeMetadataBytes` private ранних фактов и
`childRenders` состоявшихся scoped post. Полный traversal включает discovery и
полные source fences; `fullWalks=1` не означает отсутствие последующих проверок
состава. Pending вызовы внутри scope учитываются в seal receipt и используют
локальные guards. Метрики, прочитанные внутри complete callback, ещё не включают
проверку перед его возвратом. Getter сам не выполняет IO.
Отдельный `readProjectContexts` сохраняет свои необходимые native inquiries;
система не обещает один inspect на курс. Полный Publisher/Navigation rollout,
Workspace git seed и замена legacy/CUE требуют собственной сквозной проверки.
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
один capture на source и отсутствие output/resource collision или изменения.
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
