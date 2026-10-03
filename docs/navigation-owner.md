# Сертификат managed navigation root

Опциональный API `_extensions/course-core/owner-preflight/navigation.ts`
проверяет фактический navigation-only portal child, созданный Publisher.
Обычные `prepareOwner`/`activateOwner`/`finishOwner`, публичные Course/Fragment
и legacy render сохраняют свой контракт.

```ts
const owner = await prepareNavigationOwner(ctx.sourceRoot, {
  attemptId: ctx.attemptId,
  profile: ctx.profiles[0], // student или full
  extension: "_extensions/Afonenko-Course-Tools/course-core",
  portal: ctx.portal,
  members: ctx.members,
});

// Только metadata фактического portal render: output === ctx.portal.output.
const metadata = await activateNavigationOwner(owner);

// После успешных native children и QRC finalize, перед публикацией stage.
const result = await finishNavigationOwner(owner, { output: ctx.stage });
if (result.exitCode) throw new Error(JSON.stringify(result.report));
const resources = await validateOwnerResources(owner);
```

`PreparedNavigationOwner` совместим с `PreparedOwner`. Это сертификат одного
actual root child, не сертификат педагогики вложенных участников. Владелец
учебных задач продолжает использовать обычный owner API отдельно.

Root требует `project.render: []`, `project.output-dir: .project-publish/native`,
`course.id`, effective `course.view: student|full`; конечный public output
задаётся отдельно в Publisher. Последний pre-render hook — установленный
`course-core/entrypoints/owner-freeze.ts`. Допускаются только собственные Core
и Publisher pre/post entrypoints и configured filters `[course-core]` либо
`[course-core, reference-catalog]`. Установленные Core/QRC пути и bytes входят
в frozen receipt; неизвестные фильтры/hooks отказывают в capability. QRC adapter
не должен повторно добавлять уже configured root filters.

Portal descriptor передаётся без преобразований: абсолютные `input`, `output`,
`control`, `renderProfiles`, SHA256 `controlHash`, полный `configHashes` из
native inspect. Проверяется ровно один root QMD, composite profile
`audience,publish-portal`, native config set/hash, resolved document filter chain.
Сертификат включает эти facts и native child config/input identities.

Подготовка выполняет один stock native capture выбранного root через
`quarto render . --profile audience,publish-portal --no-execute --no-cache
--output-dir <private capture> --metadata-file <owner metadata>` с
`PROJECT_PUBLISH_MEMBER=1`. Исходные author/control configs не переписываются.
Полный capture output inventory хешируется; точная finite native writer
projection сохраняется настоящим service artifact, а scratch output удаляется.
Raw Pandoc facts сохраняются в owner state. Inspector
отказывает engine/code cells, CUE отказывает exr/solution/grading/assessment,
`course-role` и учебные attributes, native computed/cell blocks. Root resources
используют production visibility projection; grading declarations отклоняются
по raw facts до обычной обработки Core. Дополнительный engine или QMD parser
не используется.

Navigation сохраняет этот private composite output route. Обычные Core owners
тоже изолируют все student/full no-execute outputs, используя внутренний
per-profile scratch под `.course-owner`; ordinary/no-auto captures имеют один
output context своего профиля, Jupyter использует прежний same-capture replay.
Author-declared child outputs остаются нетронутыми. Parent не добавляет
alternate-profile output exclusions к source fingerprint и не меняет native
member/address geometry. Внутренний `capture-projections.ts` связывает actual
writer source/format/output-file/output-directory/invocation, retained bytes
и полный emitted inventory в private `Session.captureProjections` и
`Session.captureProjectionHash`; public API и Publisher phases сохраняются.

