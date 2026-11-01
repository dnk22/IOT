#!/usr/bin/env python3
"""Analyze ESP32 sample timing and structured performance records."""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import statistics
from pathlib import Path


SAMPLE_PATTERN = re.compile(r"Sampled at\s*:\s*(\d+)\s*ms")
PERF_PATTERN = re.compile(r"^\[PERF\]\s+(\{.*\})$")
UINT32_MODULUS = 1 << 32


def percentile(values: list[float], percentage: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil(percentage * len(ordered)))
    return ordered[rank - 1]


def summarize(values: list[float]) -> dict[str, float | int | None]:
    if not values:
        return {
            "n": 0,
            "min": None,
            "mean": None,
            "median": None,
            "p95": None,
            "max": None,
            "stddev": None,
        }
    return {
        "n": len(values),
        "min": min(values),
        "mean": statistics.fmean(values),
        "median": statistics.median(values),
        "p95": percentile(values, 0.95),
        "max": max(values),
        "stddev": statistics.pstdev(values),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument("--json", required=True)
    parser.add_argument("--csv", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--git-sha", required=True)
    parser.add_argument("--source", default="HARDWARE")
    parser.add_argument("--condition", default="unspecified")
    args = parser.parse_args()

    lines = Path(args.input).read_text(encoding="utf-8", errors="replace").splitlines()
    sample_times = [int(match.group(1)) for line in lines if (match := SAMPLE_PATTERN.search(line))]
    intervals = [
        float((current - previous) % UINT32_MODULUS)
        for previous, current in zip(sample_times, sample_times[1:])
    ]
    perf_records: list[dict[str, object]] = []
    for line in lines:
        match = PERF_PATTERN.match(line)
        if not match:
            continue
        try:
            perf_records.append(json.loads(match.group(1)))
        except json.JSONDecodeError:
            continue

    grouped_perf: dict[str, list[float]] = {}
    for record in perf_records:
        value = record.get("value")
        if not isinstance(value, (int, float)):
            continue
        key = f"{record.get('testId', 'PERF')}.{record.get('metric', 'unknown')}.{record.get('unit', 'unknown')}"
        grouped_perf.setdefault(key, []).append(float(value))
    perf_summary = {key: summarize(values) for key, values in sorted(grouped_perf.items())}
    perf_uptimes = [
        int(record["uptimeMs"])
        for record in perf_records
        if isinstance(record.get("uptimeMs"), int)
    ]

    analysis = {
        "runId": args.run_id,
        "gitSha": args.git_sha,
        "source": args.source,
        "condition": args.condition,
        "sampleCount": len(sample_times),
        "sampleIntervalMs": summarize(intervals),
        "intervalOutliersOver100Ms": sum(abs(value - 2000.0) > 100.0 for value in intervals),
        "sampleTimerRegressionCount": sum(
            current < previous for previous, current in zip(sample_times, sample_times[1:])
        ),
        "dhtErrorCount": sum("DHT status  : ERROR" in line for line in lines),
        "mqttPublishSuccessCount": sum("[MQTT] Telemetry published." in line for line in lines),
        "mqttPublishFailureCount": sum("publish failed" in line.lower() for line in lines),
        "fatalErrorCount": sum(
            any(token in line.lower() for token in ("guru meditation", "panic'ed", "abort()"))
            for line in lines
        ),
        "perfUptimeMs": {
            "first": min(perf_uptimes) if perf_uptimes else None,
            "last": max(perf_uptimes) if perf_uptimes else None,
            "span": (max(perf_uptimes) - min(perf_uptimes)) if perf_uptimes else None,
        },
        "perfMetricSummary": perf_summary,
        "perfRecords": perf_records,
    }
    Path(args.json).write_text(json.dumps(analysis, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    rows: list[dict[str, object]] = []
    for index, interval in enumerate(intervals, start=1):
        rows.append({
            "run_id": args.run_id,
            "git_sha": args.git_sha,
            "test_id": "T01",
            "metric": "sensor_interval",
            "value": interval,
            "unit": "ms",
            "sample_index": index,
            "uptime_ms": sample_times[index],
            "condition": args.condition,
            "source": args.source,
        })
    for record in perf_records:
        metric = str(record.get("metric", "unknown"))
        value = record.get("value")
        unit = str(record.get("unit", "unknown"))
        rows.append({
            "run_id": args.run_id,
            "git_sha": args.git_sha,
            "test_id": record.get("testId", "PERF"),
            "metric": metric,
            "value": value,
            "unit": unit,
            "sample_index": record.get("sequence", ""),
            "uptime_ms": record.get("uptimeMs", ""),
            "condition": record.get("condition", args.condition),
            "source": args.source,
        })

    fieldnames = [
        "run_id", "git_sha", "test_id", "metric", "value", "unit",
        "sample_index", "uptime_ms", "condition", "source",
    ]
    with Path(args.csv).open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(json.dumps({
        "sampleCount": analysis["sampleCount"],
        "sampleIntervalMs": analysis["sampleIntervalMs"],
        "dhtErrorCount": analysis["dhtErrorCount"],
        "mqttPublishSuccessCount": analysis["mqttPublishSuccessCount"],
        "perfRecordCount": len(perf_records),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
