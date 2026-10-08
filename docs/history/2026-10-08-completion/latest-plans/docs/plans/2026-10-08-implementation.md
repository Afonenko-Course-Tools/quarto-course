# Core, Presentation и Navigation: план владельца

Статус: выпуск v4.0.1 выполнен на чистом проверенном main,
immutable release и native remote-tag install подтверждены. Шаги12–15
завершены; Course PR#4 OPEN/новый CI SUCCESS после удаления docs, шаги17–18 ожидаются.

Нужные незавершённые C1–C5/P1–P2 перенесены из прошлых планов; их исторические
статусы/версии/необязательная сложность не определяют новый контракт.

## Последовательность изменений

1. **Согласовать словарь и существующие документы.** Обновить
   `_extensions/course-core/contract-vocabulary.json`, `tools/sync-contract.mjs`,
   производные `domain/vocabulary.ts`, `spec/core.cue`, копию словаря Presentation,
   типы `domain/model.ts`, Body `model.ts` и `package.cue`. Сохранить текущую
   схему ordered items, дополнить assignments, statementVisibility и theory-time по целевому контракту.
   Удалить отменённые kind/role и старую `.step`-форму из активных контрактов/примеров.

2. **Очертить банк в raw AST и убрать подтверждённый повтор.**
   В `pedagogy/contract.lua`, `native-document.lua`, `exercises.lua`, `filter.lua`,
   `native-answers.lua`, `native-adapters.lua`, `native-resources.lua` выполнять
   банковские проверки/сбор только в effective exercise-bank. Проверять свои
   difficulty/time до audience projection. Возвращать из validate уже собранную
   rawAssessment вместо повторного вызова assessment.collect в filter.
   Расширить существующие raw canonical facts до ID/source/difficulty/time/
   resolved visibility/purpose/hasSolution; студенту не сохранять закрытые AST.
   Сохранить самостоятельные raw/projected pedagogy и guards API/CUE/Body.

3. **Переделать состав и разрешить решения.** В `assessment.lua` и
   `native-document.lua` объединить несколько stage-списков, оставить ровно одну
   ссылку в каждом пункте и отсутствие повторов во всей работе; проверить
   Span-поля и defaults. В `pedagogy/contract.lua`, `pedagogy/collect.lua`,
   `visibility.lua` разрешать same-QMD suffix и nested anonymous solution,
   запретить solution for, устранить неявную роль demonstration у exm.
   В `domain/assemble.ts`, `domain/release.ts`, `spec/core.cue` проверить
   междокументные назначения по raw canonical declarations: известный member,
   правильная demonstration и отсутствие open у practical/test.

4. **Разделить сайт и экспорт без нового прохода.** В `visibility.lua`,
   `filter.lua` применить website statement policy и student solution policy
   до извлечения публичных AST. Full остаётся полным по банковской приватности.
   `course-export-context` сохраняет условие назначенной restricted-задачи для
   участника: website restriction не должна вызывать BODY.PUBLIC_FACTS_REQUIRED.
   `body-export/collect.ts`, `producer.ts`, `model.ts`, `package.cue` передают
   назначения, исключают assessment-preview и внешнюю структуру занятия,
   сохраняют внутренние заголовки задачи, прежние ключи/заметки/ресурсы и
   полный экспорт решений. Число source renders не меняется.

5. **Завершить существующий current-run hook для предпросмотра.**
   В `entrypoints/post.ts` и небольшой локальной функции возле него собрать
   проверенные данные текущего NativeRun для отображения времени работы/занятия; `.assessment-preview`
   остаётся обычным текстовым блоком сайта без нового авторского шаблонизатора. Quarto формирует cross-ref и адреса ссылок.
   Не читать историю DocumentResult, не разбирать Markdown, не вводить вторую
   сборку. Сведения incomplete run не превращать в выдуманную сумму/ошибку
   неизвестного банковского member; полная проверка и экспорт остаются строгими.
   Presentation оформляет готовые сведения без копирования доменных правил.

