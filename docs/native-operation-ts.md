# Текущая native операция Core

Core получает ранние объявления и позднее тело от обычного `quarto render` с
Quarto >=1.11.5. Поддерживаются фактические форматы `html|revealjs` и проекции
`student|author`. Авторские filters/hooks/engines остаются доверенным кодом
проекта. Полный установленный курс и внешние адаптеры проверяются отдельно.

В установленной композиции используются `filters: [course-core]`,
`course-core-runtime: native-ts` и `course-core-projection: student|author`.
Hooks проекта вызывают
`quarto run _extensions/Afonenko-Course-Tools/course-core/entrypoints/native-pre.ts`
и соответствующий `native-post.ts`. Quarto владеет выполнением cells,
унаследованными metadata, cache и freeze, выбором формата и преобразованием AST.

```ts
const prepared = await Core.withCurrentNativeOperation({
  root, profiles, projection: 'student', outputDirectory,
}, async operation => {
  const document = operation.document({source: 'tasks/bank.qmd'});
  const condition = operation.condition({
    source: 'tasks/bank.qmd', exerciseId: 'exr-example', view: 'student',
  });
  return await operation.withProjectContexts([{
    owner: root, directories: ['projects/example'], profiles, format: 'html',
  }], async batch => {
    const context = batch.groups[0].contexts[0];
    const plan = await Core.planProject(context, {audience: 'student'});
    const files = await Core.materializeProject(plan, condition, {
      links, resources: resourceBindings, submission: checkedOwnerSummary,
    });
    await batch.checkpoint();
    return {files, zip: await Download.packageArtifact(files)};
  });
});
```

`operation.identity` содержит UUID операции, упорядоченные profiles, projection
и runtime. Profiles ordinary операции берутся из `QUARTO_PROFILE` внутри
настоящего native pre-hook после выбора Quarto. Ожидание потребителя должно
совпадать с этим списком. Loader проектов не выбирает defaults/groups/dotenv.

Format принадлежит документу. `operation.catalog.documents` содержит
owner-relative `source`, фактический `format`, output-root-relative `output`,
native `role`, видимые упражнения и их anchors/project. Public document не
содержит абсолютный owner, закрытые ответы, исходные metadata или grading policy.
QRC владеет reference catalog, Publisher — конечными URL.

## Входы и срок жизни

Pre-hook выбирает текущие native inputs и один раз получает owner inspect.
Ранний и поздний capture сверяют source/input, operation/captureWitness,
profiles, projection и фактический формат. Post-hook требует настоящий output
каждого документа. Последовательный capture дополнительно проверяет token,
покрытие выбранного плана, завершение каждого child и отсутствие коллизий output.

Core не создаёт снимок дерева исходников, таблицу SHA, membership inventory или
подписи файлов для последующей проверки свежести. Он не сравнивает executable,
implementation dependencies, cwd или окружение с исходным снимком. Изменение
соседнего файла либо состава каталога само по себе не аннулирует операцию.
Selected input plan не пополняется обнаруженными позднее QMD.
`course-core-source-policy` не управляет отдельным путём проверок.

`document()`, `condition()`, contexts и plans принадлежат живым callbacks.
Сериализация не переносит право на зависимое чтение файлов. Поддельное значение
condition отказывает с `CONDITION_AUTHORITY`, истёкшее — с `OPERATION_EXPIRED`.
Current pointer, reservation phase и capture correlation проверяются как
состояние операции; они не доказывают неизменность исходников или внешних данных.

`assertCurrent()` и `batch.checkpoint()` проверяют срок жизни и состояние
операции. Ошибка партии остаётся необратимой; вложенная, недожданная либо новая
партия после закрытия пользовательской callback не принимается. Отложенный
child наследует истёкший callback-local scope. Результат возвращается после
успешного закрытия callbacks. Доверенный вызывающий код отбрасывает свои
промежуточные результаты при ошибке.

## Контракты code projects

`withProjectContexts` и `withProjectContracts` возвращают одинаковый batch:
`{groups: [{contexts, metrics}], metrics, checkpoint}`. Request содержит
`{owner, directories, profiles, format}`; `directories` — относительные каталоги
объявленных code projects. Искусственные `native-input.qmd` не создаются.

