# Body v2 в Core 9.0.0

Body — отдельная экспортная форма для финализированных native fragments. Единственный исполняемый договор — [`body-export/package-contracts.ts`](../_extensions/course-core/body-export/package-contracts.ts); `BodyPackage` и `BodyQuestion` выводятся из него. Пакет сохраняет `course-body-package-v2`, owner/release/apiVersion, questions, works/slots и resources.

`assertBodyPackage` проверяет закрытые root/question/work/slot/assignment поля, уникальные ключи и кандидаты, owner/key/ref связи, cardinality, fixed identity, random/choice позиции, required choice, test/practical statement policy, demonstration public witness и использование каждого вопроса. Пакетные проверки выполняются локально, без внешнего процесса или временного schema input. AST/resources payload не становятся новым Pandoc parser: export capabilities и source/byte policy проверяются существующим producer и consumers.

YAML, duplicate keys, aliases/anchors/tags, multipart/matching/numeric и single-choice используют тот же `document/answers.ts` / `answer-contracts.ts`, что ранний native TS filter. Все raw ответы проверяются до visibility/conditions. Public AST получает только публичную форму; closed key, solution и grading notes остаются вне participant пакета. `publicPackage` не содержит этих трёх полей вопроса.

Assignment Body строится существующим public native operation после release validation и проверки текущей native generation и private roles. Условия, titles, anchors и public solution witnesses берутся из late native результата; список early IDs не является доказательством видимости. Links/citations/resources разрешаются существующими helpers с effective source base; дополнительно рендерить банк или повторно разбирать QMD нельзя.

Авторский `::: {.public-tests}` — обычный Pandoc Div с публичным содержимым.
Он сохраняется в `questions[].condition` и assignment `condition.body`; тот же
`condition.body` передаётся штатному Pandoc writer при создании README стартера.
Отдельных полей, схемы проверок или разбора HTML для этого блока нет.

Название работы и название вопроса содержат авторский видимый текст: Unicode,
inline code, подписи ссылок и содержимое Span. Идентификаторы, CSS-классы,
атрибуты и адреса ссылок в название не входят. Книжная пара Quarto
`chapter-number` / `chapter-title` даёт только содержимое `chapter-title`;
авторское числовое начало внутри него сохраняется. Это правило общее для
release facts и Assignment Body; поздние названия вопросов читаются из native
результата, а не выводятся заново из раннего заголовка.

Прежние `collectExport`, `collectNativeModel`, generic export CLI и NativeRun API удалены в Core 9.0.0. История доступна в Git; новой permanent legacy выдачи нет. Проверки: `body-schema`, `answer-body-ts`, `answers-a4b`, `answers-native-a4b`, `fixed-stdin-native` и все assignment suites в canonical runner.

Assignment использует явное новое намерение, живой prepared lease и actual native early/late/post. Rich Body RawBlock/Figure и installed/full135/release проверяются отдельно; авторский Quarto toolchain остаётся доверенным кодом владельца.
