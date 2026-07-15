import os
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional
from google.cloud import storage

logger = logging.getLogger(__name__)

# Base static seed skills representing verified high-profile repositories
STATIC_REGISTRY_SKILLS = [
    {
        "repo_url": "https://github.com/stripe/stripe-node",
        "name": "stripe-node",
        "owner": "stripe",
        "repo": "stripe-node",
        "description": "Official Stripe Node.js SDK agent skill.",
        "primary_languages": ["TypeScript", "JavaScript"],
        "files_analyzed": 240,
        "grade": "F",
        "status": "FAIL",
        "risk_score": 25,
        "findings_count": 2,
        "findings_summary": [],
        "freshness": "fresh",
        "scanned_at": "",
        "last_git_sha": "",
    },
    {
        "repo_url": "https://github.com/pydantic/pydantic",
        "name": "pydantic",
        "owner": "pydantic",
        "repo": "pydantic",
        "description": "Data validation and settings management using Python type hints.",
        "primary_languages": ["Python"],
        "files_analyzed": 380,
        "grade": "A",
        "status": "PASS",
        "risk_score": 0,
        "findings_count": 1,
        "findings_summary": [],
        "freshness": "fresh",
        "scanned_at": "",
        "last_git_sha": "",
    },
    {
        "repo_url": "https://github.com/fastapi/fastapi",
        "name": "fastapi",
        "owner": "fastapi",
        "repo": "fastapi",
        "description": "FastAPI framework, high performance, easy to learn, fast to code, ready for production.",
        "primary_languages": ["Python"],
        "files_analyzed": 190,
        "grade": "A",
        "status": "PASS",
        "risk_score": 0,
        "findings_count": 0,
        "findings_summary": [],
        "freshness": "fresh",
        "scanned_at": "",
        "last_git_sha": "",
    },
    {
        "repo_url": "https://github.com/expressjs/express",
        "name": "express",
        "owner": "expressjs",
        "repo": "express",
        "description": "Fast, unopinionated, minimalist web framework for Node.js.",
        "primary_languages": ["JavaScript"],
        "files_analyzed": 90,
        "grade": "A",
        "status": "PASS",
        "risk_score": 0,
        "findings_count": 1,
        "findings_summary": [],
        "freshness": "fresh",
        "scanned_at": "",
        "last_git_sha": "",
    },
    {
        "repo_url": "https://github.com/psf/requests",
        "name": "requests",
        "owner": "psf",
        "repo": "requests",
        "description": "A simple, pleasant HTTP library for Python.",
        "primary_languages": ["Python"],
        "files_analyzed": 75,
        "grade": "B",
        "status": "WARN",
        "risk_score": 8,
        "findings_count": 1,
        "findings_summary": [],
        "freshness": "fresh",
        "scanned_at": "",
        "last_git_sha": "",
    },
]

# Ephemeral fallback cache for local dev / offline runs
IN_MEMORY_SCANS = []


def _get_storage_client() -> Optional[storage.Client]:
    if not os.environ.get("GITSCAPE_REGISTRY_BUCKET"):
        return None
    try:
        return storage.Client()
    except Exception as e:
        logger.warning(
            f"Could not initialize Google Cloud Storage client: {e}. Falling back to in-memory store."
        )
        return None


def list_registry_skills() -> List[dict]:
    """
    Returns the combined list of static registry seed skills and dynamically scanned skills.
    Reads scans_index.json from GCS if configured, otherwise falls back to local in-memory cache.
    """
    bucket_name = os.environ.get("GITSCAPE_REGISTRY_BUCKET")
    client = _get_storage_client()

    dynamic_skills = []
    if client and bucket_name:
        try:
            bucket = client.bucket(bucket_name)
            blob = bucket.blob("scans_index.json")
            if blob.exists():
                data_str = blob.download_as_text(encoding="utf-8")
                dynamic_skills = json.loads(data_str)
                logger.info(
                    f"Loaded {len(dynamic_skills)} dynamic scans from GCS registry index."
                )
        except Exception as e:
            logger.error(f"Error fetching GCS registry index scans_index.json: {e}")
            dynamic_skills = IN_MEMORY_SCANS
    else:
        dynamic_skills = IN_MEMORY_SCANS

    # Combine static seed list with unique dynamic skills (dynamic wins on overlap)
    seen_urls = set()
    combined = []
    for item in dynamic_skills:
        url = item["repo_url"].lower()
        if url not in seen_urls:
            combined.append(item)
            seen_urls.add(url)
    for item in STATIC_REGISTRY_SKILLS:
        url = item["repo_url"].lower()
        if url not in seen_urls:
            combined.append(item)
            seen_urls.add(url)

    return combined


def get_all_scans() -> List[dict]:
    """
    Returns all scanned entries (dynamic + static seeds) ordered newest first.
    Used for sitemap generation and the registry index page.
    """
    all_scans = list_registry_skills()
    # Sort by scanned_at descending (empty string sorts last)
    return sorted(all_scans, key=lambda x: x.get("scanned_at", ""), reverse=True)


