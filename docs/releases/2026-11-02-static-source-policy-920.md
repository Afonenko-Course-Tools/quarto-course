# Core / Presentation / Navigation 9.2.0

Кандидат добавляет явную owner-настройку `course-core-source-policy: static` в существующий native API. Отсутствие ключа сохраняет общий режим. Новая возможность и её явно суженный договор дают minor 9.2.0; Presentation и Navigation имеют совместную версию поставки, их поведение не меняется. Тема course-theme-html остаётся 1.0.0.

Owner утверждает неизменность авторского дерева и отсутствие вычислимых Quarto cells в течение сборки. Admission использует уже полученные native engines/codeCells/metadata и отклоняет известные вычисления, `ojs-engine: true`, неизвестную policy и отсутствующие обязательные факты. Обычный Java block и raw HTML разрешены. Универсальное обнаружение inline execution, новый parser, дополнительный inspect и постоянный индекс не вводятся.

Приватные индексы S и resources заменяют поиск по всему source на локальных проверках. Повторные getters и bound A1 cache проверяют lifetime в памяти. Адресные canonical/type/signature проверки реальных чтений и digest native resource остаются. Полные внешние entry/exit, межпроцессные capture/complete, public `assertCurrent()` и финальные privacy/completeness границы сохраняются. Общие предки проверяются один раз на source fence, включая пустые каталоги.

Адресная regression проверяет отсутствие FS у повторных cached getters, неизменность metadata/origins, копирование выдаваемых bytes, общий режим, отказ actual input/resource mutation, нового QMD, symlink, output tamper, executable include, effective OJS и неполных native facts. Измерение 7 QMD после независимого ревью и отдельного разрешения координатора, полный Java/SP и hosted CI этим исходником не подтверждаются. Старый случай пустого native `*_files/mediabag` не маскируется широким исключением.
