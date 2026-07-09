from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
import tempfile
import os
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone
import json
import logging

from app.skillforge.models import RepoMeta
from app import skillforge
import app.converter as converter

logger = logging.getLogger(__name__)

mcp_router = APIRouter()


class CallToolRequest(BaseModel):
    name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)


@mcp_router.get("/tools")
async def list_tools():
    """List available MCP tools."""
    return {
        "tools": [
            {
                "name": "install_skill",
                "description": (
                    "Clones a git repository, compiles its source code and docs into an Anthropic Agent Skill (SKILL.md), "
                    "performs a security scan, and returns the files to write locally in .agents/skills/."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "repo_url": {
                            "type": "string",
                            "description": "The HTTPS URL of the Git repository to compile."
                        },
                        "github_token": {
                            "type": "string",
                            "description": "Optional GitHub Personal Access Token for private repositories."
                        },
                        "skill_type": {
                            "type": "string",
                            "description": "The type of skill: 'code' or 'framework'. Defaults to 'code'.",
                            "enum": ["code", "framework"]
                        }
                    },
                    "required": ["repo_url"]
                }
            }
        ]
    }


@mcp_router.post("/call")
async def call_tool(req: CallToolRequest):
    """Invoke an MCP tool."""
    if req.name != "install_skill":
        raise HTTPException(status_code=404, detail=f"Tool {req.name} not found")

    repo_url = req.arguments.get("repo_url")
    if not repo_url:
        return {
            "content": [{"type": "text", "text": "Error: repo_url is required."}],
            "isError": True
        }

    github_token = req.arguments.get("github_token")
    skill_type = req.arguments.get("skill_type", "code")

    try:
        repo_url = urllib.parse.unquote(repo_url)
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
                units, meta,
                digest_hash=skillforge.content_hash(digest_str),
                digest_content=digest_str,
                skill_type=skill_type
            )

            skill_dir = pkg.name
            files_to_write = {}
            base_path = f".agents/skills/{skill_dir}"

            files_to_write[f"{base_path}/SKILL.md"] = pkg.skill_md
            files_to_write[f"{base_path}/manifest.json"] = json.dumps(pkg.manifest.model_dump(mode="json"), indent=2)

            for ref_name, ref_content in pkg.references.items():
                files_to_write[f"{base_path}/{ref_name}"] = ref_content

            result_payload = {
                "status": "success",
                "skill_name": pkg.name,
                "scan_grade": pkg.scan_report.status.value,
                "files": files_to_write
            }

            response_text = json.dumps(result_payload, indent=2)

            return {
                "content": [
                    {
                        "type": "text",
                        "text": response_text
                    }
                ],
                "isError": False
            }

    except Exception as e:
        logger.exception("MCP install_skill tool call failed")
        return {
            "content": [{"type": "text", "text": f"Error during skill generation: {str(e)}"}],
            "isError": True
        }
