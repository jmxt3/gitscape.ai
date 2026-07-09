from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List, Union
import tempfile
import os
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone
import json
import logging
import asyncio

from app.skillforge.models import RepoMeta
from app import skillforge
import app.converter as converter

logger = logging.getLogger(__name__)

mcp_router = APIRouter()


class CallToolRequest(BaseModel):
    name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)


@mcp_router.get("")
@mcp_router.get("/")
async def sse_handshake(request: Request):
    """
    MCP SSE handshake endpoint.
    Establishes SSE stream and sends the endpoint URL.
    """
    async def event_generator():
        # Retrieve incoming host and protocol to build absolute callback URL
        host = request.headers.get("host", "localhost:8081")
        scheme = "https" if request.headers.get("x-forwarded-proto") == "https" else "http"
        # Nginx routes /api/mcp to FastAPI /mcp, so client POSTs to /api/mcp/call in prod,
        # or /mcp/call in local dev. We can check if host is local to determine prefix.
        is_local = "localhost" in host or "127.0.0.1" in host
        prefix = "/mcp" if is_local else "/api/mcp"
        post_url = f"{scheme}://{host}{prefix}/call"

        # Send standard MCP SSE endpoint event
        yield f"event: endpoint\ndata: {post_url}\n\n"

        # Keep connection open with comments/keep-alive heartbeats
        while True:
            try:
                yield ": keep-alive\n\n"
                await asyncio.sleep(15)
            except asyncio.CancelledError:
                logger.info("SSE connection closed by client")
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@mcp_router.get("/tools")
async def list_tools():
    """List available MCP tools (REST fallback)."""
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


async def run_install_skill(repo_url: str, github_token: Optional[str], skill_type: str) -> Dict[str, Any]:
    """Execute the core clone and compile flow of install_skill."""
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
        logger.exception("MCP install_skill tool call execution failed")
        return {
            "content": [{"type": "text", "text": f"Error during skill generation: {str(e)}"}],
            "isError": True
        }


@mcp_router.post("/call")
async def call_tool(request: Request):
    """Handle MCP tool list and tool invocation requests (supports JSON-RPC 2.0 and legacy CLI)."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # 1. Check if it is a JSON-RPC 2.0 request
    if "jsonrpc" in body and "method" in body:
        jsonrpc = body.get("jsonrpc", "2.0")
        method = body.get("method")
        req_id = body.get("id")
        params = body.get("params", {})

        if method == "tools/list":
            # Wrap tools list response in JSON-RPC format
            tools_list = await list_tools()
            return {
                "jsonrpc": jsonrpc,
                "id": req_id,
                "result": tools_list
            }

        elif method == "tools/call":
            name = params.get("name")
            arguments = params.get("arguments", {})

            if name != "install_skill":
                return {
                    "jsonrpc": jsonrpc,
                    "id": req_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {name}"
                    }
                }

            repo_url = arguments.get("repo_url")
            if not repo_url:
                return {
                    "jsonrpc": jsonrpc,
                    "id": req_id,
                    "error": {
                        "code": -32602,
                        "message": "repo_url argument is required"
                    }
                }

            github_token = arguments.get("github_token")
            skill_type = arguments.get("skill_type", "code")

            res = await run_install_skill(repo_url, github_token, skill_type)
            if res.get("isError"):
                return {
                    "jsonrpc": jsonrpc,
                    "id": req_id,
                    "error": {
                        "code": -32603,
                        "message": res["content"][0]["text"]
                    }
                }

            return {
                "jsonrpc": jsonrpc,
                "id": req_id,
                "result": {
                    "content": res["content"]
                }
            }

        elif method == "initialize":
            return {
                "jsonrpc": jsonrpc,
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "gitscape-mcp",
                        "version": "0.2.0"
                    }
                }
            }

        # Catch-all success for notifications or initialization confirmation
        return {
            "jsonrpc": jsonrpc,
            "id": req_id,
            "result": {}
        }

    # 2. Otherwise handle as legacy CLI request:
    name = body.get("name")
    arguments = body.get("arguments", {})
    if name != "install_skill":
        raise HTTPException(status_code=404, detail=f"Tool {name} not found")

    repo_url = arguments.get("repo_url")
    if not repo_url:
        return {
            "content": [{"type": "text", "text": "Error: repo_url is required."}],
            "isError": True
        }

    github_token = arguments.get("github_token")
    skill_type = arguments.get("skill_type", "code")

    return await run_install_skill(repo_url, github_token, skill_type)
