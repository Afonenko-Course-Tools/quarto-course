---
type: authoring-guide
component: course-core
status: implementation-in-progress
updated: 2026-10-08
---

# Руководство по авторской записи курса

Обычная теория, книга и слайды остаются native Quarto: Markdown, include,
формулы, crossref, движки, cache/freeze и Reveal. Явный банк добавляет
канонические задачи, состав работ и проверенный экспорт. Правила этой ветки
внедряются по [принятому контракту](../spec/authoring-model-next.md);
выпущенные правила читаются по тому же тегу, что и расширение.
Точный контракт: [учебные элементы](../spec/learning-elements.md),
[видимость](../spec/visibility.md), [Body](body-export.md).

## Структура и файлы

Логический корень задаёт course.id один раз для экспортных ключей.
Теория, задачник, справочник и слайды могут быть отдельными native проектами:
их конфигурации, render/chapters, профили, форматы и результаты принадлежат Quarto.
Publisher компонует их явно; QRC связывает адреса, не переносит чужие тела.
Местный include организует текст своего проекта. Отдельный слайд имеет
собственный ID и ссылку к канонической задаче, а не её копию.

Используйте латинские имена `checksums.qmd`, `exr-checksum` и русские заголовки.
`index.qmd` — входная страница; `_quarto.yml`/`_metadata.yml` нативные.
Соседний `checksums/` нужен лишь при наличии ресурсов; общие изображения
выделяйте явно. Book chapters определяет порядок книги, папка не включает банк.
Устойчивый sec-ID полезен для ссылки, но не обязателен каждой задаче.

Resources указывайте от корня, например `resources: ["./assets/**"]`.
Проверяйте inspect и фактические outputs: отсутствие меню/ссылки или gitignore
не запрещает копирование. Исходники, закрытые пакеты и `_generated` исключайте
из student сайта и архивов. Публичные стартовые файлы и закрытые tests/reference
имеют отдельные пути и правила выбранного адаптера.

## Банк, собственное время и решение

Объявите только область канонических задач; файлы работ могут быть рядом вне неё:

```yaml
# tasks/_metadata.yml
exercise-bank: true
exercise-statement-visibility: open
```

```qmd
# Контрольные суммы {#sec-checksums}

::: {#exr-checksum course-role="demonstration" difficulty="introductory" time="10"}
Покажите, как изменение байта влияет на контрольную сумму.

::: {.solution}
Вычислите исходную сумму, измените один байт и сравните результаты.
:::
:::

::: {#exr-collision course-role="discussion" difficulty="intermediate" time="25"}
Объясните отличие случайной коллизии от намеренного подбора.
:::

::: {#sol-collision}
Сравните предпосылки, цель поиска и проверку результата.
:::
```

Difficulty — introductory/intermediate/advanced; собственный time —
положительное целое число минут. Ни страница, ни секция их не наследуют.
Statement visibility обязательна после native inheritance: атрибут
`statement-visibility="open|restricted"` переопределяет metadata default.
Open публикует условие; решение открывается student лишь при demonstration.
Restricted удаляет условие, решение и ссылку назначения student сайта;
full показывает полный банк.

Для `@sol-collision` используйте именованную suffix-пару в том же QMD.
Без ссылки удобнее одно анонимное solution внутри задачи. Solution for в банке
удалён; сироты, неоднозначные пары и дубли отклоняются. Альтернативные разборы
помещайте в один контейнер обычными заголовками. Вне exercise-bank native
exr/exm/sol не требуют этих полей и сохраняют обычную семантику Quarto.

## Роли с минимальной разметкой

Роли задают смысл текста; они не включают банк, платформу, баллы или приватность.
Следующие блоки применимы в теории, описании занятия и в теле задачи:

```qmd
::: {course-role="objectives"}
Объяснить назначение контрольной суммы и выбрать способ проверки файла.
:::

::: {course-role="prerequisites"}
Байты, файлы и двоичное представление числа.
:::

::: {course-role="reading" requirement="required"}
Изучите раздел @sec-checksums перед занятием.
:::

::: {course-role="takeaway"}
Совпадение сумм полезно для проверки, но не доказывает происхождение файла.
:::

::: {course-role="limitation"}
Простая сумма байтов не защищает от намеренной подмены.
:::

::: {course-role="misconception"}
Длина контрольной суммы не равна объёму проверяемых данных.
:::

::: {course-role="criteria"}
Результат содержит объяснение выбранного алгоритма и граничных случаев.
:::

::: {course-role="deliverables"}
Сдайте короткий отчёт с командами, суммами и выводом.
:::
```

