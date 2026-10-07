> Исторический план/исследование. Актуальный маршрут от 8 октября 2026: [план владельца](2026-10-08-implementation.md).
> Исходный текст сохранён без правок; его старые статусы и конфликтующие правила не действуют.
> Нужные материалы сохранить в Git до удаления из активной ветки.

# Модель курса и экспорт заданий

План репозитория `quarto-course`: границы нативной разметки и экспортной модели, идентичность курса, банк заданий, состав работ и полный исходный вход экспорта.

Общие решения, ограничения и порядок выпуска: [межрепозиторный план](../../../specs/course-change-plan.md). Перед изменением поведения — анализ актуальной архитектуры и необходимый рефакторинг. Поддерживается только актуальный авторский формат без обратной совместимости; публичные функции Quarto переиспользуются. Код, спецификации, README и примеры обновляются согласованно в соответствующем PR.

Исследования: [идентичность](course-identity-review.md), [задания и назначения](assignment-display-review.md).

### Этап 1 Нативная разметка и идентичность объектов

- [x] Разобрать исходные требования к `course.id` и owner по [обзору идентичности](course-identity-review.md).
- [x] Разделить нативное учебное оформление, логический курс, область сборки модели и выбранный экспортный корпус.
- [x] Задавать `course.id` один раз в корне логического курса; передавать его сборщиком в экспортный контекст. Запускать экспорт из корня с выбором книги и работы.
- [x] Поддерживать один экспортный банк заданий и работ на курс; путь книги выбирается при запуске экспорта, отдельный bank.id не вводится. Формировать ключ задания из Course ID и Exercise ID, работы — из Course ID и Work ID; проверять уникальность в банке. Повторное использование одного задания в нескольких работах не является коллизией.
- [x] Убрать обязательность искусственного ID проекта для обычного оформления. Отсутствие ID не мешает обычному рендеру; экспорт с устойчивыми ключами требует идентичности курса.
- [x] Разрешить нативные `exr-*` в разных материалах. Выбирать задания для экспорта по составу выбранной работы в её книге; не требовать дополнительный `target="manual"` и не менять смысл Quarto-префикса. Внешние ссылки QRC не импортируют тела заданий.
- [x] Сохранить обычные `sol-*` и заголовки без обязательной экспортной связи по суффиксу или `sec-*`. Правила связывания ответа с заданием и адресации работы применять в явно выбранном экспортном контексте.
- [x] Сделать `course-role` и `difficulty` необязательными также при экспорте. Проверять явно указанные значения и требования выбранного адаптера в контексте экспортируемых заданий.
- [x] Получать для экспорта полные исходные данные выбранной работы до фильтрации по аудитории; формировать публичную и закрытую части по требованиям адаптера. Не связывать экспорт с наличием опубликованного `full` или полным HTML-рендером; сохранять функциональные профили задания.
- [x] Включать контрольные `.qmd` в полный исходный корпус экспорта, даже если они отсутствуют в student-списке рендера. Разделить условие для участника LMS и наличие страницы на открытом сайте; приватные ответы и комментарии не включать в текст условия.
- [x] Заменить отдельные списки оцениваемых работ и раздаток общим `.task-items`; сохранять единственный авторский состав для веба, Print и LMS. Уточнить запись обязательных/дополнительных включений; дополнительные не заменяют обязательные. Правила оценки хранить только в платформенно специфичном формате.
- [x] При различии состава или обязательности для специальностей задавать отдельные страницы работ с собственными ID и явными списками. Маршруты специальностей выбирают соответствующую работу; параметры просмотра и экспорта не меняют её состав.
- [x] Сохранять ссылки на исходные условия в первом веб-интерфейсе; не добавлять скрытый перенос условий или решений. Штатный предпросмотр не объявлять полной гарантией для изображений, сносок и произвольных виджетов.
- [x] Выбирать задания и ресурсы работы до построения body transport и проверки возможностей выбранного адаптера. Неназначенные задачи широкого банка не включаются в пакет конкретной работы и не обязаны участвовать хотя бы в одной работе курса.
- [x] Сохранить независимость identity исходного объекта, платформенных ID, QRC namespace, ID цели и пути проекта.

