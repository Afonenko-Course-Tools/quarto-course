# Выдача выбранной работы из текущей native операции

Unreleased A4d добавляет явное намерение assignment в существующий
`withNativeCaptureScope` из `course-core/capture.ts`. До подготовки проекта и
первого native child требуется отдельно квалифицированный неизменяемый producer
input. Пустой закрытый набор профилей отклоняет любой assignment; он не служит
положительной квалификацией Java/SP. Внешнее основание доверия и его точное
подключение ещё проходят отдельное техническое рассмотрение.

`{assignment: {prepare(nativeOwner)}}` получает readonly результат того же
единственного owner inspect после того же source snapshot. Callback возвращает
`{expectedSources, assessments: [{source, id}]}`. Профили не поступают от caller:
Core связывает фактически наблюдённые ordered profiles, format, projection,
source, output и generation с этой операцией. Обычный overload сохраняется.

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