Native member boundaries проверяются через public inspect и полный authored QMD
inventory. Для остальных QMD public document inspect должен доказать отдельный
nested native project/config: он регистрируется как dormant, замораживается,
но не публикуется и не получает педагогический сертификат. Orphan текущего root
отклоняется. Symlinks и перекрывающиеся declared members отклоняются. Source,
config, includes, installed payload и внешние inspect dependencies заморожены;
байты dormant/member resources, QMD и root control/config закрыты для root raw
delivery. Root ordinary Link/Image resources получают текущие hashes через
существующий Core CUE resource policy/index.

Для root plain Link внутренний `rootAddresses` регистрирует точные mounted
HTML/PDF/Revealjs artifacts всех selected native inputs, включая nested inputs
и named writers. Путь берётся из фактического native document inspect
`pandoc.output-file` относительно каталога исходного документа; для HTML/Reveal
используется native HTML format fallback. Writer должен иметь каноническое
относительное имя без пустых, `.` и `..` segments, absolute paths и backslashes;
source и итоговый writer path остаются внутри canonical member boundary.
Missing/ambiguous native writer metadata отклоняется, имена не угадываются.
Произвольные child resources и source links не получают разрешения.

На finish требуются текущий native portal artifact и каждый наблюдавшийся mounted
target внутри переданного stage. Их actual bytes/SHA связываются с
session/invocation/actual observation и перепроверяются `validateOwnerResources`;
missing targets, symlinks и последующая смена байтов отклоняются. Native render
success и порядок QRC finalize — обязанности вызывающего Publisher lifecycle;
finish не заменяет ожидание процессов.

## Адресные ссылки из дочернего владельца

Отдельный прежний `addresses` сохраняет только top-level HTML/PDF native
writers для child foreign-link transport. Nested HTML/PDF и Revealjs root
addresses не расширяют этот child контракт; собственный child writer также
должен оставаться top-level.

Обычный HTML child может явно принять подготовленный Navigation handle через
`prepareOwner(..., { publicationAddresses: { navigation } })`. Это разрешает
проверить отдельный ordinary Link edge на конечный native HTML/PDF адрес
соседнего member; ресурсные права, body export и публичные Topic не добавляются.
Исходники соседнего проекта, foreign Images и raw resource selections остаются
за границей child resource policy.

Подготовка root должна предшествовать подготовке child, но его activation и
actual render на этом этапе не требуются. Контекст фиксирует настоящий prepared
handle/session, attempt/profile, native member descriptor, sources/configs,
controls/modules и finite native address rows. Ни root finished marker, ни
actual invocation ID в prepared контекст не подставляются. Child root должен
совпасть с ровно одним объявленным member; авторская address YAML или
произвольный список имён файлов этот контекст не заменяют.

Например, при обычных mounts `book` и `handouts` исходный book сохраняет свою
разметку:

```markdown
<!-- book/index.qmd -->
[Раздаточный материал в PDF](../handouts/contracts.pdf)

<!-- book/topics/contracts/index.qmd -->
![Схема договора](../../assets/contract.svg)
```

Native inspect выбранного top-level handout должен сообщать фактический PDF
`output-file: contracts.pdf`. PDF публикуется по `handouts/contracts.pdf`, а
same-source native HTML writer book — по `book/index.html`. Одна и та же
исходная Link разрешается и от `book/index.qmd`, и от каталога этого mounted
writer в `handouts/contracts.pdf`. SVG остаётся собственным
`book/assets/contract.svg` и требует обычного текущего owner resource grant;
адресный контекст не заменяет его policy.

Источник Link должен иметь ровно один frozen top-level selected HTML writer
с тем же native source. Core использует его точный native `output-file` и
mount, разрешает тот же исходный URL от mounted writer directory и сравнивает
с результатом source/effectiveBase resolution. Ссылки не переписываются;
QMD-to-output filename heuristic, nested writer fallback и HTML body parser
не применяются.