Проверки результата: обычное упражнение в теории и презентации без owner, target и обязательных метаданных; явно выбранный экспорт без необходимых ключей; перенос файла без смены ключа; коллизия заданий или работ в единственном экспортном банке; повторное использование задания в нескольких работах; одинаковые ID в обычной разметке независимых проектов; отсутствие задания в исходниках выбранной книги; полный экспорт при наличии только студенческой публикации.

## Реализация на актуальной базе 6 октября

База после обновления: `213a77c` / v2.1.1, ветка `feat/course-contract-20261006`. Анализ: `local-evidence/2026-10-06-core-architecture.md` в рабочем каталоге инструментов. Старый owner-preflight удалён; сохраняются лёгкие hooks текущего native render без повторных рендеров.

- [x] Проверка обычного native exr/exm/sol без ID курса, обязательных role/difficulty/topic и экспортной связи; затем ослабление обычного валидатора, типов и CUE с проверкой явно заданных значений.
- [x] Проверка mixed HTML/Reveal и самостоятельных областей ID проектов; перенос глобальной уникальности в выбранный банк экспорта.
- [x] Единственный `.task-items`; список native cross-ref, optional на Span `requirement="optional"`, `items` плюс `requirements`; required по умолчанию для оцениваемых работ, отсутствие статуса для неоцениваемой раздатки.
- [x] Отбор одной работы и замыкания её задач до построения тел/ресурсов/проверки возможностей; отказ от обязательного target manual.
- [x] Полные исходные экспортные факты до audience projection; student HTML не ограничивает контрольные и закрытые данные выбранного экспорта.
- [x] Root CLI `export.ts --book ПУТЬ --work ID --output ПАКЕТ --profile ФУНКЦИОНАЛЬНЫЕ-ПРОФИЛИ`; course.id только из корня. Штатный JSON writer через временный экспортный profile/project context, без подготовки полного HTML и собственного QMD-парсера.
- [x] Одновременное обновление README, спецификаций, схем, руководств и примеров; focused native/transport/CLI тесты, полный текущий npm test, измерение времени.

Решение реализации: сохранять строки `items` адаптеров и отдельную карту обязательности; это снижает изменение транспортных потребителей и не вводит общую модель оценки. JSON writer напрямую не поддерживается native book (проверено Quarto 1.11.5); экспортный context меняет только штатный тип проекта для исходного прохода и сохраняет функциональные профили.


Результат реализации 7 октября: Core принимает обычные native элементы без
экспортной идентичности и обязательных метаданных; task-items хранит местный
состав и requirements. Выбранный root export выполняет один native JSON pass
без HTML, затем выбирает work closure до Body capabilities и чтения native
writer AST выбранных документов. Полные исходники включают control вне chapter
lists. Native shortcode timing потребовал отдельный public projection wrapper
в том же JSON pass: public/private AST не смешиваются, native profile predicate
обрабатывается с AND/invert, остальные predicates остаются Quarto. Выбранный
неразрешённый QRC marker отклоняется, неиспользуемый допускается. CUE export
нормализует answer bank один раз; Body повторно использует нормализованные ключи.

Focused проверки: course-contract, selected-export, root-export (в том числе
установленная группа Core/Presentation/QRC/Download, отсутствие HTML, временный
profile cleanup, контрольные исходники, optional status, public leak
visible/hidden combined predicates, неиспользуемая работа с missing member),
visibility, native-document, native-body-render, pedagogy, solution-pairing и
quick-suite успешны. Один root-export тест с тремя native source passes занимал
14–36 секунд при параллельной работе. Базовая native-document проверка: 26
native команд / 77.8 секунд. Полный текущий npm test запущен; окончательный
результат и длительность фиксируются перед PR. Подготовлена breaking версия
v3.0.0; публикации пока нет. Демонстрацию examples/course и release artifact
подготавливает общий этап Presentation/документации.


