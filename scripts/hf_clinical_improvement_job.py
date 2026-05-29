# /// script
# dependencies = ["beautifulsoup4", "requests"]
# ///
"""Hugging Face Jobs workbench for Rhema clinical improvements.

This script is designed for `hf jobs uv run` or the Hugging Face Jobs MCP tool.
It reads only public pages, generates deterministic improvement proposals, and
prints JSON that can be stored as an HF artifact or copied into
HF_CLINICAL_JOB_CONTEXT_URL for the Supabase improvement cycle.
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Iterable

import requests
from bs4 import BeautifulSoup


DEFAULT_ROUTES = ["/", "/learn", "/scores", "/landing", "/about"]


@dataclass
class Finding:
    area: str
    title: str
    rationale: str
    severity: str = "review"


def normalize_base_url(url: str) -> str:
    return url.rstrip("/")


def fetch_text(url: str) -> tuple[int | None, str]:
    try:
        response = requests.get(
            url,
            timeout=12,
            headers={"User-Agent": "rhema-hf-clinical-improvement-job/1.0"},
        )
    except requests.RequestException as exc:
        return None, f"FETCH_ERROR: {exc}"

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = re.sub(r"\s+", " ", soup.get_text(" ")).strip()
    return response.status_code, text[:12000]


def score_route(path: str, status: int | None, text: str) -> list[Finding]:
    findings: list[Finding] = []
    lower = text.lower()

    if status != 200:
        findings.append(
            Finding(
                area="performance",
                title=f"Public route {path} did not return HTTP 200",
                rationale=f"Observed status {status}; clinical tools need reliable public navigation before patient expansion.",
            )
        )
        return findings

    if len(text) < 600:
        findings.append(
            Finding(
                area="content",
                title=f"Route {path} has low visible clinical content density",
                rationale="The page text is short after script/style removal; add clinically useful summaries, patient-safe guidance, or clearer task entry points.",
            )
        )

    if "paciente" not in lower and "patient" not in lower:
        findings.append(
            Finding(
                area="copy",
                title=f"Route {path} lacks explicit patient-facing language",
                rationale="Patient expansion benefits from clear language about who the tool serves and what action is safe to take next.",
            )
        )

    if "emerg" not in lower and "urg" not in lower and path in {"/", "/landing"}:
        findings.append(
            Finding(
                area="clinical_tools",
                title=f"Route {path} should clarify emergency/urgent-care boundaries",
                rationale="Clinical patient-facing interfaces should distinguish education/workflow support from urgent medical care.",
            )
        )

    if "score" in path and "DAS" not in text and "CDAI" not in text and "SDAI" not in text:
        findings.append(
            Finding(
                area="clinical_tools",
                title="Scores route should expose recognizable rheumatology instruments",
                rationale="The score experience should quickly surface named instruments such as DAS28, CDAI, SDAI, BASDAI, or patient-reported outcomes.",
            )
        )

    return findings[:4]


def unique_findings(findings: Iterable[Finding], limit: int = 12) -> list[Finding]:
    seen: set[tuple[str, str]] = set()
    result: list[Finding] = []
    for finding in findings:
        key = (finding.area, finding.title)
        if key in seen:
            continue
        seen.add(key)
        result.append(finding)
        if len(result) >= limit:
            break
    return result


def main() -> int:
    base_url = normalize_base_url(os.environ.get("RHEMA_PUBLIC_URL", "https://rhema-care-flow.lovable.app/"))
    routes = [r.strip() for r in os.environ.get("RHEMA_ROUTES", ",".join(DEFAULT_ROUTES)).split(",") if r.strip()]

    route_results = []
    all_findings: list[Finding] = []
    for route in routes:
        path = route if route.startswith("/") else f"/{route}"
        url = f"{base_url}{path}"
        status, text = fetch_text(url)
        route_results.append({"path": path, "status": status, "chars": len(text)})
        all_findings.extend(score_route(path, status, text))

    findings = unique_findings(all_findings)
    output = {
        "source": "huggingface-jobs",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "base_url": base_url,
        "routes": route_results,
        "proposals": [asdict(f) for f in findings],
        "handoff": {
            "safe_to_auto_apply": False,
            "next_step": "Review proposals in Rhema ai_improvement_tasks before code or content changes.",
            "privacy": "No PHI or authenticated patient data was fetched.",
        },
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
