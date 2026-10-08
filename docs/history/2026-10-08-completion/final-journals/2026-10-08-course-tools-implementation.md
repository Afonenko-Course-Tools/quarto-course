# Линейный план реализации инструментов, документации и PR курса

Дата: 8 октября 2026. Статус: шаги12–16 выполнены; Course PR#4 OPEN.
После полного удаления Course docs новый CI37743840665 SUCCESS на exact b6b085c.
Шаги17–18 ещё не завершены.

Цель: внедрить согласованную модель банка/работ, диагностику и известные
Windows-патчи; выпустить инструменты, расширить русскую авторскую документацию,
опубликовать её штатно через `gh-pages`, обновить открытый PR Cybersecurity
и очистить ветки инструментов/шаблона.

Контракт: [authoring-model-next.md](../../spec/authoring-model-next.md).
Начало работы: [/home/tolya/course-tools/START-CODEX.md](/home/tolya/course-tools/START-CODEX.md).
Исполнять пункты по порядку; после каждого сохранять короткий результат и ссылки
на коммиты/проверки в плане владельца. Для реализации применять executing-plans
либо subagent-driven-development; независимые проверки можно поручать агентам,
но порядок интеграции и выпусков остаётся линейным.

## Условия запуска и ресурсы

- На реализацию всего маршрута отводится **9 часов с момента старта**.
  Зафиксировать start/deadline в начале, учитывать время локальных проверок,
  CI, выпусков и публикации. При исчерпании времени сохранить фактический
  результат и оставшиеся пункты, не объявлять незавершённое выполненным
  и не обходить проверки/сохранение истории ради дедлайна.
- Использовать все доступные ресурсы ноутбука: CPU, память, локальные среды
  и параллельных агентов для независимых работ/проверок. Следить за нагрузкой,
  чтобы параллельные процессы не исчерпывали RAM и не замедляли друг друга;
  зависимые изменения/merge/release выполнять последовательно.
- Предпочитать локальное тестирование. Пункты 3–11 и подготовка шаблона
  проверяются локально; финальный CI запускать после успешного локального
  результата и review перед merge/release. Не использовать CI как цикл
  поиска первой ошибки; повторять его только после исправлений, требующих
  нового подтверждения. Required checks сохраняются обязательными.
- При поддержке настройки reasoning назначать реализацию runtime/инфраструктуры
  и её тесты на **medium**. Спецификации, README, docs, инструкции, шаблон
  документации и его проекты/примеры выполнять на **ultra**. Смешанный пункт
  разделять на кодовую и документальную подзадачи с этими уровнями, сохраняя
  общий линейный порядок. Модель пользователь не задавал: не менять её
  автоматически. Если уровень недоступен, указать ограничение и использовать
  ближайший поддерживаемый; не заявлять включённый ultra без поддержки.

## Постоянные ограничения

- `/home/tolya/course-tools` не является Git-репозиторием. Код, спецификации,
  планы и нужная история сохраняются в существующих репозиториях владельцев;
  дополнительный общий репозиторий не создавать.
- Quarto 1.11.5 / CUE 0.17.1; убрать активную поддержку Quarto 1.10.x.
  Старый авторский формат не поддерживать параллельно с новым.
- Переиспользовать нативный Quarto/Pandoc, нынешние raw/projected границы и
  selected source export. Не вводить общий runtime, Markdown-парсер,
  менеджер зависимостей, генератор документации или второй полный render.
- До удаления документов/веток сохранить нужные dirty/untracked материалы
  и уникальные коммиты в Git владельцев. Не сбрасывать пользовательские checkout.
- В этом этапе переносить только подтверждённые Windows-исправления и небольшие
  регрессии; остальные проблемы разбирать по факту в локальной Windows-сессии.
- Курс Cybersecurity адаптировать к новой модели. Исследование влияния на
  остальные существующие курсы не входит в работу.
- Итоговые ветки инструментов/шаблона: `main`, служебная `gh-pages` там, где
  публикуется Pages, и ветки открытых автоматических GitHub PR. Теги и Releases
  сохранить. Cybersecurity и его открытая ветка из очистки исключены.

## Последовательность

1. [x] **Сохранить исходное состояние у владельцев.** Проверить рабочие деревья,
   worktrees, свежие remote refs, main/теги/открытые PR. Сохранить dirty tracked,
   untracked и нужные ignored материалы. Не считать старые evidence подтверждением
   сегодняшнего CI. Общие ещё не сохранённые документы разнести по предметному
   владельцу и закоммитить до удаления из общего каталога; таблица переноса ниже.
   Результат: восстановимая история в существующих репозиториях, карта текущих refs.

