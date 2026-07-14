#!/usr/bin/env python3
"""
Research Runner: Scans top GitHub repositories using ScapeGuard security scanner
and generates a structured markdown research findings report.
"""
import os
import sys
import tempfile
import urllib.parse
import json
import logging
from pathlib import Path
from datetime import datetime, timezone

# Add backend directory to path so we can import app modules
sys.path.append(str(Path(__file__).parent.parent / "backend"))

import app.converter as converter
from app import skillforge
from app.skillforge.models import RepoMeta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("research_runner")

# Pre-defined list of top popular open-source repositories to scan
POPULAR_REPOS = [
    "https://github.com/stripe/stripe-node",
    "https://github.com/fastapi/fastapi",
    "https://github.com/pydantic/pydantic",
    "https://github.com/expressjs/express",
    "https://github.com/psf/requests",
    "https://github.com/tiangolo/typer",
    "https://github.com/pallets/flask",
    "https://github.com/django/django",
    "https://github.com/langchain-ai/langchain",
    "https://github.com/hotwired/turbo",
]

def scan_repository(repo_url: str, github_token: str = None):
    logger.info(f"Cloning and scanning: {repo_url}")
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            clone_path = os.path.join(tmpdir, "repo")
            converter.clone_repository(repo_url, clone_path, github_token=github_token)
            digest_str, metadata = converter.generate_markdown_digest(
                repo_url, clone_path, return_metadata=True
            )
            
            owner = metadata["owner"]
            repo = metadata["repo"]
            languages = metadata["primary_languages"]
            files_analyzed = metadata["files_analyzed"]
            
            meta = RepoMeta(
                owner=owner,
                repo=repo,
                repo_url=repo_url,
                primary_languages=languages,
                files_analyzed=files_analyzed,
                readme=metadata.get("readme", ""),
                file_structure=metadata.get("file_structure", ""),
                structure_overview=metadata.get("structure_overview", ""),
                generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                git_sha=converter.get_git_sha(clone_path),
            )
            units = skillforge.units_from_clone(Path(clone_path))
            
            # Run the compiler + ScapeGuard scanner (code skill type for speed)
            pkg = skillforge.build_skill(
                units, meta, digest_hash=skillforge.content_hash(digest_str),
                digest_content=digest_str, skill_type="code"
            )
            
            report = pkg.scan_report
            return {
                "name": f"{owner}/{repo}",
                "repo_url": repo_url,
                "languages": languages,
                "files_analyzed": files_analyzed,
                "grade": report.grade,
                "status": report.status.value,
                "risk_score": report.risk_score,
                "findings_count": len(report.findings),
                "findings": [
                    {
                        "rule": f.rule,
                        "severity": f.severity.value,
                        "message": f.message,
                        "file": f.file,
                    }
                    for f in report.findings
                ]
            }
    except Exception as e:
        logger.error(f"Error scanning {repo_url}: {e}")
        return {
            "name": repo_url.replace("https://github.com/", ""),
            "repo_url": repo_url,
            "languages": [],
            "files_analyzed": 0,
            "grade": "F",
            "status": "FAIL",
            "risk_score": 100,
            "findings_count": 0,
            "error": str(e)
        }

def run_research(github_token: str = None):
    results = []
    logger.info(f"Starting ScapeGuard security scan over {len(POPULAR_REPOS)} libraries...")
    
    for repo_url in POPULAR_REPOS:
        res = scan_repository(repo_url, github_token)
        results.append(res)
        
    # Generate Markdown Report
    report_lines = [
        "# ScapeGuard Security Research Report",
        f"Generated at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        "",
        "This report aggregates security scan verdicts from running ScapeGuard v2.1 over popular open-source repositories.",
        "",
        "## Summary table",
        "",
        "| Repository | Primary Languages | Grade | Status | Risk Score | Findings |",
        "|---|---|---|---|---|---|",
    ]
    
    for r in results:
        langs = ", ".join(r["languages"]) if r["languages"] else "N/A"
        err_suffix = " (Error)" if "error" in r else ""
        report_lines.append(
            f"| [{r['name']}]({r['repo_url']}) | {langs} | **{r['grade']}** | {r['status']}{err_suffix} | {r['risk_score']} | {r['findings_count']} |"
        )
        
    report_lines.append("")
    report_lines.append("## Detailed Findings")
    report_lines.append("")
    
    for r in results:
        if r.get("findings"):
            report_lines.append(f"### {r['name']}")
            report_lines.append("")
            for f in r["findings"]:
                report_lines.append(f"- **[{f['severity'].upper()}] {f['rule']}** in `{f['file']}`: {f['message']}")
            report_lines.append("")
            
    report_content = "\n".join(report_lines)
    
    # Save findings report to docs/research_findings.md
    output_path = Path(__file__).parent.parent / "docs" / "research_findings.md"
    output_path.write_text(report_content, encoding="utf-8")
    logger.info(f"Research findings saved to: {output_path}")

if __name__ == "__main__":
    token = os.environ.get("GITHUB_TOKEN")
    run_research(token)
