# Продолжение после переноса — 4 октября 2026

Работа остановлена по прямому запросу пользователя для переноса на другой ноутбук. Этот файл заменяет устаревшие инструкции запуска и статусы в `START-CODEX.md`; согласованные требования в `specs/` и порядок задач handoff сохраняются. Нормативные требования основного плана — §§1–13; поздние checkpoints являются историей. Новое интервью по уже согласованным требованиям не требуется.

Восемь локальных native запусков остановлены SIGTERM; все восемь внешних процессов завершились с кодом **143**. Это прерывание пользователем, а не успешная приёмка и не новый дефект. Мониторы 558, 634, 746, 750 закрыты; не ждать их и не опрашивать старые sessions. Локальные опросы GitHub и работа агентов остановлены. GitHub CI продолжает работать независимо; его не отменяли.

## Перенос и восстановление

Перенести `course-tools-transfer-2026-10-04.tar.gz` и соседний файл `.sha256`. В Linux или WSL с Git и Python 3 выполнить:

```bash
sha256sum -c course-tools-transfer-2026-10-04.tar.gz.sha256
mkdir course-tools-transfer
tar -xzf course-tools-transfer-2026-10-04.tar.gz -C course-tools-transfer
python3 course-tools-transfer/restore.py "$HOME/course-tools"
```

Папка назначения должна быть новой или пустой. Открыть **восстановленную** папку `course-tools` в Codex. Скрипт работает без сети, проверяет девять bundles и восстанавливает все 21 чистую рабочую копию, полные SHA/tree и все именованные refs. Непубликованный `4c33b15` включён. Связанные worktrees создаются заново с путями нового ноутбука; старые `.git` файлы с абсолютными ссылками не копируются. В `RESTORE-RESULT.json` сохраняется результат восстановления.

Архив содержит исходники через bundles, требования, checkpoint, исторические доказательства и stock Linux x86_64 Quarto/CUE. Не содержит `local-runtime`, `local-tmp`, `local-cache`, `local-data`, настроек Codex, SSH/API credentials. GitHub/SSH доступ настроить заново. Для native проверок нужны системные R/knitr/rmarkdown, Python/Jupyter, TeX/Cyrillic fonts, Poppler и Chromium. Версии прежнего ноутбука: Quarto Stable **1.10.18**, prerelease **1.11.5**, Deno **2.7.14**, CUE **0.17.1**, R **4.6.1**, knitr **1.51**, rmarkdown **2.31**, Python **3.14.7**. Точные записи находятся в `local-evidence/environment/`.

`local-tools/` сохраняется побайтно как историческая stock установка. У prerelease имеется пакетная абсолютная ссылка `bin/tools/pandoc → /opt/quarto/bin/tools/x86_64/pandoc`; на новом хосте проверить штатную установку этих версий и при необходимости установить официальный пакет в подходящий путь. Не менять SDK/runtime ради прохождения проверок. Ссылки внутри исторических fixtures/evidence могут указывать на старую папку; не запускать их как новые проверки.

## Согласованное состояние

| Объект | Состояние |
| --- | --- |
| Задачи 1–2 | Завершены. Core #15 `fe576c4eb1d77191b89216ae2e6bbdaef50b28a2`, tree `6a3a998e3d22907967135daca68991e06801eca0`: 20 обязательных CI успешны, четыре свежих локальных Default/Book случая успешны. Повторять неизменённый corpus не требуется. |
| Опубликованный Template #11 | Draft, feature `feat/native-listing-consumer`, head `55d9fcf120a1a241938dd62e1884b30bb02d47f6`, tree `a7b2f545480309a6fcab1a509b0c426063507b28`; base `feat/core-resource-consumer` / `2ce3a29cca93ca5a12a19f2210e5a79377ab9b23`. |
| Последний сохранённый GitHub снимок | **04.10, 07:15 UTC / 10:15 Минск:** из 18 Source jobs — 11 success, 4 running, 3 ожидают зависимостей, 0 failures. Обе Original student jobs успешны; их официальные logs/artifacts ещё не собраны. Original full2 и Pages2 выполнялись; late2 и aggregate не зарегистрированы. Это датированный снимок, не текущий онлайн-статус. |
| Рабочий Template кандидат | **`quarto-template-pages-profile-split`**, branch `fix/pages-sequential-profile-jobs`, **`4c33b15e638d166634d401830ac7aed7ae6854cc`**, tree `5c57eeeb8970f1e0c56c6bc8a61974fc6feef7e1`, parent55. Чистый, не опубликован. Четыре изменённых файла: последовательные Pages full→student→check, публичный handoff, документация и 26 успешных поведенческих tests. Native приёмки нет; Source требует 22 CI jobs после публикации. |
| Основной Template checkout | `quarto-template-course` остаётся на `65ac5a2` намеренно. Продолжать Task3 из **кандидата4c33**, а не из этого старого checkout. Primary FF — после приёмки Task3. |
| Body baseline для Task4 | `quarto-course-body-baseline`, detached `9690514a6c92dfde377d2be551ca861022387506`, tree `305d461d5737d627f52ff7d01a035af7992b2c7f`. Сохранён в bundle вместе с remote refs. Объединение Body/Nav ещё не выполнено. |