def get_scanned_detail(owner: str, repo: str) -> Optional[dict]:
    """
    Retrieves the full scan report payload from GCS if cached.
    """
    bucket_name = os.environ.get("GITSCAPE_REGISTRY_BUCKET")
    client = _get_storage_client()

    if client and bucket_name:
        try:
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(f"scans/{owner.lower()}-{repo.lower()}.json")
            if blob.exists():
                logger.info(
                    f"Registry cache hit for scans/{owner.lower()}-{repo.lower()}.json"
                )
                return json.loads(blob.download_as_text(encoding="utf-8"))
        except Exception as e:
            logger.error(f"Error checking registry cache for {owner}/{repo}: {e}")
    return None


def save_scanned_skill(owner: str, repo: str, detail_data: dict):
    """
    Saves a scanned skill payload to GCS (full details and index append) or to the in-memory fallback.
    Enriches the persisted data with scanned_at timestamp, last_git_sha, findings_summary,
    GitHub metrics, and AI prose summary so SSR report pages and search APIs have everything they need.
    """
    bucket_name = os.environ.get("GITSCAPE_REGISTRY_BUCKET")
    client = _get_storage_client()

    # Build a concise findings_summary (top 3 findings, severity + rule + message)
    raw_findings = detail_data.get("findings", [])
    findings_summary = [
        {
            "severity": f.get("severity", ""),
            "rule": f.get("rule", ""),
            "message": f.get("message", "")[:200],
        }
        for f in raw_findings[:3]
    ]

    scanned_at = detail_data.get("scanned_at") or datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    # Exclude detailed findings to keep index lightweight
    summary_data = {
        "repo_url": detail_data["repo_url"],
        "name": detail_data["name"],
        "owner": detail_data["owner"],
        "repo": detail_data["repo"],
        "description": detail_data["description"],
        "primary_languages": detail_data["primary_languages"],
        "files_analyzed": detail_data["files_analyzed"],
        "grade": detail_data["grade"],
        "status": detail_data["status"],
        "risk_score": detail_data["risk_score"],
        "findings_count": len(raw_findings),
        "findings_summary": findings_summary,
        "freshness": "fresh",
        "scanned_at": scanned_at,
        "last_git_sha": detail_data.get("last_git_sha", ""),
        "stars": detail_data.get("stars", 0),
        "forks": detail_data.get("forks", 0),
        "license": detail_data.get("license", ""),
        "open_issues": detail_data.get("open_issues", 0),
        "watchers": detail_data.get("watchers", 0),
        "last_commit_at": detail_data.get("last_commit_at", ""),
        "ai_summary": detail_data.get("ai_summary", ""),
    }

    # Enrich the detail blob with scanned_at before saving
    detail_data_to_save = {
        **detail_data,
        "scanned_at": scanned_at,
        "stars": detail_data.get("stars", 0),
        "forks": detail_data.get("forks", 0),
        "license": detail_data.get("license", ""),
        "open_issues": detail_data.get("open_issues", 0),
        "watchers": detail_data.get("watchers", 0),
        "last_commit_at": detail_data.get("last_commit_at", ""),
        "ai_summary": detail_data.get("ai_summary", ""),
    }

    if client and bucket_name:
        try:
            bucket = client.bucket(bucket_name)

            # 1. Save full details
            detail_blob = bucket.blob(f"scans/{owner.lower()}-{repo.lower()}.json")
            detail_blob.upload_from_string(
                json.dumps(detail_data_to_save, indent=2), content_type="application/json"
            )

            # 2. Append to index
            index_blob = bucket.blob("scans_index.json")
            existing_index = []
            if index_blob.exists():
                try:
                    existing_index = json.loads(
                        index_blob.download_as_text(encoding="utf-8")
                    )
                except Exception:
                    existing_index = []

            # Remove any older duplicate entry in index
            existing_index = [
                item
                for item in existing_index
                if item["repo_url"].lower() != detail_data["repo_url"].lower()
            ]
            existing_index.append(summary_data)

            index_blob.upload_from_string(
                json.dumps(existing_index, indent=2), content_type="application/json"
            )
            logger.info(f"Saved {owner}/{repo} scan to GCS bucket successfully.")
            return
        except Exception as e:
            logger.error(
                f"Failed to write scan to GCS bucket: {e}. Falling back to in-memory."
            )

    # In-memory fallback
    global IN_MEMORY_SCANS
    IN_MEMORY_SCANS = [
        item
        for item in IN_MEMORY_SCANS
        if item["repo_url"].lower() != detail_data["repo_url"].lower()
    ]
    IN_MEMORY_SCANS.append(summary_data)
    logger.info(f"Saved {owner}/{repo} scan to in-memory fallback list.")
