"""
FastAPI application creation and configuration.

Author: João Machete
"""

import os
import tempfile
import asyncio
import urllib.parse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import (
    FastAPI,
    APIRouter,
    Request,
    Query,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from starlette.websockets import WebSocketState
from pydantic import BaseModel
from typing import List, Optional

from app.config import settings, origins
import app.converter as converter
from app import skillforge
from app.skillforge import hd as hd_mod
from app.skillforge.errors import ScanBlocked
from app.skillforge.models import RepoMeta
from app.skillforge.exporters import render_framework_export
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

router = APIRouter()

from app.mcp import mcp_router
router.include_router(mcp_router, prefix="/mcp")


@router.get("/")
def read_root(request: Request):
    """Root endpoint providing a welcome message."""
    return {"message": "GitScape"}

@router.get("/health")
async def health_check():
    return {"status": "OK"}


def fetch_github_metadata(owner: str, repo: str, token: Optional[str] = None) -> dict:
    """
    Fetches repo stars, license, open_issues, watchers, forks, and last commit date
    from GitHub API with graceful fallback on rate limits or errors.
    """
    import requests
    headers = {"User-Agent": "GitScape"}
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
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            metadata["stars"] = data.get("stargazers_count", 0)
            metadata["forks"] = data.get("forks_count", 0)
            metadata["open_issues"] = data.get("open_issues_count", 0)
            metadata["watchers"] = data.get("subscribers_count") or data.get("watchers_count") or 0
            if data.get("license") and isinstance(data["license"], dict):
                metadata["license"] = data["license"].get("spdx_id") or data["license"].get("name") or ""
            
            # Fetch last commit info
            commits_url = f"{url}/commits"
            c_resp = requests.get(commits_url, headers=headers, timeout=5)
            if c_resp.status_code == 200:
                c_data = c_resp.json()
                if isinstance(c_data, list) and len(c_data) > 0:
                    commit_date = c_data[0].get("commit", {}).get("committer", {}).get("date")
                    if commit_date:
                        metadata["last_commit_at"] = commit_date
        else:
            logger.warning(f"GitHub API metadata returned {resp.status_code} for {owner}/{repo}")
    except Exception as e:
        logger.error(f"Error fetching GitHub metadata: {e}")
        
    return metadata


def _prose_fallback(owner: str, repo: str, grade: str, risk_score: int, findings: List[dict]) -> str:
    if grade in ["A", "B"] and risk_score < 10:
        return f"{owner}/{repo} exhibits a highly secure code posture with a grade of {grade} and low risk rating ({risk_score}/100). The automated security scan detected no significant vulnerabilities or unsafe agent directives, making it safe for local workspace integration."
    else:
        findings_cnt = len(findings)
        return f"A ScapeGuard security audit of {owner}/{repo} revealed a moderate-to-high risk profile (Grade {grade}, Risk Score {risk_score}/100) with {findings_cnt} findings. Developers should review the individual rule violations before deploying this skill in active agent workflows."


def generate_ai_prose(owner: str, repo: str, grade: str, risk_score: int, findings: List[dict]) -> str:
    """
    Uses Gemini API via settings.GEMINI_API_KEY to generate a concise 2-3 sentence
    security and risk profile summary for the repository. Graceful fallback on failure.
    """
    if not settings.GEMINI_API_KEY:
        return _prose_fallback(owner, repo, grade, risk_score, findings)
    
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
        resp = requests.post(url, params={"key": settings.GEMINI_API_KEY}, json=body, timeout=8)
        if resp.status_code == 200:
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            return text.strip()
        else:
            logger.warning(f"Gemini API returned status code {resp.status_code} for AI prose")
    except Exception as e:
        logger.error(f"Error generating AI prose via Gemini: {e}")
        
    return _prose_fallback(owner, repo, grade, risk_score, findings)


# ── Shared scan-and-save helper ───────────────────────────────────────────────

def _scan_and_save(
    repo_url: str,
    github_token: Optional[str] = None,
    nvidia_meta: Optional[dict] = None,
) -> None:
    """
    Clones repo_url, runs the full SkillForge pipeline, and persists the result
    to the public registry (GCS or in-memory fallback).

    Called by:
      - /api/converter  (auto-persist on every user scan)
      - /api/admin/scan-batch  (batch NVIDIA skill ingestion)

    nvidia_meta (optional) dict may contain:
      nvidia_domain, nvidia_audience, nvidia_skill_name,
      nvidia_skill_url, nvidia_subdomain, source
    """
    from app import registry_store

    nvidia_meta = nvidia_meta or {}

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
        readme = metadata.get("readme", "")
        file_structure = metadata.get("file_structure", "")
        structure_overview = metadata.get("structure_overview", "")
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        git_sha = converter.get_git_sha(clone_path)

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
            digest_content=digest_str,
        )
        skillforge.skill_cache.set(skillforge.cache_key(digest_str), pkg)

        gh_meta = fetch_github_metadata(owner, repo, github_token)
        findings_list = [f.model_dump(mode="json") for f in pkg.scan_report.findings]
        ai_summary = generate_ai_prose(
            owner, repo, pkg.scan_report.grade, pkg.scan_report.risk_score, findings_list
        )

        detail_payload = {
            "repo_url": repo_url,
            "name": pkg.name,
            "owner": owner,
            "repo": repo,
            "description": (
                pkg.manifest.metadata.get("summary_title")
                or pkg.manifest.description
                or f"Agent skill for {owner}/{repo}."
            ),
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
            # ── NVIDIA taxonomy (empty for community scans) ──
            "nvidia_domain": nvidia_meta.get("nvidia_domain", []),
            "nvidia_audience": nvidia_meta.get("nvidia_audience", []),
            "nvidia_skill_name": nvidia_meta.get("nvidia_skill_name", ""),
            "nvidia_skill_url": nvidia_meta.get("nvidia_skill_url", ""),
            "nvidia_subdomain": nvidia_meta.get("nvidia_subdomain", ""),
            "source": nvidia_meta.get("source", "community"),
        }
        registry_store.save_scanned_skill(owner, repo, detail_payload)


