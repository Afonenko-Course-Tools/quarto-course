# Core / Presentation / Navigation 9.0.0 (unreleased)

Кандидат удаляет заменённый runtime и его старый API. Единственный исполняемый канон — локальный TypeScript с штатным native Quarto transport. Body v2 и public native API сохраняются; схемы, runtime checks, early marker, native index и canonical suite описаны в [миграции](../migration-ts.md).

Это функциональная breaking дельта над принятым test-only parent `4ac049f0f1dcdb0664adde01b7545a87ca138eca`. Исторические 8.4.0 source candidates сохранены в Git и не выдаются за опубликованный выпуск.

Новый immutable tag/release создаётся после OTHER и необходимых actual CI на точном SHA. Installed consumers, actual P/OCI и все 135 задач остаются отдельными проверками.
