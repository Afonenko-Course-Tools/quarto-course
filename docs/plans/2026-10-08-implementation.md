# Core, Presentation и Navigation: план владельца

Статус: следующий этап, реализация не начата. Главный порядок —
[линейный план](2026-10-08-course-tools-implementation.md), пункты 3–5, 12–13.
Нормативные поля/правила: [целевой контракт](../../spec/authoring-model-next.md).
Только Quarto 1.11.5 / CUE 0.17.1, без новой Windows matrix.

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
