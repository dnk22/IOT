#!/usr/bin/env python3
"""Combine baseline and instrumented analysis into required metrics artifacts."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline-json", required=True)
    parser.add_argument("--baseline-csv", required=True)
    parser.add_argument("--soak-json", required=True)
    parser.add_argument("--soak-csv", required=True)
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--output-csv", required=True)
    args = parser.parse_args()

    baseline = json.loads(Path(args.baseline_json).read_text(encoding="utf-8"))
    soak = json.loads(Path(args.soak_json).read_text(encoding="utf-8"))
    combined = {
        "schemaVersion": 1,
        "notes": [
            "HARDWARE metrics use ESP32 software timestamps, not oscilloscope contact timing.",
            "MQTT publish_call measures the synchronous client call, not broker round-trip time.",
        ],
        "baseline": baseline,
        "instrumentedSoak": soak,
    }
    Path(args.output_json).write_text(
        json.dumps(combined, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    rows: list[dict[str, str]] = []
    fieldnames: list[str] | None = None
    for filename in (args.baseline_csv, args.soak_csv):
        with Path(filename).open(encoding="utf-8", newline="") as source:
            reader = csv.DictReader(source)
            if fieldnames is None:
                fieldnames = list(reader.fieldnames or [])
            rows.extend(reader)
    with Path(args.output_csv).open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fieldnames or [])
        writer.writeheader()
        writer.writerows(rows)
    print(json.dumps({"rows": len(rows), "output": args.output_csv}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
