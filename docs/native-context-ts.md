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

## Bound A1 после native child

`operation.withProjectContexts` использует existing actual owner acquisition
после native render. Для одного owner все выбранные inputs/formats обслуживает
одна disposable copy; Native inspect и scalar markers сохраняют реальное
происхождение полей. `operation.withProjectContracts` отдаёт schema-parsed
`ProjectContractContext` с contract/origins/identity без effectiveMetadata.
Оба вида context связаны с private generation и callback lifetime; DTO clone не
получает authority. Standalone `readProjectContexts` использует тот же acquisition.

Bank AST и code-project context имеют разные роли: первый содержит actual
computed condition/assessment, второй — actual starter/tests/solutions/build
metadata. Source rows прежнего pre-child owner не подменяют свежую A1 metadata.
Повторные consumers внутри batch читают те же captured bytes без нового inspect
или owner copy. Новая отдельная batch получает новый actual context, а не старый
cross-batch cache. Scalar roles и actual acquired inode identities сохраняются.

Прежний узкий aggregate carrier и его eligibility/cache путь удалены.
Цена current full copy/inspect и inventory checks остаётся; параллельная
модификация owner внутри A1 batch может отказать. `metadata-file(s)`, aliases/tags
и неподдержанные format origins сохраняют существующие A1 ограничения.
Новый recursive YAML resolver, receipt или execution policy не вводится.

## Контроль внутри статической партии (9.3.4)

`withProjectContexts` и `withProjectContracts` передают callback тот же batch с методом
`checkpoint(): Promise<void>`. Он принадлежит ровно этой callback и после её выхода
отказывает, в том числе во время следующей партии. Metrics остаются read-only и
после `await` содержат окончательные расходы A1; сами contexts и plans не оживают.

Outer runtime/private/output и selected raw-QMD guards сохраняются. Checkpoint
проверяет callback life/failure/cwd/env; actual A1 context проверяет собственные
captured bytes и identity в своей короткой post-render batch. Metadata до render
не замораживаются полным ancestor membership договором. Native engines/caches
принимаются обычным Quarto, representation output ограничивает конечный consumer.

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
