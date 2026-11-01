# Core / Presentation / Navigation 9.0.1 — кандидат

Версия исправляет cached native preview: Quarto штатно передаёт hooks явно
пустые inputs/outputs, когда нет работы. Теперь pre/post принимают только
эту техническую форму и инвалидируют прежний ordinary current pointer,
не создавая пустую capture или completion. Отсутствующий или malformed
список, чужой owner/output, token и capture reservation сохраняют refusal.
Строгие begin/finish API и genuine render/currentness fences не изменены.

Все три дескриптора bundle имеют 9.0.1; Presentation и Navigation не меняют
исполняемое поведение. Опубликованная 9.0.0 остаётся неизменной. Эта запись
не подтверждает новый release, hosted CI, assignment P или full135.

Автоматическое удаление leftover empty mediabag после неудачного render
не входит в исправление: отдельное известное ограничение recovery остаётся
с документированным ручным восстановлением точных пустых каталогов.