6. **Включить ранее согласованную диагностику и две узкие Windows-правки.**
   Сохранить содержание ранее согласованных C1–C5: убрать повтор
   assessment.collect, отказаться от regex warning refusal, добавить локальные
   Lua/TS formatter и narrow CLI catch, актуализировать справочник диагностики. Локальные Lua/TS
   formatters, текущие ID, русский контекст и foreign causes; не вводить общий
   registry/report/runtime/error accumulator. В `output.lua` нормализовать
   разделители только для сравнения NativeRun root/directory, исходные пути
   сохранить для IO. В `infrastructure/validate.ts` создавать CUE temp JSON
   внутри projectRoot и удалять в finally. Native Windows CI не расширять.

## Проверки без нового набора инфраструктуры

- `tests/course-contract.ts`, `native-document.ts`, `pedagogy.ts`: обычные
  native упражнения вне банка; обязательные локальные поля только в банке;
  metadata inheritance для bank/statement default; hidden-invalid declaration;
  multi-list/stage/Span defaults; удалённые kind/solution for.
- `tests/solution-pairing.ts`, `display-examples.ts`, `visibility.ts`: матрица
  canonical demonstration × open/restricted × present/absent solution;
  exm не даёт банковского доступа; named same-QMD, nested anonymous, duplicate
  и orphan; full сохраняет все банковские условия/решения.
- `tests/native-release.ts`, `canonical-model.mjs`, `native-body.ts`,
  `selected-export.ts`, `root-export.ts`, `export-bank-ownership.ts`:
  междокументные stage predicates; practical/test restricted-only; состав и
  assignments сквозь Body; restricted participant condition; закрытые ответы
  не оказываются в publicPackage; exporter не включает preview/внешние headings,
  internal headings сохранены; native ownership/nested project/symlink guards.
- `tests/native-run.ts`, `native-lifecycle.ts`, `native-generated.ts`,
  Presentation browser fixtures: current-run preview, required/all + one
  theory-time, назначенная demonstration, partial render без history lookup,
  student/full обычные ссылки, отсутствие лишнего source render.
- `tests/system-toolchain.ts`, native-run/release/resources/body и текущие
  negative fixtures: прежние ID, source/ID/field, related duplicate source,
  foreign tool/exit/stdout/stderr/cause, native warning policy, cleanup CUE temp,
  сравнение mixed separators без изменения IO пути.
- После focused проверок: vocabulary check, canonical-model и существующий
  `npm test` только на принятой базовой Quarto 1.11.5 с CUE 0.17.1. Обновить
  `.github/workflows/ci.yml` и `_extension.yml` до этой поддержки, не вводя
  отдельной Windows-matrix. Installed consumer/demos — после согласованной
  поставки Core вместе с зависимыми владельцами.

Активные тексты Core для синхронной правки: README.md,
`spec/plugin-architecture.md`, `spec/learning-elements.md`, `spec/visibility.md`,
`spec/ast-profile.ebnf`, `docs/authoring-style-guide.md`, `docs/body-export.md`,
`docs/native-run.md`, `docs/presentation.md`, owner-планы. Сохранить задачу
`docs/diagnostics.md` из согласованного рефакторинга. Исторические evidence и
vendor не переписывать.


## Presentation / Navigation

После Core обновить `_extensions/course-presentation/modules/config.lua`,
`filter.lua`, копию contract vocabulary и `docs/presentation.md`: правильные
контексты оставшихся course-role, mandatory metadata только для банковских задач,
отображение собственных difficulty/time и времени назначений без их наследования.
В банковских Reveal не раскрывать restricted в student; обычные публичные
презентации вне банка сохраняют нативные решения, notes и `.fragment`.

Добавить только прежним неименованным guard ID
`PRESENTATION.CONFIG_INVALID`/`PRESENTATION.FILTER_ORDER_INVALID`, русский source/field.
Standalone не зависит от Core diagnostics. Убрать дубли native source-ссылок;
HTML Code Tools на Reveal не обещать. Примеры и notes/solutions по-русски,
без тестовых маркеров в ready assets. Navigation не получает новый валидатор.

