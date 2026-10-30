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

Не квалифицированы author/revealjs, произвольная full native metadata surface,
non-Gradle/Workspace git seed, полный Publisher/Navigation runtime rollout и
удаление заменённых legacy/CUE ветвей. Это обязательные следующие owner gates
полного выпуска. Данный route не устанавливает их поддержку автоматически.
Повторная генерация поверх авторского source-файла считается изменением source;
такой producer требует отдельной квалификации владения generated inputs.

Публичная ArtifactInventorySchema проверяет общую семантическую target/audience/collision policy Core, включая запрет .git для обоих audiences. Эта же target policy используется materializer и final writer; consumers импортируют её через публичную runtime-схему. Будущий Workspace seed требует отдельного объявленного договора.