2. [x] **Подготовить единый порядок спецификаций и версий.** У каждого владельца
   создать/обновить `spec/index.md` (QRC может сохранить существующий `docs/contract.md`
   как контракт и связать его из индекса). Метки type/component/status, один
   нормативный владелец правила; текущая версия определяется `_extension.yml`
   того же Git ref, main до выпуска явно unreleased. Выделить ссылки на актуальные
   контракты из README. Старые планы/пробы сохранить в Git и убрать из активной
   ветки после переноса нужных решений. Одновременно обновлять контракты с кодом,
   а не объявлять новый синтаксис уже поддерживаемым.

3. [x] **Обновить Core: банк, словарь, задания и решения.** Владелец
   [Core](2026-10-08-implementation.md). Явный exercise-bank, свои difficulty/time,
   statement-visibility, suffix/nested решения; убрать отменённые роли/виды/формы.
   Сохранить стандартное Quarto вне банка. Проверить raw invalid декларации до
   проекции и отсутствие закрытых AST в student. Результат: согласованные
   Lua/TS/CUE/словарь/README/fixtures.

4. [x] **Обновить Core: работы, stage, preview, время и Body.** Несколько
   task-items в одной работе; назначения required/optional и work-mode;
   demonstration guards; test/practical restricted-only. Суммы required/all и
   theory-time по текущему run, корректный неполный preview. Selected export
   передаёт restricted условие участнику, отделяет ключи/решения и исключает
   assessment-preview/внешнюю структуру. Результат: одна модель назначений
   через NativeRun/Release/Body без дополнительного source render.

5. [x] **Завершить диагностику Core, Presentation и Windows-патчи.** Перенести
   output.lua/validate.ts из текущего Cybersecurity в upstream Core, сохранив
   IO/containment semantics и cleanup. Применить локальные formatter/cause/CLI
   границы и native warning policy. Presentation показывает новые сведения,
   сохраняет поиск/notes/переходы/печать и самостоятельное подключение.
   Обновить минимум Quarto/CI только до 1.11.5; пройти focused и существующий
   полный `npm test`. Результат: готовый проверяемый PR Core bundle.

6. [x] **Обновить Publisher.** Владелец
   [quarto-project-publish](../../../quarto-project-publish/docs/plans/2026-10-08-implementation.md).
   Native composition/ownership/selected profiles сохранить, fixtures перенести
   на явный банк, собственную диагностику и external process errors согласовать.
   Проверить student/full outputs/search/resources и строгость каждого ребёнка.

7. [x] **Обновить QRC.** Владелец
   [quarto-reference-catalog](../../../quarto-reference-catalog/docs/plans/2026-10-08-implementation.md).
   Адресная связь, local deferral и профильный каталог без импорта тел;
   диагностика/внешние причины, русский контент и native source. Проверить
   export-context вместе с текущими native/browser проверками.

8. [x] **Обновить Print.** Владелец
   [quarto-course-print](../../../quarto-course-print/docs/plans/2026-10-08-implementation.md).
   Новый Body/назначения, restricted participant условия, PDF без закрытых
   решений/ключей/preview; диагностика и узкий process helper. Проверить
   нативный PDF вне банка, installed CLI и настоящие PDF варианта работы.

9. [x] **Обновить Moodle.** Владелец
   [quarto-course-moodle](../../../quarto-course-moodle/docs/plans/2026-10-08-implementation.md).
   Teacher Body/назначения и single-choice XML с ключом, без прозаического
   preview. Диагностика/процессы; сохранить минимальный экспорт вопросов,
   не создавать автоматически LMS-тесты и настройки доступа.

10. [x] **Обновить PrairieLearn.** Владелец
    [quarto-course-prairielearn](../../../quarto-course-prairielearn/docs/plans/2026-10-08-implementation.md).
    Новый participant Body, restricted условия, выбранная work closure и
    прежние client/tests/reference границы. Диагностика/CUE; пройти реальные
    Java/Gradle и installed CLI проверки без новых способов оценивания.

11. [x] **Обновить Cloud и Download.** Владельцы
    [Cloud](../../../quarto-course-cloud/docs/plans/2026-10-08-implementation.md) и
    [Download](../../../quarto-project-download/docs/plans/2026-10-08-implementation.md).
    Cloud принимает новый состав и сохраняет свои CUE/VM/action контракты;
    Download сохраняет independent ownership и optional Core bridge. Диагностика
    и fixtures; проверить отсутствие закрытых ресурсов в student архивах.

12. [x] **Слить и выпустить инструменты по зависимостям.** Проверить owner PR,
    required checks и полный diff. Сначала Core, затем потребители с точными
    выпущенными pins; merge в main и проверка merged SHA до каждого выпуска.
    Версии выбрать по фактическому breaking изменению, не подставлять старую
    таблицу и не заменять опубликованные теги/assets. Проверить установку через
    штатный Quarto из новых тегов. Зафиксировать таблицу repo/tag/SHA/pins.

