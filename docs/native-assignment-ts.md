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
`lease.assert(expected)` и `lease.captureInputs(expected, sources, command)`
сверяют ожидаемую новую correlation и живые private guards до token/child.
`command: NativeCaptureCommand` содержит только `args`, необязательные
`stdout/stderr: "piped"|"inherit"|"null"` и `timeoutMs` от 1 до 1200000.
Core сам запускает child: qualified absolute executable, exact owner cwd,
`clearEnv:true`, fixed environment и точные live correlation/profiles.
Assignment callback вместо данных отклоняется до его вызова; поля
`executable/cwd/env` у запроса также не допускаются. Например:

```ts
const result = await lease.captureInputs(lease.descriptor, sources, {
  args: ["render", "--output-dir", relativeOutput],
  stdout: "inherit", stderr: "inherit", timeoutMs: 1200000,
});
```

Историческое имя `native.renders` обозначает закрытый перечень **всех** exact
argv native child commands, включая inspect/Pandoc/CUE. Наличие executable
в runtime.files само по себе не разрешает argv. Все Core constructor sites
проходят те же before-child/currentness и closed env guards; обычная ветвь
без assignment сохраняет прежнюю команду и окружение. Correlation token
проверяется по точному private live значению, а не синтаксису UUID. Выполнение
после завершения execution/capture lifecycle отклоняется до constructor.

Единственная A1 техническая вариация выводится в существующем private probe
call site: фактические `temporaryInput` и `baseProfiles + technical` в точных
позициях `inspect input --profile profiles` сравниваются с квалифицированным
`inspect originalOwnerInput [--profile baseProfiles]`. На wire сохраняется
actual temp argv. Другие пути/профили/позиции и technical env на иной команде
отклоняются; caller template API отсутствует. Это не автоматически допущенный
новый profile, engine, helper, argv или внешнее prior-P свидетельство.

Current assignment/A1 путь использует native runtime operation и
`artifacts/project.ts`, не legacy NativeRun/LegacyResult. Legacy
`metadata-closure -> native-raw-metadata`, `resolveArtifact -> writeHtml` и
`materializeProjects -> sourceHead` сохраняют ordinary семантику; смешивание их
с assignment не обходит guards. Nested cwd raw helper и legacy Git executable
не получают нового общего разрешения. Их отказ не объявляется поддержкой
legacy assignment; текущий no-LegacyResult путь их не вызывает.
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

Authority JSON документы и их digest sizes сохраняют предел **64 MiB**.
Отдельное поле `E.graph.files[*].size` допускает положительный целый размер
runtime artifact до **256 MiB**; оно не расширяет JSON read/parse limit.
Physical size, mode, SHA и currentness проверки runtime graph сохраняются.
Допустимый размер не создаёт profile qualification, prior P или admission.
