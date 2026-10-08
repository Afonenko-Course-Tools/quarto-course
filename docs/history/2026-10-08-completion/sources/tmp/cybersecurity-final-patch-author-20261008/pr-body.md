Student-ссылка лабораторной на задачу банка теряла нативный адрес при
отложенной проекции. Курс закрепляет выпущенный Core 4.0.1, который сохраняет
адрес и числовую подпись Quarto. Банк включён только для `task/data-integrity`;
существующая задача о четырёх видах бекапов и восстановлении назначена одной
лабораторной `sec-work-data-integrity-backup`. Required/individual остаются
значениями по умолчанию, stage отсутствует; 90 минут — авторская оценка опытов.

Core 4.0.1 и QRC 3.0.0 закреплены для корня и трёх подпроектов, Publisher 5.0.0
для корня, Download 2.0.0 для task. README и команды selected Body описывают
фактическую задачу. Корневой course.id, namespaces, профили и strict настройки
публичных частей сохранены. Пустой checksum и две контрольные остаются
черновиками; новые вопросы, решения, ZIP или LMS/Cloud задания не добавлены.

Проверки окончательного дерева:

- Native tag install: 618 файлов, включая четыре Core bundle по 63 файла,
  равны exact upstream source Git objects. Installed receipt: корень 159,
  theory 149, task 161, seminars 149; native install exit 0 (48,668 секунды).
- NativeRun 48 / project-local CUE 8 — `PASS: NativeRun 48 cases (exit 0, 0,995 с), project-local CUE 8 cases (exit 0, 1,213 с)`.
- Student → full → student — `PASS: student 107,247 с → full 120,018 с → student 111,065 с, все exit 0`.
- `python3 CI/site.py _site-student _site-full`, нативные ссылки, поиск и
  отсутствие служебных/закрытых ресурсов — `PASS: CI/site.py exit 0 за 0,358 с; оба native href ведут в ../data-integrity/backup.html#exr-data-integrity-backup с числовой подписью 11.1 внутри main, unresolved/pending отсутствуют`.
- Selected backup participant/teacher Body — `PASS: native selected export exit 0 за 40,629 с; root-only cybersecurity, одна open/manual задача с авторской оценкой 90 минут и required/individual назначением; закрытые participant поля отсутствуют, ресурсов 0; все 178 файлов student после экспорта побайтно сохранены`.
- CI запускается на этом PR; итог указан в GitHub checks.

Команды, длительности и source hashes: `docs/history/2026-10-08-final-refresh/receipts/verified-final-native.json`.
Публикационный workflow сохраняет master/не-PR/COURSE_PUBLISH_PAGES guards;
проверки этого PR курс не публикуют. Нативный Windows прогон и live LMS/Cloud
исполнение не заявляются. Локальные overlays поверх выпусков отсутствуют.