Окончательная проверка текущего дерева: полный `npm test` PASS, evidence
`/tmp/course-native-check-20261007-005338`, итоговый журнал
`local-evidence/implementation-2026-10-06/core-full-suite-verified.log`.
Включены реальные native writer/render, CUE/model/typechecks, raw answers,
selected source export, generated PDF/resources, Presentation/Navigation и
браузерные проверки. Финальный root-export тест: 4 source passes / 33.43 секунды;
native-document: 26 команд / 40.7 секунды. Полная проверка заняла около 5.6 минут.
Независимый review повторил native name/format attrs, .yaml profile и output-dir
регрессии и одобрил изменения. Условие source export не определяется внешними
student/full wrappers задачи/работы; private вложенные ветви исключены из
публичного условия, functional profiles сохраняются. Native CLI profile flag
учтён через QUARTO_PROFILE; --output-dir явно связывает служебный NativeRun.
Пример examples/course с native book+Reveal, Taskfile и BUILD provenance готов.
Следующий этап — PR/CI, merge и release v3.0.0 из проверенного коммита.


## Patch 3.0.1: native ownership выбранного банка

Core 3.0.0 вышел неизменяемым. Native recursive render glob захватывал QMD
вложенного отдельного Quarto-проекта: foreign ID мог ложно конфликтовать или
неявно удовлетворять missing member. Подтверждённые native воспроизведения:
core-export-scope-audit.log; собственные главы3 плюс slides/index.qmd в demo.
Исправление ветки fix/export-bank-ownership-20261007: до render использовать
public inspect inventory полного временного source context; public inspect
владельца одного representative файла на input directory, затем передать
Quarto явный список собственных input files. Собственный unpublished QMD
сохраняется, исходный HTML chapter list не определяет корпус. Никакого YAML
или glob resolver не добавляется. Native calls ограничены input directories.

- [x] RED: nested native duplicate ID ломает selected own-bank export; external
  task удовлетворяет missing member (оба подтверждены native CLI).
- [x] GREEN: nested duplicate/invalid declarations не рендерятся, missing member
  отклоняется, own-bank unpublished QMD сохраняется.
- [x] Обновить descriptors/README/demo refs3.0.1, документировать границу,
  focused tests и full current npm test, локальный commit для PR/CI/release.


Focused GREEN: core-bank-ownership-physical2.log — 3 native source renders и
ранний outside-source отказ / 20.87 секунд. Physical input paths проверяются
на containment до document inspection; native owner определяется по physical
representative и кешируется на directory. Root directory использует уже
полученный native inventory owner. Source alias к nested-owned QMD исключён;
обычный поддержанный alias.qmd→own-source.md сохранён. Hidden physical alias
подчиняется native input rules; дополнительная поддержка не изобретается.
Root-export профиль/аудитория/public privacy/QRC regression также успешен.
Полный npm test на Quarto1.11.5 запущен; далее focused ownership на1.10.18,
независимый review и локальный commit. Ранее выпущенные теги не изменяются.


Окончательный patch результат: полный текущий npm test на Quarto1.11.5 PASS,
`/tmp/course-native-check-20261007-022547`, журнал core-full-suite-patch1.log,
около5.5 минут. Focused ownership на Quarto1.10.18 PASS / 21.12 секунды;
на1.11.5 PASS / 20.87–21.65 секунды. Включены ordinary/render/CUE/typechecks,
public/private Body, native generated assets/PDF, Presentation/Navigation и
браузерные проверки. Новое поведение проверено на физическом source escape,
лексическом alias к nested-owned QMD, native-поддержанном own alias,
ложной коллизии ID, missing-member implicit import и unpublished own-bank QMD.
Runtime не менялся во время окончательной полной проверки. Локальный commit
готовится для PR/CI и выпуска3.0.1 плюс demo-20261007-patch1; старые релизы
и демо не перезаписываются.


### Окончательный выпуск 7 октября

Основной PR 22 и followup PR 23/24 слиты после финальных CI. Текущий immutable
bundle v3.0.1 выпущен из 0b1beee584cdb9708def5c4e73f83bc0e208954b,
Core/Presentation/Navigation имеют одну версию. Прежний demo tag
не перезаписан: исправленная группа demo-20261007-patch1 создана из этого же
чистого merged SHA с установленным штатным тегом 3.0.1. Native Task install/
render, 5 HTML/116 локальных ссылок и actual root-bank source export 1 question
проверены. Compact bundle и ready assets скачаны в draft и побайтно проверены
до immutable публикации. Потребители используют 3.0.1; опубликованные прочие
демо с собственным одиночным банком сохраняют проверенные зависимости 3.0.0.
Локальный полный набор и stable focused export прошли, оба финальных CI
успешны. Следующий этап относится к потребителю: документация main без Pages
и открытый PR курса. Отчёты сохранены в local-evidence/implementation-2026-10-06.

