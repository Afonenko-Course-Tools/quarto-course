# Полное условие и самостоятельный кодовый комплект

Публичный вход — `_extensions/course-core/public.ts`. Это ограниченная TS/native
композиция поверх принятого раннего/позднего договора; действующую установленную
композицию курсов переключает интегратор. Все схемы исполняются локальным
Zod4.6.7; типы выводятся из них. Наследование `course-project` задаёт
[узкий namespace loader](native-context-ts.md); Gradle при render не
запускается.

`selectCondition(document, exerciseId, view)` выбирает полное фактически позднее
тело. Документ должен быть `complete` и иметь ту же проекцию. Для повторных
появлений одного ID требуется `{view: 'student', occurrence: key}`; выбор
первого появления по умолчанию запрещён. Результат `ResolvedCondition`
неизменяем, сохраняет `operation`/`input`/`format`/`view`, occurrence,
объявленный project, действительную версию Pandoc JSON, тело и URL
ссылок/изображений. Он не заменяет условие пересказом. Текущую операцию и сбор
данных Quarto назначают production hooks Core; для dependent IO документ берётся
через withCurrentNativeOperation. Pure normalize/finalize/select не выдают IO
authority. materializeProject принимает только точное condition живой native
операции; JSON/clone/schema decode и UUID не заменяют capability.

`planProject(context, {audience: 'student' | 'full'})` действует внутри
`readProjectContexts`. План связан с исходным живым context; сериализованная
копия не получает его lifetime. Boolean maps сохраняются при объединении
namespace. Явное `false` нельзя включить через транзитивное `requires`; ошибка
содержит цепочку. Неизвестные имена, циклы, общий component/testset namespace с
неоднозначными именами и неполный build отклоняются.

В том же `course-project` runtime-каноне дополнены поля:

```yaml
course-project:
  starter: { path: starter }
  instructions:
    gradle: { path: shared/gradle.md, base: config }
    local: { path: README.local.md } # необязательно
  solutions:
    reference: { path: reference }
    alternative: { path: alternative }
```

Все адреса по умолчанию относятся к конечному code-project; явно общий адрес
содержит `base: config` и относится к YAML объявления. Значения `build.files`
тоже являются объектами `{path, base?}`. Адрес переопределяется атомарно. Имена
testsets/components и зависимости остаются boolean maps. Деревья содержат
конечные project-relative пути, например `src/main/java/Main.java`.

В student входят starter, выбранные `delivery.student.testsets`, их замыкание и
build files. Full использует `verification.testsets`, сохраняет стартовый root и
создаёт отдельные `author/<name>/` для объявленных решений/альтернатив; каждый
получает собственные build/settings/tests/helper/source и README. Все его файлы
имеют audience `full`. Это квалификация source groups с публичным условием;
native author condition пока получает `CONDITION_UNQUALIFIED`. Учебная полнота
стартера/эталона и результаты оценивания проверяются отдельно.

`materializeProject(plan, condition, bindings)` возвращает `ArtifactFiles`:
`{exerciseId, audience, files}`, где файл содержит
`{target, bytes, audience, reason}`. Файлы читаются из выбранных настоящих
источников; private source paths и собственные подписи байтов не передаются.
Plan хранит до16 вариантов condition/bindings в пределах callback. Это локальное
повторное использование результата, а не гарантия неизменности source или
межоперационный cache.

README создаёт один writer в существующем artifacts owner. Он соединяет полное
позднее тело → общую Gradle-инструкцию → optional local Markdown fragment →
раздел сдачи и вызывает штатный Pandoc GFM writer. У condition база — native
input; у Gradle/local fragments — собственные source files; у относительных
ссылок submission fragment требуется `submissionBase`. Shortcodes в обычном
Markdown fragment требуют отдельного native разрешения и получают отказ. Если
объявленный local fragment одновременно находится в корне starter как README.md,
его читает этот же writer.

Относительные ресурсы требуют явного binding `{path, target}`. Ключом служит
owner-relative canonical source path; короткий исходный URL допустим, если его
`path` совпадает с реальной базой фрагмента. Это различает одинаковые `data.txt`
в двух проектах. Копируются лишь ресурсы фактического позднего тела и включённых
fragments. Generated file должен существовать после render; источник и роль
проверяются при чтении. Неточный origin, отсутствующий ресурс, target с двумя
разными sources или столкновение с README блокируют результат. Ссылка на уже
включённый файл того же source использует один target; одинаковое имя другого
source остаётся коллизией.

Межпроектные ссылки приходят из явных `bindings.links`, которые назначает
QRC/Publisher. Ссылка на собственную заготовку заранее получает стабильный
конечный target от Download/Publisher: materializer не вызывает скачивание или
упаковку, не нуждается в хеше ZIP и не запускает рекурсивный render. Явные
локальные anchors сохраняются и проверяются в результате GFM. Неразрешённый
локальный anchor получает отказ. Raw-узлы фактического native condition и
Markdown fragments передаются штатному Pandoc writer без разбора HTML в Core.
Адреса внутри raw HTML не добавляют файлы в ресурсное замыкание; native
`Image`/`Link` сохраняют проверки origin, public/private роли и текущих bytes.