Проверки: `quarto run tests/presentation.ts`, существующие
`tests/presentation/browser.cjs`, `unified.browser.cjs`, `tests/navigation.browser.cjs`
через текущие npm scripts. Сохранить поиск скрытой цели, native окно S,
переключение/перезагрузку, обзор, печать/PDF и восстановление состояния.

## Документы и завершение

Перенести целевой контракт в `spec/learning-elements.md`, `visibility.md`,
`ast-profile.ebnf`, `plugin-architecture.md`; оформить `spec/index.md`, обновить
`docs/authoring-style-guide.md`, body-export/native-run/presentation, README,
создать `docs/diagnostics.md`. Код/словарь/CUE/Body/примеры выпускаются вместе.

Результат этапа записать здесь: commit/PR, реальные проверки, merged SHA,
выпущенный tag, dependency pins и demo assets. Старые планы сохранить в Git
до удаления из активной ветки; целевой-next документ после внедрения убрать.


## Подготовка и текущий результат

- История до очистки сохранена: `17bdd7d`; свежий upstream main v3.0.2
  включён `eb9e66d`; индекс/worktree-карта — `0502085`; очистка исторических
  active текстов — `9924a39`. Подготовительный review `147` проверил свежий
  snapshot: 0 mismatch, 9 репозиториев и 13 worktrees; Critical/Important нет.
- Локальный quick baseline: PASS с Quarto 1.11.5 / CUE 0.17.1. Полный baseline
  оставался incomplete; его прохождение здесь не заявляется.
- Документы/схемы/примеры меняются вместе. До фактической проверки runtime
  целевые тематические документы имеют implementation-in-progress; новый тег,
  CI, ready demo и публикация пока не подтверждены.


## Проверка документов и примеров Core

Документы/примеры подготовлены scoped commits `738e818`, `835d6a6`, `b324fbe`.
Тематические статусы остаются implementation-in-progress до полного runtime
`npm test` и финального review; принятому-next документу выпуск не приписан.

С Quarto 1.11.5 / CUE 0.17.1 проверены текущие примеры, установленные локальным
`quarto add /home/tolya/course-tools/quarto-course --no-prompt` из runtime
`53aaf1e` в отдельную копию `/tmp/core-docs-course-check-btyhp247`.
Локальная установка создала `_extensions/course-core`; в проверочной копии
путь pre/post hooks заменён на фактически установленный. Пины/ready asset
этими проверками не выпускаются.

- `git diff --check -- README.md spec docs examples`: PASS.
  Проверка 61 местной Markdown-ссылки вне копируемых code blocks: 0 missing.
- В `examples/style-guide`: `XDG_CACHE_HOME=/tmp/core-docs-quarto-cache
  quarto render`: PASS, все четыре native Quarto-примера. Cache override нужен
  только ограниченной локальной среде, где системный Sass cache недоступен.
- В установленной копии: `quarto render --profile student` и
  `quarto render --profile full`: exit 0, по 6 текущих документов/post-hook.
  Использованы `XDG_CACHE_HOME=/tmp/core-docs-quarto-cache`,
  `CUE=/home/tolya/course-tools/local-tools/cue/cue`, `QUARTO_RUN_NO_NETWORK=true`.
  Student HTML/search/Exercise/answer partitions не содержат restricted тел,
  закрытых решений обычных банковских задач или ключей; open anonymous demonstration сохранена.
  Actual Source embed/modal nodes и скопированные QMD отсутствуют.
  Full сохраняет restricted/ordinary/demonstration условия, решения и work links.
- Суммы текущего запуска: lab 20/45 + theory 5 → 25/50;
  seminar 35/75 + 15 → 50/90; practical 20/20 + 2.5 → 22.5/22.5;
  test 15/35 + 0 → 15/35. Нативные profile/source настройки проверены отдельно
  обычным Quarto Source probe без runtime-парсера.
