#!/usr/bin/env python3
"""Получить точные публичные входы раннего среза без изменения чужого checkout."""
import argparse
import json
import os
from pathlib import Path
import subprocess
from collections.abc import Mapping
from typing import cast


def git(directory: Path, *args: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(directory), *args], text=True,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"}, timeout=120,
    ).strip()


def verify(directory: Path, fixture: Mapping[str, str]) -> None:
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError(f"Не обычный каталог: {directory}")
    if git(directory, "rev-parse", "--show-toplevel") != str(directory.resolve()):
        raise ValueError(f"Не самостоятельный checkout: {directory}")
    if git(directory, "rev-parse", "HEAD") != fixture["commit"]:
        raise ValueError(f"Чужой commit; checkout сохранён: {directory}")
    if git(directory, "status", "--porcelain", "--untracked-files=all"):
        raise ValueError(f"Изменённые входы сохранены: {directory}")
    if "runtimeTree" in fixture:
        actual = git(directory, "rev-parse", "HEAD:" + fixture["runtimePath"])
        if actual != fixture["runtimeTree"]:
            raise ValueError(f"Runtime tree не совпал: {directory}")


def object_map(value: object, context: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError(f"Ожидается JSON-словарь: {context}")
    # isinstance подтверждает сам словарь; ключи и значения проверяем отдельно.
    entries = cast(dict[object, object], value)
    result: dict[str, object] = {}
    for key, item in entries.items():
        if not isinstance(key, str):
            raise ValueError(f"Ожидается строковый ключ: {context}")
        result[key] = item
    return result


def read_fixtures(path: Path) -> dict[str, dict[str, str]]:
    raw: object = json.loads(path.read_text())
    manifest = object_map(raw, str(path))
    fixtures = object_map(manifest.get("fixtures"), "fixtures")
    result: dict[str, dict[str, str]] = {}
    for name, raw_fixture in fixtures.items():
        fields: dict[str, str] = {}
        for key, value in object_map(raw_fixture, name).items():
            if not isinstance(value, str):
                raise ValueError(f"Ожидается строка: fixtures.{name}.{key}")
            fields[key] = value
        for required in ("directory", "repository", "commit"):
            if not fields.get(required):
                raise ValueError(f"Нет fixtures.{name}.{required}")
        if "runtimeTree" in fields and not fields.get("runtimePath"):
            raise ValueError(f"Нет fixtures.{name}.runtimePath")
        result[name] = fields
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--offline", action="store_true",
                        help="Только проверить уже полученные exact checkout")
    args = parser.parse_args()
    root_value: object = args.root
    offline: object = args.offline
    if not isinstance(root_value, Path) or not isinstance(offline, bool):
        raise ValueError("Некорректные параметры подготовки входов")
    root = root_value.absolute()
    for path in (root, *root.parents):
        if path.is_symlink():
            raise ValueError(f"Symlink в пути входов: {path}")
    fixtures = read_fixtures(Path(__file__).resolve().parents[1] /
                             "tests/early-slice-inputs.json")
    repo_root = root / "repos"
    if repo_root.is_symlink():
        raise ValueError(f"Symlink вместо repos: {repo_root}")
    repo_root.mkdir(parents=True, exist_ok=True)
    for fixture in fixtures.values():
        destination = repo_root / fixture["directory"]
        if destination.exists() or destination.is_symlink():
            verify(destination, fixture)
            continue
        if offline:
            raise ValueError(f"Offline-вход отсутствует: {destination}")
        # При ошибке partial остаётся для диагностики; reset/delete не выполняются.
        destination.mkdir()
        git(destination, "init", "--quiet")
        git(destination, "fetch", "--quiet", "--depth=1", "--no-tags",
            "https://github.com/" + fixture["repository"] + ".git",
            fixture["commit"])
        git(destination, "checkout", "--quiet", "--detach", "FETCH_HEAD")
        verify(destination, fixture)
    print(json.dumps({"status": "PASS", "root": str(root),
                      "fixtures": fixtures}, ensure_ascii=False))


if __name__ == "__main__":
    main()
