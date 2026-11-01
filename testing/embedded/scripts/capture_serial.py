#!/usr/bin/env python3
"""Capture bounded, sanitized ESP32 serial evidence."""

from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

import serial


IPV4_PATTERN = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
SAMPLE_PATTERN = re.compile(r"Sampled at\s*:\s*(\d+)\s*ms")


def sanitize(line: str) -> str:
    return IPV4_PATTERN.sub("[REDACTED_IP]", line)


def is_usable_text(line: str) -> bool:
    """Reject reset-time binary noise without hiding normal diagnostic lines."""
    if len(line) > 512 or "\ufffd" in line:
        return False
    if line.strip() in {"", "|", "||", "cting..."}:
        return False
    return all(character == "\t" or ord(character) >= 32 for character in line)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--duration", type=float, default=300.0)
    parser.add_argument("--samples", type=int, default=0)
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    samples = 0

    with serial.Serial(args.port, args.baud, timeout=0.5) as device, output_path.open(
        "w", encoding="utf-8"
    ) as output:
        while time.monotonic() - started < args.duration:
            raw = device.readline()
            if not raw:
                continue
            line = raw.decode("utf-8", errors="replace").strip("\r\n")
            if not is_usable_text(line):
                continue
            line = sanitize(line)
            output.write(line + "\n")
            output.flush()
            if SAMPLE_PATTERN.search(line):
                samples += 1
                if args.samples > 0 and samples >= args.samples:
                    break

    elapsed = time.monotonic() - started
    print(f"captured_samples={samples} elapsed_seconds={elapsed:.3f} output={output_path}")
    return 0 if samples > 0 else 2


if __name__ == "__main__":
    sys.exit(main())