- В `slides`: `quarto render` с fail-if-warnings true: exit 0.
  Русские решения, общие notes и dependency Navigation сохранены.
  Новое прохождение browser suites этой проверкой не заявляется.
- `quarto run _extensions/course-core/entrypoints/export.ts --book .
  --work sec-practical-01 --output _generated/practical.json`: exit 0, 1 вопрос.
  Participant restricted condition, qualified assignments == works.items,
  theoryTime 2.5 и внутренний Header сохранены; preview, внешний work heading,
  solution и gradingNotes отсутствуют. Условие дополнительно проверено native
  `quarto pandoc --from json --to plain`, без нового парсера.
- Та же команда с `--work sec-test-01 --output _generated/test.json`:
  exit 0, 2 restricted вопроса в авторском порядке. Defaults required/individual,
  optional, публичные варианты single-choice и qualified assignments сохранены;
  correct=0 key/решения/заметки остаются только teacher payload.
- `quarto render seminars/01.qmd --profile student`: exit 0,
  renderAll false / один текущий документ. После прежних полных сборок старые
  totals не использованы; недоступный итог отсутствует.

Student native book 1.11.5 выводит три Unable to resolve crossref warnings для
restricted назначений до post-hook, затем завершается exit 0; final links
удалены. Это фактическое native поведение при fail-if-warnings true, а не
regex-классифицированный отказ. Внутренний selected JSON pass также выводит
native crossref warnings и явно разрешает их по контракту. Full/Reveal warnings
в этих проверках отсутствовали. Общий полный runtime suite, browser checks,
CI, новый тег, ready asset и публикация ещё требуют своих финальных gates.


## Финальная документальная подготовка после Core review

Для fixwave `a9656a6` уточнены NativeRun configuration fingerprints, ограничения
свидетельства процесса, actual native hasPublicSolution после conditional pass,
JSON source-format demonstration, маскирование настоящего Source AST-контейнера,
инертные отложенные назначения и порядок projection/resource cleanup до
Core/adapter guards и downstream QRC. Full website publicExercises не выдаёт
restricted; прямой buildBodies сохраняет BODY.PUBLIC_FACTS_REQUIRED, selected
participant данные получают через collectExport native JSON source context.
Body schema остаётся course-body-package-v1; published pins/ready URLs не изменены.

Эта подготовка сохраняет implementation-in-progress. Runtime focused/quick
PASS сообщает владелец `a9656a6`; полный npm test и scoped re-review пока pending.
Новые фактические installed examples на final SHA и promotion current остаются
следующим gate после GO. Предыдущие проверки примеров на `53aaf1e` выше не
выдаются за проверку Bootstrap Source override, поздних attachments/search или
последних native solution witness исправлений. В этом документальном follow-up
повторяются только link/consistency/diff checks; новые render-сессии не запускались.


## Подготовка current/unreleased 4.0.0

По разрешённому маршруту topical spec/docs/README переведены в current для
реализованного bundle 4.0.0; до опубликованного тега этот Git ref unreleased.
Переходный accepted-next документ снят с нормативных ссылок и оставлен только
исторической записью implemented-unreleased для финальной очистки плана.
Taskfile/BUILD/source pins заранее согласованы с планируемым v4.0.0, чтобы
инструмент и готовая группа имели один чистый producer SHA после публикации.
Это не утверждение доступности Release или прохождения финального browser/review.


## Локальный final gate Core 4.0.0

Runtime `0ddb463`: полный `npm test` session 38878 завершён exit 0, включая
native и три browser suites; лог `/tmp/core-runtime-20261008/full-round2.log`,
свежий evidence `/tmp/course-native-check-20261008-045220`. Scoped round2 review
`/tmp/core-bundle-review-20261008/rereview-round2.md`: Approved,
Critical/Important/обязательных Minor нет. Это локальные gates, не CI/merge/Release.

