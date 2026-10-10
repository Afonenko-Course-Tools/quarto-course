---
type: specification
component: course-core
status: current
version: 5.0.0
---

# Связи с публикацией и каталогом ссылок

Учебная спецификация использует стандартные идентификаторы Quarto и сохраняет
авторские ссылки в Pandoc AST. Она не определяет каталог публикации, порядок
сборки подпроектов, адрес сайта или способ скачивания ресурсов.

- [quarto-reference-catalog](https://github.com/Afonenko-Course-Tools/quarto-reference-catalog)
  определяет экспорт целей и разрешение межпроектных ссылок.
- [quarto-project-publish](https://github.com/Afonenko-Course-Tools/quarto-project-publish)
  определяет составную сборку, размещение HTML, PDF и других результатов.
- [quarto-project-download](https://github.com/Afonenko-Course-Tools/quarto-project-download)
  определяет архивы явно перечисленных материалов и ссылки на них.

Каждый компонент устанавливается и активируется отдельно. Отсутствие этих
компонентов не меняет допустимые роли, метаданные и отношения Core. Тему БГУ
можно применять к штатным книгам и слайдам без учебной модели.
