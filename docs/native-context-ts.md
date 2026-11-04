# Загрузка `course-project`

Core загружает только предметный namespace `course-project`. Реальные документы,
их заголовки, defaults, условия, format metadata и исполняемые ячейки
обрабатывает Quarto. Загрузчик не создаёт документы для каталогов кодовых
проектов.

`readProjectContexts([{owner, directories, profiles, format}], callback)` читает
каждый участвующий YAML один раз за операцию. `directories` — относительные к
`owner` каталоги проектов. `profiles` — фактически выбранные профили из Quarto
composition; выбор defaults, групп и dotenv загрузчик не повторяет. Внутри
native operation используются `withProjectContexts` или `withProjectContracts` с
одинаковым договором.

Контекст имеет поля `{owner, input, profiles, format, contract}`. Здесь `input`
— абсолютный каталог кодового проекта. `contract` содержит разобранные
предметные поля с абсолютными physical paths. `decodeProjectContract(context)`
возвращает тот же договор. Context и план действуют внутри callback; их
сериализация не передаёт доступ к чтению файлов. Свойство неизменности source
между вызовами не проверяется и не обещается.

## Слои и объединение

Порядок от менее приоритетного к более приоритетному:

1. `_quarto.yml` (либо `.yaml`) и его `metadata-file`/`metadata-files` в порядке
   списка, поверх объявления основного файла.
2. Фактически выбранные `_quarto-<profile>.yml`/`.yaml` в обратном порядке
   списка: первый перечисленный профиль выигрывает конфликт scalar.
3. `_quarto.yml.local` (либо `.yaml.local`).
4. `_metadata.yml`/`.yaml` от owner к конечному каталогу, включая его самого.

Directory includes поддерживаются тем же явным прикладным правилом, рекурсивно в
порядке списка; цикл включений отклоняется. Каждый включённый файл является
собственной базой `base: config`. В профилях и `.local` metadata includes не
разрешаются, как при композиции профилей Quarto. В каждом слое обычный
`course-project` дополняет `format.<selected>.course-project`. Это ограниченный
договор namespace, а не воспроизведение всех стадий metadata Quarto.

Maps объединяются по ключам, scalar заменяется, `false` сохраняется. Предметная
схема использует maps и scalar; массив в этих полях получает ошибку decoder.
Aliases и теги разбирает обычный YAML parser; отдельного CST, markers или origin
DTO нет. При наличии обоих расширений имени выбирается `.yml`.

## Адреса

Все адреса starter, components, testsets, solutions, instructions и значения
`build.files` имеют одинаковый вид:

```yaml
course-project:
  starter: { path: starter }
  components:
    support: { path: common/java/api-support, base: config }
  build:
    files:
      settings.gradle: { path: common/settings.gradle, base: config }
```

Обычный адрес относится к конечному кодовому проекту. `base: config` относится к
YAML, который объявил адрес. Адрес `path`/`base` заменяется атомарно: override
`{path: local}` снова project-relative даже после унаследованного
`base: config`. Остальные поля узла, например `requires`, сливаются независимо.

База не выбирается по существованию файлов. Отсутствующий выбранный путь даёт
`PROJECT_PATH_MISSING` с адресом и полем. Выход из owner, служебный tool cache,
символические ссылки и специальные типы файлов отвергаются. При материализации
обходятся выбранные деревья; байты читаются по необходимости. Privacy, реальные
роли файлов, target collisions и новый безопасный destination проверяются
отдельно от наследования YAML.

Метрики: `yamlFileReads`, `yamlBytesRead`, `directoryLayers`, `sourceFileReads`,
`sourceBytesRead`. Здесь нет счётчиков фиктивного копирования, полного source
hash или проверок неизменности. Ограниченная проверка не подтверждает скорость
всего курса либо готовность установленной композиции.