## Обсуждение рефакторинга 7 октября 2026

Согласованы требования к диагностике; рабочий код в этом обсуждении не менялся.

- Собственные сообщения расширений — на русском. Идентификатор относится
  к правилу и остаётся устойчивым при изменении формулировки сообщения.
  Внешние инструменты сохраняют свои идентификаторы и исходную диагностику;
  наше пояснение не подменяет их идентичность.
- Сообщение должно позволять найти проблему и исправить её: понятная причина,
  достоверный исходный файл, ID объекта и поле при наличии, связанное место
  для конфликта и подсказка. Точные строки QMD не обещаются без достоверных данных.
- Сборка авторского курса использует штатный `--fail-if-warnings`. Проверить,
  что предупреждения фильтров участвуют в штатном механизме Quarto/Pandoc.
  Организацию сборки инструментов сохранить; нового жёсткого запрета
  предупреждений не вводить.
- Несколько независимых ошибок можно собирать только там, где анализ подтвердит
  чистую архитектуру, прозрачность и минимум дополнительного кода. Если это
  требует сложного продолжения после ошибки или общего механизма накопления,
  сохранить остановку на первой ошибке.
- Контрпримеры и их исправленные варианты остаются внутренними тестами.
  Проверять ожидаемую диагностику и результат операции в существующих наборах.
  Справочник ошибок в документации не включает ошибочные исходники.

Следующий шаг — сопоставить production ID, именованные CUE-правила и свободные
сообщения, определить минимальный рефакторинг и покрытие внутренних тестов.
Отдельная проба tests/probes/diagnostics не считается готовым production
контрактом: её правила требуют сверки с текущей моделью; переносить её целиком
или добавлять ради диагностики новый парсер либо общий runtime не предполагается.

## План рефакторинга диагностики 7 октября 2026

