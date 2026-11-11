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

Core один раз выполняет owner inspect. Callback получает readonly факты этого
inspect; выбор авторского плана сверяется с его actual inputs. Prepared state
сохраняет owner metadata и назначает operation UUID/captureWitness каждого input.
Native pre переиспользует эти факты и проверяет actual profiles/input selection.
Снимок дерева, SHA, memberships и runtime implementation signatures не создаются.

## Generation и исполнение

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

Core-owned owner inspect/Pandoc используют private call sites с проверяемой
формой argv. Loader проектов читает только course-project YAML; временные QMD,
technical profiles и aggregate carrier удалены.
Callback-local ALS lifetime и beforeChild действуют на всех child sites;
после завершения callback их отложенный вызов отказывает.

Native early TS фильтр проверяет current pointer/reservation, active token,
незакрытый actual child, source/input, capture path, operation/witness,
ordered profiles и projection. Manual `COURSE_CORE_TS_RUN` не создаёт assignment
producer. Pre-ast hook проверяет фактические native input/format/projection;
авторские служебные request/context metadata запрещены. Shortcode, включая
вложенные аргументы, rich metadata и зарегистрированные расширения, обрабатывает
сам Quarto. Core не разбирает внутренние shortcode Span/UUID и не вводит второй
список разрешённых имён или таблицу handler observations. Приватные решения
удаляются early projection до native shortcode processing; источники, ресурсы,
владелец и аудитория сохраняют существующие проверки. Standalone/caller JSON
не создают право native assignment capture.
Все raw ответы/проекты проходят
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
context code project с фактическими format/profiles. Пропуск, повтор, JSON-копия или чужой
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

`operation.assignmentProvenance()` возвращает только `documents`: source,
actual format, все generic project facts с effective materialization и optional
raw projectChecks из того же preprojection EarlyDocument. Identity, полный
owner/captured scope, context/witness/declaration parity и materialization
conflicts проверяются внутри Core до успешной validation и повторно в getter;
эти служебные поля и исходная materialization map наружу не выдаются. Getter не
делает inspect/render/source walk/rehash. Raw projectChecks — инертные same-source
данные; их policy normalization принадлежит PL, не Core. Относительные project
paths пока требуют отдельной квалификации и отвергаются действующим collector.

## Ресурсы и срок жизни

Native JSONL сохраняет bounded форму объявлений. Пути ресурсов относятся к owner
либо к установленному Quarto share; служебные stylesheet cache и pagination
outputs допускаются в своих native формах. Это не inventory всех файлов и не
loader trace. Содержимое executable и implementation dependencies не читается
для hashing и не сверяется позднее по stat/signature.

Публичные bytes требуют выбранного owning document и native resource. Перед
чтением Body/citation файлов проверяются роли всех declared code projects.
Physical aliases закрытых solutions/testsets/components не становятся публичными
из-за другого имени или удаления первоначального source после hooks. Служебные
implementation/CSS пути не получают доступа к Body, README или ZIP.

`operation.resourceFiles` ordinary операции возвращает только
`{audience, files: [{source, target, bytes}]}`. Assignment общего resource getter
не предоставляет: файлы доступны через selected delivery и private role checks.
Current output проверяется как regular owned path; прежние bytes не замораживаются.

Файлы `bibliography`, `csl`, `citation-abbreviations` читаются citeproc по точным
путям из actual citation metadata выбранного документа. Quarto уже пересчитывает
их относительно source, включая публичные входы родительского курса за пределами
owner. Такой файл требует отдельной проверки объявления, canonical regular path
и physical private role; symlink, закрытая роль или её hardlink, tool cache и
необъявленный путь отвергаются. Это разрешение не открывает внешние Body resources
и не меняет относительные target paths выдачи.

[Loader code projects](native-context-ts.md) получает actual profiles из capture,
читаёт каждый участвующий YAML один раз и наследует namespace в памяти. Context
содержит абсолютный code directory в `input` и нормализованный `contract`.
`withProjectContexts` и `withProjectContracts` используют одну форму batch без
origins/effectiveMetadata, owner copy и per-project inspect. Декларации проекта
не заменяют actual QMD metadata из Quarto.

Callback-local lifecycle, private reservation и operation/capture correlation
сохраняются. Checkpoint и закрытие партии проверяют жизнь/failed/active; они не
обещают свежесть raw QMD, metadata, кеша или всего дерева. Source SHA и
`sourceRows` удалены из producers, DTO и consumers. Native cells/cache/freeze
остаются механизмами Quarto; раздельные student/full outputs задаёт автор.

References остаются у QRC: `referencesBySource` связывает source-relative token
с `{href,label}`, а прежние links/linksBySource сохраняют native подписи.
Core не читает каталог и не выводит default label из ID. Catalogue Cite
распознаётся по существующей key/style форме; обычные bibliography Cite не
становятся catalogue ссылками. Actual installed SP/Java, богатый Body и полный
выпуск требуют собственной приёмки. Изменение Source этого само не доказывает.

## Ручной курс без adapter

Для `target="manual"` не нужен PrairieLearn, Java или фиктивный validator.
Объявления проходят Core release semantics. Пример отдельного скрипта курса
с bank/work без code projects:

```ts
const sources = ["bank.qmd", "work.qmd"];
const outputDirectory = join(root, "_generated/manual-assignment");
await Core.withNativeCaptureScope({root, projection: "author", outputDirectory}, {
  assignment: {
    mode: "new",
    prepare: async () => ({
      expectedSources: sources,
      assessments: [{source: "work.qmd", id: "work"}],
    }),
  },
}, scope => scope.withPreparedOperation(lease => lease.captureInputs(
  lease.descriptor, sources,
  {args: ["render", "--output-dir", "_generated/manual-assignment"]},
)));
await Core.withCurrentNativeOperation({
  root, profiles: ["full"], projection: "author", outputDirectory,
}, async operation => {
  await operation.validateRelease({expectedSources: sources});
  const delivery = await operation.assignmentDelivery({
    source: "work.qmd", assessmentId: "work",
  }, {projectPlans: []});
  // Это фактические native slots, не повторный разбор исходной разметки.
  await saveManualBody(delivery.publicPackage, delivery.publicPackage.works[0]!.slots);
});
```

`sources` — точный состав owner inputs, выбранный интеграцией; `root` canonical.
`saveManualBody` — собственный конечный потребитель курса, не новый Core API.
Для code projects передаются полные typed student/full plans вместо пустого
массива. Общий `document()` assignment capture остаётся закрыт; назначение/slots
берутся только из selected delivery. Ordinary publication и список ID из
`validateRelease` не подменяют этот producer.

Это поддержанная миграция прежнего `entrypoints/export.ts`; старый CLI не
восстанавливается. Если прежний `project-checks.ts` обслуживал adapter-specific
политику, её проверяет соответствующий owner validator/readSet. Для manual
работы без code projects такой adapter не требуется. Execution ограничения,
включая OJS→Body, перечислены в [договоре выполнения](native-execution.md).
