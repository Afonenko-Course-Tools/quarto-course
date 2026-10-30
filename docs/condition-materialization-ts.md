# Полное условие и самостоятельный кодовый комплект

Публичный вход — `_extensions/course-core/public.ts`. Это ограниченная TS/native композиция поверх принятого раннего/позднего договора; действующую установленную композицию курсов переключает интегратор. Все схемы исполняются локальным Zod4.6.7; типы выводятся из них. Новый YAML merge, CUE fallback, wrapper и запуск Gradle при render не используются.

`selectCondition(document, exerciseId, view)` выбирает полное фактически позднее тело. Документ должен быть `complete` и иметь ту же проекцию. Для повторных появлений одного ID требуется `{view: 'student', occurrence: key}`; выбор первого появления по умолчанию запрещён. Результат `ResolvedCondition` неизменяем, сохраняет operation/input/format/view, occurrence, объявленный project, действительную версию Pandoc JSON, тело и URL ссылок/изображений. Он не заменяет условие пересказом. Текущий native operation/capture назначают production hooks Core; для dependent IO документ берётся через withCurrentNativeOperation. Pure normalize/finalize/select не выдают IO authority. materializeProject принимает только точное condition живой native операции; JSON/clone/schema decode и UUID не заменяют capability.

`planProject(context, {audience: 'student' | 'full'})` действует внутри `readProjectContexts`. План связан с исходным живым context; сериализованная копия не получает его lifetime. Boolean maps сохраняются как результат native inheritance. Явное `false` нельзя включить через транзитивное `requires`; ошибка содержит цепочку. Неизвестные имена, циклы, общий component/testset namespace с неоднозначными именами и неполный build отклоняются.

В том же `course-project` runtime-каноне дополнены поля:

```yaml
course-project:
  starter: {path: starter}
  instructions:
    gradle: {path: shared/gradle.md}
    local: {path: README.local.md} # необязательно
  solutions:
    reference: {path: reference}
    alternative: {path: alternative}
```

`starter`, локальные testsets, `solutions` и `instructions.local` разрешаются относительно выбранного code-project input. Общая Gradle-инструкция, components и build files — относительно файла объявления. Имена testsets/components и зависимости остаются существующими boolean maps; отдельного реестра Gradle dependencies нет. `starter.requires` допускает те же зависимости. Деревья содержат конечные project-relative пути: например, `src/main/java/Main.java` либо `src/test/java/DemoTest.java`. Build/settings копируются из настоящих `build.files`. Пути не выводятся из basename.

В student входят starter, выбранные `delivery.student.testsets`, их замыкание и build files. Full использует `verification.testsets`, сохраняет стартовый root и создаёт отдельные `author/<name>/` для объявленных решений/альтернатив; каждый получает собственные build/settings/tests/helper/source и README. Все его файлы имеют audience `full`. Это квалификация source groups с публичным условием; native author condition пока получает `CONDITION_UNQUALIFIED`. Учебная полнота стартера/эталона и результаты оценивания проверяются отдельно.

`materializeProject(plan, condition, bindings)` возвращает `ArtifactInventory`, содержащий только конечные target/bytes/size/SHA256/audience/reason. Private source paths не входят в публичный DTO. Файлы берутся из уже захваченного A1 owner inventory, дополнительный полный source walk не нужен. Перед зависимой выдачей повторно проверяются source identities и живой context. Plan хранит до16 явных вариантов condition/bindings в пределах операции; повторный запрос того же варианта не вызывает native writer/inspect/source walk. Это не межоперационный cache.

README создаёт один writer в существующем artifacts owner. Он соединяет полное позднее тело → общую Gradle-инструкцию → optional local Markdown fragment → раздел сдачи и вызывает штатный Pandoc GFM writer. У condition база — native input; у Gradle/local fragments — собственные source files; у относительных ссылок submission fragment требуется `submissionBase`. Shortcodes в обычном Markdown fragment требуют отдельного native разрешения и получают отказ. Если объявленный local fragment одновременно находится в корне starter как README.md, его читает этот же writer.

