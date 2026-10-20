# Материализация выбранных проектов

Core собирает внешние student/grading stages из полного текущего NativeRun.
Исходный owner остаётся единственным редактируемым источником. Общие файлы
задаются в обычной merged metadata Quarto:

```yaml
project-materialization:
  projects:
    exr-example:
      common-files:
        - {source: common/Support.java, target: student/src/Support.java, audience: student}
      include-git: false
```

Это адрес существующего exercise с projectRoot, а не второй реестр банка.
Декларации фиксируются в native capture. Сборка всего owner отклоняет
неизвестные ID, project без projectRoot и несовместимые определения одного ID.
Ключ другого тематического документа допустим. Массив common-files не склеивается
между разными captured определениями.

`source` — явный public файл относительно owner; `target` — путь относительно
выбранного projectRoot. Абсолютные пути, traversal, glob, symlink, служебная Git
база, повторный target и пересечение с авторским файлом запрещены до записи.
Публичный mapping находится в student/ и включается в обе аудитории; grading
mapping включается только в grading. Приватный teacher overlay поставляет
только reference/, tests/, rubric.md и contract.md выбранного проекта.

```bash
quarto run _extensions/course-core/entrypoints/materialize-projects.ts -- \
  --root /absolute/course/tasks \
  --model /absolute/course/tasks/_generated/course-spec/native-run.json \
  --output-root /absolute/fresh-stage --audience student \
  --task exr-example --write
```

Команда проверяет model по текущему NativeRun. Для grading обязательна
`--teacher-root /absolute/private/java`. `--check` вместо `--write` только
сверяет ранее созданный stage, включая лишние файлы. Output должен быть новым,
вне owner и teacher. В нём только выбранные project trees и materialization.json;
полный owner snapshot создаёт Platform, используя точные replacementRoots.
Receipt содержит source→target/hash, аудиторию, source documents, общий source
hash и hash эффективных project declarations.
Для Git owner receipt также содержит sourceCommit, полученный внутренним чтением
HEAD до и после подготовки; смена HEAD останавливает запись. Platform private
freeze требует совпадение с public HEAD, включая config-only commit.

Выбранный документ обслуживает отдельный внутренний
`materializeStarterArtifact(run,{source,exerciseId})`, возвращающий только files.
Он проверяет текущие source/input/output/profiles и открытую student policy.
Один общий planner сохраняет file/privacy/common/includeGit guards. Неизвестный
ID metadata на неполном capture откладывается до полного owner audit; известные
конфликты, дубли и exercise без project не откладываются. Этот вход не выдаёт
staging receipt и не принимает teacher/audience/output/fullness параметры.

По умолчанию student/.git исключается. include-git: true сохраняет только
контролируемую учебную историю выбранного student seed: обычные файлы и каталоги,
без gitfile, symlink, commondir и alternates. Core передаёт точный files inventory
через resolveArtifact; Download упаковывает эти bytes без повторного generic
exclude. Обычные resource globs не получают разрешения на .git. Копирование
не выполняет содержимое Git. Публичная заготовка не получает teacher overlay.

`common-files` остаётся owner-relative декларацией. При native capture Core
сопоставляет stock owner/raw-QMD metadata с effective metadata вложенного документа
по закрытому run-local witness. Pointer-v2 и witness не являются публичным API:
старый pointer требует нового capture. Изменение QMD, common source, config,
относящегося extension descriptor либо появление metadata origin делает proof
устаревшим. Неподтверждённый directory/extension origin отклоняется; authored `..`
не разрешается вслед за generated rebasing Quarto. Операторский stage и starter
используют одну текущую canonical binding; временный export profile может быть
удалён только по точной записи принадлежащего этому запуску generated profile.