Demonstration — разобранная деятельность; у open банковской задачи она разрешает
публичное решение. Discussion — обсуждение; independent-study — самостоятельная
деятельность; control — контроль. Для этих ролей применим банковский `course-role`:

```qmd
::: {#exr-repair course-role="independent-study" difficulty="advanced" time="40"}
Предложите проверку повреждённого архива с резервными данными.
:::

::: {#exr-variant course-role="control" difficulty="intermediate" time="20" statement-visibility="restricted"}
Объясните выбранную проверку для выданного варианта файла.
:::
```

Control сам не скрывает текст: это делает restricted в банке или нативные
условия вне него. Independent-study не является отдельным видом работы.
У objectives/prerequisites/reading/takeaway/limitation/misconception/criteria/
deliverables нет задачи оценивания только из-за роли. Reading requirement
описывает материал; assignment requirement — включение задачи в работу.
Work-mode банка относится к назначению, не к декларации задачи.

## Lab, seminar, practical и test

Один QMD содержит одну работу с явным kind. Lab — лабораторная;
seminar — семинар; practical — практическая, в том числе на распечатках;
test — контроль, включая экзамен. Вид не выбирает доставку, место или баллы.
ID задаётся assessment.id, существующим chapter-id или первым заголовком.

```qmd
---
assessment:
  kind: seminar
  theory-time: 15
---

# Семинар по целостности {#sec-integrity-seminar}

## Разбор с преподавателем

::: {.task-items stage="demonstration"}
1. @exr-checksum
:::

## В аудитории

::: {.task-items stage="classroom"}
1. [@exr-collision]{work-mode="pair"}
:::

## После занятия

::: {.task-items stage="homework"}
1. [@exr-repair]{requirement="optional" work-mode="group"}
:::
```

Несколько списков дают общий порядок, повтор во всей работе запрещён.
Одна местная ссылка exr на пункт; QRC не включает чужое условие.
Stage demonstration/classroom/homework задаётся списку и может отсутствовать,
например у lab без зависимости от места выполнения. Неявного classroom нет.
На Span: requirement required/optional и work-mode individual/pair/group;
defaults — required/individual. Stage не меняет свойства задачи.
Demonstration требует open, роль demonstration и фактическое публичное решение
после native условий Quarto. Для экспортируемой работы используйте переносимое
решение без when-format/when-meta gating: HTML-only разбор, отсутствующий в native
JSON source pass, не разрешает demonstration stage. Raw наличие контейнера
не заменяет этот публичный результат.

Practical/test назначают только restricted. Публичный пример размещается
в preview вне состава:

```qmd
---
assessment:
  kind: practical
---

# Практическая работа на распечатках {#sec-integrity-practical}

::: {.assessment-preview}
Перед работой изучите @exr-checksum. Оцениваться будет объяснение метода.
:::

::: {.task-items stage="classroom"}
1. @exr-variant
:::
```

Student показывает описание работы/preview без ссылки restricted назначения.
Full ссылается в полный банк; богатое тело автоматически не дублируется в работе.
Preview не объявляет задачи, не назначает их и полностью исключается из экспорта.
Последовательность занятия задают обычные заголовки и оглавление.

## Рекомендательное время

Required/all суммируются из собственных time назначений, включая demonstration;
pair/group время не масштабирует. В семинаре выше: задачи required — 35,
all — 75; теория — 15; занятие required — 50, all — 90 минут.
Theory-time — положительное конечное число минут вне уже учтённого времени задач,
добавляемое один раз к обоим итогам. Preview-ссылка автоматически не включает time;
нужное изучение примера учитывайте в theory-time.

Полный текущий render/экспорт строго проверяет состав. Partial render/preview
может пропустить недоступный итог или показать `??`. Не используйте частичную
сумму как полную, 0 вместо неизвестного или данные прежнего sidecar.
Для времени текущего run подключаются [native hooks](native-run.md), без второго
полного render; Presentation оформляет готовые сведения.