Из `git archive 0ddb463` установлены все три расширения 4.0.0 через local
`quarto add`; актуальные авторские примеры/pins проверены в отдельной копии
`/tmp/core-docs-final-qrc62ext/example`. Hooks использовали ownerless путь
локальной установки. В проверочной копии student native Code Tools Source
принудительно включён (source true / keep-source true / toggle false / caption),
чтобы проверить реальное Source AST masking, а не только рекомендованную настройку.

- Student/full/standalone Reveal: exit 0; book по 6 текущих документов.
  Bank/work source modal/QMD copies отсутствуют; HTML/search/AST не содержат
  закрытые условия/назначения, публичные title/preview сохранены.
  Четыре суммы совпали с таблицей примера; full сохраняет банк, Reveal — notes,
  русские решения и Navigation. Logs: student.log/full.log/reveal.log в указанном tmp.
- Partial семинара: exit 0, renderAll false / один документ; нет старого полного
  итога. Log partial.log. Полный render не повторялся после подтверждённого PASS.
- Selected seminar/practical/test: exit 0, 3/1/2 вопроса. JSON demonstration
  имеет actual hasPublicSolution; qualified items/assignments и defaults/stages
  согласованы. Restricted participant пакеты не имеют closedKey/solution/
  gradingNotes; single-choice correct=0 остаётся teacher-only. Practical condition
  проверен native Pandoc plain: внутренний Header сохранён, preview/внешний work
  header/private blocks отсутствуют. Logs: seminar-export.log,
  practical-export.log, test-export.log; condition.json/condition.txt.
- Diff check PASS; все 64 текущие местные Markdown-ссылки вне code blocks доступны
  (к исходным 61 добавлены исторические redirect links). Нет active normative
  ссылок на accepted-next или старого implementation-in-progress в topical docs.

Taskfile/BUILD/source references закреплены на v4.0.0. Проверка выполнена из
локального архива, а не из ещё не опубликованного сетевого тега. Готовый asset
и BUILD sourceDirty:false не создавались; контроллер выпускает tool/demo из
одного чистого окончательного Git SHA после branch review/CI/merge. Текущий факт
неопубликованного тега остаётся только журналом подготовки; продуктовые документы
сохраняют корректную общую связь descriptor/ref/tag после публикации.

## Итоговый журнал 8 октября: проверенные выпуски и передача

Core 4.0.1: PR#27 merged source `a9a439bd6e6498806d4d4943efd71232e70170be`, PR CI37734271246/main CI37734901545 SUCCESS. Immutable tool Release406473961/native install63 exact files; Core demo-20261008-1 Release406475550/native ready107 exact files, sourceDirty false. Full npm test exit0 и native book2.1/late-bank3.1/privacy/Source/search/resource/partial guards PASS. Core 4.0.0 и первая demo0 остаются immutable историей.

Шаг16: ожидает `https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4` / `fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c` / `SUCCESS — https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/actions/runs/37742519419`; курс не merge/deploy/branch-cleanup. Шаги17/18 pending до actual before/after cleanup receipts и first durable history commit. Позднейший docs/history main не заменяет опубликованный producer/site sourceSHA.

Общий gate14/15 выполнен: Template PR19/CI37737745573 SUCCESS/MERGED, native publication main52316a7/gh-pages8dc11b5; actual Pages/live/CUA proof /tmp/template-patch-pages-20261008/.

Course16 native final PASS: Core 4.0.1/618 exact bytes, fixtures48+CUE8, student107.247/full120.018/student111.065/site0.358 all0, native bank href+11.1 both views, selected Body40.629s/root-only owner/real open-manual90/required-individual/0resources/noZIP, student178bytes unchanged and author43 unchanged. Actual proof /tmp/cybersecurity-core-patch-20261008/verified-final-native.json. Новый OPEN PR/head/required CI ещё ожидаются.

## Подтверждённый финальный журнал — 8 октября 2026, 07:19 UTC

