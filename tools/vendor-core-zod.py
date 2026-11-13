"""Воспроизводимая поставка локального ESM Zod из exact lock tarball."""

import base64
import hashlib
import json
import sys
import tarfile
from collections.abc import Mapping
from pathlib import Path
from typing import cast


def object_map(value: object) -> Mapping[object, object]:
    if not isinstance(value, dict):
        raise ValueError("Ожидается словарь в exact package-lock")
    return cast(dict[object, object], value)


root = Path(__file__).resolve().parents[1] / "_extensions/course-core"
lock_value: object = json.loads((root / "package-lock.json").read_text())
lock = object_map(lock_value)
tarball = Path(sys.argv[1])
packages = object_map(lock.get("packages"))
package = object_map(packages.get("node_modules/zod"))
expected = package.get("integrity")
if not isinstance(expected, str):
    raise ValueError("Нет строкового integrity Zod в exact package-lock")
actual = "sha512-" + base64.b64encode(hashlib.sha512(tarball.read_bytes()).digest()).decode()
if actual != expected:
    raise SystemExit("Tarball не соответствует exact lock")
with tarfile.open(tarball) as archive:
    for member in archive.getmembers():
        name = member.name.removeprefix("package/")
        if name in {"LICENSE", "package.json"} or (
            name.startswith("v4/") and (name.endswith(".js") or name.endswith(".d.ts"))
        ):
            if not member.isfile() or ".." in Path(name).parts:
                raise SystemExit("Недопустимый tarball entry")
            target = root / "vendor/zod" / name
            target.parent.mkdir(parents=True, exist_ok=True)
            payload = archive.extractfile(member)
            if payload is None:
                raise SystemExit("Нет содержимого tarball entry")
            with payload:
                data = payload.read()
            if name.endswith(".d.ts"):
                data = data.replace(b'.js"', b'.d.ts"')
            target.write_bytes(data)
print("PASS zod@4.6.7: exact integrity и локальные ESM/типы")