13. [x] **Пересобрать и выпустить готовые группы демонстраций.** У производителей
    обновить русские QMD, примеры разметки и native source-ссылки, убрать тестовые
    маркеры. Core/composition/QRC/Print/PL/Moodle/Cloud/external: чистые merged
    SHA, новые точные зависимости, BUILD sourceDirty:false. Проверить HTML,
    QRC, ресурсы и реальные PDF/XML/PL outputs; скачать draft assets и сверить
    hashes/provenance до окончательной публикации. Download отдельной группы
    не требует. Результат: новые неизменяемые готовые assets, старые сохранены.

14. [x] **Обновить и проверить документацию-шаблон.** Владелец
    [quarto-template-course](../../../quarto-template-course/docs/plans/2026-10-08-implementation.md).
    Перенести внешнее поведение спецификаций в русское authoring-руководство:
    сценарий, минимальная копируемая разметка, результат и рекомендация.
    Синхронизировать банковские правила/решения/roles/stage/preview/time,
    answer forms, адаптеры, профили/форматы, composition/QRC/resources/source.
    Добавить заметку о Windows-путях. Обновить точные assets, навигацию и checks;
    выполнить `task install`, `task fetch`, `task render`, `task check` и
    `python3 tests/fetch.py`. PR шаблона слить после проверок в main.

15. [x] **Опубликовать проверенную документацию штатно через gh-pages.** На
    чистом проверенном main шаблона повторить install/fetch/render/check,
    выполнить существующий `task publish`, использующий
    `quarto publish gh-pages --no-render`. Сохранить соответствие main SHA,
    pins/assets и опубликованной ревизии. Pages настроить на ветку gh-pages;
    PR-проверки сайт не публикуют. Проверить live URL, руководство, примеры,
    source-ссылки, поиск и ресурсы. Обходной artifact deployment не вводить.

