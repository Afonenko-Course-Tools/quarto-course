# Запуск Codex: завершение текущей поставки Quarto

Распакуй архив в постоянную рабочую папку. Открой эту папку в локальном Codex.
Исходники девяти инструментов держи рядом в собственных checkout/worktrees;
они восстанавливаются из GitHub, не из диагностического evidence.

Передай Codex следующий запрос:

---

Продолжи существующую реализацию общих инструментов Quarto.

Сначала прочитай quarto-codex-handoff-2026-10-03.md, pr-snapshot.json и требования
в specs/quarto-tools-plan.md. Для ближайшего integration транша дополнительно
прочитай два остальных plans из specs/. Требования уже согласованы:
не начинай повторное интервью и не разрабатывай заново проверенные providers.

Обнови реальное состояние GitHub: Core #15 в снимке ещё выполняет CI, а PR body
и старые checkpoints отстают от head. Если другой исполнитель продвинул работу,
продолжай с его подтверждённого результата и не запускай дублирующий run.

Выполни задачи 1–6 handoff-плана последовательно:
1. Восстанови чистые refs, текущие runs и Template feat/native-listing-consumer.
2. Заверши root-address correction Core #15 на текущем Source.
3. Полностью установи packages в Template и пройди OriginalCourse student/full/
   late на Stable и prerelease; создай недостающий тематический Draft PR.
4. Объедини существующие Body и Navigation ветки Core в отдельном integration PR.
5. Проверь единую текущую установленную композицию и обнови устаревшие
   production test pins/consumers без потери смысла отрицательных fixtures.
6. Сохрани конечный результат, remaining gaps и следующий тематический план.

Работай в feature branches/worktrees. Обновляй существующие Draft PR, создавай
недостающие; этот запрос не поручает merge в default branches или release.
VirtualizationAndCloud и Operations-Research не изменяй; Java не мигрируй
до текущего проверенного Template.

На failure сохрани конкретный code/step/log, затем делай узкое исправление.
Source review, чистая компиляция, smoke и старые green runs не заменяют
указанный native scope текущего head. Owner state/captures/handles из evidence
не восстанавливай как permission; для новой проверки нужен fresh attempt.

Веди компактные Progress, Discoveries, Decision Log и Outcomes в handoff-плане.
После законченной задачи сделай commit и checkpoint с SHA/tree, run IDs,
ограничениями и exact next command. Не добавляй в основной нормативный план
ещё один полный журнал и не повторяй уже доказанные неизменённые native tests.

Рутинные implementation решения принимай самостоятельно. Вопрос нужен только
при новом противоречии согласованных требований или недостающем доступе,
который блокирует конкретную необходимую проверку. До такого препятствия
выполни всё доступное в текущем scope и подготовь проверяемый результат.

Сначала покажи кратко восстановленные refs и первый незакрытый gate, затем
приступай к работе. Когда ближайший транш закрыт, продолжай упорядоченный
backlog §7 отдельными небольшими тематическими планами; доступ к целевой LMS
требуй только для конкретного real import/delivery gate.

---

В evidence/ находится уже сохранённый архив проверок v25. Он нужен для
диагностики и сопоставления результатов. Реальный Source и complete installed
payloads находятся в commits из pr-snapshot.json.

SHA256SUMS.txt содержит контрольные суммы файлов пакета передачи.

