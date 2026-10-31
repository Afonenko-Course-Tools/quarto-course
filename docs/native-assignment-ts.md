# Выдача выбранной работы из текущей native операции

Unreleased A4d добавляет явное намерение assignment в существующий
`withNativeCaptureScope` из `course-core/capture.ts`. До подготовки проекта и
первого native child требуется отдельно квалифицированный неизменяемый producer
input. Fixed optional `runtime/assignment-authority-location.json` (L) отсутствует в
обычном опубликованном Core. Assignment читает только данные внешней capsule:
`anchor.json` (E), `manifest.json` (M), `profiles.json` (R). L/E/M/R и статический
bootstrap G проверяются раздельно от owner S/runtime K; capsule запрещена внутри
любого owner, включая excluded cache и physical aliases. В обычном пути Core
не читает эти optional файлы. Когерентные hashes не означают квалификацию:
внешний launcher обязан независимо проверить prior P, G и полный Deno command
до первого import того же C mainModule. Prior P находится вне S/K/G/capsule,
argv и env и не создаётся этим API. Core не наблюдает эту внешнюю проверку и не
обещает универсального отклонения когерентного неподдерживаемого запуска.

`{assignment: {mode: "new", prepare(nativeOwner)}}` получает readonly результат
того же единственного owner inspect после того же source snapshot. Callback возвращает
`{expectedSources, assessments: [{source, id}]}`. Профили не поступают от caller:
Core связывает фактически наблюдённые ordered profiles, format, projection,
source, output и generation с этой операцией. Обычный overload сохраняется.

## Новое намерение и подготовленная generation

Assignment использует `scope.withPreparedOperation(async lease => ...)`.
`lease.descriptor` (`NativePreparedOperation`) содержит genuine новую identity,
canonical root/outputDirectory, sources с captureWitness и assessments.
`lease.assert(expected)` и `lease.captureInputs(expected, sources, runNative)`
сверяют ожидаемую новую correlation и живые private guards до token/child.
Внешний `scope.captureInputs` для assignment отказывает с sticky failure;
ordinary overload остаётся прежним. Lease истекает с callback; DTO-копия
не создаёт authority. Профили descriptor получены из квалифицированного producer,
не из caller metadata или старого receipt.

CLI трактует `mode: "new"` как новое намерение: создаёт **новый** request B из
genuine descriptor B и actual owner. Старый request A не переименовывается в B.
Проверки B не доказывают stale control для неиспользованного A. Consume existing
A требует отдельного existing `withCurrentNativeOperation(A, ...)` до новой
scope/pointer либо явного отказа CLI; новый overload этот режим не реализует.

После успешного текущего `operation.validateRelease(...)` применяется:

```ts
const delivery = await operation.assignmentDelivery(
  {source: "labs/text.qmd", assessmentId: "lab-text"},
  {projectPlans, references},
);
```

`projectPlans` содержит **все** declared code projects владельца, включая
невыбранные: `{source, exerciseId, student, full}`. Оба плана должны происходить
из одного живого A1 context, иметь фактические format/profiles и соответствовать
проекту исходной декларации. Пропуск, повтор, JSON-копия или другой context
отклоняются. Закрытые solutions/testsets/components, их произвольные пути и
physical aliases учитываются до обращения к ресурсам и citation files.

Результат `NativeAssignmentDelivery` содержит schema
`course-native-assignment-delivery-v1`, фактический `origin`, выбранный
`assessment`, прежний `PublicBodyPackage` v2 и `conditions` по ID кандидата.
Сохраняются rich introduction, название и kind работы, все позиции/кандидаты,
поздние условия, публичные формы ответа, bibliography и проверенные ресурсы.
Ключи, correct flags, tolerance и закрытые решения не входят в public package.

`NativeAssignmentCondition` имеет `kind: "assignment"`, `audience: "student"`,
фактический author context (`html` или `revealjs`), `assessment`, `responseSlots`
и прежнее содержимое условия. Existing `materializationClosure`,
`materializeCondition` и `materializeProject` принимают его только с исходными
живыми student/full планами. Сериализация сохраняет данные, но не I/O authority.
Генерические document/condition/resource getters assignment операции недоступны.
Обычные student/author и HTML ограничения прежнего condition сохраняются.

