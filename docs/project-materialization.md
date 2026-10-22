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

Обычные `metadata-file(s)` допускаются после native raw extraction и доказательства
отсутствия common-ключей в дополнительных origins. Закрытый `metadataClosure`
перечисляет stock config inventory, raw metadata hashes, dependencies и absence
watches owner, документа, include, directory и extension scope. Наличие common
в дополнительном origin, включая null, вложенное или перекрытое значение, требует
отказа; имя файла не даёт разрешения. Числа, списки, boolean и порядок наследования
берутся из Quarto, а не из Pandoc AST. Неизвестный scope зависимости не считается
отсутствием metadata. Старый witness без closure требует нового capture.

Private witness содержит обязательный `sourceIdentities`: каждый выбранный lexical
input связан с regular physical origin и stock physical owner. Допустим только
leaf input alias с точным `readLink`, без цепочек и linked parent; его effective
metadata и зависимости сохраняют lexical directory. Reader повторно проверяет
отношение, bytes и physical owner; retarget даже на те же bytes требует fresh
capture. Config/common/include/extension/witness paths остаются regular без
symlink. Посторонние ссылки не получают source capability через owner inventory.

После удаления owned export-профиля source вне обычного render-list сохраняет
capability только завершённого run: exact initial source/format/output inventory,
private nonce/documents и live owner config проверяются до и после retirement.
Stock `{input:[]}` без document config не задаёт defaults: допускается лишь его
точная форма при independently verified owner/closure и исходном selected scope.

Exact original owner/lexical/physical stock inspection stdout сохраняется в одном
private run-local `inspections/sha256/<H>.json` store (directories 0700, files
0600). Union выводится только из существующих witness refs; inventory, exact
bytes/hash и исходные role/source/config/raw bindings проверяются до и после
live inspections. Отсутствующие preimages требуют fresh capture, без backfill.
`physicalInspectionHash` — неизменный hash original stdout, не fingerprint
живого resource listing. Currentness независимо повторяет relation/owner/raw
и полную metadata closure. Unrelated resource listing не меняет original H;
metadata/include/common/source/descriptor drift по-прежнему отказан. Private
store не включается в public/student materialization; retirement использует
тот же store и completed-run before/after inventory guard.


Owned JSON export хранит закрытый private writer marker и один exact raw profile
`owned-export-profile.json` (0600), связанный с прежними SHA1/SHA256. Producer
проверяет fixed pre/post hooks своего module context. Reader сверяет raw строки
с singleton arrays original owner preimage, а не с URL своей установленной копии.
Raw bytes, mode, closed inventory, current active profile либо настоящий completed
retirement проверяются до и после actual inspect. Старый capture без raw slot
требует fresh capture. Обычный run не получает writer mode из author metadata.
Original authored HTML inspection остаётся HTML; JSON rows завершаются только
actual native JSON event и полным Lua effective-section equality до записи facts.

Retired regular input может получить stock standalone document context в своей
lexical directory только через закрытый in-memory proof завершённого exporter run.
Original listed source/config/owner hashes остаются прежними. Независимый live
owner сохраняет root и exact remaining config inventory; source отсутствует в его
обычном render-list. Exact empty standalone project shape не назначает нового
owner. Regular relation, original/current raw metadata, extension scope, directory
absence watches и вся metadata closure проверяются вместе; current owner и
completed private/output inventory повторно подтверждаются перед возвратом.
Active producer и ordinary run такого разрешения не имеют. Public NativeRun,
author metadata и CLI не получают дополнительных переключателей.
