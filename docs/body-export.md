# Body v2 в Core 9.0.0

Body — отдельная экспортная форма для финализированных native fragments. Единственный исполняемый договор — [`body-export/package-contracts.ts`](../_extensions/course-core/body-export/package-contracts.ts); `BodyPackage` и `BodyQuestion` выводятся из него. Пакет сохраняет `course-body-package-v2`, owner/release/apiVersion, questions, works/slots и resources.

`assertBodyPackage` проверяет закрытые root/question/work/slot/assignment поля, уникальные ключи и кандидаты, owner/key/ref связи, cardinality, fixed identity, random/choice позиции, required choice, test/practical statement policy, demonstration public witness и использование каждого вопроса. Пакетные проверки выполняются локально, без внешнего процесса или временного schema input. AST/resources payload не становятся новым Pandoc parser: export capabilities и source/byte policy проверяются существующим producer и consumers.

YAML, duplicate keys, aliases/anchors/tags, multipart/matching/numeric и single-choice используют тот же `document/answers.ts` / `answer-contracts.ts`, что ранний native TS filter. Все raw ответы проверяются до visibility/conditions. Public AST получает только публичную форму; closed key, solution и grading notes остаются вне participant пакета. `publicPackage` не содержит этих трёх полей вопроса.

Assignment Body строится существующим public native operation после release validation и qualified authority/role checks. Условия, titles, anchors и public solution witnesses берутся из late native результата; список early IDs не является доказательством видимости. Links/citations/resources разрешаются существующими helpers с effective source base; дополнительно рендерить банк или повторно разбирать QMD нельзя.

Прежние `collectExport`, `collectNativeModel`, generic export CLI и NativeRun API удалены в Core 9.0.0. История доступна в Git; новой permanent legacy выдачи нет. Проверки: `body-schema`, `answer-body-ts`, `answers-a4b`, `answers-native-a4b`, `fixed-stdin-native` и все assignment suites в canonical runner.

Обычный native render не квалифицирует assignment producer. Actual P/RME/G/K, rich Body RawBlock/Figure и installed/full135/release проверяются отдельно.
