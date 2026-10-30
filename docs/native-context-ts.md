# Ограниченный native/TS договор Core

Первый модуль A1 имеет статус unreleased. Он не переключает существующие Lua/CUE consumers или установленную композицию курса.

```ts
import {readProjectContexts, decodeProjectContract, assertProjectContext} from "../_extensions/course-core/public.ts";
await readProjectContexts([{owner: absoluteBookRoot, inputs: ["projects/a/input.qmd", "projects/b/input.qmd"], profiles: [], format: "html"}], async ([group]) => {
  const context = group.contexts[0];
  const project = decodeProjectContract(context);
  await assertProjectContext(context); // перед зависимым IO
});
```

Настоящий owner читается отдельно. Один disposable-контекст с техническим `project.type: default` обслуживает явно выбранные QMD inputs, включая входы вне book chapters. Авторские файлы не редактируются. Native Quarto 1.11.5 объединяет `course-project`; CST только индексирует scalar declarations и добавляет параллельное дерево ID. `effectiveMetadata` сохраняет native rebasing, `origins` отдельно хранит raw, источник, диапазон байтовых позиций JavaScript-строки и разрешённый путь. Здесь диапазон — offsets, не номер строки.

Поддержано: именованные scalar-map `components.<name>.path`, `testsets.<name>.path`, `build.files.<target>` и boolean maps `delivery.student.testsets` / `verification.testsets`. Зависимости testset/component объявляются boolean map `requires`. Декодер не выполняет их замыкание: это следующая операция A2. Default выводится из той же runtime-схемы Zod exact4.6.7, из неё же выводятся TS-типы.

Первый тест с двумя inputs измеряет три inspect: настоящий owner и по одному effective document в disposable owner. Полный исходный обход один, финальные fences отдельно проверяют сохранённый inventory. Повторные getters используют тот же context и не запускают inspect/полный обход. Контекст действует только внутри callback; поддельная копия и истёкшая ссылка отклоняются. Изменение metadata, использованных path membership или source inventory до финальной границы вызывает отказ; межоперационного cache нет.

Непроверенные arrays/aliases/tags в owner namespace, metadata-files и format contributors получают `ORIGIN_UNQUALIFIED`. Отсутствующий path, чужой owner и коллизия служебного ключа также блокируют зависимую выдачу. Native glob, локальные conventions starter/solutions, source symlinks и внешние path roots здесь ещё не квалифицированы. Ограничение не означает поддержку всей metadata-поверхности реального курса.

Квалификационная baseline/instrumented пара запускается только тестом. Постоянной двойной рабочей цепочки нет. Runtime импортирует локальный Zod из расширения без npm и сети.

Проверки: `quarto run tests/native-context-a1.ts`, `quarto run tests/native-context-a1-negative.ts`, `quarto run tests/native-context-a1-typecheck.ts`. Для процессов используется постоянный `XDG_CACHE_HOME` из execution brief.
