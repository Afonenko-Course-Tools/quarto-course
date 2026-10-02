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
Capture output удаляется; raw Pandoc facts сохраняются в owner state. Inspector
отказывает engine/code cells, CUE отказывает exr/solution/grading/assessment,
`course-role` и учебные attributes, native computed/cell blocks. Root resources
используют production visibility projection; grading declarations отклоняются
по raw facts до обычной обработки Core. Дополнительный engine или QMD parser
не используется.

Native member boundaries проверяются через public inspect и полный authored QMD
inventory. Для остальных QMD public document inspect должен доказать отдельный
nested native project/config: он регистрируется как dormant, замораживается,
но не публикуется и не получает педагогический сертификат. Orphan текущего root
отклоняется. Symlinks и перекрывающиеся declared members отклоняются. Source,
config, includes, installed payload и внешние inspect dependencies заморожены;
байты dormant/member resources, QMD и root control/config закрыты для root raw
delivery. Root ordinary Link/Image resources получают текущие hashes через
существующий Core CUE resource policy/index.

Единственное исключение для root plain Link — точный mounted HTML/PDF artifact,
имя которого native document inspect сообщает через `pandoc.output-file` для
top-level selected input. Missing/ambiguous native output не разрешается через
догадку TypeScript. Nested targets остаются задачей QRC; произвольные child
resources и source links не получают разрешения. На finish требуются текущий
native portal artifact и каждый наблюдавшийся mounted target внутри переданного
stage. Их bytes/SHA связываются с session/invocation/actual observation и
перепроверяются `validateOwnerResources`. Native render success и порядок QRC
finalize — обязанности вызывающего Publisher lifecycle; finish не заменяет
ожидание процессов.

Mutable Download requests допускаются только через существующий публичный
`inspectOwnedRequests` provider и проверенную producer-owned directory; current
request bytes добавляются как service/denied. Требуется reviewed provider
`d78a533b14c38e3dd64dbfbd59e437a82e2752fd` или совместимый публичный контракт.
Старый пакет без ownership API отказывает; blanket `_generated` exclusion нет.

Этот API не экспортирует body/currentanswer, не расширяет Print schema и не
проверяет поздние QRC publication addresses вместо QRC. Header provenance
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
и QRC finalize, завершает optional child owners, затем navigation owner и seal.
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
