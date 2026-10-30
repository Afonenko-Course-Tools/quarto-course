# Текущая native операция Core

Ограниченная композиция A3 квалифицирована для Quarto 1.11.5, HTML/student.
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
  root, profiles, format: 'html', projection: 'student', outputDirectory,
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

`operation.identity` содержит UUID операции, profiles, format/projection и
runtime. `operation.catalog.documents` содержит owner-relative `source`,
output-root-relative `output`, проверенную native `role` и фактически видимые
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

`operation.metrics` различает producer inspect/full source walk/source hashes,
native resource observations, resource hashes/reads/cache hits и consumer
fences/currentness checks. Отдельный `readProjectContexts` сохраняет собственные
метрики и native origin qualification. Система не обещает один inspect на курс.

Первоначальная A3 квалификация не включала author/revealjs, полную native metadata
surface, non-Gradle/Workspace git seed. Ранняя A4a дельта описана ниже; full surface,
revealjs, Workspace git seed, полный Publisher/Navigation runtime rollout и
удаление заменённых legacy/CUE ветвей. Это обязательные следующие owner gates
полного выпуска. Данный route не устанавливает их поддержку автоматически.
Повторная генерация поверх авторского source-файла считается изменением source;
такой producer требует отдельной квалификации владения generated inputs.

Публичная ArtifactInventorySchema проверяет общую семантическую target/audience/collision policy Core, включая запрет .git для обоих audiences. Эта же target policy используется materializer и final writer; consumers импортируют её через публичную runtime-схему. Будущий Workspace seed требует отдельного объявленного договора.

## Ранние release и capture gates A4a

`withCurrentNativeOperation` поддерживает HTML projections `student` и `author`.
Если явная projection отсутствует, native `course.view: student|full` определяет
`student|author`; конфликт с expectation отвергается. Проверенный early
`exercise-bank` определяет роль документа. Метаданные Quarto остаются источником
этого значения; отдельного YAML merge нет.

```ts
await Core.withCurrentNativeOperation(expectation, async operation => {
  const proof = await operation.validateRelease(
    {expectedSources: actualOwnerSourceList, courseId: 'java-semester-one'},
    [{name: 'prairielearn', validate: PL.validateNativeAdapter}],
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
(operation, captureWitness, source, HTML, projection, ordered profiles), `course`,
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
   канон и связывает его с этим source/witness/identity. Core выполняет обычные
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

В том же callback `configuration?: unknown` содержит только фактическое значение
native metadata namespace текущего адаптера из `course.adapters`. Quarto до
этого уже выполнил наследование: Core декодирует штатные
`MetaMap/MetaList/MetaBool/MetaString/MetaInlines/MetaBlocks` без своего YAML
merge. Отсутствующий namespace сохраняется отсутствующим; неподдержанная native
форма даёт `CORE.ADAPTER_METADATA`. Владелец применяет собственную схему и
defaults. Чужие namespace не передаются. Эти immutable значения связаны с
прежними source/operation/witness/profiles/projection и current/final fences;
новых getter, сканирований или IO-полномочий нет. Закрытые факты и configuration
не входят в `operation.document()`, `catalog`, condition или release proof.

Для default native HTML/revealjs операций identity, request и release proof
содержат точный `format`. Producer берёт default из уже выполненного native
owner inspect и требует совпадения с фактическим форматом pre-AST. Проверены
HTML/revealjs × student/author с include, conditional body и late solution. Это
**не квалификация всех форматов**: локальный HTML-документ внутри revealjs owner
и явный выбор другого формата через Publisher `--to` пока отвергаются.
Подтверждённый путь SP `practice/index.qmd` требует отдельного решения о native
lifecycle identity. Общий полный выпуск этим checkpoint не подтверждён.

Полный native PL export, перенос этих фактов настоящим C-потребителем, защита
его raw sidecar configuration от подмены, README/ZIP с answer-формами и весь
активный состав 128+7 остаются отдельными gates. Сохраняются прежние
release/source fences и старый CUE-путь до проверки фактической замены. В
частности, `readProjectContexts` пока отдельно отвергает metadata-files в своей
origin-инструментации: успешная доставка нейтральной configuration в callback
этого ограничения A1 не снимает.