| Случай с исходным `../handouts/contracts.pdf` | Граница |
| --- | --- |
| Writer `book/index.html`, target `handouts/contracts.pdf` | Оба разрешения совпадают с finite native address |
| Другой native HTML filename в том же каталоге, заданный до prepare | Поддержан при точном inspect writer и совпадении обоих разрешений |
| Book remapped в `courses/book` | Mounted Link ведёт в `courses/handouts/contracts.pdf`: `SOURCE.PUBLICATION_ADDRESS_WRITER_MISMATCH` |
| Native writer перемещён в `book/pages/start.html` | Вне поддержанного корпуса: Quarto 1.10.18 запрещает path в output-file ещё при capture; если writer facts получены, mounted resolution также не совпадает |
| Nested, неизвестный либо неоднозначный собственный writer | `SOURCE.PUBLICATION_ADDRESS_WRITER_UNSUPPORTED`; finite top-level scope не расширяется |
| Child без `publicationAddresses` | Прежний `RESOURCE.OUTSIDE_OWNER` для foreign filesystem Link |

После всех успешных native commands и настоящего QRC finalize child finish
получает stage и полный actual member map. Каждый `output` — реальный native
metadata context данного member. На этой границе Core проверяет **весь**
успешный root result/actual-hash/resource-seal набор и guard, текущие root/child
invocations, неизменный prepared context и точные member paths/mounts/formats.
Root preparation либо один успешный root receipt не доказывают завершение.

```ts
const navigation = await prepareNavigationOwner(ctx.sourceRoot, {
  attemptId: ctx.attemptId,
  profile: ctx.profiles[0],
  extension: "_extensions/Afonenko-Course-Tools/course-core",
  portal: ctx.portal,
  members: ctx.members,
});
const book = await prepareOwner(bookRoot, {
  attemptId: ctx.attemptId,
  profile: ctx.profiles[0],
  extension: "_extensions/Afonenko-Course-Tools/course-core",
  publicationAddresses: { navigation },
});

// Обычная activation и единственные native renders с owner metadata.
// Вызывающий код ждёт zero exit всех команд, затем выполняет QRC finalize.
// actualMembers содержит outputs из реальных native metadata callbacks.
const addressMembers = actualMembers.map(({ path, mount, format, output }) => ({
  path, mount, format, output,
}));
const childResult = await finishOwner(book, {
  publicationAddresses: { output: ctx.stage, members: addressMembers },
});
if (childResult.exitCode) throw new Error(JSON.stringify(childResult.report));
const rootResult = await finishNavigationOwner(navigation, { output: ctx.stage });
if (rootResult.exitCode) throw new Error(JSON.stringify(rootResult.report));
await sealNavigationPublicationResources(navigation, {
  output: ctx.stage,
  members: actualMembers, // обычный map, включая законченные optional owner handles
});
await validateNavigationPublicationResources(navigation);
```

Ранний `addressMembers` содержит только `path`, `mount`, `format`, `output`,
без owner handles. Все required addresses выводятся из sealed native uses,
включая baseline; вызывающий код не может выбрать удобное подмножество.
Для каждого проверяются native output и mounted stage file, canonical пути
без symlink/escape и текущие SHA. PDF bytes обязаны совпасть; HTML может быть
переписан QRC, поэтому native и mounted SHA связываются отдельно. Это byte
proof после существующего QRC lifecycle, а не второй completion protocol.

Собственные closed/service bytes child остаются veto для обоих witnesses.
Единственное новое исключение может снять только typed capture-projection
denial для точного current same-source native artifact и его собственного
mounted stage destination, если оба текущих SHA равны projection SHA. Другой
service/closed/source/config/module denial с теми же bytes сохраняет veto.
Completion записывает реальный denied service proof
`.course-owner/publication-addresses.json` **до** resource index и finished
marker. Нужный, но отсутствующий finish context даёт
`SOURCE.PUBLICATION_ADDRESS_FINISH_REQUIRED`; неполные members или actual
root evidence тоже отказывают до этих markers. Current child accessor
перепроверяет prepared inputs, те же actual invocations/все receipts, полный
edge set и writer geometry, native/stage bytes и own текущие denials. Proof,
артефакт или control/source drift отзывают current index; новый root invocation
не переиспользует старое подтверждение.

