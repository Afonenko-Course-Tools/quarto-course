#!/usr/bin/env python3
"""Не допускает возврат удалённого schema tool в executable target/CI."""

import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
for p in root.rglob("*.cue"):
    if ".git" not in p.parts and "node_modules" not in p.parts:
        raise SystemExit("Вернулась удалённая схема: " + str(p.relative_to(root)))
for p in (
    list((root / "_extensions").rglob("*.ts"))
    + list((root / "_extensions").rglob("*.lua"))
    + list((root / ".github").rglob("*.yml"))
    + list((root / "tools").glob("*.sh"))
):
    if "vendor" in p.parts:
        continue
    if re.search(r'(?:get\(["\']CUE["\']|environment\.CUE|cue-lang/setup|["\']cue["\']|\.cue["\'])', p.read_text()):
        raise SystemExit("Вернулась зависимость от удалённого tool: " + str(p.relative_to(root)))
print("PASS: executable schema canon локальный TypeScript, удалённый tool отсутствует")