## Ограниченная provenance проекта

`operation.assignmentProvenance()` возвращает immutable
`NativeAssignmentProvenance` со schema `course-native-assignment-provenance-v1`:

- `identity`, `ownerInputs`, `capturedInputs` — фактические области той же операции;
- `sourceRows: [{source, sha256}]` — уже посчитанные строки всего owner S;
- `projects: [{source, id, project, target?, format}]` — все preprojection projects,
  включая hidden/non-PL/nonbank declarations и actual format;
- `documents: [{source, format, courseId?, projects, projectMaterializations}]` —
  результат существующего Core `projects.lua.collect` и существующего complete
  `bindProjectMaterializations`, без второго metadata resolver.

Scope getter и assignment delivery требуют точного покрытия owner inputs:
subset не выдаётся за полный набор проектов. Native frame обязательно связан с
той же operation/source/format/captureWitness; отсутствие producer отличается от
отсутствия project-check metadata. Транспорт вызывает existing `collect` ровно
один раз после того же early JSON filter с original preprojection metadata.
Nonbank project facts добавляются в том же collector только для private
assignment intent; bankMember остаётся false. Ordinary page semantics прежние.
Относительные project paths пока явно не квалифицированы и вызывают отказ;
это открытый release gate, а не подтверждение полного Java/SP.

Getter использует существующие S rows и captures, не добавляет owner inspect,
source walk, rehash или render. DTO не содержит AST, решений, answer policy или
PrairieLearn-owned configuration и не даёт I/O authority. Его rows **не** являются
legacy `sourceSnapshotHash`; готовый `CheckProject[]` он не изобретает.
Прежние значения требуют точного множества и существующей нормализации:
`sourceSnapshotHash = SHA256(canonical({sources, projects}))`,
`inventoryHash = SHA256(canonical(projects))`. Selected source/test/reference/
contract fixtures и readiness ещё должны совпасть при actual C integration;
verification inventory принадлежит C. До actual parity и OTHER review strict v3
остаётся открытым. Postcapture projection не решает pre-child ID→source mapping.

Authority counters отдельно учитывают L/E/M/R/G bytes/hash/path/directory/topology
reads. Native metadata bytes включают private project-facts frame. Ordinary
`runtimeHashBytes` теперь включает initial invocation read, ранее пропущенные
8061 bytes на projection в старом evidence; прежние цифры не исправляются задним
числом. Вне scope render `childRenders` равен нулю; actual external renders
считаются самим harness отдельно.

## Подписи ссылок в самостоятельном README

`MaterializationBindings.referencesBySource` связывает source-relative fragment
с таблицей `reference.token -> {href, label}`. Эти значения предоставляет
существующий QRC owner/resolver по `materializationClosure(...).references`.
Core не читает каталог и не выводит подпись из ID. Прежние `links` и
`linksBySource` URL strings сохраняют native Link/Span и явную AST подпись.

Catalogue `Cite` распознаётся по той же key/style форме, что QRC requests.lua;
порядок, prefix/suffix и несколько ссылок сохраняются. Для его default label
необходима структурированная QRC привязка; отсутствие вызывает
`CONDITION_REFERENCE_UNRESOLVED`. Обычные библиографические Cite не становятся
каталоговыми, смешанная группа отклоняется. Assignment Body использует тот же
`BodyReferenceContext` и existing native citeproc.

`QUARTO_FILTER_DEPENDENCY_FILE` наблюдается только как JSONL деклараций
данных/ресурсов. Он не является полным журналом загруженных модулей. До child
основание допуска — отдельно квалифицированный статически закрытый loader
closure; поздняя проверка объявленных файлов дополняет его в своём фактическом
объёме. Producer positive, actual C integration, полный Java/SP и выпуск
требуют отдельных проверок на точном составе.