**Цель:** улучшить сообщения, сохранив действующие правила, их ID и границы
обычного рендера и selected export. **Архитектура:** raw AST → validation →
projection → DocumentResult → NativeRun → Release/CUE → selected Body.
**Основание:** [согласованные требования и межрепозиторный план](../../../specs/course-change-plan.md#исследование-и-план-рефакторинга-7-октября-2026).
**Средства:** текущие Lua/TypeScript/CUE, Quarto 1.10.18/1.11.5; без нового парсера,
Graphlib, runtime registry или report schema. Для выполнения —
subagent-driven-development либо executing-plans по выбранному способу.

База main `0b1beee` подтверждена через GitHub. Собственные предупреждения
Core/Presentation сейчас отсутствуют; новый lint-набор не вводится.
`validateRelease` уже использует CUE `--all-errors`; остальные стадии сохраняют
первую ошибку. Проверки разных публичных API не считаются лишними только
потому, что их правила пересекаются.

### C1 Убрать подтверждённые повторы внутри raw-прохода

Файлы: `_extensions/course-core/native-document.lua`, `filter.lua`;
проверки: `tests/native-document.ts`, `pedagogy.ts`, `solution-pairing.ts`,
`course-contract.ts`. Интерфейс `native_document.validate(doc)` расширяется
третьим внутренним результатом `rawAssessment`; первые `canonical, domains`
сохраняются. `filter.lua` потребляет его вместо повторного `assessment.collect`.

- [ ] Зафиксировать одинаковые canonical facts/assessment items на корректном
  входе; hidden invalid declaration по-прежнему отклоняется; standalone
  native `exr/sol`, hint IDs и grading-notes сохраняют своё поведение.
- [ ] Удалить неиспользуемый `role` и повторные `contract.kind/metadata` перед
  `contract.describe`. Вернуть уже рассчитанный raw assessment из validate.
- [ ] Выполнить `quarto run tests/native-document.ts`, `tests/pedagogy.ts`,
  `tests/solution-pairing.ts`, `tests/course-contract.ts`; ожидается PASS.
- [ ] Провести review и отдельный commit этого cleanup до изменения сообщений.

Не удалять raw и projected `pedagogy.collect`: у них разные области видимости.
Не удалять guards assembleRelease, CUE и Body: их самостоятельные входы остаются.

### C2 Сохранить причины внешних отказов и native warning policy

Файлы: `_extensions/course-core/infrastructure/process.ts`,
`body-export/answer.ts`, `body-export/collect.ts`;
проверки: `tests/system-toolchain.ts`, `native-body.ts`, `root-export.ts`.
Внутренний интерфейс `command(executable, args, cwd, env={}) → Promise<string>`:
stdout результата; stderr видим; отказ определяется exit/невозможностью запуска.
Пятый аргумент `rejectWarnings` удаляется вместе с regex по stderr.

- [ ] В system-toolchain добавить fake child: exit 0 + `WARNING` остаётся
  успехом; nonzero с разными stdout/stderr сохраняет оба потока и код; missing
  executable сохраняет имя инструмента и причину. Это внутренние fixtures.
- [ ] Минимально изменить command без общей subprocess-библиотеки. Внешний
  отказ хранить как cause с `tool/exitCode/stdout/stderr`; не разбирать CUE stderr.
- [ ] Сохранить `ANSWER_YAML`/`ANSWER_INVALID`, перевести своё пояснение и
  передать исходную причину из YAML parser/CUE. Отказ запуска инструмента не
  описывать как доказанную ошибку ответа; собственные CUE rule IDs сохраняются.
- [ ] Проверить selected export при публичном `fail-if-warnings: true`:
  internal JSON source pass сохраняет разрешённые native warnings, а semantic
  invalid member по-прежнему отклоняется. В source render использовать явный
  native `--fail-if-warnings=false`, перекрывающий публичную конфигурацию;
  постоянную конфигурацию не менять. Проверить cleanup и функциональные профили.
- [ ] Выполнить `quarto run tests/system-toolchain.ts`, `tests/native-body.ts`,
  `tests/root-export.ts`; ожидаются PASS и отсутствие остаточного temp-профиля.
- [ ] Провести review и отдельный commit внешней границы.

Native Lua warning при необходимости выводить через `pandoc.log.warn`.
Пробы обеих версий показали, что `quarto.log.warning/error` — вывод, не гарантия
native warning counter/отказа. Неподходящие для source pass предупреждения
не переклассифицировать в новые предметные правила.

### C3 Русский контекст Lua без нового прохода

Создать `_extensions/course-core/diagnostics.lua` с локальными
`format(code, message, context?) → string`, `fail(code, message, context?)`.
Контекст: только `source, id, field, related, hint`, когда они известны.
Runtime-пути ниже относительно `_extensions/course-core/`.
Изменить: `native-document.lua`, `pedagogy/contract.lua`, `pedagogy/collect.lua`,
`visibility.lua`, `assessment.lua`, `native-answers.lua`, `native-adapters.lua`,
`filter.lua`, `output.lua`, `native-resources.lua`.
Не создавать общий пакет для других расширений.

- [ ] Дополнить существующие invalid fixtures проверкой прежнего ID, входного
  документа/объекта/поля и полезного пояснения; корректный вариант проходит.
  Для двух объявлений проверить оба ID/контекст; include не получает выдуманный span.
- [ ] Перевести собственные сообщения, передавать контекст в guard без изменения
  предиката. Сохранить `CORE.COURSE_INVALID`, `CORE.EXERCISE_INVALID`,
  `CORE.ASSESSMENT_INVALID`, `CORE.DUPLICATE_DECLARATION` и другие текущие ID.
- [ ] Прежним неименованным guards назначить `CORE.METADATA_INVALID`,
  `CORE.PEDAGOGY_CONFIG_INVALID`, `CORE.PEDAGOGY_ROLE_INVALID`,
  `CORE.PEDAGOGY_ATTRIBUTE_INVALID`, `CORE.PEDAGOGY_REFERENCE_INVALID`,
  `CORE.PEDAGOGY_REFERENCE_CONFLICT`, `CORE.VIEW_INVALID`,
  `CORE.PROFILES_INVALID`, `CORE.VISIBILITY_INVALID` по соответствующему guard.
  Неименованный guard course.schema получает `CORE.SCHEMA_INVALID`;
  NATIVE.RUN_POINTER_INVALID/NATIVE.RUN_DIRECTORY_INVALID и
  RESOURCE.PROJECT_PATH_INVALID сохраняются, получают русский контекст.
  Новых требований к необязательным role/difficulty не вводить.
- [ ] Выполнить native-document, pedagogy, visibility, solution-pairing,
  native-run и native-project-resources через `quarto run tests/<имя>.ts`;
  проверить plain standalone и installed filter path. Ожидается PASS.
- [ ] Проверка изменений и коммит; отрицательные QMD остаются только в tests.

### C4 Контекст TS и узкая граница CLI

Создать `_extensions/course-core/domain/diagnostics.ts`:
`diagnostic(code:string, message:string, context?:DiagnosticContext,
cause?:unknown) → Error & {code:string}`. DiagnosticContext имеет те же
необязательные поля source/id/field/related/hint; это внутренний тип, не Body API.
Изменить: `domain/release.ts`, `assemble.ts`, `body-export/producer.ts`,
`collect.ts`, `answer.ts`, `infrastructure/files.ts`, `adapters.ts`,
`native-run.ts`, `resources.ts`, `validate.ts`, `entrypoints/check.ts`,
`post.ts`, `export.ts`. Публичные подписи этих API сохраняются.

- [ ] В native-release проверить `CORE.DUPLICATE_EXERCISE` и
  `CORE.DUPLICATE_ASSESSMENT` с текущим и первым source; `CORE.UNKNOWN_MEMBER`
  содержит source/ID работы и поле items. Корректная модель не меняется.
- [ ] Заменить локальные Set для дублей на Map первого объявления, обогатить
  существующие guards русским текстом. Не добавлять accumulator или обход recovery.
- [ ] У Body/ресурсов передавать уже известный document/question/work context;
  для validateAnswer/projectChoice разрешить optional `{source,id}`. Сохранить
  `BODY.*`, `RESOURCE.*`, `EXPORT.*`, `NATIVE.*`, `RELEASE.*`, `ADAPTER`.
- [ ] В entrypoints выводить ожидаемую именованную ошибку однократно и завершать
  неуспешно; неизвестное исключение оставлять для native stack. Foreign failure
  сохраняет исходные потоки и ID, без нового публичного JSON-отчёта.
- [ ] Добавить внутренний отрицательный CLI-тест в tests/system-toolchain.ts:
  после CLI catch чужой marker/exit и оба потока fake tool остаются видны
  по одному разу. Сохранённый в памяти cause нельзя потерять при печати message.
- [ ] Выполнить native-release, native-run, native-resources, native-body,
  selected-export, root-export, export-bank-ownership; ожидается PASS.
- [ ] Проверка изменений и коммит. Проверить отсутствие конечного экспорта после отказа.

### C5 Документация и окончательная проверка

Создать: `docs/diagnostics.md`; изменить: README, `spec/plugin-architecture.md`,
`docs/native-run.md`, `docs/body-export.md`, `docs/presentation.md` и остальные
активные собственные руководства/spec, содержащие английские объяснения.
Исторические evidence, vendor-документы/лицензии и API-имена не переписывать.

- [ ] Таблица ID, краткого смысла, доступного контекста и действия автора;
  для CUE сохранить именованные поля, не объявлять их aliases runtime ID.
  Документировать strict публичный render и отдельный internal source pass.
- [ ] Сверить каждую затронутую запись справочника с guard и внутренним negative
  fixture; в справочнике только объяснения и корректные примеры.
- [ ] Выполнить vocabulary sync, canonical-model и действующий `npm test`
  на обеих версиях Quarto с существующим набором сред и browser dependencies.
  Инструментальный CI и его политика предупреждений не расширяются.
- [ ] Проверка изменений всего Core; согласовать README/spec/tests в PR. Версию выбирать
  по окончательному изменению, выпускать из проверенного merged SHA.

Отдельные задачи Presentation находятся в её owner-плане. Installed consumer
проверки и ready demo release следуют общему плану групп; схема Body и число
source render не меняются. Проба tests/probes/diagnostics остаётся исследованием.
