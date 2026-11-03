# Выдача выбранной работы из текущей native операции

Assignment выполняется обычным установленным Quarto владельца через существующий
`withNativeCaptureScope` из `course-core/capture.ts`. Авторские filters/hooks/engines
считаются доверенным кодом проекта. Core проверяет принадлежность текущей операции,
raw объявления до projection, поздний native результат и публичные ресурсы; он не
аттестует полный launcher/module graph и не изолирует исполняемый код владельца.
Внешняя capsule, prior P и `assignment-authority-location.json` не требуются.

```ts
await withNativeCaptureScope({root, projection: "author", outputDirectory}, {
  assignment: {
    mode: "new",
    profiles: ["lab"], // только функциональные, в исходном порядке
    prepare: async owner => ({
      expectedSources: /* все фактические owner inputs */ sources,
      assessments: [{source: "labs/text.qmd", id: "lab-text"}],
    }),
  },
}, async scope => {
  await scope.withPreparedOperation(async lease => {
    await lease.captureInputs(lease.descriptor, sources, {
      args: ["render", "--output-dir", relativeOutput],
      stdout: "inherit", stderr: "inherit", timeoutMs: 1200000,
    });
  });
});
```

`profiles?: readonly string[]` содержит не более15 уникальных функциональных
профилей по `^[-a-z0-9]+$`, без `student/full`. Core добавляет `full` последним
и передаёт одинаковый ordered список в owner inspect, render и `QUARTO_PROFILE`.
Пустой список означает только `full`; неизвестный профиль не превращается в
подтверждённую audience. Фактическая native конфигурация обязана дать
`course-core-runtime: native-ts`, `course-core-projection: author` и согласованный
`course.view: full`. Native pre сверяет весь список и выбранные inputs.

Core создаёт source snapshot до единственного owner inspect. Callback получает
readonly факты этого inspect; повторного QMD parser или metadata resolver нет.
Source signatures/memberships проверяются на границах подготовки. Prepared state
переиспользует тот же snapshot/owner witness и назначает новые operation UUID и
captureWitness каждого input. Native pre не повторяет owner discovery/inspect.
Initial metrics включают `sourceHashBytes`.

## Свежая generation и исполнение

`lease.descriptor` сохраняет `course-native-prepared-operation-v1`: canonical
owner/output, identity, inputs с witnesses и выбранные assessments. JSON/DTO
служат ожидаемой correlation; только живой Core lease запускает child.
`lease.assert(expected)` проверяет точную identity/inputs/профили/output и текущую
private reservation. Scope/lease callbacks, повторный child, stale token,
неполное покрытие и проглоченная ошибка проваливают операцию необратимо.

Capture command содержит только `args`, `stdout/stderr: piped|inherit|null` и
`timeoutMs` от1 до1200000. Допустимый capture argv —
`render --output-dir <точный относительный output>`; профили добавляет Core.
Произвольные input, metadata/filter/profile overrides и callback вместо command
отклоняются до constructor. Executable разрешается в текущую физическую
установку Quarto, cwd фиксируется owner, child получает копию окружения с
собственным Quarto project transport и correlation token (`clearEnv: true`).
Author configuration по-прежнему принадлежит Quarto.

Core-owned inspect/Pandoc используют существующие private call sites с
проверяемой формой argv. A1 temporary input/technical profile и aggregate carrier
разрешены внутри их исходных временных scopes с same-source/request guards.
Callback-local ALS lifetime и beforeChild действуют на всех child sites;
после завершения callback их отложенный вызов отказывает.

Native early TS фильтр проверяет current pointer/reservation, active token,
незакрытый actual child, source/input, capture path, operation/witness,
ordered profiles и projection. Manual `COURSE_CORE_TS_RUN` не создаёт assignment
producer. Собственный pre-ast hook передаёт actual phase/format/engine;
авторские служебные metadata запрещены. Наблюдение filters не выдаётся за
независимую аттестацию. Literal `xref` и primitive `meta title` сохраняют guards
против dynamic/nested/unknown shortcode. Все raw ответы/проекты проходят
валидацию до public projection. Late hook получает реальные conditional bodies,
anchors и public solution witnesses; post проверяет outputs и actual pre/post.

