# Ограниченный native/TS договор Core

A1 входит в unreleased Core 9.2.1. Установленную композицию курса переключает её владелец.

```ts
import {readProjectContexts, decodeProjectContract, assertProjectContext} from "../_extensions/course-core/public.ts";
await readProjectContexts([{owner: absoluteBookRoot, inputs: ["projects/a/input.qmd", "projects/b/input.qmd"], profiles: [], format: "html"}], async ([group]) => {
  const context = group.contexts[0];
  const project = decodeProjectContract(context);
  await assertProjectContext(context); // перед зависимым IO
});
```

Настоящий owner читается отдельно. Один disposable-контекст с техническим `project.type: default` обслуживает явно выбранные QMD inputs, включая входы вне book chapters. Отсутствующий служебный QMD создаётся только в disposable-копии, если родительский code-project каталог существует. Авторские файлы не редактируются. Native Quarto >=1.11.5 объединяет `course-project`; CST только индексирует scalar declarations и добавляет параллельное дерево ID. `effectiveMetadata` сохраняет native rebasing, `origins` отдельно хранит raw, источник, диапазон смещений UTF-16 исходного текста и разрешённый путь. Здесь диапазон — offsets, не номер строки.

Поддержано: именованные scalar-map `components.<name>.path`, `testsets.<name>.path`, `build.files.<target>` и boolean maps `delivery.student.testsets` / `verification.testsets`. Для shared components/build базой служит файл объявления (`definition`), для локального `testsets.<name>.path` — каталог выбранного code-project input (`project`), даже при унаследованном raw объявлении. Зависимости testset/component объявляются boolean map `requires`. Декодер сам не выполняет замыкание; операция `planProject` описана в [условии и материализации](condition-materialization-ts.md). Default выводится из той же runtime-схемы Zod exact4.6.7, из неё же выводятся TS-типы.

Первый тест с двумя inputs измеряет три inspect: настоящий owner и по одному effective document в disposable owner. Полный исходный обход один, финальные fences отдельно проверяют сохранённый inventory. Повторные getters используют тот же context и не запускают inspect/полный обход. Контекст действует только внутри callback; поддельная копия и истёкшая ссылка отклоняются. Изменение metadata, использованных path membership или source inventory до финальной границы вызывает отказ; межоперационного cache нет.

Непроверенные arrays/aliases/tags в owner namespace, metadata-files и format contributors получают `ORIGIN_UNQUALIFIED`. Отсутствующий path, чужой owner и коллизия служебного ключа также блокируют зависимую выдачу. Native glob, source symlinks и внешние path roots здесь ещё не квалифицированы. Ограниченный явный договор starter/solutions описан в A2. Ограничение не означает поддержку всей metadata-поверхности реального курса.

Квалификационная baseline/instrumented пара запускается только тестом. Постоянной двойной рабочей цепочки нет. Runtime импортирует локальный Zod из расширения без npm и сети.

Проверки: `quarto run tests/native-context-a1.ts`, `quarto run tests/native-context-a1-negative.ts`, `quarto run tests/native-context-a1-typecheck.ts`. Для процессов используется постоянный `XDG_CACHE_HOME` из execution brief.

## Ранний и поздний документ

`normalizeDocument(ast, context)` принимает Pandoc JSON и явно заданные `operation` (UUID текущего запуска), `input`, `format`, `projection` (`student`/`author`), `exerciseBank` и необязательные defaults. Он сохраняет обычные узлы, валидирует скрытые объявления до проекции, декодирует короткие attrs и непосредственный fenced YAML `.course-exercise` одной схемой. Обычный YAML не поглощается. Совпадающие определения ID могут иметь разные occurrences; противоречащие определения и повторные attrs/marker-поля отклоняются.

`finalizeDocument(early, late)` получает текущий ранний результат как authority операции и late witness того же operation/input/format/projection. Он возвращает `status: complete | partial`; отсутствующее обязательное тело или безусловное выбранное решение остаётся в `unresolved`. У conditional solution отсутствие допустимо, а `hasPublicSolution` устанавливается только при положительном позднем witness. Текущий early нельзя подменять одновременно старой парой early/late: текущий operation назначает вызывающий composition owner.

На файловой границе early/late декодируются runtime-схемами, а `FinalizedDocument` и его тип выводятся из одной исполняемой схемы. Внутренние occurrence keys не являются учебными ID. Операции не запускают внешний schema tool и не переопределяют штатные Quarto conditions.

Для ограниченного native маршрута composition owner создаёт приватный JSON request `{context, capture}` с абсолютным capture prefix и передаёт его путь через `COURSE_CORE_TS_RUN`. На каждый запуск нужен новый operation/capture; существующий sidecar отклоняется. До native render включаются эти explicit filters:

```yaml
filters:
  - at: pre-ast
    path: _extensions/course-core/native-ts/early-context.lua
  - at: post-quarto
    path: _extensions/course-core/native-ts/late-kind.lua
  - at: post-render
    path: _extensions/course-core/native-ts/late-filter.lua
course-core-projection: student
```

В установленной namespace-раскладке пути получают префикс `Afonenko-Course-Tools/`; установку выполняет интегратор. Новые filters пока подключаются явно в изолированной композиции; старый `course-core` одновременно не включается. Этот документ не переключает действующую композицию Java/SP.

Тонкий pre-ast adapter сверяет реальный input/format/projection и вызывает штатный `pandoc.utils.run_json_filter` с `early-filter.sh` → `quarto run`. Post-quarto сохраняет техническую метку native `Theorem`/`Proof`. Post-render собирает окончательное тело после штатных conditions и renderer и удаляет внутренние метки до writer. Это существенно: на post-quarto скрытый ConditionalBlock ещё может иметь пустой scaffold, который нельзя выдавать за положительное решение.