## Ответы, аудитории и исходники

Single-choice — `.answer type="single-choice"` с одним BulletList и
одним Span `.correct`; manual/numeric/multipart/matching —
answer-spec по [схеме](../_extensions/course-core/body-export/answer.cue).
Минимальный ответ внутри банковской задачи:

```qmd
::: {.answer type="single-choice"}
- [Сравнить с независимой ожидаемой суммой.]{.correct}
- Проверить только имя файла.
:::
```

Grading-notes и ключи отделены от условия. Raw ключи и декларации проверяются
до student проекции, даже в скрытой ветви. Target явно выбирает адаптер и его
ведущий Header; project нужен использующему его адаптеру. Баллы, attempts,
external IDs, тесты и grader принадлежат выбранной интеграции.

Student/full — нативные профили с разными output-dir и course.view.
Обычные слайды вне банка сохраняют native решения, fragment и публичные notes;
банковский student Reveal подчиняется Core visibility. Дополнительный full-only
материал оформляйте нативно:

```qmd
::: {.content-visible when-profile="full"}
Дополнительный преподавательский материал.
:::
```

Функциональные профили активны вместе с одной аудиторией; форматные/metadata
условия принадлежат Quarto. Открытый Git содержит полный исходник независимо
от сайта. Для student банковского HTML отключите native встраивание QMD:

```yaml
format:
  html:
    code-tools:
      source: false
    keep-source: false
```

Не добавляйте локальные QMD в code-links/resources. Внешняя обычная GitHub-ссылка
на открытый репозиторий допустима. Проверяйте HTML source modal и copied resources,
поскольку Source использует оригинальный QMD, а не student банковское тело.
Core дополнительно удаляет уже подготовленный нативный AST-контейнер исходника
на student страницах банка и работ; pre-ast metadata не переопределяет writer
options Bootstrap. Нативные toggle/caption и другие preferences сохраняются.
Для междокументной проекции, закрытых назначений и времени подключайте текущие
pre/post hooks; Core post ставьте перед QRC/потребителями результатов.
Reveal использует обычные внешние Markdown-ссылки на исходник/группу;
HTML code-tools для Reveal не обещаются. Notes публичны, доступны по S;
режимы, поиск, disclosure и печать описаны в [Presentation](presentation.md).

## Selected экспорт и проверка

```sh
quarto run _extensions/course-core/entrypoints/export.ts \
  --book tasks --work sec-integrity-practical \
  --output _generated/exports/integrity.json
```

Используйте фактический путь установленного Core. Один native source JSON-проход
сохраняет include, вычисления и функциональные профили, читает полные банковские
QMD вне HTML chapters и не готовит full HTML. Только выбранные местные назначения
переходят в Body; unsupported неназначенная задача не ломает выбранный экспорт.

Participant пакет содержит условия, поля ответа и разрешённые ресурсы,
включая selected restricted условие. Preview, внешние заголовки и окружающая
проза исключены; внутренние headings задачи сохранены. Website
statementVisibility отдельно от participant-safe visibility public.
ClosedKey/solution/gradingNotes остаются в закрытом payload;
`.public.json` их не содержит. Print/PrairieLearn получают participant данные;
Moodle использует нужные ключи по собственному контракту. Неразрешённая выбранная
QRC-ссылка и unsupported Body node — явные ошибки.

```sh
quarto inspect .
quarto render index.qmd --profile student
quarto preview --profile student
quarto render --profile full
```

Выпуск требует текущего успешного run и exit 0, без retained результатов после
ошибки. Импорт/выдача в реальной LMS проверяется отдельно от валидного Body JSON.
Toolchain — Quarto 1.11.5 и CUE 0.17.1. На Windows upstream recoverEncode возможен
на кириллическом пути; временно используйте путь без кириллицы, не считая это
исправлением Quarto.

Нативные источники: [профили](https://quarto.org/docs/projects/profiles.html),
[условия](https://quarto.org/docs/authoring/conditional.html),
[crossref](https://quarto.org/docs/authoring/cross-references.html),
[HTML Source](https://quarto.org/docs/output-formats/html-code.html#code-tools),
[Reveal](https://quarto.org/docs/presentations/revealjs/).
