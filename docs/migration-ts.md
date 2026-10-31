# Переход на Core 9.0.0

Это несовместимая unreleased миграция заменённого Lua/IR маршрута на уже действующий native TypeScript канон. Публичный вход `public.ts`, ранний TS JSON-filter и существующие native pre/post hooks сохраняют Quarto reader, наследование metadata, conditions, crossref и рендер. Типы выводятся из исполняемых локальных схем. Нового Course DTO, metadata resolver или renderer нет.

Удалены прежние model/filter/CLI, schema-only probes и их tool setup. Они не становятся permanent fallback. Body v2 проверяется `body-export/package-contracts.ts`; YAML и ответы переиспользуют `document/answers.ts` и `document/answer-contracts.ts`. Вывод старого validator не имитируется: новый отказ содержит стабильный код, source/id/field и cause TS-проверки.

| Прежняя гарантия | Текущие реальные контроли |
| --- | --- |
| Course declaration/defaults/target/adapter/policy | release-semantics-a4a, release-collection-a4a, release-a4a, metadata-a4b, native-metadata-producer-a4c |
| Ответы до projection, closed key, YAML/choice | answers-a4b, answers-native-a4b, answer-body-ts |
| Body package owner/key/ref/slot/cardinality/policy | body-schema, fixed-stdin-native |
| Native include bases/A1 origins/readonly/private/full | native-context-a1(+negative), artifact-target-guards-a2, project-closure-a2, materialization-a4a, native-full-a4a |
| Реальные repeated/nested/conditional/native nodes | document-a1-native/pairing-native/conditional-native, native-operation-a3, native-title-transport |
| Source/output/currentness/lifetime/resource binding | native-capture-*-a4c, native-binding-fences-a4c, release-generated-resource-currentness, operation-project-reuse* |
| Ordinary installed default и указатель | native-default-runtime (student/full, links, resources, foreign route refusal) |
| Child argv/env/cwd/stdin/cause/security | assignment-child-execution, assignment-child-native, process-input, system-toolchain, fixed-stdin-native |
| Representation/Navigation и browser DOM | navigation-model и три actual browser suites |

`tools/check-canonical.sh --native` выполняет все A1/A2/A3/A4 TS suites, все assignment boundary suites и перечисленные прикладные проверки. `--quick` не включает полный ранний срез и browser suites. Старые private-injected NativeRun/IR fixtures удалены: их положительный результат не подтверждал current public operation. Их код и прежние результаты остаются в Git истории. Типизированные Java/checks manifests принадлежат адаптеру PrairieLearn и проверяются его живыми schemas/validators, не второй схемой Core.

Resource getter сохраняет entry local fence; при синхронном копировании уже проверенных cached bytes второй одинаковый fence без await/IO не повторяется. После чтения/хеширования bytes и на конечных full boundaries fence сохраняется. Результат smoke не означает универсального ускорения курса; фактический полный курс измеряется отдельно после финальной интеграции.

Этот перенос не закрывает qualified assignment/P, rich Body RawBlock/Figure границы, actual all135, installed composition, OCI или release. Hosted CI нужен на точном новом SHA.