@router.get("/converter")
@limiter.limit("10/minute")
def get_digest(
    request: Request,
    repo_url: str = Query(..., description="Git repository URL to analyze"),
    github_token: str = Query(
        None,
        description="GitHub Personal Access Token for private repos or increased rate limits",
    ),
):
    """
    HTTP endpoint to clone a Git repository and generate a Markdown digest.
    Returns the digest (Code Digest + Visualization fields) plus the SkillForge
    skill preview (skill_md, references, scan_report, manifest). The skill build is
    defensively wrapped: a skill failure never affects the digest response.
    """
    try:
        repo_url = urllib.parse.unquote(repo_url)
        # The digest fields are produced first and always returned unchanged; the
        # skill is built inside the same block so the live clone is still on disk.
        skill_fields = {
            "skill_md": None,
            "references": None,
            "scan_report": None,
            "manifest": None,
        }
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
            readme = metadata.get("readme", "")
            file_structure = metadata.get("file_structure", "")
            structure_overview = metadata.get("structure_overview", "")
            generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            git_sha = converter.get_git_sha(clone_path)

            try:
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
                    digest_content=digest_str
                )
                skillforge.skill_cache.set(skillforge.cache_key(digest_str), pkg)
                skill_fields = {
                    "skill_md": pkg.skill_md,
                    "references": pkg.references,
                    "scan_report": pkg.scan_report.model_dump(mode="json"),
                    "manifest": pkg.manifest.model_dump(mode="json"),
                }
                # ── Auto-persist to public registry (SEO flywheel) ──────────────
                try:
                    _scan_and_save(repo_url, github_token=github_token)
                except Exception:
                    logger.exception("Registry auto-persist failed; continuing")
            except Exception:
                logger.exception("SkillForge build failed; returning digest only")

        return {
            "digest": digest_str,
            "primary_languages": languages,
            "files_analyzed": files_analyzed,
            "readme": readme,
            "file_structure": file_structure,
            "structure_overview": structure_overview,
            **skill_fields,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ScanRequest(BaseModel):
    repo_url: str
    github_token: Optional[str] = None


@router.post("/scan")
@limiter.limit("10/minute")
def scan_repo(request: Request, body: ScanRequest):
    """Security-scan a repository without building/installing a skill.

    Runs the deterministic SkillForge pipeline (no LLM) purely to produce the
    ScapeGuard verdict — "what grade would this repo's skill get?" — and returns
    only the scan report. Nothing is written; no digest or skill is returned.
    """
    from app.skillforge.models import ScanStatus
    from app.skillforge.package import is_bypassable

    try:
        repo_url = urllib.parse.unquote(body.repo_url)
        with tempfile.TemporaryDirectory() as tmpdir:
            clone_path = os.path.join(tmpdir, "repo")
            converter.clone_repository(repo_url, clone_path, github_token=body.github_token)
            digest_str, metadata = converter.generate_markdown_digest(
                repo_url, clone_path, return_metadata=True
            )
            meta = RepoMeta(
                owner=metadata["owner"], repo=metadata["repo"], repo_url=repo_url,
                primary_languages=metadata["primary_languages"],
                files_analyzed=metadata["files_analyzed"],
                readme=metadata.get("readme", ""),
                file_structure=metadata.get("file_structure", ""),
                structure_overview=metadata.get("structure_overview", ""),
                generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                git_sha=converter.get_git_sha(clone_path),
            )
            units = skillforge.units_from_clone(Path(clone_path))
            # Deterministic, keyless build (skill_type="code"): no Gemini, and no
            # STRUCTURE-section warnings — we only want the repo's security verdict.
            pkg = skillforge.build_skill(
                units, meta, digest_hash=skillforge.content_hash(digest_str),
                digest_content=digest_str, skill_type="code",
            )

        report = pkg.scan_report
        return {
            "repo_url": repo_url,
            # "authored" = the repo already shipped a SKILL.md we scanned as-is;
            # "compiled" = GitScape generated the skill from source.
            "source": pkg.source,
            "grade": report.grade,
            "status": report.status.value,
            "risk_score": report.risk_score,
            "safe_to_install": report.status != ScanStatus.FAIL,
            "bypassable": is_bypassable(report),
            "counts": report.counts,
            "categories": [c.model_dump(mode="json") for c in report.categories],
            "findings": [f.model_dump(mode="json") for f in report.findings],
            "engine": report.engine,
            "engine_version": report.engine_version,
            "scanned_at": report.generated_at,
            "skill_hash": report.skill_hash,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/freshness")
@limiter.limit("10/minute")
def check_freshness(
    request: Request,
    repo_url: str = Query(..., description="Git repository URL to analyze"),
    last_git_head: str = Query(..., description="The last checked git HEAD SHA"),
    github_token: str = Query(
        None,
        description="GitHub Personal Access Token for private repos or increased rate limits",
    ),
):
    """
    Check if a repository has git drift since a given git head SHA.
    Returns the freshness status, the current remote git HEAD SHA, and the changed files.
    """
    try:
        repo_url = urllib.parse.unquote(repo_url)
        with tempfile.TemporaryDirectory() as tmpdir:
            clone_path = os.path.join(tmpdir, "repo")
            converter.clone_repository(repo_url, clone_path, github_token=github_token)
            current_head = converter.get_git_sha(clone_path)

            if last_git_head == current_head:
                return {
                    "status": "fresh",
                    "git_head": current_head,
                    "changes_since_last": []
                }

            from app.skillforge.freshness import compute_drift, is_noop_drift
            changed_files = compute_drift(Path(clone_path), last_git_head)

            if is_noop_drift(changed_files):
                status = "fresh"
            else:
                status = "stale"

            return {
                "status": status,
                "git_head": current_head,
                "changes_since_last": changed_files
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from app import registry_store


@router.get("/registry/search")
@limiter.limit("20/minute")
def search_registry(
    request: Request,
    query: Optional[str] = Query(None, description="Search term for repository URL or name"),
):
    """
    Search indexed skills in the GitScape registry.
    If no query is provided, returns all indexed skills.
    """
    skills = registry_store.list_registry_skills()
    if not query:
        return skills
        
    q = query.lower()
    results = []
    for skill in skills:
        if (q in skill["name"].lower() or 
            q in skill["owner"].lower() or 
            q in skill["repo"].lower() or 
            q in skill["repo_url"].lower() or
            q in skill["description"].lower()):
            results.append(skill)
    return results


@router.get("/registry/recent")
def get_recent_scans():
    """
    Get the 20 most recently scanned repositories.
    """
    all_scans = registry_store.get_all_scans()
    return all_scans[:20]


@router.get("/registry/detail")
@limiter.limit("10/minute")
def get_registry_detail(
    request: Request,
    repo_url: str = Query(..., description="Git repository URL to fetch details for"),
    github_token: str = Query(None, description="Optional GitHub PAT"),
):
    """
    Retrieve or dynamically compile the GitScape skill for the given repository URL.
    This provides infinite long-tail coverage via dynamic compilation.
    """
    repo_url = urllib.parse.unquote(repo_url)
    
    try:
        url_path = urllib.parse.urlparse(repo_url).path.strip("/")
        parts = url_path.split("/")
        if len(parts) < 2:
            raise ValueError()
        owner = parts[0]
        repo = parts[1]
        if repo.endswith(".git"):
            repo = repo[:-4]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL.")
        
    # Check cache first
    cached = registry_store.get_scanned_detail(owner, repo)
    if cached:
        return cached
        
    skills = registry_store.list_registry_skills()
    static_info = next((s for s in skills if s["repo_url"].lower() == repo_url.lower()), None)
    
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            clone_path = os.path.join(tmpdir, "repo")
            converter.clone_repository(repo_url, clone_path, github_token=github_token)
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
            
            gh_meta = fetch_github_metadata(owner, repo, github_token)
            findings_list = [f.model_dump(mode="json") for f in pkg.scan_report.findings]
            ai_summary = generate_ai_prose(owner, repo, pkg.scan_report.grade, pkg.scan_report.risk_score, findings_list)
            
            detail_payload = {
                "repo_url": repo_url,
                "name": pkg.name,
                "owner": owner,
                "repo": repo,
                "description": static_info["description"] if static_info else (pkg.manifest.metadata.get("summary_title") or pkg.manifest.description or f"Agent skill for {owner}/{repo}."),
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
            
            # Save scan dynamically (GCS or fallback to in-memory)
            registry_store.save_scanned_skill(owner, repo, detail_payload)
            
            return detail_payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/registry/sitemap.xml")
def registry_sitemap(request: Request):
    """
    Auto-generated XML sitemap of all scanned repositories.
    Submitted to Google Search Console to drive indexing of /registry/{owner}/{repo} pages
    and /registry/nvidia/{skill_slug} pages for NVIDIA-sourced skills.
    """
    from fastapi import Response

    scans = registry_store.get_all_scans()
    base_url = "https://gitscape.ai"

    urls = []
    # Registry index page
    urls.append(f"""  <url>
    <loc>{base_url}/registry</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>""")

    nvidia_slugs_added = set()

    for scan in scans:
        owner = scan.get("owner", "")
        repo = scan.get("repo", "")
        scanned_at = scan.get("scanned_at", "")
        if not owner or not repo:
            continue
        lastmod = f"<lastmod>{scanned_at[:10]}</lastmod>" if scanned_at else ""

        # Primary GitHub repo URL
        urls.append(f"""  <url>
    <loc>{base_url}/registry/{owner}/{repo}</loc>
    {lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>""")

        # Also add /registry/nvidia/{skill_slug} for NVIDIA-sourced skills
        if scan.get("source") == "nvidia":
            skill_name = scan.get("nvidia_skill_name", "")
            if skill_name and skill_name not in nvidia_slugs_added:
                # Slugify: lowercase, replace spaces/underscores with hyphens
                slug = skill_name.lower().replace(" ", "-").replace("_", "-")
                urls.append(f"""  <url>
    <loc>{base_url}/registry/nvidia/{slug}</loc>
    {lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.75</priority>
  </url>""")
                nvidia_slugs_added.add(skill_name)

    sitemap_xml = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
""" + "\n".join(urls) + """
</urlset>"""

    return Response(
        content=sitemap_xml,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/registry/nvidia/{skill_slug}")
@limiter.limit("30/minute")
def get_nvidia_skill(request: Request, skill_slug: str):
    """
    Retrieve a registry entry for an NVIDIA-curated skill by its slug.
    The slug is the nvidia_skill_name lowercased with spaces/underscores → hyphens.
    Returns the index summary enriched with the full scan detail if available.
    Used by the NvidiaSkillPage frontend component for SEO-optimised skill landing pages.
    """
    # Normalise the incoming slug
    slug = skill_slug.lower().strip()

    def _to_slug(name: str) -> str:
        return name.lower().replace(" ", "-").replace("_", "-").strip()

    skills = registry_store.list_registry_skills()
    match = next(
        (s for s in skills
         if s.get("source") == "nvidia"
         and _to_slug(s.get("nvidia_skill_name", "")) == slug),
        None,
    )

    if not match:
        # Fallback: try matching by repo name (some NVIDIA skills use repo slug)
        match = next(
            (s for s in skills
             if s.get("source") == "nvidia"
             and _to_slug(s.get("repo", "")) == slug),
            None,
        )

    if not match:
        raise HTTPException(
            status_code=404,
            detail=f"No NVIDIA skill found for slug '{skill_slug}'. "
                   "Run the admin batch scan to index this skill.",
        )

    owner = match.get("owner", "")
    repo = match.get("repo", "")

    # Try to enrich with full scan detail (categories, findings, ai_summary, etc.)
    detail = registry_store.get_scanned_detail(owner, repo) if owner and repo else None
    if detail:
        # Merge NVIDIA taxonomy from index into detail (detail may have been saved before taxonomy fields)
        for field in ("source", "nvidia_domain", "nvidia_audience", "nvidia_skill_name",
                      "nvidia_skill_url", "nvidia_subdomain"):
            if field not in detail or not detail[field]:
                detail[field] = match.get(field)
        return detail

    # Return the index summary when detail blob is not yet cached
    return match


def _grade_color(grade: str) -> str:
    return {"A": "#10b981", "B": "#84cc16", "C": "#f59e0b"}.get(grade, "#ef4444")


def _grade_label(grade: str, status: str) -> str:
    labels = {"A": "Excellent", "B": "Good", "C": "Moderate", "F": "High Risk"}
    return labels.get(grade, status)


@router.get("/registry/render/{owner}/{repo}")
def render_repo_report(owner: str, repo: str, request: Request):
    """
    SSR: Render a fully pre-built HTML security report page for Googlebot and other crawlers.
    Regular users are served the React SPA; bots receive this server-rendered HTML.
    The page is cinematic, SEO-optimised, and contains JSON-LD structured data.
    """
    from fastapi import Response as FastAPIResponse

    cached = registry_store.get_scanned_detail(owner, repo)
    if not cached:
        # Check the index for at least summary data
        skills = registry_store.list_registry_skills()
        cached = next(
            (s for s in skills if s.get("owner", "").lower() == owner.lower() and s.get("repo", "").lower() == repo.lower()),
            None,
        )

    # QUALITY GATE: If repo is not cached or does not have a valid grade/findings, noindex it.
    is_thin = not cached or cached.get("status") == "Not yet scanned"
    robots_meta = '<meta name="robots" content="noindex, nofollow">' if is_thin else '<meta name="robots" content="index, follow, max-snippet:200, max-image-preview:large">'

    if not cached:
        # Minimal stub page — still SEO-indexable as a placeholder but noindexed by the gate
        grade = "?"
        status = "Not yet scanned"
        risk_score = 0
        description = f"Security audit report for {owner}/{repo} — scan this repository on GitScape AI."
        findings = []
        languages = []
        files_analyzed = 0
        scanned_at = ""
        findings_count = 0
        findings_summary = []
        stars = 0
        forks = 0
        license_name = ""
        ai_summary = ""
        categories = []
        last_git_sha = ""
    else:
        grade = cached.get("grade", "?")
        status = cached.get("status", "")
        risk_score = cached.get("risk_score", 0)
        description = cached.get("description", f"Security audit for {owner}/{repo}.")
        findings = cached.get("findings", [])
        findings_summary = cached.get("findings_summary", [])
        languages = cached.get("primary_languages", [])
        files_analyzed = cached.get("files_analyzed", 0)
        scanned_at = cached.get("scanned_at", "")
        findings_count = cached.get("findings_count", len(findings))
        stars = cached.get("stars", 0)
        forks = cached.get("forks", 0)
        license_name = cached.get("license", "")
        ai_summary = cached.get("ai_summary", "")
        categories = cached.get("categories", [])
        last_git_sha = cached.get("last_git_sha", "")

    grade_color = _grade_color(grade)
    grade_verdict = _grade_label(grade, status)
    repo_url = f"https://github.com/{owner}/{repo}"
    page_url = f"https://gitscape.ai/registry/{owner}/{repo}"
    langs_str = ", ".join(languages) if languages else "Unknown"
    scanned_display = scanned_at[:10] if scanned_at else "Not yet scanned"

    # Dynamic prose block
    prose_html = ""
    if ai_summary:
        prose_html = f"""
        <div style="background:rgba(30,41,59,0.4);border:1px solid rgba(71,85,105,0.2);border-radius:12px;padding:16px 20px;margin-bottom:24px;max-width:800px;">
          <p style="font-size:14px;color:#94a3b8;line-height:1.6;font-style:italic;">🛡 &ldquo;{ai_summary}&rdquo;</p>
        </div>"""

    # Extra metadata pills
    stars_pill = f'<span class="meta-pill">⭐ {stars:,} stars</span>' if stars > 0 else ""
    forks_pill = f'<span class="meta-pill">🍴 {forks:,} forks</span>' if forks > 0 else ""
    license_pill = f'<span class="meta-pill">⚖️ {license_name}</span>' if license_name else ""

    # Build findings rows
    findings_rows = ""
    source_findings = findings if findings else findings_summary
    for f in source_findings[:10]:
        sev = f.get("severity", "INFO")
        sev_color = {"CRITICAL": "#ef4444", "HIGH": "#f97316", "MEDIUM": "#f59e0b", "LOW": "#64748b"}.get(sev.upper(), "#64748b")
        rule = f.get("rule", "")
        message = f.get("message", "")[:200]
        file_loc = f"{f.get('file', '')}:{f.get('line', '')}" if f.get("file") else ""
        findings_rows += f"""
        <tr>
          <td style="padding:10px 12px;">
            <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;background:{sev_color}22;color:{sev_color};border:1px solid {sev_color}44">{sev}</span>
          </td>
          <td style="padding:10px 12px;font-family:monospace;font-size:12px;color:#94a3b8">{rule}</td>
          <td style="padding:10px 12px;font-size:13px;color:#cbd5e1">{message}</td>
          <td style="padding:10px 12px;font-family:monospace;font-size:11px;color:#64748b">{file_loc}</td>
        </tr>"""

    if not findings_rows:
        findings_rows = """
        <tr><td colspan="4" style="padding:32px;text-align:center;color:#10b981;font-size:14px">
          ✓ No security findings detected. This repository is considered safe for agent installation.
        </td></tr>"""

    # Build categories list for mock editor json
    default_categories = ["secrets", "prompt_injection", "malicious_execution", "supply_chain", "excessive_agency"]
    category_rows = []
    
    # Map raw categories if available, otherwise mock from grade
    if categories:
        for c in categories:
            cat_name = c.get("category", "")
            cat_status = c.get("status", "PASS")
            cat_color = "#10b981" if cat_status == "PASS" else "#f59e0b" if cat_status == "WARN" else "#ef4444"
            category_rows.append(f'      <div style="display:flex;justify-content:space-between;line-height:1.7;"><span style="color:#64748b;">"{cat_name}"</span><span style="color:{cat_color};">"{cat_status}"</span></div>')
    else:
        # Fallback based on security grade
        for c in default_categories:
            cat_status = "PASS"
            if grade == "F" and c in ["secrets", "prompt_injection"]:
                cat_status = "FAIL"
            elif grade in ["B", "C"] and c == "prompt_injection":
                cat_status = "WARN"
            cat_color = "#10b981" if cat_status == "PASS" else "#f59e0b" if cat_status == "WARN" else "#ef4444"
            category_rows.append(f'      <div style="display:flex;justify-content:space-between;line-height:1.7;"><span style="color:#64748b;">"{c}"</span><span style="color:{cat_color};">"{cat_status}"</span></div>')
            
    category_json_rows = "\n".join(category_rows)
    
    # Shorten git sha for display
    skill_hash_display = last_git_sha[:12] if last_git_sha else "sha256:9f2c...e41a"

    # JSON-LD structured data
    json_ld = json.dumps({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": page_url,
        "name": f"{owner}/{repo}",
        "url": repo_url,
        "description": description,
        "applicationCategory": "DeveloperApplication",
        "review": {
            "@type": "Review",
            "author": {"@type": "Organization", "name": "GitScape AI ScapeGuard"},
            "reviewBody": f"{owner}/{repo} received a security grade of {grade} ({grade_verdict}) with {findings_count} findings across {files_analyzed} files analyzed. Languages: {langs_str}.",
            "reviewRating": {
                "@type": "Rating",
                "ratingValue": {"A": "5", "B": "4", "C": "3"}.get(grade, "1"),
                "bestRating": "5",
                "worstRating": "1",
            },
            "datePublished": scanned_at[:10] if scanned_at else "",
        },
    }, indent=2)

    meta_description = (
        f"{owner}/{repo} received Grade {grade} in the GitScape ScapeGuard security audit — "
        f"{findings_count} finding{'s' if findings_count != 1 else ''} across {files_analyzed} files. "
        f"Languages: {langs_str}. View the full security report."
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{owner}/{repo} Security Audit — GitScape AI</title>
  <meta name="description" content="{meta_description}">
  {robots_meta}
  <meta property="og:type" content="website">
  <meta property="og:url" content="{page_url}">
  <meta property="og:title" content="{owner}/{repo} Security Report — Grade {grade} | GitScape AI">
  <meta property="og:description" content="{meta_description}">
  <meta property="og:site_name" content="GitScape AI">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{owner}/{repo} Security Report — Grade {grade}">
  <meta name="twitter:description" content="{meta_description}">
  <link rel="canonical" href="{page_url}">
  <script type="application/ld+json">{json_ld}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:'Inter',sans-serif;background:#0b1120;color:#cbd5e1;line-height:1.6;min-height:100vh}}
    a{{color:#22d3ee;text-decoration:none}}
    a:hover{{color:#67e8f9}}
    .header{{background:rgba(8,13,20,0.9);border-bottom:1px solid rgba(71,85,105,0.3);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;backdrop-filter:blur(20px)}}
    .logo{{font-size:18px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px}}
    .logo span{{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;margin-left:6px}}
    .nav-link{{font-size:13px;font-weight:500;color:#94a3b8;margin-left:20px}}
    .hero{{padding:52px 24px 36px;max-width:1100px;margin:0 auto}}
    .breadcrumb{{font-size:12px;color:#475569;margin-bottom:18px}}
    .breadcrumb a{{color:#475569}}
    .breadcrumb a:hover{{color:#94a3b8}}
    .repo-title{{font-size:32px;font-weight:800;color:#f1f5f9;letter-spacing:-1px;margin-bottom:10px}}
    .repo-title span{{color:#22d3ee}}
    .repo-desc{{font-size:15px;color:#94a3b8;max-width:720px;margin-bottom:16px}}
    .meta-row{{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:28px;align-items:center}}
    .meta-pill{{font-size:12px;font-weight:600;padding:4px 12px;border-radius:9999px;border:1px solid rgba(100,116,139,0.3);color:#94a3b8;background:rgba(30,41,59,0.5)}}
    .cta-row{{display:flex;gap:10px;flex-wrap:wrap}}
    .btn-primary{{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;font-weight:700;font-size:13px;border-radius:8px;cursor:pointer}}
    .btn-secondary{{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:rgba(30,41,59,0.7);color:#94a3b8;font-weight:600;font-size:13px;border-radius:8px;border:1px solid rgba(71,85,105,0.4)}}
    .score-layout{{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;max-width:1100px;margin:0 auto;padding:0 24px 32px;align-items:start}}
    .scores-grid{{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}}
    .score-card{{background:rgba(15,23,42,0.7);border:1px solid rgba(71,85,105,0.25);border-radius:16px;padding:24px;text-align:center;backdrop-filter:blur(12px)}}
    .score-label{{font-size:11px;font-weight:700;letter-spacing:0.08em;color:#64748b;text-transform:uppercase;margin-bottom:12px}}
    .score-grade{{font-size:56px;font-weight:800;line-height:1;color:{grade_color};text-shadow:0 0 24px {grade_color}44}}
    .score-verdict{{font-size:13px;font-weight:600;color:#94a3b8;margin-top:6px}}
    .score-num{{font-size:36px;font-weight:800;line-height:1;color:#f1f5f9}}
    .score-sub{{font-size:12px;color:#64748b;margin-top:4px}}
    .editor-card{{background:#020617;border:1px solid rgba(71,85,105,0.25);border-radius:16px;padding:24px;font-family:monospace;font-size:13px;color:#94a3b8;box-shadow:0 8px 32px rgba(0,0,0,0.5)}}
    .editor-header{{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(71,85,105,0.2);padding-bottom:12px;margin-bottom:16px}}
    .editor-filename{{color:#e2e8f0;font-weight:600;font-size:13px}}
    .editor-badge{{background:{grade_color}1a;color:{grade_color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;border:1px solid {grade_color}33}}
    .section{{max-width:1100px;margin:0 auto;padding:0 24px 40px}}
    .section-title{{font-size:16px;font-weight:700;color:#e2e8f0;margin-bottom:16px;display:flex;align-items:center;gap:8px}}
    .section-title::before{{content:'';display:block;width:3px;height:16px;background:linear-gradient(#7c3aed,#22d3ee);border-radius:2px}}
    .findings-table{{width:100%;border-collapse:collapse;background:rgba(15,23,42,0.6);border:1px solid rgba(71,85,105,0.2);border-radius:12px;overflow:hidden}}
    .findings-table th{{background:rgba(15,23,42,0.9);padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:0.06em;color:#64748b;text-transform:uppercase;border-bottom:1px solid rgba(71,85,105,0.2)}}
    .findings-table tr:not(:last-child){{border-bottom:1px solid rgba(71,85,105,0.12)}}
    .badge-box{{background:rgba(15,23,42,0.7);border:1px solid rgba(71,85,105,0.25);border-radius:12px;padding:20px}}
    .badge-code{{background:rgba(8,13,20,0.8);border:1px solid rgba(71,85,105,0.2);border-radius:8px;padding:12px 16px;font-family:monospace;font-size:12px;color:#94a3b8;word-break:break-all;margin-top:12px}}
    .footer{{border-top:1px solid rgba(71,85,105,0.2);padding:24px;text-align:center;font-size:12px;color:#475569;margin-top:40px}}
  </style>
</head>
<body>
  <header class="header">
    <a href="/" class="logo">GitScape<span>AI</span></a>
    <div>
      <a href="/registry" class="nav-link">Registry</a>
      <a href="https://github.com/{owner}/{repo}" target="_blank" rel="noopener" class="nav-link">GitHub ↗</a>
    </div>
  </header>

  <div class="hero">
    <div class="breadcrumb">
      <a href="/">GitScape AI</a> &rsaquo;
      <a href="/registry">Registry</a> &rsaquo;
      <a href="/registry/{owner}">{owner}</a> &rsaquo;
      {repo}
    </div>
    <h1 class="repo-title"><span>{owner}</span> / {repo}</h1>
    <p class="repo-desc">{description}</p>
    {prose_html}
    <div class="meta-row">
      <span class="meta-pill">📅 Last scanned: {scanned_display}</span>
      <span class="meta-pill">📁 {files_analyzed} files analysed</span>
      <span class="meta-pill">🔤 {langs_str}</span>
      <span class="meta-pill" style="color:{grade_color};border-color:{grade_color}44;background:{grade_color}11">🛡 Grade {grade} · {grade_verdict}</span>
      {stars_pill}
      {forks_pill}
      {license_pill}
    </div>
    <div class="cta-row">
      <a href="/?repo={repo_url}" class="btn-primary">🔍 Re-scan this repository</a>
      <a href="{repo_url}" target="_blank" rel="noopener" class="btn-secondary">View on GitHub ↗</a>
      <a href="/registry" class="btn-secondary">← Back to Registry</a>
    </div>
  </div>

  <div class="score-layout">
    <div class="scores-grid">
      <div class="score-card">
        <div class="score-label">Security Grade</div>
        <div class="score-grade">{grade}</div>
        <div class="score-verdict">{grade_verdict}</div>
      </div>
      <div class="score-card">
        <div class="score-label">Risk Score</div>
        <div class="score-num" style="color:{'#ef4444' if risk_score > 15 else '#f59e0b' if risk_score > 5 else '#10b981'}">{risk_score}</div>
        <div class="score-sub">{'High Risk' if risk_score > 15 else 'Moderate' if risk_score > 5 else 'Low Risk'}</div>
      </div>
      <div class="score-card">
        <div class="score-label">Findings</div>
        <div class="score-num">{findings_count}</div>
        <div class="score-sub">{'Issues found' if findings_count > 0 else 'Clean'}</div>
      </div>
      <div class="score-card">
        <div class="score-label">Verdict</div>
        <div class="score-num" style="font-size:22px;font-weight:800;color:{'#10b981' if status == 'PASS' else '#f59e0b' if status == 'WARN' else '#ef4444'}">{status}</div>
        <div class="score-sub">ScapeGuard verdict</div>
      </div>
    </div>

    <!-- Editor scan-report.json panel (matching ScapeGuard mock output screenshot) -->
    <div class="editor-card">
      <div class="editor-header">
        <span class="editor-filename">scan-report.json</span>
        <span class="editor-badge">{grade} {status}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">"engine"</span><span style="color:#38bdf8;">"scapeguard/2.1.0"</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">"grade"</span><span style="color:{grade_color};font-weight:bold;">"{grade}"</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">"risk_score"</span><span style="color:#f59e0b;">{risk_score}</span></div>
        {category_json_rows}
        <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">"license"</span><span style="color:#e2e8f0;">"{license_name or 'Unknown'}"</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">"files_scanned"</span><span style="color:#34d399;">{files_analyzed}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">"skill_hash"</span><span style="color:#64748b;">"{skill_hash_display}"</span></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Security Findings</h2>
    <table class="findings-table">
      <thead>
        <tr>
          <th>Severity</th>
          <th>Rule</th>
          <th>Description</th>
          <th>Location</th>
        </tr>
      </thead>
      <tbody>{findings_rows}</tbody>
    </table>
  </div>

  <div class="section">
    <h2 class="section-title">Badge — Add to Your README</h2>
    <div class="badge-box">
      <p style="font-size:13px;color:#94a3b8;margin-bottom:10px">Copy this markdown to display the ScapeGuard grade in your repository README:</p>
      <img src="https://gitscape.ai/api/badge/{owner}/{repo}" alt="ScapeGuard Grade {grade}" style="margin-bottom:12px">
      <div class="badge-code">[![ScapeGuard Grade {grade}](https://gitscape.ai/api/badge/{owner}/{repo})](https://gitscape.ai/registry/{owner}/{repo})</div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Install as Agent Skill</h2>
    <div class="badge-box">
      <p style="font-size:13px;color:#94a3b8;margin-bottom:10px">Run this command to install this repository as a skill in your AI agent workspace:</p>
      <div class="badge-code">npx gitscape {repo_url}</div>
    </div>
  </div>

  <footer class="footer">
    <p>GitScape AI &mdash; ScapeGuard Security Report for <a href="{repo_url}" target="_blank" rel="noopener">{owner}/{repo}</a></p>
    <p style="margin-top:6px">Report generated by <a href="https://gitscape.ai">GitScape AI</a> · <a href="/registry">View all scanned repositories</a></p>
  </footer>
</body>
</html>"""

    return FastAPIResponse(
        content=html,
        media_type="text/html",
        headers={"Cache-Control": "public, max-age=1800, stale-while-revalidate=86400"},
    )


@router.get("/registry/render/nvidia/{skill_slug}")
def render_nvidia_skill(skill_slug: str, request: Request):
    """
    SSR: Server-rendered HTML for NVIDIA skill landing pages.
    Googlebot and social crawlers receive this pre-built page.
    Regular users get the React SPA (handled by nginx bot detection).
    Contains full JSON-LD structured data, OG/Twitter meta, and NVIDIA taxonomy.
    """
    from fastapi import Response as FastAPIResponse

    def _to_slug(name: str) -> str:
        return name.lower().replace(" ", "-").replace("_", "-").strip()

    slug = skill_slug.lower().strip()

    # Resolve slug → registry entry
    skills = registry_store.list_registry_skills()
    match = next(
        (s for s in skills
         if s.get("source") == "nvidia" and _to_slug(s.get("nvidia_skill_name", "")) == slug),
        None,
    )
    if not match:
        match = next(
            (s for s in skills
             if s.get("source") == "nvidia" and _to_slug(s.get("repo", "")) == slug),
            None,
        )

    is_thin = not match or not match.get("grade")
    robots_meta = (
        '<meta name="robots" content="noindex, nofollow">'
        if is_thin else
        '<meta name="robots" content="index, follow, max-snippet:200, max-image-preview:large">'
    )

    if not match:
        skill_name = skill_slug.replace("-", " ").title()
        grade = "?"
        status = "Not yet scanned"
        risk_score = 0
        description = f"{skill_name} — NVIDIA-curated AI agent skill. Scan on GitScape AI to see the ScapeGuard security report."
        findings_count = 0
        findings = []
        categories = []
        languages = []
        files_analyzed = 0
        scanned_at = ""
        ai_summary = ""
        nvidia_domain: list = []
        nvidia_audience: list = []
        nvidia_skill_name = skill_name
        nvidia_skill_url = f"https://build.nvidia.com/skills/{skill_slug}"
        nvidia_subdomain = ""
        owner = "NVIDIA"
        repo = skill_slug
    else:
        # Try to pull full detail blob (has categories + findings)
        detail = registry_store.get_scanned_detail(match.get("owner", ""), match.get("repo", ""))
        data = detail if detail else match
        grade = data.get("grade", "?")
        status = data.get("status", "")
        risk_score = data.get("risk_score", 0)
        description = data.get("description", "")
        findings = data.get("findings", data.get("findings_summary", []))
        findings_count = data.get("findings_count", len(findings))
        categories = data.get("categories", [])
        languages = data.get("primary_languages", [])
        files_analyzed = data.get("files_analyzed", 0)
        scanned_at = data.get("scanned_at", "")
        ai_summary = data.get("ai_summary", "")
        nvidia_domain = match.get("nvidia_domain") or data.get("nvidia_domain") or []
        nvidia_audience = match.get("nvidia_audience") or data.get("nvidia_audience") or []
        nvidia_skill_name = match.get("nvidia_skill_name") or data.get("nvidia_skill_name") or skill_slug
        nvidia_skill_url = match.get("nvidia_skill_url") or data.get("nvidia_skill_url") or f"https://build.nvidia.com/skills/{skill_slug}"
        nvidia_subdomain = match.get("nvidia_subdomain") or data.get("nvidia_subdomain") or ""
        owner = match.get("owner", "NVIDIA")
        repo = match.get("repo", skill_slug)

    grade_color = _grade_color(grade)
    grade_verdict = _grade_label(grade, status)
    page_url = f"https://gitscape.ai/registry/nvidia/{slug}"
    repo_url = f"https://github.com/{owner}/{repo}"
    langs_str = ", ".join(languages) if languages else "Unknown"
    scanned_display = scanned_at[:10] if scanned_at else "Not yet scanned"

    domains_html = "".join(
        f'<span style="display:inline-block;padding:3px 10px;border-radius:9999px;font-size:11px;font-family:monospace;font-weight:600;background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.3);color:#c4b5fd;margin:2px 3px">{d}</span>'
        for d in nvidia_domain
    )
    audiences_html = "".join(
        f'<span style="display:inline-block;padding:3px 10px;border-radius:9999px;font-size:11px;font-family:monospace;font-weight:600;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);color:#6ee7b7;margin:2px 3px">{a}</span>'
        for a in nvidia_audience
    )
    taxonomy_html = (
        f'<div style="margin-bottom:16px">{domains_html}{audiences_html}</div>'
        if (domains_html or audiences_html) else ""
    )

    ai_prose_html = ""
    if ai_summary:
        ai_prose_html = f"""
        <div style="background:rgba(30,41,59,0.4);border:1px solid rgba(71,85,105,0.2);border-radius:12px;padding:16px 20px;margin-bottom:24px;max-width:800px;">
          <p style="font-size:14px;color:#94a3b8;line-height:1.6;font-style:italic;">"{ai_summary}"</p>
        </div>"""

    # Findings rows (top 10)
    findings_rows = ""
    for f in findings[:10]:
        sev = f.get("severity", "INFO")
        sev_color = {"CRITICAL": "#ef4444", "HIGH": "#f97316", "MEDIUM": "#f59e0b", "LOW": "#64748b"}.get(sev.upper(), "#64748b")
        rule = f.get("rule", "")
        msg = f.get("message", "")[:200]
        loc = f"{f.get('file', '')}:{f.get('line', '')}" if f.get("file") else ""
        findings_rows += f"""
        <tr>
          <td style="padding:10px 12px;"><span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;background:{sev_color}22;color:{sev_color};border:1px solid {sev_color}44">{sev}</span></td>
          <td style="padding:10px 12px;font-family:monospace;font-size:12px;color:#94a3b8">{rule}</td>
          <td style="padding:10px 12px;font-size:13px;color:#cbd5e1">{msg}</td>
          <td style="padding:10px 12px;font-family:monospace;font-size:11px;color:#64748b">{loc}</td>
        </tr>"""
    if not findings_rows:
        findings_rows = """
        <tr><td colspan="4" style="padding:28px;text-align:center;color:#10b981;font-size:14px">
          &#10003; No security findings detected — this skill is considered safe for agent installation.
        </td></tr>"""

    # Categories
    cat_rows = ""
    default_cats = ["secrets", "prompt_injection", "malicious_execution", "supply_chain", "excessive_agency"]
    cat_labels = {"secrets": "Secrets & Credentials", "prompt_injection": "Prompt Injection",
                  "malicious_execution": "Malicious Execution", "supply_chain": "Supply Chain",
                  "excessive_agency": "Excessive Agency"}
    cats = categories if categories else [
        {"category": c, "status": ("FAIL" if grade == "F" and c in ("secrets", "prompt_injection")
                                   else "WARN" if grade in ("B", "C") and c == "prompt_injection"
                                   else "PASS")}
        for c in default_cats
    ]
    for c in cats:
        cs = c.get("status", "PASS")
        cc = "#10b981" if cs == "PASS" else "#f59e0b" if cs == "WARN" else "#ef4444"
        cn = cat_labels.get(c.get("category", ""), c.get("category", ""))
        cat_rows += f'<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(71,85,105,0.15)"><span style="font-size:13px;color:#cbd5e1">{cn}</span><span style="font-size:11px;font-weight:700;font-family:monospace;color:{cc};background:{cc}15;padding:2px 8px;border-radius:4px;border:1px solid {cc}33">{cs}</span></div>'

    # JSON-LD
    json_ld = json.dumps({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "@id": page_url,
        "name": nvidia_skill_name,
        "url": nvidia_skill_url,
        "description": description,
        "applicationCategory": "DeveloperApplication",
        "creator": {"@type": "Organization", "name": "NVIDIA"},
        "review": {
            "@type": "Review",
            "author": {"@type": "Organization", "name": "GitScape AI ScapeGuard"},
            "reviewBody": (
                f"{nvidia_skill_name} is an NVIDIA-curated AI agent skill. "
                f"ScapeGuard security grade: {grade} ({grade_verdict}). "
                f"{findings_count} finding{'s' if findings_count != 1 else ''} across {files_analyzed} files. "
                f"Languages: {langs_str}."
            ),
            "reviewRating": {
                "@type": "Rating",
                "ratingValue": {"A": "5", "B": "4", "C": "3"}.get(grade, "1"),
                "bestRating": "5",
                "worstRating": "1",
            },
            "datePublished": scanned_at[:10] if scanned_at else "",
        },
        "keywords": ", ".join(nvidia_domain + nvidia_audience),
    }, indent=2)

    meta_desc = (
        f"{nvidia_skill_name} is an NVIDIA-curated AI agent skill"
        + (f" for {', '.join(nvidia_domain)}" if nvidia_domain else "")
        + f". ScapeGuard security grade: {grade}"
        + (f" — {findings_count} finding{'s' if findings_count != 1 else ''}" if findings_count else ", no findings")
        + f". Languages: {langs_str}. View the full security audit on GitScape AI."
    )

    nvidia_url_html = (
        f'<a href="{nvidia_skill_url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:10px 18px;background:rgba(30,41,59,0.7);color:#94a3b8;font-weight:600;font-size:13px;border-radius:8px;border:1px solid rgba(71,85,105,0.4);text-decoration:none">View on NVIDIA &#8599;</a>'
        if nvidia_skill_url else ""
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{nvidia_skill_name} — NVIDIA AI Skill Security Audit | GitScape AI</title>
  <meta name="description" content="{meta_desc}">
  {robots_meta}
  <meta property="og:type" content="website">
  <meta property="og:url" content="{page_url}">
  <meta property="og:title" content="{nvidia_skill_name} — NVIDIA Skill Grade {grade} | GitScape AI">
  <meta property="og:description" content="{meta_desc}">
  <meta property="og:site_name" content="GitScape AI">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{nvidia_skill_name} — ScapeGuard Grade {grade}">
  <meta name="twitter:description" content="{meta_desc}">
  <link rel="canonical" href="{page_url}">
  <script type="application/ld+json">{json_ld}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:'Inter',sans-serif;background:#0b1120;color:#cbd5e1;line-height:1.6;min-height:100vh}}
    a{{color:#22d3ee;text-decoration:none}}
    a:hover{{color:#67e8f9}}
    .header{{background:rgba(8,13,20,0.9);border-bottom:1px solid rgba(71,85,105,0.3);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;backdrop-filter:blur(20px)}}
    .logo{{font-size:18px;font-weight:800;color:#f1f5f9;letter-spacing:-0.5px}}
    .logo span{{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;margin-left:6px}}
    .nav-link{{font-size:13px;font-weight:500;color:#94a3b8;margin-left:20px}}
    .hero{{padding:48px 24px 36px;max-width:1100px;margin:0 auto}}
    .breadcrumb{{font-size:12px;color:#475569;margin-bottom:18px;font-family:monospace}}
    .breadcrumb a{{color:#475569}}
    .breadcrumb a:hover{{color:#94a3b8}}
    .nvidia-badge{{display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:9999px;background:rgba(118,233,0,0.08);border:1px solid rgba(118,233,0,0.22);margin-bottom:14px}}
    .nvidia-badge-dot{{width:7px;height:7px;border-radius:50%;background:#76e900;flex-shrink:0}}
    .nvidia-badge-text{{font-family:monospace;font-size:10.5px;letter-spacing:0.08em;color:#76e900;font-weight:700;text-transform:uppercase}}
    .skill-title{{font-size:34px;font-weight:800;color:#f1f5f9;letter-spacing:-1px;margin-bottom:10px;line-height:1.15}}
    .skill-desc{{font-size:15px;color:#94a3b8;max-width:720px;margin-bottom:16px;line-height:1.65}}
    .meta-row{{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px;align-items:center}}
    .meta-pill{{font-size:12px;font-weight:500;padding:4px 12px;border-radius:9999px;border:1px solid rgba(100,116,139,0.3);color:#94a3b8;background:rgba(30,41,59,0.5);font-family:monospace}}
    .cta-row{{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}}
    .btn-primary{{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:white;font-weight:700;font-size:13px;border-radius:8px;text-decoration:none}}
    .btn-secondary{{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:rgba(30,41,59,0.7);color:#94a3b8;font-weight:600;font-size:13px;border-radius:8px;border:1px solid rgba(71,85,105,0.4);text-decoration:none}}
    .layout{{display:grid;grid-template-columns:1fr 240px;gap:32px;max-width:1100px;margin:0 auto;padding:0 24px 32px;align-items:start}}
    @media(max-width:768px){{.layout{{grid-template-columns:1fr}}}}
    .grade-card{{background:rgba(15,23,42,0.7);border:1px solid rgba(71,85,105,0.25);border-radius:16px;padding:28px;text-align:center;backdrop-filter:blur(12px)}}
    .grade-label{{font-size:10px;font-weight:700;letter-spacing:0.1em;color:#64748b;text-transform:uppercase;margin-bottom:12px}}
    .grade-value{{font-size:64px;font-weight:800;line-height:1;color:{grade_color};text-shadow:0 0 28px {grade_color}44}}
    .grade-verdict{{font-size:12px;color:#94a3b8;margin-top:6px;font-weight:600}}
    .grade-stat{{display:flex;justify-content:space-between;font-size:12px;font-family:monospace;padding:6px 0;border-top:1px solid rgba(71,85,105,0.2);margin-top:8px;color:#64748b}}
    .grade-stat span:last-child{{color:#cbd5e1}}
    .section{{max-width:1100px;margin:0 auto;padding:0 24px 36px}}
    .section-title{{font-size:15px;font-weight:700;color:#e2e8f0;margin-bottom:14px;display:flex;align-items:center;gap:8px}}
    .section-title::before{{content:'';display:block;width:3px;height:15px;background:linear-gradient(#7c3aed,#22d3ee);border-radius:2px}}
    .findings-table{{width:100%;border-collapse:collapse;background:rgba(15,23,42,0.6);border:1px solid rgba(71,85,105,0.2);border-radius:12px;overflow:hidden}}
    .findings-table th{{background:rgba(15,23,42,0.9);padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:0.08em;color:#64748b;text-transform:uppercase;border-bottom:1px solid rgba(71,85,105,0.2)}}
    .findings-table tr:not(:last-child){{border-bottom:1px solid rgba(71,85,105,0.12)}}
    .taxonomy-card{{background:rgba(15,23,42,0.6);border:1px solid rgba(71,85,105,0.25);border-radius:14px;padding:22px;margin-bottom:28px}}
    .taxonomy-row{{display:grid;grid-template-columns:130px 1fr;gap:8px;margin-bottom:10px;font-size:13px}}
    .taxonomy-key{{font-family:monospace;font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;padding-top:2px}}
    .taxonomy-val{{color:#cbd5e1}}
    .footer{{border-top:1px solid rgba(71,85,105,0.2);padding:24px;text-align:center;font-size:12px;color:#475569;margin-top:40px}}
  </style>
</head>
<body>
  <header class="header">
    <a href="/" class="logo">GitScape<span>AI</span></a>
    <div>
      <a href="/registry" class="nav-link">Registry</a>
      <a href="{nvidia_skill_url}" target="_blank" rel="noopener" class="nav-link">NVIDIA &#8599;</a>
    </div>
  </header>

  <div class="hero">
    <nav class="breadcrumb">
      <a href="/">GitScape AI</a> &rsaquo;
      <a href="/registry">Registry</a> &rsaquo;
      <a href="/registry">NVIDIA</a> &rsaquo;
      {nvidia_skill_name}
    </nav>

    <div class="nvidia-badge">
      <div class="nvidia-badge-dot"></div>
      <span class="nvidia-badge-text">NVIDIA Curated Skill</span>
    </div>

    <h1 class="skill-title">{nvidia_skill_name}</h1>
    <p class="skill-desc">{description}</p>
    {taxonomy_html}
    {ai_prose_html}

    <div class="meta-row">
      <span class="meta-pill">Scanned: {scanned_display}</span>
      <span class="meta-pill">{files_analyzed:,} files</span>
      <span class="meta-pill">{langs_str}</span>
      <span class="meta-pill" style="color:{grade_color};border-color:{grade_color}44;background:{grade_color}11">Grade {grade} &middot; {grade_verdict}</span>
      {f'<span class="meta-pill">{nvidia_subdomain}</span>' if nvidia_subdomain else ''}
    </div>

    <div class="cta-row">
      <a href="/registry/{owner}/{repo}" class="btn-primary">Full Security Report</a>
      {nvidia_url_html}
      <a href="https://github.com/{owner}/{repo}" target="_blank" rel="noopener" class="btn-secondary">GitHub &#8599;</a>
      <a href="/registry" class="btn-secondary">&larr; Registry</a>
    </div>
  </div>

  <div class="layout">
    <div>
      <!-- Gate categories -->
      <div class="taxonomy-card">
        <div class="section-title" style="margin-bottom:12px">Security Gate Results</div>
        {cat_rows}
      </div>

      <!-- Taxonomy -->
      <div class="taxonomy-card">
        <div class="section-title" style="margin-bottom:12px">NVIDIA Skill Taxonomy</div>
        {''.join(f'<div class="taxonomy-row"><div class="taxonomy-key">{k}</div><div class="taxonomy-val">{v}</div></div>' for k, v in [("Skill", nvidia_skill_name), ("Subdomain", nvidia_subdomain or "—"), ("Domain", ", ".join(nvidia_domain) or "—"), ("Audience", ", ".join(nvidia_audience) or "—"), ("Repository", f"{owner}/{repo}"), ("Source", "NVIDIA/skills")])}
      </div>
    </div>

    <!-- Grade certificate -->
    <div class="grade-card">
      <div class="grade-label">ScapeGuard Grade</div>
      <div class="grade-value">{grade}</div>
      <div class="grade-verdict">{grade_verdict}</div>
      <div class="grade-stat"><span>Risk Score</span><span>{risk_score}</span></div>
      <div class="grade-stat"><span>Findings</span><span>{findings_count}</span></div>
      <div class="grade-stat"><span>Files</span><span>{files_analyzed:,}</span></div>
      <div class="grade-stat"><span>Verdict</span><span style="color:{'#10b981' if status == 'PASS' else '#f59e0b' if status == 'WARN' else '#ef4444'}">{status or '—'}</span></div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Security Findings ({findings_count})</h2>
    <table class="findings-table">
      <thead><tr><th>Severity</th><th>Rule</th><th>Description</th><th>Location</th></tr></thead>
      <tbody>{findings_rows}</tbody>
    </table>
  </div>

  <div class="section">
    <h2 class="section-title">Install as Agent Skill</h2>
    <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(71,85,105,0.25);border-radius:14px;padding:22px">
      <p style="font-size:13px;color:#94a3b8;margin-bottom:10px">Add this NVIDIA-curated skill to your AI agent workspace:</p>
      <div style="background:rgba(8,13,20,0.8);border:1px solid rgba(71,85,105,0.2);border-radius:8px;padding:12px 16px;font-family:monospace;font-size:12px;color:#94a3b8;word-break:break-all">npx skills add nvidia/{skill_slug}</div>
    </div>
  </div>

  <footer class="footer">
    <p>GitScape AI &mdash; ScapeGuard Security Audit for <strong>{nvidia_skill_name}</strong></p>
    <p style="margin-top:6px">Powered by <a href="https://gitscape.ai">GitScape AI</a> &middot; <a href="/registry">View all {229} NVIDIA skills in the registry</a></p>
  </footer>
</body>
</html>"""

    return FastAPIResponse(
        content=html,
        media_type="text/html",
        headers={"Cache-Control": "public, max-age=1800, stale-while-revalidate=86400"},
    )

@router.get("/badge/{owner}/{repo}")
def get_repo_badge(owner: str, repo: str):
    """
    Generate a dynamic ScapeGuard badge SVG for a given repository.
    """
    matching_skill = None
    skills = registry_store.list_registry_skills()
    for skill in skills:
        if skill["owner"].lower() == owner.lower() and skill["repo"].lower() == repo.lower():
            matching_skill = skill
            break
            
    if matching_skill:
        grade = matching_skill["grade"]
    else:
        grade = "Scanned"
        
    color_map = {
        "A": "#10b981",
        "B": "#84cc16",
        "C": "#f59e0b",
        "F": "#ef4444",
        "Scanned": "#64748b"
    }
    color = color_map.get(grade, "#64748b")
    
    label = "ScapeGuard"
    value = f"Grade {grade}" if grade != "Scanned" else "Scanned"
    
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="160" height="20">
  <linearGradient id="b" lg="y" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a">
    <rect width="160" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <path fill="#555" d="M0 0h100v20H0z"/>
    <path fill="{color}" d="M100 0h60v20H100z"/>
    <path fill="url(#b)" d="M0 0h160v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="50" y="15" fill="#010101" fill-opacity=".3">{label}</text>
    <text x="50" y="14">{label}</text>
    <text x="130" y="15" fill="#010101" fill-opacity=".3">{value}</text>
    <text x="130" y="14">{value}</text>
  </g>
</svg>"""
    
    from fastapi import Response
    return Response(content=svg, media_type="image/svg+xml")


class SkillZipRequest(BaseModel):
    repo_url: str
    owner: str
    repo: str
    digest_md: str
    languages: List[str] = []
    files_analyzed: int = 0
    bypass_scan_gate: bool = False
    skill_type: str = "framework"  # always "framework"; "code" is internal fallback only


def _readme_from_units(units) -> str:
    for u in units:
        if Path(u.path).name.lower().startswith("readme"):
            return u.content
    return ""


def _build_from_digest(body: "SkillZipRequest", repo_url: str, *, hd: bool = False):
    """Build (or fetch cached) a SkillPackage from a client-supplied digest."""
    key = skillforge.cache_key(body.digest_md)
    skill_type = getattr(body, "skill_type", "code")
    if hd:
        key += ":hd"
    if skill_type == "framework":
        key += ":framework"
    pkg = None if hd else skillforge.skill_cache.get(key)
    if pkg is not None:
        return pkg

    doc = skillforge.parse_digest(body.digest_md)
    meta = RepoMeta(
        owner=body.owner, repo=body.repo, repo_url=repo_url,
        primary_languages=body.languages,
        files_analyzed=body.files_analyzed or doc.files_analyzed,
        readme=_readme_from_units(doc.units), file_structure=doc.tree,
    )

    # Option A — for framework builds, reuse references from the Code Skill
    # package (built from the live clone) so the security scan sees the same
    # full-fidelity content it saw during /converter.  Falls back to digest
    # reconstruction when the cache is cold (recycled Cloud Run instance).
    prebuilt_references: dict | None = None
    if skill_type == "framework" and not hd:
        code_pkg = skillforge.skill_cache.get(skillforge.cache_key(body.digest_md))
        if code_pkg is not None:
            prebuilt_references = code_pkg.references
            logger.info(
                "framework build: reusing %d live-clone references from code-skill cache",
                len(prebuilt_references),
            )

    pkg = skillforge.build_skill(
        doc.units, meta,
        digest_hash=skillforge.content_hash(body.digest_md),
        hd=hd,
        skill_type=skill_type,
        prebuilt_references=prebuilt_references,
        digest_content=body.digest_md,
    )
    skillforge.skill_cache.set(key, pkg)
    return pkg



@router.post("/skill-zip")
def get_skill_zip(
    request: Request,
    body: SkillZipRequest,
):
    """
    Build and return a downloadable ZIP skill package from a pre-computed digest.

    Hits the SkillForge cache when the digest matches a prior /converter build
    (no recompute); otherwise rebuilds deterministically from the digest. The
    security scanner gates the download: a FAIL returns 422 with the report.

    ZIP contains: SKILL.md, references/*.md, exporters/*.py, manifest.json.
    """
    try:
        repo_url = urllib.parse.unquote(body.repo_url)
        pkg = _build_from_digest(body, repo_url)
        try:
            zip_buffer = skillforge.build_zip(pkg, bypass_scan_gate=body.bypass_scan_gate)
        except ScanBlocked as blocked:
            from app.skillforge.package import is_bypassable
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "scan_failed",
                    "scan_report": blocked.report.model_dump(mode="json"),
                    "bypassable": is_bypassable(blocked.report),
                },
            )

        filename = f"{body.repo}-skill.zip"
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class HdProseRequest(SkillZipRequest):
    """Same payload as /skill-zip; rebuilds the skill with Gemini-written prose."""


@router.post("/skill/hd-prose")
@limiter.limit("5/minute")
def get_hd_prose(
    request: Request,
    body: HdProseRequest,
):
    """
    HD mode: rebuild the skill with LLM-written prose (Gemini Flash, server-side
    key) layered over the deterministic structure. Returns the enhanced skill_md +
    references + scan_report + manifest. 503 when no server key is configured.
    """
    if not hd_mod.hd_available():
        raise HTTPException(status_code=503, detail="HD mode is not configured on this server.")
    try:
        repo_url = urllib.parse.unquote(body.repo_url)
        pkg = _build_from_digest(body, repo_url, hd=True)
        return {
            "skill_md": pkg.skill_md,
            "references": pkg.references,
            "scan_report": pkg.scan_report.model_dump(mode="json"),
            "manifest": pkg.manifest.model_dump(mode="json"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FrameworkSkillRequest(SkillZipRequest):
    """Same payload as /skill-zip; builds an Engineering Skill using the framework anatomy."""
    skill_type: str = "framework"


@router.post("/skill/framework")
@limiter.limit("5/minute")
def get_framework_skill(
    request: Request,
    body: FrameworkSkillRequest,
):
    """
    Engineering Skill mode: uses Gemini to generate all 6 canonical framework
    sections (Overview, When to Use, Core Process, Common Rationalizations,
    Red Flags, Verification) over the deterministic extract. HD key required.
    Returns skill_md + references + scan_report + manifest.
    503 when no Gemini API key is configured on this server.
    """
    if not hd_mod.hd_available():
        raise HTTPException(
            status_code=503,
            detail="Engineering Skill mode requires the Gemini API key to be configured on this server.",
        )
    try:
        repo_url = urllib.parse.unquote(body.repo_url)
        pkg = _build_from_digest(body, repo_url)
        return {
            "skill_md": pkg.skill_md,
            "references": pkg.references,
            "scan_report": pkg.scan_report.model_dump(mode="json"),
            "manifest": pkg.manifest.model_dump(mode="json"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/{framework}")
@limiter.limit("10/minute")
def get_framework_export(
    request: Request,
    framework: str,
    repo_url: str = Query(..., description="Git repository URL"),
):
    """
    Render and download a Python framework integration file for the given skill.

    Supported frameworks:
      - adk   : Google Agent Development Kit (google-adk)
      - agno  : Agno Knowledge Agent

    Returns a downloadable .py file named {repo}-{framework}-skill.py
    """
    framework = framework.lower()
    if framework not in ("adk", "agno"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported framework '{framework}'. Supported: adk, agno",
        )

    try:
        decoded_url = urllib.parse.unquote(repo_url)
        # Extract owner/repo from URL, e.g. https://github.com/owner/repo[.git]
        parts = decoded_url.rstrip("/").rstrip(".git").split("/")
        if len(parts) < 2:
            raise ValueError("Cannot parse owner/repo from URL")
        owner = parts[-2]
        repo = parts[-1].removesuffix(".git")

        code = render_framework_export(framework=framework, owner=owner, repo=repo)
        filename = f"{repo}-{framework}-skill.py"

        return StreamingResponse(
            iter([code.encode("utf-8")]),
            media_type="text/x-python",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/ws/converter")
async def websocket_converter(
    websocket: WebSocket,
    repo_url: str = Query(..., description="Git repository URL to analyze"),
    github_token: str = Query(
        None,
        description="GitHub Personal Access Token for private repos or increased rate limits",
    ),
):
    """
    WebSocket endpoint to clone a Git repository and generate a Markdown digest,
    streaming progress updates to the client as JSON with percentage.
    """
    await websocket.accept()
    loop = asyncio.get_event_loop()
    sender_task = None

    try:
        repo_url = urllib.parse.unquote(repo_url)
        with tempfile.TemporaryDirectory() as tmpdir:
            clone_path = os.path.join(tmpdir, "repo")
            await websocket.send_text(
                json.dumps(
                    {
                        "type": "progress",
                        "message": "Starting repository clone...",
                        "percentage": 0,
                    }
                )
            )
            converter.clone_repository(repo_url, clone_path, github_token=github_token)
            await websocket.send_text(
                json.dumps(
                    {
                        "type": "progress",
                        "message": "Repository cloned. Starting digest generation...",
                        "percentage": 10,
                    }
                )
            )

            progress_queue = asyncio.Queue()

            def sync_progress_callback(message: str, percentage: int):
                try:
                    asyncio.run_coroutine_threadsafe(
                        progress_queue.put(
                            {
                                "type": "progress",
                                "message": message,
                                "percentage": percentage,
                            }
                        ),
                        loop,
                    ).result()
                except Exception as e:
                    logger.error(
                        f"Error in sync_progress_callback putting to queue: {e}"
                    )

            async def queue_to_websocket_sender():
                while True:
                    item = await progress_queue.get()
                    if item is None:
                        progress_queue.task_done()
                        break
                    try:
                        await websocket.send_text(json.dumps(item))
                    except WebSocketDisconnect:
                        logger.info("WebSocket disconnected during send from queue.")
                        progress_queue.task_done()
                        break
                    except Exception as e:
                        logger.error(
                            f"Error sending message from queue to websocket: {e}"
                        )
                    progress_queue.task_done()
                    await asyncio.sleep(0.01)

            sender_task = asyncio.create_task(queue_to_websocket_sender())

            def progress_callback(message, percentage):
                sync_progress_callback(message, percentage)

            markdown_digest = await loop.run_in_executor(
                None,
                converter.generate_markdown_digest,
                repo_url,
                clone_path,
                progress_callback,
            )

            await progress_queue.put(None)
            await progress_queue.join()
            await sender_task

            await websocket.send_text(
                json.dumps(
                    {
                        "type": "digest_complete",
                        "digest": markdown_digest,
                        "percentage": 100,
                    }
                )
            )

    except WebSocketDisconnect:
        logger.info(f"Client {websocket.client} disconnected")
    except Exception as e:
        error_message = f"An unexpected error occurred: {str(e)}"
        try:
            if websocket.client_state == websocket.client_state.CONNECTED:
                await websocket.send_text(
                    json.dumps(
                        {"type": "error", "message": error_message, "percentage": 100}
                    )
                )
        except Exception as ws_send_error:
            logger.error(
                f"Error sending error to WebSocket during general exception: {ws_send_error}"
            )
        logger.error(error_message)
    finally:
        if sender_task and not sender_task.done():
            sender_task.cancel()
            try:
                await sender_task
            except asyncio.CancelledError:
                logger.info("Sender task cancelled.")
            except Exception as e_cancel:
                logger.error(f"Error during sender_task cancellation: {e_cancel}")
        if websocket.client_state == WebSocketState.CONNECTED:
            try:
                await websocket.close()
            except RuntimeError as close_err:
                logger.warning(f"WebSocket close error (already closed?): {close_err}")
        logger.info(f"WebSocket connection closed for {websocket.client}")


def create_app() -> FastAPI:
    """
    Create and configure the FastAPI application
    """
    app = FastAPI(
        title=str(settings.APP_NAME),
        description=str(settings.APP_DESCRIPTION),
        version=str(settings.APP_VERSION),
    )

    # CORS is only needed for local development where the Vite dev server
    # (localhost:5173) makes direct XHR calls to the FastAPI process (localhost:8081).
    # In production, all browser requests go to the same origin and nginx proxies
    # /api/* to the FastAPI sidecar on 127.0.0.1:8081 — no cross-origin request occurs.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount admin router (key-gated, no rate limit)
    from app.admin_router import admin_router
    app.include_router(admin_router, prefix="/admin")

    return app