Context имеет форму `{owner, input, profiles, format, contract}`; `input` здесь
абсолютный каталог code project. `contract` — нормализованный namespace
`course-project`. `effectiveMetadata` и scalar origins отсутствуют. Настоящие
metadata QMD поступают отдельно из native capture.

[Loader](native-context-ts.md) читает участвующий YAML один раз за операцию и
наследует namespace в памяти. Обычный адрес относится к конечному code project;
`{path, base: config}` — к YAML объявления. Включённый файл сам служит такой
базой. Путь и его base переопределяются атомарно. Отсутствующий target даёт ошибку;
существование похожего файла не выбирает другую базу.

Запрашиваются только объявленные пары project/format и фактические profiles.
Ordinary операция может выбрать subset, включая пустой batch. Assignment требует
успешную owner validation и полное покрытие private declarations, включая hidden
и non-PL. Context/plan истекают после callback. Роли файлов и выбранные
student/full наборы сохраняются; фактические physical aliases проверяются для
защиты закрытых файлов, а не для обещания их свежести.

Batch metrics: `yamlFileReads`, `yamlBytesRead`, `directoryLayers`,
`sourceFileReads`, `sourceBytesRead`. Operation metrics: `inspectCalls`,
`nativeMetadataBytes`, `childRenders`, `resourceByteReads`, `resourceCacheHits`.
Счётчиков удалённого snapshot/hash/fence пути нет. Эти метрики сами по себе не
подтверждают ускорение полного курса.

## Ресурсы

`operation.resourceFiles({files: [{source, target}]})` возвращает
`NativeResourceFiles`: `{audience, files: [{source, target, bytes}]}`.
Это выбранные ресурсы с относительными путями; schema/operation certificate,
SHA, size и inventory отсутствуют. Метод недоступен для общего чтения assignment
capture; там ресурсы проходят выбранную выдачу после private role checks.

Разрешены только наблюдённые native ресурсы, принадлежащие документам операции.
Закрытые/source пути, tool cache, unsafe paths, symlinks и target collisions
отвергаются. Фактический regular output разрешается после hooks. Сохранённая
связь с закрытым source и physical aliases не позволяет выдать его под публичным
именем. Bytes каждого physical ресурса читаются один раз за callback и
возвращаются отдельной копией; равенство с промежуточными bytes не обещается.

Assignment citeproc отдельно принимает явно объявленные `bibliography`, `csl` и
`citation-abbreviations` из native metadata выбранного документа. Публичный файл
может находиться в родительском курсе за пределами owner. Точный документ/key/path,
canonical regular file, private physical aliases и отсутствие служебного cache
проверяются до citeproc. Общее чтение Body resources остаётся внутри owner.

## Release и публикация

Ранний collector проверяет все raw ответы и декларации до публичной projection.
`AnswerFacts`, закрытые ключи и adapter policy передаются только соответствующему
validator. `nativeMetadataReadSet` выбирает слоты `configuration`, `assessment`,
`projectChecks`, `projectMaterialization` из того же настоящего native capture.
Отсутствующий слот отличается от отсутствующего envelope. Core не подменяет
policy normalization адаптера.

`operation.validateRelease(request, validators)` сохраняет полную проверку
coverage/course/assessment/деклараций и выбранных адаптеров для course-export.
Installed adapters читаются из `contract.json` двух layouts
`_extensions/name` и `_extensions/owner/name`; vendor и source trees не обходятся.

`withNativePublication(expectation, selection, use)` использует тот же capture
для обычной публикации. Он проверяет общую семантику и owned paths без grading
или seed gate; assignment capture использует отдельный course-export API.
`NativePublication` предоставляет `document`, `condition`, `resourceFiles`,
`withProjectContracts`, `assertCurrent`, `adapterInputs` и `checkSources` с тем же
callback lifetime. Роли не обещают приватность произвольного немаркированного
computed текста; разделение student/full cache задаёт автор.

## Cached native preview

Технические hooks принимают явно пустые native input/output lists только для
ordinary zero-work preview. Они проверяют owner/cwd/output и отсутствие capture
reservation, удаляют прежний current pointer и не создают новую generation.
Missing/malformed list либо assignment token такого пути не дают. Строгие
`beginNativeOperation` и `finishNativeOperation` продолжают отвергать пустые lists.
Следующий настоящий render создаёт новую операцию; прежний complete не оживает.
