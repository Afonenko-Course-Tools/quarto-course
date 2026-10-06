# Банк назначений и единая презентация

Самостоятельная группа: native book с общими условиями и работой, отдельная
native Reveal-презентация. Все учебные файлы находятся внутри этой папки.
Default full намеренно показывает демонстрационные ответы. Core/Presentation/
Navigation входят в один bundle, оба проекта устанавливают один и тот же выпуск.

```sh
quarto add Afonenko-Course-Tools/quarto-course@v3.0.1 --no-prompt
(cd slides; quarto add Afonenko-Course-Tools/quarto-course@v3.0.1 --no-prompt)
quarto render
quarto render slides
```

Для выпуска готовой демонстрации скопируйте native результат `slides/_output/`
в `_book-full/slides/`, сохранив структуру ресурсов. Это простая операция
производителя готового архива; документация получает весь результат и не
запускает предварительную сборку. Taskfile задаёт команды Linux/macOS/Windows.

```sh
task render
quarto run _extensions/Afonenko-Course-Tools/course-core/entrypoints/export.ts --book . --work sec-lab-01 --output _generated/work.json
```

Task render записывает в корень готовой группы `BUILD.json` с ревизией производителя,
закреплённым bundle и версией Quarto. Сайт документации получает этот результат
по закреплённому Release `demo-20261007-patch1` (asset `course.tar.gz`).
Функциональная проверка программного проекта и реальная LMS в этой группе
не заявлены. Слайды проверены на native notes, режим/перезагрузку, скрытые
поисковые цели и PDF без заметок в `tests/presentation/unified.browser.cjs`.
