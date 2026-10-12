"""
scripts/eval_latency.py
Measures median and p95 latency for critical CarbonVault endpoints:
- GET /marketplace/listings
- POST /projects/create-project
- POST /payment/create-order
- POST /esg/generate-report

Evaluates against the live Render API URL:
1. Cold start / initial request latency
2. Warm request latency (median and p95 over repeated calls)
Outputs research paper latency table.
"""

import sys
import os
import time
import statistics
from typing import Dict, Any, List
import httpx

RENDER_BASE_URL = os.environ.get("RENDER_API_URL", "https://carbonvault-api.onrender.com").rstrip("/")


def measure_endpoint(
    client: httpx.Client,
    method: str,
    path: str,
    payload: Dict[str, Any] = None,
    n_warm: int = 5
) -> Dict[str, Any]:
    url = f"{RENDER_BASE_URL}{path}"

    # 1. First call (cold / initial request)
    t0 = time.perf_counter()
    cold_status = None
    try:
        if method.upper() == "GET":
            resp = client.get(url, timeout=30.0)
        else:
            resp = client.post(url, json=payload or {}, timeout=30.0)
        cold_latency_ms = round((time.perf_counter() - t0) * 1000.0, 1)
        cold_status = resp.status_code
    except Exception as e:
        cold_latency_ms = round((time.perf_counter() - t0) * 1000.0, 1)
        cold_status = f"Err ({e.__class__.__name__})"

    # 2. Warm calls
    warm_latencies = []
    warm_statuses = []
    for _ in range(n_warm):
        time.sleep(0.3)
        t_start = time.perf_counter()
        try:
            if method.upper() == "GET":
                resp = client.get(url, timeout=20.0)
            else:
                resp = client.post(url, json=payload or {}, timeout=20.0)
            dur_ms = (time.perf_counter() - t_start) * 1000.0
            warm_latencies.append(dur_ms)
            warm_statuses.append(resp.status_code)
        except Exception as e:
            dur_ms = (time.perf_counter() - t_start) * 1000.0
            warm_latencies.append(dur_ms)
            warm_statuses.append(f"Err ({e.__class__.__name__})")

    if warm_latencies:
        warm_latencies.sort()
        median_ms = round(statistics.median(warm_latencies), 1)
        idx_p95 = min(len(warm_latencies) - 1, int(len(warm_latencies) * 0.95))
        p95_ms = round(warm_latencies[idx_p95], 1)
    else:
        median_ms = 0.0
        p95_ms = 0.0

    return {
        "endpoint": f"{method} {path}",
        "cold_ms": cold_latency_ms,
        "cold_status": cold_status,
        "median_ms": median_ms,
        "p95_ms": p95_ms,
        "warm_samples": len(warm_latencies)
    }


def run_latency_benchmark():
    print("=" * 82)
    print(f"CarbonVault Endpoint Latency Benchmark (Live Render: {RENDER_BASE_URL})")
    print("=" * 82)

    endpoints = [
        {
            "method": "GET",
            "path": "/marketplace/listings",
            "payload": None
        },
        {
            "method": "POST",
            "path": "/projects/create-project",
            "payload": {
                "name": "Benchmark Project Latency Test",
                "plantation_type": "reforestation",
                "area_hectares": 10.0,
                "latitude": 12.34,
                "longitude": 78.56,
                "number_of_trees": 5000,
                "dry_run": True
            }
        },
        {
            "method": "POST",
            "path": "/payment/create-order",
            "payload": {
                "amount_inr": 1500,
                "credits": 2,
                "project_id": "PRJ-TEST",
                "currency": "INR"
            }
        },
        {
            "method": "POST",
            "path": "/esg/generate-report",
            "payload": {
                "project_id": "PRJ-MANGROVE-01",
                "company_name": "Benchmark Corp",
                "credits_retired": 10
            }
        }
    ]

    results = []
    with httpx.Client() as client:
        for ep in endpoints:
            print(f"Benchmarking {ep['method']} {ep['path']}...")
            res = measure_endpoint(client, ep["method"], ep["path"], ep["payload"], n_warm=5)
            results.append(res)

    print("\n" + "=" * 82)
    print(f"{'Endpoint':<34} | {'Cold / Idle (ms)':<16} | {'Warm Median (ms)':<16} | {'Warm p95 (ms)':<12}")
    print("-" * 82)
    for r in results:
        print(f"{r['endpoint']:<34} | {r['cold_ms']:>14.1f} ms | {r['median_ms']:>14.1f} ms | {r['p95_ms']:>10.1f} ms")
    print("=" * 82)
    print(f"Tested on {RENDER_BASE_URL} at {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n")


if __name__ == "__main__":
    run_latency_benchmark()
