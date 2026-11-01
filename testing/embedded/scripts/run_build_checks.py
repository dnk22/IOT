#!/usr/bin/env python3
"""Run reproducible project checks and preserve combined stdout/stderr."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    repo = Path(args.repo).resolve()
    checks = [
        ("firmware normal", ["pio", "run", "-e", "esp32dev"], repo / "firmware"),
        ("firmware perf", ["pio", "run", "-e", "esp32dev-perf"], repo / "firmware"),
        ("backend typecheck", ["yarn", "typecheck"], repo / "backend"),
        ("backend isolated verify", ["yarn", "verify"], repo / "backend"),
        ("frontend typecheck", ["yarn", "typecheck"], repo / "frontend"),
        ("frontend build", ["yarn", "build"], repo / "frontend"),
    ]
    output_lines: list[str] = []
    failed = False
    for name, command, cwd in checks:
        output_lines.append(f"===== {name} =====")
        output_lines.append(f"command: {' '.join(command)}")
        result = subprocess.run(
            command,
            cwd=cwd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        output_lines.append(result.stdout.rstrip())
        output_lines.append(f"exit_status: {result.returncode}")
        failed = failed or result.returncode != 0
    Path(args.output).write_text("\n".join(output_lines) + "\n", encoding="utf-8")
    print(f"checks={len(checks)} status={'FAIL' if failed else 'PASS'} output={args.output}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
