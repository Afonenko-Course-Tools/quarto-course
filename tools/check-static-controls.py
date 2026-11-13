#!/usr/bin/env python3
"""Новые файлы и отказ инструмента проходят через тот же блокирующий gate."""

import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASES = (
    ("_extensions/course-theme/__quality.css", ".test {\n  colro: red;\n}\n", "property-no-unknown"),
    ("_extensions/course-theme/__quality.scss", "@incldue invalid;\n", "scss/at-rule-no-unknown"),
    (
        "_extensions/course-theme/__quality.html",
        '<div id="duplicate"></div>\n<div id="duplicate"></div>\n',
        "no-dup-id",
    ),
    ("_extensions/course-core/__quality.lua", "return misspelled_global\n", "W113"),
    ("tools/__quality.py", "import pathlib\n", "F401"),
    ("tools/__quality.py", 'value = eval("1")\n', "B307"),
    ("tools/__quality.py", 'import pickle\n\nvalue = pickle.loads(b"input")\n', "B301"),
    ("tools/__quality.py", 'import requests\n\nrequests.get("https://example.invalid", verify=False)\n', "B501"),
    ("tools/__quality.py", 'import yaml\n\nvalue = yaml.load("input", Loader=yaml.Loader)\n', "B506"),
    ("tools/__quality.py", 'import subprocess\n\nsubprocess.run("echo input", shell=True)\n', "B602"),
    ("tools/__quality.py", 'import os\n\nos.system("echo input")\n', "B605"),
    ("tools/__quality.sh", "#!/usr/bin/env bash\necho $UNQUOTED\n", "SC2086"),
    ("__quality.json", '{"not_formatted":1}\n', "Code style issues"),
    ("__quality.toml", "broken = [\n", "taplo"),
    ("__quality.xml", "<root><unclosed></root>\n", "parser error"),
    ("__quality.yml", "duplicated: true\nduplicated: false\n", "duplicated"),
    (
        ".github/workflows/__quality.yml",
        "name: Control\non: push\njobs:\n  check:\n    runs-on: ubuntu-latest\n    steps:\n"
        '      - run: echo "${{ steps.missing.outputs.value }}"\n',
        "expression",
    ),
)


def check(expected: str, env: dict[str, str] | None = None) -> None:
    result = subprocess.run(
        [sys.executable, "tools/check-static.py"], cwd=ROOT, capture_output=True, text=True, env=env
    )
    output = result.stdout + result.stderr
    if result.returncode == 0 or expected not in output:
        raise RuntimeError(f"Контроль не отклонён ({expected}):\n{output}")
    print(f"PASS: новый файл отклонён ({expected})", flush=True)


def main() -> None:
    subprocess.run([sys.executable, "tools/check-static.py"], cwd=ROOT, check=True)
    for name, source, expected in CASES:
        path = ROOT / name
        if path.exists():
            raise FileExistsError(path)
        try:
            path.write_text(source)
            # Проверяем семантический CLI после форматтера, без маскирующего style failure.
            if path.suffix in {".css", ".scss", ".html", ".yml"} and expected != "duplicated":
                subprocess.run(["node_modules/.bin/prettier", "--write", name], cwd=ROOT, check=True)
            check(expected)
        finally:
            path.unlink(missing_ok=True)
    with tempfile.TemporaryDirectory(prefix="core-missing-tool-") as directory:
        for name in ("git", "node"):
            import shutil

            target = shutil.which(name)
            if target is None:
                raise FileNotFoundError(name)
            (Path(directory) / name).symlink_to(target)
        check("stylua", {**os.environ, "PATH": directory})
    with tempfile.TemporaryDirectory(prefix="core-broken-bandit-") as directory:
        executable = Path(directory) / "bandit"
        for payload in (
            '{"errors": [{"reason": "tool parse failure"}], "results": []}',
            '{"errors": [], "results": [], "metrics": {}}',
        ):
            executable.write_text(f"#!{sys.executable}\nprint({payload!r})\n")
            executable.chmod(0o700)
            check("Bandit не проверил", {**os.environ, "PATH": directory + os.pathsep + os.environ["PATH"]})
    # Фактический Git scope должен включить Lua-файл, которого нет в coverage manifest.
    path = ROOT / "_extensions/course-core/__quality.lua"
    try:
        path.write_text("---@type string\nlocal value = 42\nreturn value\n")
        result = subprocess.run(["quarto", "run", "tools/check-lua.ts"], cwd=ROOT, capture_output=True, text=True)
        if result.returncode == 0 or "__quality.lua" not in result.stdout + result.stderr:
            raise RuntimeError("LuaLS пропустил новый production-файл")
        print("PASS: LuaLS обнаружил новый production-файл")
    finally:
        path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
