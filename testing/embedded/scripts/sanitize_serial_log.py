#!/usr/bin/env python3
"""Sanitize an existing ESP32 serial log in place or into another file."""

from __future__ import annotations

import argparse
from pathlib import Path

from capture_serial import is_usable_text, sanitize


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("output")
    args = parser.parse_args()

    source = Path(args.input)
    destination = Path(args.output)
    lines = source.read_text(encoding="utf-8", errors="replace").splitlines()
    clean_lines = [sanitize(line) for line in lines if is_usable_text(line)]
    destination.write_text("\n".join(clean_lines) + "\n", encoding="utf-8")
    print(f"kept_lines={len(clean_lines)} output={destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
