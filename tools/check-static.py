#!/usr/bin/env python3
"""Стандартные форматтеры и статические CLI для собственных файлов checkout."""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTION = (
    "_extensions/course-core/",
    "_extensions/course-navigation/",
    "_extensions/course-presentation/",
    "_extensions/course-theme/",
)
EXCLUDED = {"vendor", "node_modules", "generated", "_generated", ".git"}


def run(command: list[str]) -> None:
    """CLI failure, missing binary and warnings fail the gate."""
    print("+ " + " ".join(command), flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def discover() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return sorted(
        {
            name
            for name in result.stdout.split("\0")
            if name
            and not EXCLUDED.intersection(Path(name).parts)
            and (not name.startswith("_extensions/") or name.startswith(PRODUCTION))
            and (ROOT / name).is_file()
        }
    )


def main() -> None:
    os.chdir(ROOT)
    write = sys.argv[1:] == ["--write"]
    if sys.argv[1:] and not write:
        raise ValueError("Поддерживается только --write")
    files = discover()
    if not files:
        raise ValueError("Пустой scope")

    def delegated(name: str) -> bool:
        return "/observability/bridge." in name

    prettier = [
        name
        for name in files
        if Path(name).suffix in {".ts", ".js", ".cjs", ".mjs", ".json", ".yml", ".yaml", ".css", ".scss", ".html"}
        and not delegated(name)
    ]
    run(["node_modules/.bin/prettier", "--write" if write else "--check", *prettier])
    lua = [name for name in files if name.endswith(".lua") and not delegated(name)]
    run(["stylua", *([] if write else ["--check"]), ".luacheckrc", *lua])
    runtime_lua = [name for name in lua if not name.startswith("typecheck/")]
    run(["luacheck", "--no-color", *runtime_lua])
    python = [name for name in files if name.endswith(".py")]
    run(["ruff", "format", *([] if write else ["--check"]), *python])
    run(["ruff", "check", *(["--fix"] if write else []), *python])
    run(["bandit", "--configfile", ".bandit.yml", *python])
    shells = [name for name in files if name.endswith(".sh")]
    run(["shfmt", "-i", "2", "-ci", "-w" if write else "-d", *shells])
    run(["shellcheck", "--external-sources", "--source-path=SCRIPTDIR", *shells])
    for name in shells:
        run(["bash", "-n", name])
    for name in files:
        if name.endswith(".fish"):
            run(["fish", "--no-execute", name])
    toml = [name for name in files if name.endswith(".toml")]
    if toml:
        run(["taplo", "fmt", *([] if write else ["--check"]), *toml])
    xml = [name for name in files if name.endswith(".xml")]
    if xml:
        run(["xmllint", "--nonet", "--noout", *xml])
    yaml = [name for name in files if Path(name).suffix in {".yml", ".yaml"}]
    run(["yamllint", "--strict", "-c", ".yamllint.yml", *yaml])
    workflows = [name for name in yaml if name.startswith(".github/workflows/")]
    run(["actionlint", "-color", *workflows])
    styles = [name for name in files if Path(name).suffix in {".css", ".scss"}]
    run(["node_modules/.bin/stylelint", "--max-warnings", "0", *styles])
    html = [name for name in files if name.endswith(".html")]
    if html:
        run(["node_modules/.bin/html-validate", *html])
    print(f"PASS: {len(files)} собственных файлов; format, lint и workflows")


if __name__ == "__main__":
    main()
