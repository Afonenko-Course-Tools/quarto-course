---
type: api-contract
component: course-core/project-checks
status: current
version: 8.1.0
updated: 2026-10-17
---

# Normalized projects and checks

Контракт API Core 8.1 сохраняется в candidate bundle 8.2.4 без изменений.
Номер bundle не повышает версию этого API; совместимый Exporter 8.2 использует
тот же контракт. Выпуск и готовность runtime/image проверяются отдельно.

Quarto owns project, directory and document metadata inheritance. Core reads that
merged metadata once. `default-exercise-target`, `default-exercise-course-role`,
`default-exercise-statement-visibility`, `default-exercise-difficulty`,
`default-exercise-time` and `default-exercise-project-check` apply only to exr
exercise declarations. `false` clears a default. An explicit different target is
an error; other explicit fields override defaults. IDs/project paths are never
inherited. `authoredTarget` records only the original attribute.

Assignments inherit requirement/work-mode from Span, then task-items, then
required/individual. Stage belongs only to task-items and may be absent.
`assessment.related-exercise` becomes `Assessment.relatedExercise`, checked
against this release's declarations. It is independent of runtime user choices.

The Core Course and DocumentResult expose projects with fields `exerciseId`,
`source`, `projectRoot`, `bankMember`, `purpose`, `statementVisibility`,
`artifactPolicy` and optional resolved `check`. Non-bank demonstrations remain
outside Course.exercises. A project's source/root are relative to its native book.

```sh
quarto run _extensions/course-core/entrypoints/project-checks.ts -- \
  --book tasks --output _generated/checks.json
```

This explicit inventory command runs a fresh full NativeRun and emits a private
schemaVersion 1 manifest. It does not invoke PrairieLearn or Java. Check defaults
merge into the named profile: maps merge, arrays/scalars replace. Unknown fields,
unknown source/check profiles and unsafe paths are rejected. Manual projects
without a check are excluded. Declared placeholders are retained with
`readiness: {ready:false,missing:[...]}`; selected delivery requires ready inputs.
All selected source, trusted test, verification, reference and contract fixture
bytes contribute to inventory and source snapshot hashes. SourceSelection fields
are `projectRelativePath`, `submissionRelativePath` and `sha256`.

`body-export/collect.ts` exports `collectNativeModel(root,{book,profiles})` for
platform-neutral current full model collection. `collectExport` additionally
selects one work and retains required related-exercise declaration evidence.

`artifacts/resolve.ts` exports `resolveArtifact(run,{source,exerciseId,kind})`.
Audience comes from the trusted NativeRun. Default student delivery is starter;
an open canonical demonstration receives full. Full audience receives full.
Conditions are resolved native Pandoc AST, with prerequisite dependencies and
approved assets, stripped of solutions, keys, notes and Download links. The
result is portable `files: {name,bytes}[]`, containing index.html and assets.
Cross-document links require website.site-url; source QMD links are rejected.

`course-exercise-index` is a native post-render request: Core replaces it using
this run's completed canonical exercises joined to `TopicFact={source,semester?,categories}`
by source. `{{< course-exercise-index role="independent-study" group-by="semester,difficulty" >}}`
filters by final purpose and groups by the requested topic/exercise fields. Role is
optional; group-by defaults to semester,difficulty and accepts either or both fields
once, in the requested order. Unknown parameters/roles/groups fail. Title, ID, time
and difficulty come from canonical exercises; the topic has no second exercise
inventory. Student output excludes restricted exercises. It never reads source
metadata again or uses an older model.

## Предварительная проверка Java API в локальном кандидате

Необязательные `api-precheck` и `verification-api-precheck` содержат только
`files` (шаблоны Java sources) и `entry` (полное имя класса trusted проверки).
Первое выбирается внутри `tests`, второе — внутри публичной `student` partition.
Каждая подборка является непустым собственным подмножеством уже объявленных
trusted/public tests; остальные файлы остаются зависимыми unit-тестами.
Поддерживается `java25-junit-v1` в режиме implementation. Пути за пределами
проекта, symlink и произвольные команды не разрешаются.

