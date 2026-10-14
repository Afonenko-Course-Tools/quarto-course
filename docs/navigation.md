---
type: component-contract
component: course-navigation
status: current
version: 6.0.0
updated: 2026-10-10
---

# Navigation для native Reveal

`course-navigation` подключается независимо от Core/Presentation через
`revealjs-plugins: [course-navigation]`. Quarto и Reveal владеют форматом
слайдов, фрагментами, штатными заметками и печатью. Navigation оформляет
оглавление, обзор, историю переходов и поиск готовой презентации.

## Разделы и физические границы слайдов

YAML `title` задаёт название лекции; в общем исходнике `##` задаёт раздел,
`###` — слайд. Нативные настройки `format.revealjs.shift-heading-level-by: -1`
и `slide-level: 2` превращают эти уровни в H1/H2 только в Reveal.
`navigation-mode: linear` сохраняет последовательное движение по слайдам.

Текст после `##` остаётся на начальном слайде раздела. Граница `---` создаёт
продолжение без заголовка; Navigation сохраняет его в группе текущего раздела.
Повторное название `###` не начинает новую группу. Каждый следующий `##`
начинает новую группу, даже если его название повторяется. Разные авторские ID
сохраняют адреса повторных заголовков. Пустая заставка появляется только тогда,
когда автор сам оставляет раздел без вводного содержимого перед первым `###`.

[Нативный пример](../examples/presentation/README.md) показывает содержательные
начала разделов, повторные названия и два безымянных продолжения. Его фактическую
структуру, группировку и переходы проверяет `tests/navigation.browser.cjs`.

## Поиск и штатные возможности Reveal

Поиск включает текст слайдов, раскрываемые подсказки/решения и общие notes.
Выбор результата раскрывает целевой блок и родителей, сохраняя другое состояние.
В аудиторном режиме цель notes открывает штатную панель заметок;
презентационный режим страницы не меняется. Navigation не возвращает материал,
удалённый Core из student AST, и не получает нового валидатора банка.

Клавиша S сохраняет штатное окно докладчика. Печать раскрывает публичные ответы,
исключает заметки и после печати восстанавливает экранное состояние.
Правила режимов и disclosure принадлежат [Presentation](presentation.md).
Браузерные проверки: `tests/navigation.browser.cjs` и существующий
`npm run test:navigation-model`; совместное поведение — `npm run test:browser`.

## Постоянные выходы и репозиторий (unreleased)

Для постоянных действий подключите также `filters: [course-navigation]` и
задайте конфигурацию один раз в `_quarto.yml` либо native `metadata-files`:

```yaml
course-navigation:
  course-url: https://example.org/course/
  links:
    - {text: Курс, href: /index.html, scope: course}
    - {text: Все материалы, href: /index.html, scope: project}
    - {text: Теория, href: /theory/index.html, scope: course}
repo-url: https://github.com/owner/course
repo-branch: main
repo-subdir: slides
repo-actions: [source, issue]
issue-url: https://github.com/owner/course/issues/new
```

`text` — подпись, `href` — URL-путь от корня выбранной области. Ведущий `/`
обязателен: Quarto может перебазировать относительные строки проектных metadata,
если одноимённый файл существует, в том числе промежуточный `index.html`.
Это URL-путь, а не абсолютный путь файловой системы. `scope` принимает `project`
(по умолчанию) либо `course`; `..`, машинные пути и внешние схемы запрещены.
Проектный адрес вычисляется по native расположению документа; вложенные
исходники и `output-file` сохраняют правильный выход к своему индексу.

Для `scope: course` обязателен публичный HTTP(S) `course-url` с корнем общего
сайта. В самостоятельном render он служит основой адреса. В полной композиции
Publisher переводит эти выходы в адреса относительно корня текущего результата,
поэтому сайт работает и при размещении под URL-префиксом. Если у общего сайта
задан `website.site-url`, `course-url` обозначает тот же публичный корень.
Оба значения принадлежат авторской native конфигурации; Publisher не выводит
адрес из локальной машины и не создаёт отдельную иерархию материалов.

Настоящие ссылки доступны в боковой панели и меню узкого экрана, работают
без `opener` и истории посещений. «Назад по посещённым слайдам» продолжает
перемещаться только по истории данной презентации. Конкретные QRC-связи с
теорией остаются частью материала; постоянная ссылка может вести на индекс.

Для HTML используйте штатные navbar/sidebar и `repo-actions` в `website` либо
`book`. Фильтр не заменяет их. Для Reveal он читает те же `repo-url`,
`repo-branch` (native default `main`), `repo-subdir`, `repo-actions` и `issue-url`
с верхнего уровня metadata. Quarto удаляет проектные `website`/`book` перед
Lua-фильтром: для смешанного HTML/Reveal задайте общие значения через YAML anchors
и используйте их также в native блоке. Например:

```yaml
repo-url: &repo_url https://github.com/owner/course
repo-branch: &repo_revision main
repo-subdir: &repo_subdir slides
repo-actions: &repo_actions [source, issue]
website:
  repo-url: *repo_url
  repo-branch: *repo_revision
  repo-subdir: *repo_subdir
  repo-actions: *repo_actions
```

Для книги аналогичный native блок называется `book`. Anchors и использующий их
блок должны принадлежать одному YAML-документу; общую конфигурацию можно подключать
через `metadata-files`. Значения остаются авторскими и не повторяются в QMD. `source` ведёт к
`blob/<revision>/<repo-subdir>/<native-source>`; `issue` использует `issue-url`
либо `repo-url/issues/new`. Сам `issue-url`, как у Quarto, включает действие
issue. Репозиторные действия открываются в новой вкладке. Ревизию и каталог
задают авторы проекта; для закреплённого source используйте исходный commit SHA.
Publisher не подменяет исправную native реализацию source для HTML.

Publisher определяет реальные Reveal-результаты текущего native render и
открывает ссылки на них из штатных `index.html` в новой вкладке, сохраняя индекс.
Это действует в композиции, включая общий индекс, и при самостоятельной сборке
части с `course-site/entrypoints/collect.ts` как последним post-render hook.
Обычные страницы, ссылки на теорию, внешние адреса и история слайдов этим
правилом не меняются. Дополнительный список целей презентаций не требуется.

Проверки: `tests/navigation.browser.cjs` и нейтральный
`quarto-project-publish/tests/site-navigation.browser.cjs` — оба профиля,
композиция/standalone, вложенный mount, `output-file`, прямой вход без opener,
история и ширина 320/390 px.
