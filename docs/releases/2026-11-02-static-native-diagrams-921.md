# Core / Presentation / Navigation 9.2.1

Static admission теперь различает фиксированные нативные диаграммы Mermaid/Dot и вычислительные engine/cells. При уже подтверждённом markdown engine допустимы только raw `=...` и встроенные `mermaid`/`dot`; OJS, knitr/Jupyter, неизвестные cell languages и отсутствующие обязательные native facts по-прежнему отклоняются. Все source/read/lifetime/publication boundaries сохраняются.

В Quarto1.11.5 Mermaid и Dot реализованы встроенными post-engine diagram handlers. [Документация Quarto](https://quarto.org/docs/authoring/diagrams.html) называет их executable cells; рендер текстового описания схемы в этом ограниченном static договоре допустим. Это не общий пропуск codeCells и не detector произвольного inline execution.

Причина исправления: настоящий objects.qmd курса содержит две Mermaid схемы, обычные Java/Kotlin/text blocks и native markdown engine. Core9.2.0 ошибочно отвергал его только из-за языка diagram cell. Учебные исходники, содержание и оценивание не менялись. Отдельный native admission regression покрывает Mermaid+Dot+raw+обычный Java; прежние execution/OJS negatives сохранены. Imports и metadata/origins алгоритм не изменены. Theme остаётся1.0.0; published9.2.0 история не переписывается.