Collector создаёт `apiPrecheck` и `verificationApiPrecheck` с entry и
нормализованными submission-relative filenames. Для private `tests/junit/`
снимается так же, как у остальных trusted tests. Подобранные bytes уже входят
в общий source/hash inventory; отдельного незакреплённого источника нет.
У неполного проекта API files могут быть пустыми только с readiness=false.

Эти поля предназначены для локального совместимого Platform/Exporter кандидата:
опубликованная Platform 2.1.0 закрытую стадию API-precheck ещё не поддерживает.
Прежние descriptors без новых полей сохраняют поведение. Работа runner,
expected/observed и компиляционные client probes принадлежат Platform, а не Core.

## Необязательные дополнительные исходники Java

Локальный unreleased candidate поддерживает `additional-java-sources` только для `java25-junit-v1` / implementation. Закрытая policy требует `archive` (безопасное basename ZIP), `max-files`, `max-file-bytes`, `max-total-bytes`, `max-archive-bytes`; положительные целые не превышают соответственно 128 / 1048576 / 4194304 / 2097152. Runtime отдельно ограничивает 256 ZIP entries, 32 сегмента и 512 UTF-8 bytes пути. Это пределы доставки с ручным fallback, не предметные требования к структуре программы; ZIP необязателен.

Collector сохраняет policy, source/hash границы и допускает дополнительные reference `.java` только при ней. Каждый основной starter filename обязателен. Platform формирует из reference extras детерминированный ZIP и передаёт проверенные пути явно компилятору. Для contract-case архив задаётся прежним `{fixture: tests/fixtures/.../extra.zip, submission: additional-sources.zip}`; произвольных target paths это не разрешает. ZIP bytes входят в snapshot hash как остальные fixtures. Без policy прежнее точное reference mapping не расширяется. Имя архива не должно конфликтовать с основными/public/private test путями.

PrairieLearn exporter отображает штатный optional upload и пределы всего ответа; Core не исполняет присланный код и не вводит произвольных commands/hooks. Активация в курсе и новый published image требуют отдельной проверки поставки; этот canonical candidate не меняет существующие published pins.

## Явно публичные наблюдения проверки

Локальный unreleased candidate сохраняет `feedback: {requirement, what-check}` и
`public-cases` в captured ProjectFact. Каждый публичный случай имеет уникальный
`id`, короткое явное `name` (что проверяется), exact `test`, `expected` и хотя бы
одно из `input/state/action`; пустой input/expected допустим как опубликованная
граница. Неизвестные поля и повторные ID отвергаются. Core не исполняет случай
и не создаёт actual/status: наблюдение и безопасная RESULTS проекция принадлежат
Platform. Необъявленные случаи по умолчанию закрыты; их stdout/assertions не
становятся публичной диагностикой.

## Сборка Gradle JAR (контракт Core 8.1.0)

Необязательный закрытый `project-check.java-build` содержит ровно `kind`,
`main-class` и `artifact`. `kind` равен `gradle-jar-v1`, имя класса соответствует
`^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$`, basename JAR —
`^[A-Za-z0-9][A-Za-z0-9_-]{0,100}\.jar$` (до 105 ASCII bytes).
Поле обязательно только вместе с `runtime: java25-gradle-junit-v1` и
`sourceProfile.mode: implementation`; у прочих runtime и режима student-tests
оно запрещено. Unknown fields, recipe и небезопасные имена отвергаются.

```yaml
runtime: java25-gradle-junit-v1
java-build:
  kind: gradle-jar-v1
  main-class: grade.Main
  artifact: gradeapp.jar
```

Core сохраняет record в captured `check`; он входит в существующие inventory и
source snapshot hashes. API-precheck и дополнительные Java sources доступны
обоим exact implementation runtime: `java25-junit-v1` и
`java25-gradle-junit-v1`. Core не исполняет Gradle и не читает student build script.
Exporter 8.1.0 переносит record в `javaBuild`; необходимы отдельно проверенные
Platform candidate, registry и image. Старые Core/Exporter 8.0.0 и старые image
не подтверждают совместимость. Локальный candidate не является опубликованным
тегом или доказательством runtime/archive/course readiness.
