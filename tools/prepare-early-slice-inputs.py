#!/usr/bin/env python3
"""Получить точные публичные входы раннего среза без изменения чужого checkout."""
import argparse
import json
import os
from pathlib import Path
import subprocess


def git(directory, *args):
    return subprocess.check_output(
        ["git", "-C", str(directory), *args], text=True,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"}, timeout=120,
    ).strip()


def verify(directory, fixture):
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--offline", action="store_true",
                        help="Только проверить уже полученные exact checkout")
    args = parser.parse_args()
    root = args.root.absolute()
    for path in (root, *root.parents):
        if path.is_symlink():
            raise ValueError(f"Symlink в пути входов: {path}")
    manifest = json.loads((Path(__file__).resolve().parents[1] /
                           "tests/early-slice-inputs.json").read_text())
    repo_root = root / "repos"
    if repo_root.is_symlink():
        raise ValueError(f"Symlink вместо repos: {repo_root}")
    repo_root.mkdir(parents=True, exist_ok=True)
    for fixture in manifest["fixtures"].values():
        destination = repo_root / fixture["directory"]
        if destination.exists() or destination.is_symlink():
            verify(destination, fixture)
            continue
        if args.offline:
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
                      "fixtures": manifest["fixtures"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
