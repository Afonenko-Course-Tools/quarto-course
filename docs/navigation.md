---
type: component-contract
component: course-navigation
status: current
updated: 2026-10-08
---

# Navigation для native Reveal

`course-navigation` подключается независимо от Core/Presentation через
`revealjs-plugins: [course-navigation]`. Quarto и Reveal владеют форматом
слайдов, фрагментами, штатными заметками и печатью. Navigation оформляет
оглавление, обзор, историю переходов и поиск готовой презентации.

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