Девять полных refs и все рабочие копии перечислены в `migration-20261004/repositories.json`. Точные доказательства: `pr-snapshot.json`, Core final summary в `local-evidence/registry/current-fe576/`, кандидат freeze/review в `local-evidence/template-pages-profile-split/`, последний GitHub снимок в `local-evidence/registry/template-11-current-55d9fcf/current-template-status-0715.json`. Записи остановки — `local-evidence/migration-stop-20261004.json` и `migration-terminal-results-20261004.json`.

## Порядок следующей сессии

1. Проверить `RESTORE-RESULT.json`, чистые HEAD/tree кандидата4c33 и Corefe, доступ к GitHub и необходимые системные зависимости. Прочитать этот файл, активный §13 handoff, `pr-snapshot.json` и согласованные три плана в `specs/`. Исторические sessions, абсолютные пути и статусы не продолжать.
2. **Первое внешнее действие: обновить реальный PR11/head55 CI.** Сохранить настоящий head/tree и run/job IDs. Забрать ещё недостающие официальные student/full/late/Pages logs/artifacts после фактического завершения соответствующих jobs. Уже собранные неизменённые Resource/Artifact/Portal proofs переиспользовать. Runs: Portal37177939125, Resource37177939137, Pages37177939129, Artifact37177939164, Original37177939127; refresh может показать новый head — тогда сначала согласовать Source со снимком.
3. После фактического завершения текущих55 jobs опубликовать4c33 обычным FF **в существующий Draft PR11**, если не обнаружено нового конкретного Source дефекта. До push обновить подготовленный Source-only PR body: упомянуть прерывание локальных проверок, не оставлять обещание активных sessions. Не публиковать4c раньше terminal55: workflow concurrency отменит прежние jobs. После actual PR GET4c применять подготовленный Source22 CI adapter; не считать Source18 результат приёмкой4c.
4. **Закрыть Task3 на новом ноутбуке:** свежие установленные Original student→full→late на обоих каналах; свежие Pages full→student→check на обоих каналах; все 22 обязательных CI на опубликованном current Source. На старом ноутбуке начальные student/full попытки прерваны, положительного локального parent для последующих фаз нет. Создать новые run/evidence/runtime/temp bindings. Подготовленные команды и helpers находятся в `local-evidence/actual-main/pages-split-4c33b15/` и `local-evidence/template-pages-profile-split/`; переназначить только конкретные пути/run bindings под новую рабочую папку. Сначала максимум **две тяжёлые native фазы одновременно**. Использовать один канал наблюдения на процесс и отчёт по фазе; не создавать новые слои collectors ради неизменённых фактов.
5. **Task4:** объединить существующие Body и Navigation в отдельной integration ветке/PR. План `local-evidence/integration/body-navigation-plan.md`, read-only preview наfe выявил три конфликта: `filter.lua`, `owner.ts`, `resources.ts`. Сохранить Body prepare/validate API и Navigation/Listing; не создавать второй collector/engine. Native union fixture готовился отдельно; необходимые regression scopes описаны в интеграционных документах.
6. **Task5:** проверить единую установленную composition U, обновить четыре production copies прежнего25-file Core и устаревшие production pins/Print Body consumer, сохранив смысл intentional negative fixtures. План `local-evidence/integration/consumer-pin-audit.md`; Print использует публичный production Body API.
7. **Task6:** сохранить итоговые current SHA/tree, acceptance и оставшиеся gaps; продолжить упорядоченный тематический backlog из §7 handoff и `local-evidence/integration/next-thematic-plans.md`. Старые pin references в будущем плане актуализировать после U. Для начала полноценного оформления курса остаются Task3 и интеграционный транш Task4–5; полный P1/P2 и реальные LMS imports — отдельные последующие gates.

Source review и pure tests уже приняты в своём scope; они не заменяют native приёмку текущего Template. Старые Owner state/captures/handles не являются permission. Для нового запуска нужны fresh attempt и собственные доказательства. Только действительно принятые публичные outputs текущего Source того же канала могут быть parent следующей фазы. Late обязан проверить `SOURCE.PUBLICATION_ADDRESS_CHANGED` после QRC/child finish и сохранность обоих предыдущих публичных деревьев.

Работать в feature branches/worktrees; существующие Draft PR обновлять, недостающие тематические создавать. Merge в default branches и releases не поручены. `VirtualizationAndCloud` и `Operations-Research` не изменять; Java не мигрировать до принятого Template.

## Запрос для нового Codex

> Продолжи согласованную реализацию после переноса. Сначала прочитай START-NEXT-CODEX.md и проверь восстановленные refs. Задачи1–2 уже приняты; первый незакрытый gate — Task3 на кандидате4c33. Обнови реальный GitHub PR11 CI, затем исполняй описанный порядок Task3→4→5→6 без повторного интервью и повторных неизменённых native corpus. Проводи необходимые локальные проверки, начиная с двух тяжёлых фаз одновременно. Старые процессы остановлены пользователем: не ждать закрытые sessions и не восстанавливать их runtime как authority. Сохраняй компактный checkpoint и действуй автономно в согласованном scope до завершения.
