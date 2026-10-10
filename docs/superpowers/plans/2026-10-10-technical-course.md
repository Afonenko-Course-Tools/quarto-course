# План технического внедрения Java / System Practice

Авторизация: пользователь выбрал T-01, T-02, T-03, T-04, T-05, T-06, T-13; 10 октября разрешил параллельное выполнение всеми четырьмя слотами и worktrees. Для сопоставления курсов использовать только OPEN PR Java #7 и Cybersecurity #4.

Цель: подтвердить актуальную совместимую основу, внедрить настройки и пример презентаций, собрать и опубликовать System Practice из готовых 26 карточек, закрепить русский язык постоянными правилами.

Архитектура: native Quarto, действующие контракты владельцев, штатные profiles/include/Reveal и явные Core/QRC/Publisher. Без нового общего runtime или авторского контроля покрытия.

Входы: START-CODEX.md; current индексы владельцев; /home/tolya/Загрузки/java-course-handoff-2026-10-10/tasks/T-{01,02,03,04,05,06,13}.md; COURSE-STRUCTURE.md, программа и 26 карточек System Practice.

## Зависимости и результат

- [ ] T-01: актуальные OPEN PR SHA, версии владельцев, native команды; результат — baseline.json и отчёт совместимости.
- [ ] T-02 после T-01: поддерживаемый native YAML/CSS/Presentation, justified paragraphs/last-line-left/lang ru; реальная native сборка и визуальная проверка.
- [ ] T-03 после T-01: YAML title, ## раздел, ### слайд, продолжения и навигация; native пример и тесты доказанных дефектов.
- [ ] T-04 после T-01: portal, headings/selected links theory/reference, canonical 26 cards, 180/360min work routes; native build, ссылки и источники.
- [ ] T-05 после T-04: проверить отсутствие/доступ, сохранить существующие материалы; отдельная branch/OPEN PR либо новый repo.
- [ ] T-06 после T-05: штатная публикация и карта фактических URL/якорей.
- [ ] T-13 независим: общий источник русского языка, согласованные repo instructions и PR templates; без массового перевода A-11.

## Ограничения

Сохранять пользовательские деревья, main/default branches, служебные gh-pages, heads OPEN bot PR, все tags/Releases. Корень course-tools не Git repo, не создавать его. Внешние действия выполняет координатор. При code changes тесты/реализация medium; материалы/spec/README/docs/template/projects ultra. Финал: новые выпуски затронутых инструментов, штатная документация gh-pages, новый OPEN PR Cybersecurity, cleanup только tools/template после сохранения истории. Слияние и публикация имеют отдельные статусы. 9 часов исполнения с 2026-10-10 19:31 UTC.

## Параллельные владельцы

Presentation: T-02/T-03 в отдельном Core worktree. System Practice: T-04 и подготовка T-05/T-06 в отдельном owner worktree. Russian policy: T-13 в изолированных owner worktrees. Координатор: T-01, интеграция, ревью, публикация/releases/cleanup.

## Проверка перед интеграцией

T-02/T-03 используют одни Presentation/Navigation examples: объединить проверки и не дублировать runtime. T-13/Core изменяет только самостоятельную policy и AGENTS/PR templates; presentation agent владеет component docs. T-04/T-13 имеют общий вход языкового правила, project README пишет System Practice agent. T-05 получает готовое дерево T-04; T-06 публикует именно проверенный commit, не локальный смешанный источник.