16. [x] **Создать новый открытый PR Cybersecurity.** Владелец
    [Cybersecurity PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4).
    Проверить фактический head/remote [PR #3](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/3).
    PR #3 уже MERGED; пользователь прямо разрешил новый PR, который остаётся OPEN.
   В сохранённой рабочей ветке установить точные новые релизы в корень/theory/task/seminars,
    убрать необходимость ручных локальных patches и однократно адаптировать
    авторскую разметку по опубликованному руководству. Проверить student/full,
    закрытые назначения/решения, CI Quarto 1.11.5 и strict child render.
    Написать title/body нового PR по финальному результату с проверками и ограничениями;
    прикрепить его к задаче Codex. PR оставить OPEN, курс не сливать/не публиковать.

17. [x] **Очистить ветки инструментов и шаблона после всех основных изменений.**
    Повторно инвентаризировать LOCAL/REMOTE refs, worktrees, уникальные изменения
    и OPEN PR. Авторов автоматических PR подтвердить GitHub API и происхождением
    automation, а не префиксом ветки. Все нужные human/dirty/unmerged изменения
    уже должны быть в проверенном main либо сохранённой Git-истории владельца;
    human PR сначала завершить интеграцией. Удалить остальные локальные и
    удалённые ветки, перед удалением снова проверить keep-set. Сохранить `main`,
    служебную `gh-pages` публикации и точные heads OPEN automatic PR, а также теги
    и Releases. Учесть fork head repository и занятые worktrees. Cybersecurity
    не чистить. Итог: свежая таблица refs, работающие Pages и открытый PR курса.

18. [x] **Закрыть передачу результатов.** В планах владельцев сохранить итоговые
    теги/SHA, реальные проверки и ссылки на сайт/PR; обновить START-CODEX как
    краткий маршрут к действующим контрактам. Удалить принятые-next/завершённые
    планы из активной ветки после Git-сохранения; исторические выводы доступны
    по коммитам, выпущенные спецификации — по тегам. Проверить отсутствие
    противоречий между кодом, README, spec, руководством и примерами.

## Разнесение истории без нового репозитория

| Материал вне Git владельца | Где сохранить до очистки |
| --- | --- |
| Учебная модель, identity, authoring, диагностика Core | `quarto-course` |
| Composition/subprojects/resource ownership | `quarto-project-publish`; Download получает свою часть |
| QRC/межпроектные адреса и публикация каталогов | `quarto-reference-catalog` |
| Print/Moodle/PL/Cloud исследования и собственные контракты | Соответствующий адаптер |
| Сайт руководства, source, готовые демо и Pages | `quarto-template-course` |
| Cybersecurity migration/authoring и Windows воспроизведения | `/home/tolya/Cybersecurity` |

Mixed документы разделить по содержанию с указанием исходного пути/даты и
сохранить исходный снимок в истории владельца перед удалением. Не оставлять
в текущих spec/docs исторические документы, формулирующие другой контракт;
не подменять этим сохранение ещё не закоммиченных материалов.

## Проверка целостности перед завершением

Пять обязательных регрессий: native `exr/sol` вне банка; hidden-invalid raw
задача внутри банка; student без restricted ссылок/тел/ресурсов при полноценном
full; restricted participant экспорт без ключа/preview; partial preview без
ложной суммы/старой модели. Они принадлежат шагам 3–11 и owner fixtures.

Серьёзное новое расхождение контракта показывать пакетом: конкретная ситуация,
минимальный QMD, фактический результат и 2–3 варианта. До ответа продолжать
независимые пункты. Уже согласованные решения не открывать заново; обычные
детали реализации выбирать по нативным API и минимальному коду.

Справка о штатной публикации:
[Quarto GitHub Pages](https://quarto.org/docs/publishing/github-pages.html).


## Журнал текущего выполнения

- Старт: 8 октября 2026, 02:36 Europe/Minsk; дедлайн: 11:36.
- Core исходные планы и общие historical snapshots: `17bdd7d`; свежий
  `origin/main` v3.0.2 включён коммитом `eb9e66d`; индекс и карта локальных
  worktrees/refs сохранены в `0502085`. Runtime ещё не изменён.
- Cybersecurity dirty state, Windows patches, два CI fixtures и намеренные
  удаления сохранены в локальном `9853fb3` до миграции.
- GitHub PR Cybersecurity #3 фактически MERGED (head `3d0410e`). Прямой ответ
  пользователя 8 октября: **создать новый PR Cybersecurity и оставить OPEN**.
  Это заменяет требование продолжать PR #3 в пунктах 16–18; запрет merge/deploy
  курса и исключение его веток из очистки остаются действующими.
- Quarto 1.11.5 установлен; для CUE использовать
  `/home/tolya/course-tools/local-tools/cue/cue` v0.17.1. Системный CUE иной версии.

Подготовка пунктов 1–2: independent review — 147 snapshot records совпали с Git
bytes/SHA256, 9 origin/main ancestry, 13 сохранённых дополнительных checkout.
Critical/Important нет. Два Core metadata/report Minor входят в документальную
часть пунктов 3–5. Runtime GO выдан после сохранения/проверки всех владельцев.

## Финальный локальный gate 8 октября 2026

Core runtime `0ddb463`: полный npm test с native/CUE/Body и тремя browser suites — exit 0.
Installed Core examples — student/full/Reveal/partial и три selected Body экспорта — exit 0.
Publisher → QRC: native composition, все domain modes/child profiles/preview, source/HTTP/browser — exit 0.
Пять адаптеров: 14/14 команд exit 0; Print 56 тестов и реальные PDF, Moodle 84 и keyed XML,
PrairieLearn 6 Java checks и ожидаемый отказ starter, Cloud guards, Download ZIP/install matrix.
Ревью Core и всех семи потребителей Approved, обязательных замечаний нет.
CI/merge/immutable releases/ready assets/Pages пунктов12–15 завершены.
Новый Course PR#4 OPEN; required CI SUCCESS на exact head,16 выполнен;17–18 ожидаются.
Все исходные изменения и выполненные тестовые исправления сохранены в Git владельцев.

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


## Финальный архивный checkpoint: шаги 17–18 (2026-10-08T07:58:45.289496+00:00)

Шаг 17 выполнен: 46 LOCAL и 11 REMOTE веток удалены; 11 checkout переведены
в detached HEAD без изменения HEAD/bytes/status. Все tags и 61 Releases
сохранены; main, native serving gh-pages и API-confirmed OPEN bot heads
сохранены. Все 13 исходных пользовательских checkout и Course исключены
из удаления. Квитанции before/after/operations/verified-cleanup сохраняются
в Core архивном checkpoint до очистки активных исторических документов.

Шаг 18: итоговый маршрут подготовлен к проверенной передаче. Последние планы,
ROOT START/AGENTS, root ledger и квитанции сохранены этим Git checkpoint
до удаления exact known completed plans/stub/metadata/root snapshots и
новых датированных completion trees. Текущие контракты остаются в spec/index;
итоговые факты — docs/releases/2026-10-08-implementation.md. Финальная
проверка удаления и ссылок записывается после операции; итоговый docs commit
и push выполняются после независимого review.

Текущий Course PR #4 OPEN: b6b085cf0541785d11159bd9a106cd131dfabaf0,
CI 37743840665 SUCCESS, publication SKIPPED. Course docs отсутствует:
36 файлов сохранены в Git fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c
до удаления по прямому указанию пользователя. Course не merge/deploy;
его README, 667 runtime и 43 authored источника не менялись при очистке.
