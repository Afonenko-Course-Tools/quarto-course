# Банк назначений и единая презентация

Самостоятельная группа содержит native book с явным банком tasks и четыре
работы lab/seminar/practical/test вне области банка. Отдельная native Reveal
презентация использует standalone Presentation/Navigation. Русские примеры
показывают все роли, собственные difficulty/time, suffix/nested решения,
stage, Span назначения, assessment-preview и theory-time.

Изменения этой ветки требуют следующего согласованного выпуска bundle;
текущие pins/ready asset будут обновлены при выпуске. Для проверки checkout:

```sh
quarto add ../.. --no-prompt
(cd slides; quarto add ../../.. --no-prompt)
quarto render --profile student
quarto render --profile full
quarto render slides
```

Core устанавливает все три расширения пассивно. В book явно подключены
native pre/post hooks для текущих полных проверок и времени. Если локальная
установка создала путь без владельца GitHub, замените путь hooks на фактический.
Обычный exr/sol главной страницы остаётся вне банка; slides банк не включает.

```sh
quarto run _extensions/Afonenko-Course-Tools/course-core/entrypoints/export.ts \
  --book . --work sec-practical-01 --output _generated/practical.json
```

Selected participant пакет practical содержит restricted условие, поля ответа
и ресурсы, без preview/внешней прозы/ключей. Teacher пакет хранит решение отдельно.
Student сайт удаляет restricted условия и ссылки назначений, обычные решения
банка; открытая demonstration сохраняет решение. Native code-tools source
и keep-source отключены student профилем: исходник закрытого условия не встроен
в source modal и не скопирован как QMD. Внешние ссылки открывают GitHub отдельно.

| Работа | Задачи required/all | Теория | Занятие required/all |
| --- | --- | --- | --- |
| Лабораторная | 20/45 | 5 | 25/50 |
| Семинар | 35/75 | 15 | 50/90 |
| Практическая | 20/20 | 2,5 | 22,5/22,5 |
| Контроль | 15/35 | — | 15/35 |

Stage лабораторной и контроля намеренно отсутствует; seminar объединяет
три списка. Назначенная demonstration учитывается во времени; pair/group
время не масштабирует. При partial render недоступный итог пропускается/??.

Для готовой группы производитель копирует native slides/_output в
_book-full/slides, сохраняя ресурсы, и пишет BUILD.json через build-info.ts.
Taskfile описывает Linux/macOS/Windows. Новая ready группа выпускается отдельно
после проверки merged SHA и pins; старые immutable assets сохраняются.
Реальная LMS/программный grader в этой группе не заявлены.

Слайды сохраняют общие публичные notes, поиск, штатное окно S, переключение,
перезагрузку и печать. Source-ссылки — обычный Markdown на закреплённый выпуск;
HTML code-tools для Reveal не требуются. [Диагностики](../../docs/diagnostics.md)
принадлежат владельцам Core/Presentation.