Private state имеет `course-native-operation-private-v2`. Старые complete и
reservation state не мигрируют в свежую generation. CLI `mode: new` создаёт B;
неиспользованный A не переименовывается. Consume-existing остаётся отдельным
явно не поддерживаемым PL режимом. Ordinary overload сохраняет свой native путь.

## Публичная выдача и private проекты

После успешного `operation.validateRelease(...)` доступен:

```ts
const delivery = await operation.assignmentDelivery(
  {source: "labs/text.qmd", assessmentId: "lab-text"},
  {projectPlans, references},
);
```

`projectPlans` покрывает все declared code projects владельца, включая hidden,
nonbank и невыбранные. Student/full планы должны происходить из одного живого
A1 context с фактическими format/profiles. Пропуск, повтор, JSON-копия или чужой
context отвергаются. Private solutions/testsets/components и physical aliases
закрываются до чтения ресурсов и citation файлов.

`NativeAssignmentDelivery` сохраняет schema `course-native-assignment-delivery-v1`,
origin, assessment, прежний `PublicBodyPackage` v2 и conditions по ID кандидата.
Rich introduction, название/kind работы, позиции/кандидаты, поздние условия,
публичные формы ответа и bibliography сохраняются. Keys, correct flags,
tolerance и закрытые решения в participant package не входят.
`NativeAssignmentCondition` сохраняет `kind: assignment`, `audience: student`,
actual html/revealjs author context, assessment/responseSlots. Existing
materializationClosure/materializeCondition/materializeProject требуют исходные
живые планы. Сериализация не переносит I/O authority. Generic document/condition/
resource getters assignment операции недоступны.

`operation.assignmentProvenance()` сохраняет
`course-native-assignment-provenance-v1`: identity, ownerInputs/capturedInputs,
исходные sourceRows и all-declaration project facts/материализации из того же
preprojection EarlyDocument. Требуется точное полное owner coverage. Getter не
делает inspect/render/source walk/rehash. Raw projectChecks — инертные same-source
данные; их policy normalization принадлежит PL, не Core. Относительные project
paths пока требуют отдельной квалификации и отвергаются действующим collector.

## Ресурсы и currentness

Course data/resources из native JSONL проверяются по same-source inventory;
фактические bytes дополнительно требуют owning document и resource witness.
Native implementation dependencies в private intermediate HTML связываются
только с canonical установленным Quarto share и проверяются по regular file и
physical identity. Наблюдённые dependencies адресно сверяются на полных границах
operation; весь tool tree не обходится. Обычный `bin/quarto → ../share` layout
должен существовать физически; unknown layout/path не получает разрешения.
Это наблюдение data/resources, не полный loader trace.

Узкие штатные generated CSS families и pagination links остаются техническим
оформлением private HTML. Их путь/атрибуты и текущие outputs проверяются;
CSS cache bytes не копируются и не квалифицируются как public payload.
Native implementation allowlist не применяется к Body/citations/README/ZIP:
там допустимы только same-source и owning resource rows после private role guards.

General dependent IO сохраняет адресные source/resource guards. Явная policy
`static` сохраняет lifetime/host checks внутри batch и полные entry/exit fences;
она требует markdown без вычислений. General не получает общего запрета
авторских engines. Полный snapshot не повторяется на lease/getter/child.
Publication stage передаётся наружу только после closing batch/operation fences;
при ошибке consumer отбрасывает stage. Временная подмена с восстановлением между
static fences и произвольная запись того же доверенного процесса вне договора
не покрываются этой проверкой.

References остаются у QRC: `referencesBySource` связывает source-relative token
с `{href,label}`, а прежние links/linksBySource сохраняют native подписи.
Core не читает каталог и не выводит default label из ID. Catalogue Cite
распознаётся по существующей key/style форме; обычные bibliography Cite не
становятся catalogue ссылками. Actual installed SP/Java, богатый Body и полный
выпуск требуют собственной приёмки. Изменение Source этого само не доказывает.