Native standalone shortcode include в Quarto1.11.5 подставляет текст с
main-input-relative URL. Вложенное расположение include не создаёт для его URL
новую базу: actual HTML сохраняет ошибочный `../image.svg`. Положительный nested
include использует действительные native main-input-relative ссылки. Выходящий
из owner `../escape` отвергается. Существующие курсовые includes требуют
проверки при переносе; собственный include resolver не добавлен. Отдельные
Gradle/local fragments сохраняют свои собственные базы.

`SubmissionInstructionsSchema` — нейтральная граница Core:

```ts
{files: [{name: 'grade/Main.java', starterPath: 'src/main/java/grade/Main.java'}],
 instructions: '...'}
```

`name` — логическое имя сдачи. `starterPath` необязателен и при наличии должен
существовать в конечном starter inventory. Для native способа без файлов
допустимы `files: []`. Mode/options/оценивание принадлежат PL. Его публичный
`describeSubmission` возвращает этот summary из проверенного business contract и
реального mapping.

```ts
// finalized — текущий actual native early→late результат этой композиции.
await readProjectContexts(requests, async ([batch]) => {
  const condition = selectCondition(finalized, "exr-reverse-array", "student");
  const plan = await planProject(batch.contexts[0], { audience: "student" });
  const submission = describeSubmission(plContract, actualFileMappings); // PL public
  const inventory = await materializeProject(plan, condition, {
    submission,
    resources: finalResourceBindings,
    links: publishedLinkBindings,
  });
  ArtifactFilesSchema.parse(inventory); // общая публичная граница B/PL
  await writeArtifactFiles(inventory, absoluteNewRoot);
});
```

`writeArtifactFiles` декодирует договор, получает собственную копию переданных
bytes, проверяет targets/collisions/audience и общий размер, затем пишет новый
root. Результат `ArtifactWriteResult` сообщает files/bytes. JSON, потерявший
Uint8Array, не является корректным входом; process codec должен явно
восстановить bytes. Собственных SHA, receipts и повторной проверки неизменности
source здесь нет.

Первоначальная квалификация A2 writer — HTML/student. Ранняя A4a дельта описана
ниже; revealjs, неперенесённые namespaces, symlinks/external source roots,
foreign writer nodes и полный legacy cleanup (удалён в
Core 9.0.0; см. migration-ts.md) остаются отдельными gates. Публичные операции
выражают эти пределы отказами. Сам факт генерации не является учебным PASS и не
переключает installed consumers.

Проверки: `bash tools/check-core-condition-ts.sh`; изолированная реальная
композиция PL включается через
`A2_PL_PUBLIC=/absolute/path/to/course-prairielearn/public.ts`. Этот optional
path используется только тестом, продукт не зависит от частного дерева PL.
Отдельный Gradle replay выполняется после render и распаковки с JDK25 и
постоянным cache.

Первоначальная A2 партия требовала Gradle build/settings. Ранняя non-Gradle
дельта A4a описана ниже; native Workspace seed сохраняет отдельный owner gate.

## Ранняя граница A4a

`materializationClosure(plan, condition)` возвращает owner fragments: `source`,
`kind` (`condition`, `gradle`, `local`), `baseKind`, `links`, `resources`,
`references`. Каждый Gradle/local fragment имеет базу собственного фактически
выбранного файла; условие — базу собственного native input. Повторный вызов
использует разобранные на этом plan фрагменты. Это не постоянный cache между
операциями.

Для QRC ссылка с native `data-qrc-ref` получает различающий token
`course-reference:<encoded key>:<encoded style>`; descriptor содержит исходные
`key`/`style`. Composition передаёт их QRC и задаёт конечные URL в
`bindings.linksBySource[fragment.source][token]`. Обычные файловые ссылки,
перечисленные в `resources`, разрешает сам Core writer; B не разбирает Markdown.
Не найденный token и непереносимый узел дают адресный отказ.

`materializeCondition(plan, condition, bindings)` использует тот же README
writer, что `materializeProject`, и выдаёт полный README с замыканием его
ресурсов, без build/source/test деревьев проекта. Обычный resource target по
умолчанию — `resources/<canonical owner-relative source>`; явный override
проверяется по той же origin/source/target policy. Имена в двух разных fragment
bases не сливаются. Текущий native generated asset доступен только через позднее
byte observation этой операции; один retained output не является доказательством
ресурса.

Gradle build/settings и общая Gradle инструкция обязательны при объявленной
Gradle форме. Для non-Gradle они не выдумываются. Native HTML
`course.view: full` соответствует projection `author`; такой condition не даёт
student выдачу. Квалифицированы ранние две Java и две SP формы в обоих профилях,
а не весь author surface. Native Workspace seed/lifecycle, revealjs, остальные
metadata forms и полный legacy cleanup (удалён в Core 9.0.0; см.
migration-ts.md) остаются следующими обязательными gates.

## Выбор Pandoc внутри assignment operation

README runner использует уже выбранный `operation.pandocBinding()` в живом
assignment scope. Перед прямым запуском сохраняются прежние проверки
`assignmentChild` для argv, cwd и frozen runtime environment; после ожидания
binding снова проверяется lifetime. Если binding отсутствует либо launcher
controls host snapshot отличаются от frozen runtime, остаётся прежний
квалифицированный `quarto pandoc`. Environment и cwd прямого child берутся из
этого квалифицированного вызова, а не из host transport. Ordinary operation
сохраняет существующий fallback; публичные materialization API не меняются.
