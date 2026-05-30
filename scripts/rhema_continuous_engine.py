#!/usr/bin/env python3
"""Rhema continuous improvement engine.

Creates a deterministic, review-only handoff from public routes and local
engine manifests. It is safe to run locally, in Replit, Netlify build hooks, or
Hugging Face Jobs because it never writes production systems.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HANDOFF = Path.home() / "rhema-ops" / "handoff"
DEFAULT_ROUTES = ["/", "/learn", "/scores", "/about", "/quality-test"]


@dataclass
class Proposal:
    source: str
    area: str
    title: str
    rationale: str
    severity: str = "review"


def read_manifest() -> dict:
    path = ROOT / "public" / "engine-manifest.json"
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_base(url: str) -> str:
    return url.rstrip("/")


def fetch_public_text(url: str) -> tuple[int | None, str]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "rhema-continuous-engine/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            status = int(response.status)
            raw = response.read(500_000).decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(80_000).decode("utf-8", errors="replace")
    except Exception as exc:  # noqa: BLE001 - this is a handoff tool.
        return None, f"FETCH_ERROR: {exc}"

    text = re.sub(r"<script[\s\S]*?</script>", " ", raw, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return status, text[:14000]


def audit_route(path: str, status: int | None, text: str) -> list[Proposal]:
    lower = text.lower()
    proposals: list[Proposal] = []

    if status != 200:
        return [
            Proposal(
                source="public-route",
                area="reliability",
                title=f"{path} did not return HTTP 200",
                rationale=f"Observed status {status}; preview and public routes should be stable before improvement agents consume them.",
            )
        ]

    if len(text) < 700:
        proposals.append(
            Proposal(
                source="public-route",
                area="content",
                title=f"{path} has low visible content density",
                rationale="Continuous agents need enough visible semantic content to evaluate clinical clarity, navigation, and safety boundaries.",
            )
        )

    if path in {"/", "/about"} and not any(term in lower for term in ["urgent", "emerg", "emergência", "urgência"]):
        proposals.append(
            Proposal(
                source="public-route",
                area="clinical-safety",
                title=f"{path} should clarify urgent-care boundaries",
                rationale="Patient-facing clinical software should clearly separate education/workflow support from emergency care.",
            )
        )

    if path == "/scores" and not any(term in lower for term in ["das28", "cdai", "sdai", "basdai"]):
        proposals.append(
            Proposal(
                source="public-route",
                area="clinical-tools",
                title="Scores route should expose recognizable rheumatology instruments",
                rationale="Named instruments help clinicians and improvement agents verify coverage across rheumatology workflows.",
            )
        )

    return proposals[:3]


def audit_manifest(manifest: dict) -> list[Proposal]:
    proposals: list[Proposal] = []
    env_ids = {env["id"] for env in manifest.get("environments", [])}
    expected = {"local-wsl", "huggingface-jobs", "replit", "netlify", "hex"}
    missing = sorted(expected - env_ids)
    if missing:
        proposals.append(
            Proposal(
                source="engine-manifest",
                area="orchestration",
                title="Engine manifest is missing environments",
                rationale=f"Missing: {', '.join(missing)}.",
            )
        )

    policy = manifest.get("policy", {})
    if policy.get("autoDeploy") is not False or policy.get("requiresAdrGate") is not True:
        proposals.append(
            Proposal(
                source="engine-manifest",
                area="safety",
                title="Engine policy should remain proposal-first",
                rationale="Continuous coding environments must not bypass ADR, PR review, or production deploy authorization.",
                severity="blocked",
            )
        )
    return proposals


def unique(proposals: list[Proposal]) -> list[Proposal]:
    seen: set[tuple[str, str]] = set()
    output: list[Proposal] = []
    for proposal in proposals:
        key = (proposal.area, proposal.title)
        if key in seen:
            continue
        seen.add(key)
        output.append(proposal)
    return output


def write_handoff(payload: dict, handoff_dir: Path) -> Path:
    handoff_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = handoff_dir / f"rhema-continuous-engine-{stamp}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Rhema continuous engine handoff.")
    parser.add_argument("--base-url", default=os.environ.get("RHEMA_PUBLIC_URL", "https://rhema-care-flow.lovable.app/"))
    parser.add_argument("--routes", default=os.environ.get("RHEMA_ROUTES", ",".join(DEFAULT_ROUTES)))
    parser.add_argument("--emit-handoff", action="store_true")
    parser.add_argument("--handoff-dir", default=str(DEFAULT_HANDOFF))
    args = parser.parse_args()

    manifest = read_manifest()
    base = normalize_base(args.base_url)
    routes = [route.strip() for route in args.routes.split(",") if route.strip()]

    route_results = []
    proposals = audit_manifest(manifest)
    for route in routes:
      path = route if route.startswith("/") else f"/{route}"
      status, text = fetch_public_text(f"{base}{path}")
      route_results.append({"path": path, "status": status, "chars": len(text)})
      proposals.extend(audit_route(path, status, text))

    payload = {
        "source": "rhema-continuous-engine",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base,
        "repo": manifest["canonicalRepo"],
        "deploy": manifest["canonicalDeploy"],
        "policy": manifest["policy"],
        "routes": route_results,
        "environments": manifest["environments"],
        "proposals": [asdict(item) for item in unique(proposals)[:12]],
        "next_safe_actions": [
            "Review proposals before code changes.",
            "Run npm run quality:gate before PR/deploy.",
            "Do not send PHI to external workbenches.",
            "Do not auto-deploy from Replit, Netlify, Hugging Face, or Hex.",
        ],
    }

    if args.emit_handoff:
        payload["handoff_path"] = str(write_handoff(payload, Path(args.handoff_dir)))

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