Child finish и `validateOwnerResources(child)` не требуют parent finished/index
и не завершают parent. Затем Navigation finish фиксирует уже текущий child
service inventory, после него publication seal и последний current validator
предшествуют замене старого output. Recognized Core/Download producer state
не меняет frozen authored inputs; новая phase, hook или дополнительный engine
не нужны. Полный embedding контракт описан в
[owner preflight](owner-preflight.md#ссылки-дочернего-владельца-на-адреса-публикации).

Prepared parent/source validation не требует child activation или finish.
Поздние Navigation finish/index/current checks получают projection rows из
реального child session и sealed manifest через finite Core producer helper,
сверяя root/attempt/profile с prepared member, current session hash/active
mirror и полный успешный invocation. Очищенные synthetic child maps не
заменяют этот registry. Exact retained projections и manifest должны реально
существовать с sealed bytes и принадлежащими попытке canonical путями; missing,
extra, moved или изменённые records/files отказывают. Child current accessor
не ждёт parent completion; Navigation затем фиксирует уже текущий child
registry в своём denied service inventory до publication seal.

Mutable Download requests допускаются только через существующий публичный
`inspectOwnedRequests` provider и проверенную producer-owned directory; current
request bytes добавляются как service/denied. Требуется reviewed provider
`d78a533b14c38e3dd64dbfbd59e437a82e2752fd` или совместимый публичный контракт.
Старый пакет без ownership API отказывает; blanket `_generated` exclusion нет.

Этот API не экспортирует body/currentanswer, не расширяет Print schema и не
подменяет QRC finalize: адресные witnesses проверяются после него. Header provenance
расширяется независимым owner изменением: merge обязан сохранить native Header
baseline, composite profile и единственный ordinary render.

Проверки: `quarto run tests/navigation-owner.ts`; дополнительные focused режимы
`--address-only`, `--scope-only` и `--download-only` (последний требует
`PROJECT_DOWNLOAD_REPO` с ownership API). Installed Template composition и
late byte delivery guard проверяют всю Publisher/QRC/owner цепочку отдельно.

Resource policy этого сертификата относится к root delivery. Его запрет child
source bytes нельзя объединять глобальным union denied hashes с отдельным
child owner index: тот может разрешать те же текущие bytes только у собственного
mount. Whole-publication assembly требует provider-owned scoped composition и
current native member output witnesses. Native root certificate сам по себе не
означает Template composition GREEN и не разрешает consumer исключать файлы
по имени/видимости.

`owner-preflight/publication-resources.ts` предоставляет отдельный scoped seal:

```ts
await sealNavigationPublicationResources(navigation, {
  output: publication.stage,
  members: actualMembers.map(member => ({
    path: member.path, mount: member.mount, format: member.format,
    output: currentNativeMetadataOutput[member.path],
    owner: currentOwnerHandle[member.path], // если есть production owner
  })),
});
await validateNavigationPublicationResources(navigation);
```

Caller сохраняет реальные native metadata outputs, ждёт успешные child renders
и QRC finalize, завершает optional child owners (с actual address context,
если он принят при prepare), затем navigation owner и seal.
Navigation index включает текущий child model service state; последующее
изменение producer state отказывает. Stage совпадает с finished navigation stage.
Provider сравнивает полный descriptor, actual native project/input/config,
audience/attempt, current public owner accessor/index/invocation/output и SHA.
Receipt `.course-owner/publication-resources.json` содержит точные grants,
upstream hashes, native/staged artifacts и полный stage file set. Повторная
валидация отказывает при изменении stage, источников/config/modules/runtime,
receipt или upstream index. Новый Publisher phase не требуется.

Разрешение foreign source quarantine возможно только для точного mounted asset
с текущим allowed child owner path/SHA. Root own closed/control/model/service
и child own closed denials остаются veto. Отдельная public runtime role требует
Presentation descriptor и marked native script/link либо CourseNavigation
native revealjs registration, public plugin.yml и точных native script/link
destinations. Service runtime разрешён только на доказанном destination;
переименование/копия и raw resource selection запрещены. Общего SHA grant нет.
Для foreign runtime denied source record сам обязан иметь finite public runtime
роль в своём native scope; совпадения service-only SHA недостаточно. Private
owner indices/finished receipts и собственный publication receipt запрещены.

Retained finite capture writer projections — denied service rows в обоих
child и Navigation indexes. Manifest, raw AST, identity/input и остальные
private service rows сохраняют строгую denial. Publication seal и current
validator сначала проверяют реальный sealed projection registry и связывают
его service/index hashes с receipt, затем проверяют stage collisions.
Collision exception для child требует selected `html`, текущего завершённого
`member.owner`/index/invocation и точного `member.output === active.output`.
Без owner artifact row остаётся provenance и не снимает projection denial;
существующий optional-owner runtime transport сохраняется.
Auxiliary emitted inventory служит только provenance: stock Quarto sidecars
не получают новой denial либо grant по capture SHA, их scratch copies удалены.
Существующие page/resource/runtime permissions не расширяются.

При совпадении stage SHA с typed projection row разрешён только существующий
finite selected native artifact того же root/source в текущем participating
профиле и его точный canonical mounted destination. Нужны current owner/index,
все invocation receipts/guard, exact native writer facts, native SHA и stage
SHA, оба равные projection SHA. Для собственного portal действует та же
точная current artifact identity. Projection другого обязательного профиля
может совпасть по bytes, но permission исходит из current same-source artifact.
Stage-only substitution, alias, другой member/page и runtime copy не проходят;
исключение снимает только projection denial и не создаёт общего digest grant
или allowed owner resource-policy row. Любой другой denial с тем же SHA
остаётся veto. Уникальная full projection по raw или renamed имени отказывает
до первого publication seal.

Stock Quarto копирует пять файлов зарегистрированного Navigation directory:
3 JS, 1 CSS и обязательный `plugin.yml`. Manifest получает отдельный
`runtime-manifest` grant: closed CUE фиксирует name, scripts, stylesheet и finite
config; исходные bytes равны deterministic JSON serialization этого fixed public
value плюс newline (JSON-YAML). Native copy и exact staged destination совпадают
по SHA и связаны с четырьмя actual native runtime tags. Unknown fields, comments,
aliases и noncanonical YAML отказывают. Generic author project/control/model/config
YAML не получает этой роли. Node test находится в repo `tests/navigation-model.cjs`
и не входит в registered/shipped runtime directory. Public 3 JS/1 CSS неизменны.

Core владеет finite legacy `_generated/course-spec` protocol: текущие child model
files и native-selected source fragments включаются как service/denied;
неизвестный producer file отказывает. Download state остаётся отдельным public
ownership provider. Dormant проекты не исполняются: их source и producer state
заморожены целиком, mutable owned-state exemptions не применяются и отсутствующий
неиспользуемый provider не требуется. Foreign native-project QMD include
отказывает; same-root navigation partial допускается. Resource edge не расширяет
root source coverage на независимый native project.

Composer читает HTML только для finite runtime tags через vendored parse5 7.3.0
(MIT)/entities 6.0.1 (BSD-2-Clause), с complete licenses/byte provenance manifest.
Он не читает педагогический HTML body. Native HTML/PDF artifact provenance не
сертифицирует child pedagogy. Неизвестный legacy source/resource carrier требует
owner index либо отдельного public producer contract и отказывает capability.
Focused native test: `quarto run tests/navigation-publication.ts`.