Относительные ресурсы требуют явного binding `{path, target}`. Ключом служит owner-relative canonical source path; короткий исходный URL допустим, если его `path` совпадает с реальной базой фрагмента. Это различает одинаковые `data.txt` в двух проектах. Копируются лишь ресурсы фактического позднего тела и включённых fragments. Generated file должен уже существовать после render при снятии project context; байты берутся из этого снимка. Неточный origin, отсутствующий ресурс, target с двумя разными sources или столкновение с README блокируют результат. Ссылка на уже включённый файл того же source использует один target; одинаковое имя другого source остаётся коллизией.

Межпроектные ссылки приходят из явных `bindings.links`, которые назначает QRC/Publisher. Ссылка на собственную заготовку заранее получает стабильный конечный target от Download/Publisher: materializer не вызывает скачивание или упаковку, не нуждается в хеше ZIP и не запускает рекурсивный render. Явные локальные anchors сохраняются и проверяются в результате GFM. Неразрешённый локальный anchor и непереносимый raw/native узел получают отказ.

Native standalone shortcode include в Quarto1.11.5 подставляет текст с main-input-relative URL. Вложенное расположение include не создаёт для его URL новую базу: actual HTML сохраняет ошибочный `../image.svg`. Положительный nested include использует действительные native main-input-relative ссылки. Выходящий из owner `../escape` отвергается. Существующие курсовые includes требуют проверки при переносе; собственный include resolver не добавлен. Отдельные Gradle/local fragments сохраняют свои собственные базы.

`SubmissionInstructionsSchema` — нейтральная граница Core:

```ts
{files: [{name: 'grade/Main.java', starterPath: 'src/main/java/grade/Main.java'}],
 instructions: '...'}
```

`name` — логическое имя сдачи. `starterPath` необязателен и при наличии должен существовать в конечном starter inventory. Для native способа без файлов допустимы `files: []`. Mode/options/оценивание принадлежат PL. Его публичный `describeSubmission` возвращает этот summary из проверенного business contract и реального mapping.

```ts
// finalized — текущий actual native early→late результат этой композиции.
await readProjectContexts(requests, async ([batch]) => {
  const condition = selectCondition(finalized, 'exr-reverse-array', 'student');
  const plan = await planProject(batch.contexts[0], {audience: 'student'});
  const submission = describeSubmission(plContract, actualFileMappings); // PL public
  const inventory = await materializeProject(plan, condition, {
    submission, resources: finalResourceBindings, links: publishedLinkBindings,
  });
  ArtifactInventorySchema.parse(inventory); // общая публичная граница B/PL
  await writeArtifactInventory(inventory, absoluteNewRoot);
});
```

`writeArtifactInventory` предварительно декодирует DTO, снимает собственную копию bytes, проверяет targets/collisions/audience/size/SHA256 всех файлов, затем пишет новый root. Результат `ArtifactWriteResult` сообщает files/bytes/hashReads. Здесь нет зависимости от private receipt. JSON, потерявший Uint8Array, не принимается как корректные bytes; внешний process codec должен явно восстановить их до этой схемы.

Текущая native квалификация writer — HTML/student. Author/revealjs, metadata-files/arrays/aliases/tags, неперенесённые namespaces, symlinks/external source roots, универсальные raw HTML/foreign writer nodes и полный legacy/CUE cleanup остаются отдельными gates. Публичные операции выражают эти пределы отказами. Сам факт генерации не является учебным PASS и не переключает installed consumers.

Проверки: `bash tools/check-core-condition-ts.sh`; изолированная реальная композиция PL включается через `A2_PL_PUBLIC=/absolute/path/to/course-prairielearn/public.ts`. Этот optional path используется только тестом, продукт не зависит от частного дерева PL. Отдельный Gradle replay выполняется после render и распаковки с JDK25 и постоянным cache.

Эта партия требует Gradle build/settings; non-Gradle проекты и native Workspace seed пока не квалифицированы этим materializer. Их owner gate сохраняется отдельно.
