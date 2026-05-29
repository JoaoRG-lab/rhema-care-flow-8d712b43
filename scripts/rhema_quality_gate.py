#!/usr/bin/env python3
"""Rhema local quality gate.

Runs repeatable checks, computes ADR (Agentic Delivery Reliability), and writes
handoff reports that another agent or human can continue from.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HANDOFF = Path.home() / "rhema-ops" / "handoff"
ADR_THRESHOLD = 0.90


@dataclass
class CheckResult:
    name: str
    command: str
    passed: bool
    duration_seconds: float
    output_tail: str


def run(command: list[str], timeout: int) -> CheckResult:
    started = datetime.now(timezone.utc)
    proc = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        check=False,
    )
    ended = datetime.now(timezone.utc)
    output = redact(proc.stdout or "")
    tail = "\n".join(output.splitlines()[-80:])
    return CheckResult(
        name=command[0] if len(command) == 1 else " ".join(command[:2]),
        command=" ".join(command),
        passed=proc.returncode == 0,
        duration_seconds=(ended - started).total_seconds(),
        output_tail=tail,
    )


def redact(text: str) -> str:
    patterns = [
        r"github_pat_[A-Za-z0-9_]+",
        r"ghp_[A-Za-z0-9_]+",
        r"sk-[A-Za-z0-9_-]{20,}",
        r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}",
    ]
    redacted = text
    for pattern in patterns:
        redacted = re.sub(pattern, "[REDACTED]", redacted)
    return redacted


def git_output(args: list[str]) -> str:
    proc = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    return redact(proc.stdout.strip())


def secret_scan() -> CheckResult:
    started = datetime.now(timezone.utc)
    proc = subprocess.run(
        [
            "git",
            "grep",
            "-nE",
            r"(github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]{20,})",
            "--",
            ".",
            ":(exclude)package-lock.json",
            ":(exclude)docs/legacy/*",
        ],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    ended = datetime.now(timezone.utc)
    output = redact(proc.stdout or "")
    # git grep exits 1 when there are no matches; that is the desired state.
    passed = proc.returncode == 1
    return CheckResult(
        name="secret-scan",
        command="git grep -nE <secret-patterns>",
        passed=passed,
        duration_seconds=(ended - started).total_seconds(),
        output_tail="\n".join(output.splitlines()[-80:]),
    )


def score_adr(results: list[CheckResult], fast: bool) -> dict[str, float]:
    weights = {
        "functionality": 0.30,
        "security": 0.20,
        "redundancy": 0.15,
        "reproducibility": 0.15,
        "coverage": 0.10,
        "cost_time": 0.10,
    }
    by_command = {r.command: r.passed for r in results}
    lint_ok = by_command.get("npm run lint", False)
    type_ok = by_command.get("npx tsc --noEmit", False)
    build_ok = by_command.get("npm run build", fast)
    test_ok = by_command.get("npm run test", fast)
    secret_ok = next((r.passed for r in results if r.name == "secret-scan"), False)

    subscores = {
        "functionality": mean([type_ok, build_ok]),
        "security": 1.0 if secret_ok else 0.0,
        "redundancy": mean([lint_ok, type_ok, test_ok]),
        "reproducibility": mean([build_ok, bool(git_output(["rev-parse", "--short", "HEAD"]))]),
        "coverage": 1.0 if test_ok else 0.55,
        "cost_time": 1.0 if sum(r.duration_seconds for r in results) < (180 if fast else 420) else 0.75,
    }
    adr = sum(subscores[k] * weights[k] for k in weights)
    return {**subscores, "adr": round(adr, 4)}


def mean(values: list[bool]) -> float:
    return sum(1 for value in values if value) / max(len(values), 1)


def write_reports(payload: dict, handoff_dir: Path) -> tuple[Path, Path]:
    handoff_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = handoff_dir / f"rhema-quality-gate-{stamp}.json"
    md_path = handoff_dir / f"rhema-quality-gate-{stamp}.md"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    score = payload["score"]
    checks = payload["checks"]
    md = [
        "# Rhema Quality Gate",
        "",
        f"- Generated: `{payload['generated_at']}`",
        f"- Repo: `{payload['repo']}`",
        f"- Branch: `{payload['branch']}`",
        f"- SHA: `{payload['sha']}`",
        f"- ADR: `{score['adr']:.2f}`",
        f"- Deploy gate: `{'PASS' if payload['deploy_gate_passed'] else 'BLOCK'}`",
        "",
        "## Subscores",
        "",
    ]
    for key, value in score.items():
        md.append(f"- `{key}`: `{value:.2f}`")
    md.extend(["", "## Checks", ""])
    for check in checks:
        md.append(f"- `{'PASS' if check['passed'] else 'FAIL'}` `{check['command']}` ({check['duration_seconds']:.1f}s)")
    md.extend(["", "## Next Safe Actions", ""])
    if payload["deploy_gate_passed"]:
        md.append("- Open or update the GitHub PR and wait for remote checks before merge/deploy.")
    else:
        md.append("- Fix failing checks before merge/deploy.")
    md.append("- Do not run Supabase migrations or production deploy without explicit target confirmation.")
    md_path.write_text("\n".join(md) + "\n", encoding="utf-8")
    return json_path, md_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Rhema ADR quality gate.")
    parser.add_argument("--fast", action="store_true", help="Skip slower build/test checks.")
    parser.add_argument("--handoff-dir", default=str(DEFAULT_HANDOFF))
    args = parser.parse_args()

    commands = [
        ["npx", "tsc", "--noEmit"],
        ["npm", "run", "lint"],
    ]
    if not args.fast:
        commands.extend([["npm", "run", "test"], ["npm", "run", "build"]])

    results = [run(command, timeout=240) for command in commands]
    results.append(secret_scan())
    score = score_adr(results, fast=args.fast)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repo": git_output(["remote", "get-url", "origin"]),
        "branch": git_output(["branch", "--show-current"]),
        "sha": git_output(["rev-parse", "HEAD"]),
        "status": git_output(["status", "--short"]),
        "score": score,
        "deploy_gate_passed": score["adr"] >= ADR_THRESHOLD and all(r.passed for r in results),
        "checks": [asdict(result) for result in results],
    }
    json_path, md_path = write_reports(payload, Path(args.handoff_dir))
    print(f"ADR={score['adr']:.2f}")
    print(f"deploy_gate={'PASS' if payload['deploy_gate_passed'] else 'BLOCK'}")
    print(f"json={json_path}")
    print(f"markdown={md_path}")
    return 0 if payload["deploy_gate_passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
