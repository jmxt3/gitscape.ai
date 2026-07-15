#!/usr/bin/env python3
"""
Seeding script for GitScape Public Registry.
Clones, analyzes, and scans a list of high-profile popular repositories,
saving their reports and categories directly into the GCS registry bucket.

Usage:
    python seed_registry.py
"""

import os
import sys
import tempfile
import logging
from pathlib import Path
from datetime import datetime, timezone

# Ensure the backend directory is in the import path
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_registry")

from app import converter
from app import skillforge
from app import registry_store
from app.skillforge.models import RepoMeta
from app.config import settings

SEED_REPOSITORIES = [
    "https://github.com/fastapi/fastapi",
    "https://github.com/pydantic/pydantic",
    "https://github.com/psf/requests",
    "https://github.com/expressjs/express",
    "https://github.com/stripe/stripe-node",
    "https://github.com/pallets/flask",
    "https://github.com/django/django",
    "https://github.com/encode/django-rest-framework",
    "https://github.com/python/cpython",
]


def fetch_github_metadata(owner: str, repo: str) -> dict:
    """
    Direct fetch helper for script execution.
    """
    import requests
    headers = {"User-Agent": "GitScape-Seeder"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
    
    url = f"https://api.github.com/repos/{owner}/{repo}"
    metadata = {
        "stars": 0,
        "forks": 0,
        "license": "",
        "open_issues": 0,
        "watchers": 0,
        "last_commit_at": "",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            metadata["stars"] = data.get("stargazers_count", 0)
            metadata["forks"] = data.get("forks_count", 0)
            metadata["open_issues"] = data.get("open_issues_count", 0)
            metadata["watchers"] = data.get("subscribers_count") or data.get("watchers_count") or 0
            if data.get("license") and isinstance(data["license"], dict):
                metadata["license"] = data["license"].get("spdx_id") or data["license"].get("name") or ""
        else:
            logger.warning(f"Failed to fetch GitHub metadata for {owner}/{repo}: {resp.status_code}")
    except Exception as e:
        logger.error(f"Error fetching GitHub metadata: {e}")
    return metadata


def generate_ai_prose(owner: str, repo: str, grade: str, risk_score: int, findings: list) -> str:
    """
    Prose summary helper for script execution.
    """
    # Try using Gemini API if key is available
    if not settings.GEMINI_API_KEY:
        return _fallback_prose(owner, repo, grade, risk_score, findings)
    
    import requests
    model = getattr(settings, "HD_MODEL", "gemini-2.5-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    
    findings_str = "\n".join([f"- [{f.get('severity', 'INFO')}] {f.get('rule', '')}: {f.get('message', '')}" for f in findings[:5]])
    if not findings_str:
        findings_str = "No security findings or vulnerability reports."
        
    prompt = f"""
You are an expert security auditor. Provide a concise, professional 2-3 sentence security risk profile summary of the GitHub repository '{owner}/{repo}'.
The repository was analyzed by GitScape ScapeGuard and received:
- Security Grade: {grade}
- Risk Score: {risk_score} out of 100
- Findings:
{findings_str}

Summarize the key security posture and risk implications for developers installing this as an AI agent skill. Keep it strictly 2 or 3 sentences. Be objective and objective. Avoid generic introductory phrases. Return ONLY the paragraph, no markdown formatting.
"""
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 200,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    
    try:
        resp = requests.post(url, params={"key": settings.GEMINI_API_KEY}, json=body, timeout=12)
        if resp.status_code == 200:
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            return text.strip()
    except Exception as e:
        logger.error(f"Error generating AI prose via Gemini: {e}")
        
    return _fallback_prose(owner, repo, grade, risk_score, findings)


def _fallback_prose(owner: str, repo: str, grade: str, risk_score: int, findings: list) -> str:
    if grade in ["A", "B"] and risk_score < 10:
        return f"{owner}/{repo} exhibits a highly secure code posture with a grade of {grade} and low risk rating ({risk_score}/100). The automated security scan detected no significant vulnerabilities or unsafe agent directives, making it safe for local workspace integration."
    else:
        findings_cnt = len(findings)
        return f"A ScapeGuard security audit of {owner}/{repo} revealed a moderate-to-high risk profile (Grade {grade}, Risk Score {risk_score}/100) with {findings_cnt} findings. Developers should review the individual rule violations before deploying this skill in active agent workflows."


def seed_repo(repo_url: str):
    logger.info(f"--- Seeding {repo_url} ---")
    try:
        # Parse owner and repo
        url_path = repo_url.replace("https://github.com/", "").strip("/")
        parts = url_path.split("/")
        owner, repo = parts[0], parts[1]
        
        with tempfile.TemporaryDirectory() as tmpdir:
            clone_path = os.path.join(tmpdir, "repo")
            logger.info(f"Cloning {repo_url} to {clone_path}...")
            converter.clone_repository(repo_url, clone_path, github_token=os.environ.get("GITHUB_TOKEN"))
            
            logger.info("Generating digest...")
            digest_str, metadata = converter.generate_markdown_digest(
                repo_url, clone_path, return_metadata=True
            )
            
            languages = metadata["primary_languages"]
            files_analyzed = metadata["files_analyzed"]
            readme = metadata.get("readme", "")
            file_structure = metadata.get("file_structure", "")
            structure_overview = metadata.get("structure_overview", "")
            generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            git_sha = converter.get_git_sha(clone_path)
            
            logger.info("Building skill...")
            meta = RepoMeta(
                owner=owner, repo=repo, repo_url=repo_url,
                primary_languages=languages, files_analyzed=files_analyzed,
                readme=readme, file_structure=file_structure,
                structure_overview=structure_overview, generated_at=generated_at,
                git_sha=git_sha,
            )
            
            units = skillforge.units_from_clone(Path(clone_path))
            pkg = skillforge.build_skill(
                units, meta, digest_hash=skillforge.content_hash(digest_str),
                digest_content=digest_str, skill_type="code"
            )
            
            logger.info("Fetching metadata & generating AI summary...")
            gh_meta = fetch_github_metadata(owner, repo)
            findings_list = [f.model_dump(mode="json") for f in pkg.scan_report.findings]
            ai_summary = generate_ai_prose(owner, repo, pkg.scan_report.grade, pkg.scan_report.risk_score, findings_list)
            
            detail_payload = {
                "repo_url": repo_url,
                "name": pkg.name,
                "owner": owner,
                "repo": repo,
                "description": pkg.manifest.description or f"Agent skill for {owner}/{repo}.",
                "primary_languages": languages,
                "files_analyzed": files_analyzed,
                "grade": pkg.scan_report.grade,
                "status": pkg.scan_report.status.value,
                "risk_score": pkg.scan_report.risk_score,
                "findings": findings_list,
                "categories": [c.model_dump(mode="json") for c in pkg.scan_report.categories],
                "skill_md": pkg.skill_md,
                "manifest": pkg.manifest.model_dump(mode="json"),
                "last_git_sha": git_sha,
                "stars": gh_meta.get("stars", 0),
                "forks": gh_meta.get("forks", 0),
                "license": gh_meta.get("license", ""),
                "open_issues": gh_meta.get("open_issues", 0),
                "watchers": gh_meta.get("watchers", 0),
                "last_commit_at": gh_meta.get("last_commit_at", ""),
                "ai_summary": ai_summary,
            }
            
            logger.info("Saving to registry...")
            registry_store.save_scanned_skill(owner, repo, detail_payload)
            logger.info(f"✓ Successfully seeded {owner}/{repo} (Grade {pkg.scan_report.grade})")
            
    except Exception as e:
        logger.error(f"❌ Failed to seed {repo_url}: {e}", exc_info=True)


def main():
    logger.info("Starting public registry seeding run...")
    for url in SEED_REPOSITORIES:
        seed_repo(url)
    logger.info("Registry seeding run complete!")


if __name__ == "__main__":
    main()
