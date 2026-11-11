# Текущий разбор совместимости Core: issue #62

Проверено по [живому issue #62](https://github.com/Afonenko-Course-Tools/quarto-course/issues/62)
11 ноября 2026 года. Исходное наблюдение относится к Cybersecurity PR14,
Course 9.3.0/Theme 1.0.0/QRC 3.2.0/Publisher 6.0.1/Download 3.5.0 и конкретному
course commit. Минимальная matrix нового Core **не является** миграцией этого
курса или доказательством работы прежнего установленного состава.

| Пункт issue | Текущее воспроизведение и принятое решение |
| --- | --- |
| 1. Quarto 1.11.5 и `sec-control-demo` | Независимый Quarto-only book воспроизвёл отказ без Core/QRC: document-level `crossref: {exr-title, exr-prefix}` на 1.11.5 теряет native chapter-id/entries и даёт исходные unresolved warnings; 1.11.6/1.12.1 разрешают ссылку. Удаление только локальных overrides исправляет 1.11.5. Current Cybersecurity `e73f11c04a70fe04fbab4784d1c25e1f848898d3` уже содержит эту миграцию. Historical form требует 1.11.6 либо этого изменения конфигурации; minimum Core 1.11.5 сохраняется. Полный current course/browser/CI не проверен этим примером. |
| 2. `course-theme-html` | Core сравнивал target name с renderer. Сейчас проверяет native base `html|revealjs`, Pandoc `FORMAT` и early/late equality. Actual custom HTML и manual Body проходят на 1.11.5 и 1.12.1; native HTML тоже проверен. Это исправление Core, обход со списком SCSS больше не обязателен. |
| 3. OJS/mediabag и source snapshots | Старый snapshot/membership путь уже снят принятой волной. Дополнительно найден и исправлен другой актуальный дефект: virtual mediabag source не существовал для `io.open`, потому выпадал из resource API. Теперь сохраняются точные наблюдённые source bytes без реконструкции native writer layout. OJS publication проходит; переносимый Body явно отказывает нативным runtime placeholders. |
| 4. Родительская конфигурация | Relative `metadata-files: ../metadata.yml` проходит ordinary и manual assignment: default реально приходит в AST/Body, общий resource API вне owner по-прежнему отказывает. Абсолютное `/...` в Quarto metadata-files может означать project-root-relative путь; это native path semantics, используйте проверенный relative путь. Core не начинает обход родительского дерева. |
| 5. Изменяемые журналы | Прежний отказ о source snapshot больше не существует. Изменения соседних файлов допускаются текущим договором; принятие capture не обещает неизменность журнала. Для эксплуатационной ясности журналы и traces рекомендуется писать в `_generated/ci-logs`, отдельно от authored QMD и публикуемых resources. Расширять разрешение public resource для них не нужно. |
| 6. Прежний Body CLI и назначения | Поддержан explicit native assignment capture → owner validateRelease → selected assignmentDelivery. `target="manual"` не требует PL adapter. Actual matrix получает Body question, slots и privacy из настоящей capture, включая custom HTML и parent metadata. Generic `document` у assignment остаётся запрещён; ordinary render не выдаётся за assignment qualification. Старые CLI не возвращаются. |
| OJS block-count warning | Неблокирующее upstream/native diagnostic observation из старого course run. Отсутствие предупреждения в минимальной matrix не считается исправлением Quarto и не закрывает это наблюдение. |

Полный договор, ограничения OJS/virtual media, допустимость source edits,
cache/freeze и поддержанные manual consumers описаны в
[native-execution.md](native-execution.md). Матрица и её commands должны
сопровождаться exact source hashes; новые fixture results не заменяют installed
course/browser acceptance и исходный QRC case пункта 1.