Native квалификация сейчас относится к HTML. Другой writer, непереносимый native node или generated resource до post-render требуют отдельной проверки. Публичные `selectCondition`, `planProject`, `materializeProject` и `ArtifactInventory` описаны в [A2](condition-materialization-ts.md); они используют этот же context и поздний документ.

Весь ограниченный набор: `bash tools/check-core-native-ts.sh`. Он включает local exact Zod smoke, native contexts, negative/lifetime tests, JSON roundtrip, настоящий book render и typecheck public/launcher graph. Полный текущий native набор — `tools/check-canonical.sh --native`; старый schema-tool маршрут удалён.

Неперенесённые Core namespaces ответов (`answer`, `answer-spec`, `correct`) и составов `task-items` получают `DOCUMENT_UNQUALIFIED` до writer. Это предотвращает публикацию сырых ключей ответа через новый ограниченный маршрут. Для `student` закрытые условия `restricted`, private solutions и `grading-notes` удаляются после валидации скрытых объявлений. Launcher принудительно использует cached-only Quarto runtime и отключает Deno package auto-discovery; render не создаёт новый dependency lock в расширении.

Перед выбором public/private политики решение проходит единый pairing check: named `sol-*` и окружающий `exr-*`, если заданы оба, обязаны указывать на одну задачу. Конфликт получает `SOLUTION_PAIRING_INVALID` до sidecar/writer. Атрибут `for` у банковского решения остаётся запрещённым действующим контрактом. Анонимное вложенное решение и отдельный `sol-*` того же документа поддерживаются; эта проверка не скрывает корректные публичные решения и не объединяет повторные occurrences.

Для combined `.solution .content-visible/.content-hidden` transport передаёт собственный occurrence через native `Proof` container. Помеченный payload внутри `ConditionalBlock` получает немаркированную оболочку: штатный renderer снимает её для видимой ветви и удаляет всё для скрытой. Условие не вычисляется в Core; положительный witness по-прежнему собирается только после native renderer. Приёмочные controls — `tests/document-a1-conditional-native.ts`; конечный writer и поздние тела не содержат внутренних атрибутов.

Явная [source policy `static`](native-operation-ts.md) относится только к bound `operation.withProjectContexts`: повторные getters и byte cache проверяют lifetime в памяти, а source/runtime fences выполняет внешний owner callback. Standalone `readProjectContexts` сохраняет общий договор. Native metadata, scalar origins и истечение contexts остаются прежними.

## Узкий project contract в 9.3.0

`operation.withProjectContracts(requests, callback)` возвращает непрозрачный
`ProjectContractContext`. Он содержит native namespace `contract`, origins и
identity, но не обещает `effectiveMetadata`. `planProject` принимает оба вида
контекста. Старый `withProjectContexts` сохраняет полный native договор.
Копия DTO не получает authority; после callback контекст истекает.

Для явного `course-core-source-policy: static`, Quarto **ровно 1.11.5**,
HTML и независимого локального `course-project` в единственном `_metadata.yml`
или `_metadata.yaml` одна публичная команда `quarto inspect <temporaryOwner>`
разрешает весь batch. Carrier содержит только `_quarto.yml`, без QMD и копии
Source. Origins размечаются прежним scalar-marker механизмом; namespace,
покрытие, версия и marker проверяются после native ответа. Неверный ответ
завершает batch ошибкой, без скрытого повторного общего inspect.

Inherited execution/OJS, brand (включая неявные `_brand` пути), иная версия,
формат, authored native-input, неоднозначный YAML или неканонический path
оставляют прежний общий маршрут. Format-specific namespace сохраняет
`ORIGIN_UNQUALIFIED`. Это узкая квалификация, а не новый metadata resolver.
Файлы читаются лениво через прежний bound reader с canonical/type/signature
проверками; Source lifetime, outer fences и shared failed/reentrant guard
остаются общими. Cache действует только в той же operation/S/generation.

В assignment точная внутренняя callback-привязка дополнительно проверяет
принятые projects/HTML/Source witness и текущие ordered native profiles.
Разрешается только реальный временный owner этого carrier; argv на проводе
остаётся фактическим, окружение фиксируется текущей операцией, `beforeChild` и lifetime
проверяются. Произвольный inspect не добавляется в профиль.

Aggregate carrier сохраняет точное дерево declaration markers отдельно для каждого project entry; перестановка целого дерева или foreign scalar ID отказывает до построения origins, даже при одинаковых значениях контрактов. Перед настоящим inspect Core повторно проверяет physical carrier и `_quarto.yml` после асинхронного Source fence, непосредственно перед созданием child; чужие файлы, aliases и замена YAML запрещены.


## Контроль внутри статической партии (9.3.4)

`withProjectContexts` и `withProjectContracts` передают callback тот же batch с методом
`checkpoint(): Promise<void>`. Он принадлежит ровно этой callback и после её выхода
отказывает, в том числе во время следующей партии. Metrics остаются read-only и
после `await` содержат окончательные расходы A1; сами contexts и plans не оживают.

Для `course-core-source-policy: static` полная существующая проверка S/G/K
выполняется перед получением contexts и после завершения партии, до успешного
возврата. Checkpoint проверяет жизнь, failure state и исходные cwd/env без чтения
S/G/K. Вложенные Core children используют тот же временный scope; проверки
argv/env/profile/token, real resource bytes и materialization сохраняются.
`operation.assertCurrent()` сохраняет прежнюю семантику: полный static fence даже
внутри batch и прежнюю адресную general проверку. General checkpoint делегирует
`guard(false)`; standalone и consumers без нового метода сохраняют прежний путь.

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
