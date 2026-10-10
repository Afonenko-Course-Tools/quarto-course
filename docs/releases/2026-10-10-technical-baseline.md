---
type: implementation-baseline
status: historical
updated: 2026-10-10
---

# T-01: техническая основа на 10 октября 2026 года

Этот отчёт фиксирует выбранную основу перед реализацией T-02, T-03, T-04, T-05, T-06 и T-13. Он не подтверждает будущие выпуски, слияния, публикацию документации, приёмку Platform или готовность курса Java. Прямые решения пользователя и current контракты владельцев имеют приоритет над историческими планами.

Начало общего исполнения — `2026-10-10T19:31:10Z` по `baseline.json`; выделено 9 часов. Корень `/home/tolya/course-tools` не является Git-репозиторием. Исходные рабочие деревья пользователей сохранены; задачи выполняются в отдельных рабочих деревьях существующих владельцев.

## Единственные образцы курсов

| Курс | Открытый PR | Точный head |
| --- | --- | --- |
| Java | [PR #7](https://github.com/BSU-RFCT-Afonenko-Courses/Java/pull/7) | `960af5aa94ab5bf381395366987ffb1c676f983a` |
| Cybersecurity | [PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4) | `8404bc79105708caa509d2fdcee7cbaaee9ee451` |

Состояния этих PR зафиксированы как OPEN. Для сравнений не используются default branches курсов и не смешиваются их прежние настройки с новым форматом PR. Получение refs и чтение default branch metadata служат только инвентаризации. Ошибка доступа не приравнивается к отсутствию репозитория.

Установленные пакеты выбранных PR проверены по `pr-package-integrity.json`: у Java 24 каталога пакетов / 968 файлов, у Cybersecurity 18 каталогов / 650 файлов. Во всех 42 записях `differences` и `extraFiles` пусты. Проверка состава пакетов не заменяет рендер курса и не подтверждает внешнюю интеграцию.

## Исходные refs владельцев

После свежего fetch локальные основные ветки Core, PrairieLearn и Download оказались отстававшими. Выбранные рабочие ветки созданы от фактических `origin/main`; пользовательские checkout не обновлялись. У остальных владельцев исходные refs совпали с локальными.

| Владелец | Точный source SHA | Версия descriptor этого ref |
| --- | --- | --- |
| `quarto-course` | `d9c764823beee6ea45af1d7093933382aafce663` | `5.0.1` |
| `quarto-project-publish` | `2935a9b9de089daea4e5f48e88f8c08358fad938` | `5.0.0` |
| `quarto-reference-catalog` | `ae0af85f7303d9d79de4f0b0715dbe61b3f651df` | `3.0.0` |
| `quarto-course-print` | `25b8c6950c7d23e43e8240bfceb88c6ddfe6a34d` | `0.3.0` |
| `quarto-course-moodle` | `03abf4a78649ec95726260a02473d4c0bc6fff3d` | `0.3.0` |
| `quarto-course-prairielearn` | `4a83958ed6ad3902dc23cfd6be01944ff2f61b65` | `5.0.0` |
| `quarto-course-cloud` | `4b1ac644017f72575210e6b2ff2aa10be83e3aa8` | `3.0.0` |
| `quarto-project-download` | `6fb3945020cd74fda40cc4d333389864e06609b5` | `3.0.0` |

Template `main` на старте сохранял прежнее руководство Core 4.0.1. Для нового документационного изменения отдельно выбран сохранённый draft [PR #21](https://github.com/Afonenko-Course-Tools/quarto-template-course/pull/21), точный head `13fa3da421ddffabdd9281c9e2794e25f7664145`. Он согласует руководство с Core 5.0.1; исходный draft остаётся OPEN без изменения и не объявляется автоматически принятым или опубликованным.

## Подтверждённые опубликованные выпуски

`published-baseline.json` содержит ответы GitHub Releases с exit 0. Для четырёх перечисленных выпусков `isDraft:false` и `isPrerelease:false`:

| Владелец | Выпуск | Source SHA выпуска | Время публикации UTC |
| --- | --- | --- | --- |
| `quarto-course` | [v5.0.1](https://github.com/Afonenko-Course-Tools/quarto-course/releases/tag/v5.0.1) | `d9c764823beee6ea45af1d7093933382aafce663` | `2026-10-10T13:37:12Z` |
| `quarto-project-publish` | [v5.0.0](https://github.com/Afonenko-Course-Tools/quarto-project-publish/releases/tag/v5.0.0) | `215309b5c41669e56a857a1bc3e4f7f2ce782c5f` | `2026-10-08T03:31:31Z` |
| `quarto-reference-catalog` | [v3.0.0](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog/releases/tag/v3.0.0) | `559583805a514ae8a244b6ea4cb5124867064024` | `2026-10-08T03:41:11Z` |
| `quarto-project-download` | [v3.0.0](https://github.com/Afonenko-Course-Tools/quarto-project-download/releases/tag/v3.0.0) | `6fb3945020cd74fda40cc4d333389864e06609b5` | `2026-10-10T10:10:06Z` |

Source SHA выпущенного Publisher/QRC отличается от свежего `main` с последующими документальными коммитами. Версия установленного пакета и API читаются по его точному ref; `main` и неизменяемый выпуск не подменяют друг друга. В таблице source refs выше PrairieLearn имеет descriptor 5.0.0; она фиксирует исходники текущего владельца, а не самостоятельно доказывает публикацию его Release.

Выбранный проверяемый набор: Core / Presentation / Navigation 5.0.1, Publisher 5.0.0, QRC 3.0.0, Download 3.0.0, Quarto 1.11.5 и CUE 0.17.1. Матрица Core 5.0.0 также задаёт согласованные потребительские контракты; их наличие не означает, что прошли все платформенные приёмочные этапы.

## Архитектура и узкий способ реализации

Прочитаны общие `AGENTS.md` / `START-CODEX.md`, current индексы владельцев и архитектура Core. Quarto сохраняет владение Markdown, проектами, профилями, вычислениями, книгами и Reveal. Core проверяет банковскую модель, Presentation оформляет материал, Navigation работает с готовой native презентацией, Publisher явно объединяет подпроекты, QRC владеет адресами межпроектных ссылок.

Для T-02 используется штатное `format.revealjs.css` с `lang: ru`: выравнивание обычных абзацев по ширине, последняя строка слева, заголовки/код/вывод слева. Для T-03 сохраняется YAML `title` / `##` / `###` с `shift-heading-level-by: -1`, `slide-level: 2`, `navigation-mode: linear`; граница `---` создаёт продолжение текущего раздела. Новый параметр Presentation, общий runtime и слой обратной совместимости не требуются.

Для System Practice источник — согласованный набор 26 карточек и структуры handoff. На этапе выбора репозитория состояние API подтверждало отсутствие `BSU-RFCT-Afonenko-Courses/System-Practice`; ошибка сети не использовалась как это подтверждение. Перед связыванием Java должны быть получены реальные страницы и проверены адресные QRC либо обычные внешние ссылки.

T-13 вводит единый [источник языкового правила](../russian-language-policy.md), краткие локальные инструкции и русские шаблоны. Массовый перевод A-11 остаётся отдельной работой. Новые README, документы и описания PR сразу русские; команды, идентификаторы API, пути, имена пакетов и URL сохраняются буквально.

## Выполненная локальная проверка и её границы

Core baseline quick завершился с exit 0 и итогом `PASS --quick` в `core-baseline-quick.log`. Индивидуальные журналы подтверждают согласованный словарь, TypeScript-проверку, модели и native lifecycle, project/check facts, inherited defaults, Body, contextual Download исключение до публичного resource inventory, CUE validation, privacy проекцию и ресурсные границы. В `system-toolchain.log` зафиксированы настоящий публичный Quarto executable 1.11.5, Deno 2.7.14 и сохранение кодов/причин внешних ошибок. Quick-набор не заменяет финальный полный прогон и CI.

Cybersecurity student-рендер завершился с exit 0; `cybersecurity-pr4-student.log` завершён сообщением `Профиль student собран` и результатом `_site-student/index.html`. Финальные QRC сведения портала: разрешено 23 ссылки, отложено 0, целей 25, страниц 21. Это локальный student-рендер выбранного PR; новый курсный PR, его CI и публикация не выводятся из этого журнала.

Java student-рендер завершился с exit 0; журнал содержит `_site-student/index.html` и QRC 367 / 0 / 921 / 95. Окончательные коды всех трёх процессов и точные source SHA зафиксированы исполнителем в `baseline-exits.json` в `2026-10-10T19:55:54Z`. Завершение student-рендера само по себе не подтверждает проверку Java25/JUnit, анонимное получение GHCR образов или Moodle readback.

## Ожидающие внешние этапы

Сохранённый Template draft прямо отделяет фактически слитый Platform source `0083e3e102f47860cabc1d1e62e6434353f5c4c6` и закреплённые Java/Community OCI digests от ожидаемого source tag v1.0.1, анонимного GHCR pull и приёмки точного Java head. Введение нативного примера презентации и языковой политики не закрывает эти этапы.

Последующие изменения пакета должны пройти проверку локально, затем CI, получить новые immutable releases и отдельную проверку установки. Документация публикуется штатно в `gh-pages`; Cybersecurity передаётся через новый OPEN PR. Существующие heads OPEN PR, пользовательские рабочие деревья, `main`, служебная `gh-pages`, теги и Releases сохраняются.

## Источники свидетельств

Снимки получены в `/home/tolya/course-tools/handoffs/technical-20261010`. Этот отчёт переносит проверяемые значения; исходные JSON и журналы должны сохраняться в Git истории владельца до очистки временных данных. SHA-256 входных снимков:

| Файл | SHA-256 |
| --- | --- |
| `baseline.json` | `b257f93b2d8f21287c2033d91cdef8d4c259798c2fbff6c74ee980bd4f02997c` |
| `published-baseline.json` | `94fb2d8632d53813fc683f7947a1663cbc2a7ae07232d7ab06c9bea9ebb6b6a0` |
| `pr-package-integrity.json` | `20db4b4b4125d7590c013e896572c9c39019cf135628e45ecacb711f0cab4e08` |
| `core-baseline-quick.log` | `66f796e072ee7ba98ba7d6a18897f956259f7749edcf86e098b81011687c4e3e` |
| `cybersecurity-pr4-student.log` | `8d32c7552346906fa21afd82aa34dfa1a3dfc884dcc588eeaa6df5c86f8f7e56` |
| `baseline-exits.json` | `6f58bd9d6fb46ac848296f426c4fff85689991da440f20aa90f269981f08c8bb` |
| `java-pr7-student.log` | `cda20368db18b6a34a9e6e979513b9c7b1c0f94780aeaf01e2dba1797fe487c2` |
