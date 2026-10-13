#!/usr/bin/env python3
"""
CarbonVault — Automated CI Hardcode Gate (Python Edition)
Scans codebase for prohibited static domain constants, fake entities,
fabricated climate metrics, and mock data arrays outside of tests/ and seed.py.
"""

import os
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

EXEMPT_PATHS = [
    "node_modules",
    ".git",
    "dist",
    "docs",
    "scripts",
    "tests",
    "Backend/tests",
    "Backend/seed.py",
    "Backend/routers/config_router.py",
    "Backend/test_backend_endpoints.py",
]

SCAN_DIRS = [
    ROOT_DIR / "Frontend" / "src",
    ROOT_DIR / "Backend",
]

BANNED_RULES = [
    {
        "name": "Hardcoded INR FX Rate (83.5 / 83.50)",
        "pattern": r"\b83\.50?\b",
        "description": "Use dynamic FX rates from get_current_inr_rate() or fetchLiveFxRate() instead of static 83.5",
        "exempt_files": [
            "Backend/routers/config_router.py",
            "Backend/routers/payment_router.py",
            "Backend/credit_calculation/credits_module/funding_engine.py",
            "Backend/routers/marketplace_router.py",
        ],
    },
    {
        "name": "Fabricated 49,400 tonnes Portfolio Holding",
        "pattern": r"\b49,?400\b",
        "description": "Fabricated corporate holding. Aggregate from real database transactions instead.",
        "exempt_files": [],
    },
    {
        "name": "Fabricated 89 GWh Renewable Generation Claim",
        "pattern": r"\b89\s*GWh\b",
        "description": "Fabricated renewable energy metric. Query approved project telemetry instead.",
        "exempt_files": [],
    },
    {
        "name": "Ungrounded 99.9% Fraud-Free Claim",
        "pattern": r"99\.9%\s*(fraud-free|accuracy|uptime)",
        "description": "Unverifiable promotional claim. Use verifiable empirical benchmark figures.",
        "exempt_files": [],
    },
    {
        "name": "Fabricated ISO 14001 Certified Tick",
        "pattern": r"ISO\s*14001\s*certified",
        "description": "Unverified ISO certification. Use informational reporting_frameworks_aligned with disclaimers.",
        "exempt_files": [],
    },
    {
        "name": "Fake Prototype Entity (GreenForest)",
        "pattern": r"\bGreenForest(\s*Corp)?\b",
        "description": "Synthetic company entity. Use real registered user accounts or empty states.",
        "exempt_files": [],
    },
    {
        "name": "Mock Data Arrays in Production",
        "pattern": r"\bmockPublicLeaderboard\b",
        "description": "Hardcoded leaderboard array. Query dynamic GRS leaderboard endpoint.",
        "exempt_files": [],
    },
]


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def is_exempt(filepath: Path) -> bool:
    rel_path = filepath.relative_to(ROOT_DIR).as_posix()
    return any(rel_path == ep or rel_path.startswith(ep + "/") for ep in EXEMPT_PATHS)


def scan_codebase():
    violations = []
    print("[CarbonVault CI Gate] Scanning codebase for hardcoded domain values...")

    for base_dir in SCAN_DIRS:
        if not base_dir.exists():
            continue
        for root, dirs, files in os.walk(base_dir):
            root_path = Path(root)
            dirs[:] = [d for d in dirs if not is_exempt(root_path / d)]

            for file in files:
                filepath = root_path / file
                if is_exempt(filepath):
                    continue

                if filepath.suffix.lower() not in [".js", ".jsx", ".ts", ".tsx", ".py", ".json", ".html"]:
                    continue

                try:
                    content = filepath.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue

                rel_str = filepath.relative_to(ROOT_DIR).as_posix()
                lines = content.splitlines()

                for rule in BANNED_RULES:
                    if any(rel_str == ef or rel_str.endswith(ef) for ef in rule["exempt_files"]):
                        continue

                    regex = re.compile(rule["pattern"], re.IGNORECASE)
                    for line_idx, line in enumerate(lines, 1):
                        trimmed = line.strip()
                        if trimmed.startswith(("//", "#", "*", "/*")):
                            continue
                        if regex.search(line):
                            violations.append({
                                "file": rel_str,
                                "line": line_idx,
                                "rule": rule["name"],
                                "desc": rule["description"],
                                "snippet": trimmed[:100],
                            })

    if violations:
        print(f"\n[FAIL] CI HARDCODE GATE FAILED: Found {len(violations)} prohibited hardcoded patterns:\n")
        for idx, v in enumerate(violations, 1):
            print(f"  {idx}. [{v['rule']}]")
            print(f"     File: {v['file']}:{v['line']}")
            print(f"     Code: {v['snippet']}")
            print(f"     Fix:  {v['desc']}\n")
        sys.exit(1)

    print("[PASS] CI Hardcode Gate Passed: Zero banned domain constants, fake entities, or mock data detected.")
    sys.exit(0)


if __name__ == "__main__":
    scan_codebase()