Шаги 12–15 завершены: восемь текущих инструментов immutable выпущены,
штатная установка по тегам и native ready результаты проверены; Core 4.0.1
и demo-20261008-1 сохранены отдельно от предыдущей immutable линии.
[Template PR #19](https://github.com/Afonenko-Course-Tools/quarto-template-course/pull/19)
MERGED после [CI SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-template-course/actions/runs/37737745573).
Published source main `52316a762da3a9c054b5ac6a7a89620e46c7c150`,
native gh-pages `8dc11b599406f65af420aef39babdb15375df61b`. Пять clean-main
native gates и task publish exit 0; exact 63 Core/549 ready/599 site bytes,
61 HTML/2459 local links,22 HTTP/Pages built/Root CUA Source-search-catalog PASS.
[Руководство](https://afonenko-course-tools.github.io/quarto-template-course/).

Шаг 16: [новый PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4) **OPEN**, прикреплён к задаче,
head `fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c`, tree `a9fdc3fe043bcaf75249dc2f7c839324287924e1`.
Сохранены пользовательские 9853/master8e histories; 701 одобренный путь
совпадает с Git bytes, включая все32 Course receipts/history files и8 raw logs.
Core 4.0.1 installed618 exact paths/bytes; NativeRun48/CUE8, student107.247/
full120.018/student111.065/site0.358s exit0; оба bank href/native11.1; Body40.629s,
root-only owner, real open/manual90-minute estimate, required/individual,
closed participant fields absent/resources0/noZIP. Student178bytes, author43
и runtime667 сохранены. Exact native proof: `/tmp/cybersecurity-core-patch-20261008/verified-final-native.json`.
[Required CI 37742519419](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/actions/runs/37742519419) **SUCCESS** на exact head
fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c; публикационный uploader student
SKIPPED, merge/deploy не выполнялись. Шаг16 выполнен. Курс не merge/deploy/branch cleanup.

Шаги 17–18 pending: first durable nine-owner final history, fresh branch/tag/
Release/worktree guards, exact refs cleanup и final docs handoff ещё не выполнены.
Теги/Releases/source producer SHA, serving gh-pages, OPEN automatic heads
и все пользовательские worktrees/Course ветки сохраняются.

Подтверждение07:23 UTC: Course PR#4 остаётся OPEN; CI37742519419 completed SUCCESS
на headfd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c. Exact receipt: /tmp/cybersecurity-final-pr-20261008/verified-pr-ci.json.
Шаг16 выполнен;17–18 ещё pending.

## Прямое позднее указание: удалить Course docs — 07:33 UTC

По запросу пользователя каталог `/home/tolya/Cybersecurity/docs` полностью
удалён: 36 файлов перед удалением побайтно совпали с Git
`fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c`; untracked/symlink материалов нет.
README,43 авторских источника и runtime667 не менялись. Старый owner plan и
технические snapshots остаются только в Git; Course docs не восстанавливать
и не создавать заново под другим путём. Действующая передача —
[PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4) и итоговый отчёт Core.
Фактический новый head `b6b085cf0541785d11159bd9a106cd131dfabaf0`, tree `f6a3732feca1bad1fd4c4ed4e533edbb6b230e5b`; PR OPEN.
Предыдущий CI37742519419/fd62 SUCCESS является историческим результатом.
Новый [CI 37743840665](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/actions/runs/37743840665) **SUCCESS** на exact новом head;
шаг16 выполнен. Публикация SKIPPED, курс не merge/deploy. Шаги17–18 ещё pending.
Exact cleanup receipt: `/tmp/cybersecurity-docs-cleanup-20261008/verified-cleanup.json`.

Финальный актуальный gate07:37 UTC: PR4 OPEN/headb6b085cf0541785d11159bd9a106cd131dfabaf0,
CI37743840665 completed SUCCESS, deploy SKIPPED, docs ABSENT. Все36 удалённых
Course docs файлов восстановимы из Gitfd62, README/runtime667/author43 сохранены.
Шаг16 выполнен;17–18 pending. Exact receipt: /tmp/cybersecurity-docs-cleanup-20261008/verified-pr-ci.json.
