"""
admin_router.py
===============

Admin-only endpoints for GitScape batch operations.
All routes are protected by the X-Admin-Key header matched against the
GITSCAPE_ADMIN_KEY environment variable (loaded from Secret Manager in prod).

Mounted at: /api/admin (see api.py create_app)

Routes
------
POST /api/admin/scan-batch
    Batch-scan a list of skills from nvidia_skills.json (or any compatible payload).
    Streams per-skill status as Server-Sent Events.
    Body:
        {
          "skills": [
            {
              "github_url": "https://github.com/NVIDIA/skills",
              "skill_name": "aiq-deploy",
              "nvidia_domain": ["AI And Machine Learning"],
              "nvidia_audience": ["Developer", "DevOps Engineer"],
              "nvidia_skill_url": "https://build.nvidia.com/skills/aiq-deploy",
              "nvidia_subdomain": "agentic-ai",
              "product": "NeMo Agent Toolkit"
            },
            ...
          ],
          "concurrency": 2   // optional, 1-5, default 2
        }

GET /api/admin/scan-status
    Returns current progress of the most recent batch scan job.
    Body: { "total": N, "completed": M, "failed": K, "in_progress": J }
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

admin_router = APIRouter(tags=["admin"])

# ─── shared state for scan progress ───────────────────────────────────────────

_scan_progress: dict = {
    "total": 0,
    "completed": 0,
    "failed": 0,
    "skipped": 0,
    "in_progress": 0,
    "started_at": "",
    "finished_at": "",
    "running": False,
}


# ─── auth dependency ───────────────────────────────────────────────────────────


def _require_admin_key(request: Request) -> None:
    admin_key = os.environ.get("GITSCAPE_ADMIN_KEY", "").strip()
    if not admin_key:
        raise HTTPException(
            status_code=503,
            detail="Admin endpoint is not configured (GITSCAPE_ADMIN_KEY not set).",
        )
    provided = request.headers.get("X-Admin-Key", "")
    if provided != admin_key:
        raise HTTPException(status_code=401, detail="Invalid admin key.")


# ─── request models ───────────────────────────────────────────────────────────


class NvidiaSkillItem(BaseModel):
    github_url: str
    skill_name: str = ""
    display_name: str = ""
    description: str = ""
    product: str = ""
    nvidia_domain: list[str] = Field(default_factory=list)
    nvidia_audience: list[str] = Field(default_factory=list)
    nvidia_skill_url: str = ""
    nvidia_subdomain: str = ""
    nvidia_activity_tags: list[str] = Field(default_factory=list)
    source: str = "nvidia"
    skip: bool = False


class BatchScanRequest(BaseModel):
    skills: list[NvidiaSkillItem]
    concurrency: int = Field(default=2, ge=1, le=5)


# ─── core scan helper ─────────────────────────────────────────────────────────


async def _scan_one(skill: NvidiaSkillItem, loop: asyncio.AbstractEventLoop) -> dict:
    """
    Runs a full GitScape scan for one NVIDIA skill and persists the result to
    the registry. Returns a status dict with 'ok', 'skill_name', and 'error'.
    """
    from app import api as api_mod
    from app import registry_store

    nvidia_meta = {
        "nvidia_domain": skill.nvidia_domain,
        "nvidia_audience": skill.nvidia_audience,
        "nvidia_skill_name": skill.skill_name,
        "nvidia_skill_url": skill.nvidia_skill_url,
        "nvidia_subdomain": skill.nvidia_subdomain,
        "source": skill.source,
    }

    try:
        await loop.run_in_executor(
            None,
            api_mod._scan_and_save,
            skill.github_url,
            None,  # github_token — none for NVIDIA/skills (public)
            nvidia_meta,
        )
        return {"ok": True, "skill_name": skill.skill_name, "error": None}
    except Exception as exc:
        logger.error(
            "Batch scan failed for skill",
            skill=skill.skill_name,
            github_url=skill.github_url,
            error=str(exc),
        )
        return {"ok": False, "skill_name": skill.skill_name, "error": str(exc)}


# ─── SSE event generator ──────────────────────────────────────────────────────


async def _batch_scan_stream(
    skills: list[NvidiaSkillItem],
    concurrency: int,
) -> AsyncGenerator[str, None]:
    global _scan_progress

    skills_to_scan = [s for s in skills if not s.skip]
    skipped = len(skills) - len(skills_to_scan)

    _scan_progress.update(
        {
            "total": len(skills_to_scan),
            "completed": 0,
            "failed": 0,
            "skipped": skipped,
            "in_progress": 0,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "finished_at": "",
            "running": True,
        }
    )

    yield f"data: {json.dumps({'event': 'start', 'total': len(skills_to_scan), 'skipped': skipped})}\n\n"

    semaphore = asyncio.Semaphore(concurrency)
    loop = asyncio.get_event_loop()

    result_queue: asyncio.Queue = asyncio.Queue()

    async def _bounded(skill: NvidiaSkillItem) -> None:
        async with semaphore:
            _scan_progress["in_progress"] += 1
            result = await _scan_one(skill, loop)
            _scan_progress["in_progress"] -= 1
            if result["ok"]:
                _scan_progress["completed"] += 1
            else:
                _scan_progress["failed"] += 1
            await result_queue.put(result)

    tasks = [asyncio.create_task(_bounded(s)) for s in skills_to_scan]

    for _ in range(len(skills_to_scan)):
        result = await result_queue.get()
        payload = {
            "event": "skill_done",
            "skill_name": result["skill_name"],
            "ok": result["ok"],
            "error": result["error"],
            "completed": _scan_progress["completed"],
            "failed": _scan_progress["failed"],
            "total": _scan_progress["total"],
        }
        yield f"data: {json.dumps(payload)}\n\n"

    await asyncio.gather(*tasks, return_exceptions=True)

    _scan_progress["finished_at"] = datetime.now(timezone.utc).isoformat()
    _scan_progress["running"] = False

    yield f"data: {json.dumps({'event': 'done', **_scan_progress})}\n\n"


# ─── routes ───────────────────────────────────────────────────────────────────


@admin_router.post("/scan-batch")
async def scan_batch(
    request: Request,
    body: BatchScanRequest,
    _: None = Depends(_require_admin_key),
):
    """
    Batch-scan a list of skills (from nvidia_skills.json) and stream progress
    as Server-Sent Events. Each 'skill_done' event carries the result for one
    skill. A final 'done' event summarises the full run.

    Protected by X-Admin-Key header.
    """
    if _scan_progress.get("running"):
        raise HTTPException(
            status_code=409,
            detail="A batch scan is already running. Wait for it to finish or restart the service.",
        )

    return StreamingResponse(
        _batch_scan_stream(body.skills, body.concurrency),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering for SSE
        },
    )


@admin_router.get("/scan-status")
async def scan_status(
    request: Request,
    _: None = Depends(_require_admin_key),
):
    """
    Returns the progress of the most recent batch scan job.
    Protected by X-Admin-Key header.
    """
    return _scan_progress
