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
        is_local = "localhost" in host or "127.0.0.1" in host
        scheme = "http" if is_local else "https"
        # Nginx routes /api/mcp to FastAPI /mcp, so client POSTs to /api/mcp/call in prod,
        # or /mcp/call in local dev. We can check if host is local to determine prefix.
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
                    "Install an agent skill from a GitHub repository. "
                    "Use this tool when the user asks to: install a skill, compile a repo into a skill, "
                    "add a skill from GitHub, convert a repository to an agent skill, or learn a codebase. "
                    "Clones the repo, compiles source code and docs into a SKILL.md, performs a security scan, "
                    "and returns files to write to .agents/skills/. "
                    "The response carries a ScapeGuard security verdict: scan_grade (A/B/C/F), scan_status "
                    "(PASS/WARN/FAIL), risk_score, and safe_to_install. Do NOT write the files when "
                    "safe_to_install is false unless the user explicitly accepts the findings. "
                    "After receiving a safe response, the agent MUST write all returned files to disk "
                    "and register the skill in AGENTS.md."
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
                    },
                    "required": ["repo_url"]
                }
            },
            {
                "name": "uninstall_skill",
                "description": (
                    "Remove a previously installed agent skill. "
                    "Use this tool when the user asks to: uninstall a skill, remove a skill, "
                    "delete a skill, or clean up an agent skill. "
                    "Returns the file paths and AGENTS.md references to delete. "
                    "After receiving the response, the agent MUST execute all listed deletion actions locally."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "skill_name": {
                            "type": "string",
                            "description": (
                                "The kebab-case skill name as it appears in .agents/skills/, e.g. \"google-adk-python\". "
                                "Alternatively, pass the full GitHub repo URL and the name will be derived from it."
                            )
                        },
                    },
                    "required": ["skill_name"]
                }
            },
        ]
    }


async def run_install_skill(repo_url: str, github_token: Optional[str]) -> Dict[str, Any]:
    """Execute the core clone and compile flow of install_skill.

    Always builds a framework (Engineering Skill). Falls back to a code skill
    automatically when Gemini is unavailable.
    """
    skill_type = "framework"
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

            # Include the full code digest as a reference file so the agent has
            # complete source-code context — mirrors what the web zip export does.
            if pkg.digest_filename and pkg.digest_content:
                files_to_write[f"{base_path}/{pkg.digest_filename}"] = pkg.digest_content

            # Include scan report files so the installed skill has a complete
            # audit trail — mirrors what the web zip export produces.
            scan_json = json.dumps(pkg.scan_report.model_dump(mode="json"), indent=2, ensure_ascii=False)
            files_to_write[f"{base_path}/scan-report.json"] = scan_json

            from app.skillforge.scan.sarif import to_sarif
            sarif_json = json.dumps(to_sarif(pkg.scan_report), indent=2, ensure_ascii=False)
            files_to_write[f"{base_path}/scan-report.sarif"] = sarif_json

            # Include exporter files (ADK, Agno wrappers, etc.)
            for exp_name, exp_content in pkg.exporters.items():
                files_to_write[f"{base_path}/{exp_name}"] = exp_content

            from app.skillforge.models import ScanStatus
            from app.skillforge.package import is_bypassable
            from app.skillforge.scan.judge import judge_enabled

            report = pkg.scan_report
            llm_judge_used = bool(report.summary)
            result_payload = {
                "status": "success",
                "skill_name": pkg.name,
                # "authored" = installed the maintainer's committed skill as-is;
                # "compiled" = GitScape generated it from source.
                "source": pkg.source,
                # Letter grade (A/B/C/F); scan_status keeps the PASS/WARN/FAIL verdict.
                "scan_grade": report.grade or report.status.value,
                "scan_status": report.status.value,
                "risk_score": report.risk_score,
                # Agent-facing install gate: safe unless the scan FAILed, and
                # whether the UI may still offer an accept-and-download path.
                "safe_to_install": report.status != ScanStatus.FAIL,
                "bypassable": is_bypassable(report),
                # Transparency: how the scan actually ran.
                "scan_mode": "static+llm_judge" if llm_judge_used else "static",
                "llm_judge_requested": judge_enabled(),
                "llm_judge_used": llm_judge_used,
                "pre_write_actions": [
                    {
                        "type": "delete_directory_if_exists",
                        "path": base_path,
                        "description": (
                            f"Remove the previous version of '{pkg.name}' before writing new files. "
                            "This ensures stale reference files from an older install don't linger."
                        )
                    }
                ],
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


def run_uninstall_skill(skill_name: str) -> Dict[str, Any]:
    """Build the uninstall manifest for a previously installed skill.

    The MCP server has no access to the agent's local filesystem, so this
    returns a structured action list the agent must execute locally.
    """
    import re

    # Derive the kebab-case skill directory name from a URL if one was passed.
    raw = skill_name.strip()
    if raw.startswith("http://") or raw.startswith("https://"):
        try:
            from urllib.parse import urlparse
            parts = urlparse(raw).path.rstrip("/").split("/")
            raw = f"{parts[-2]}-{parts[-1]}" if len(parts) >= 2 else parts[-1]
        except Exception:
            pass
    # Normalise to kebab-case (mirrors generate_skill_name in skill_builder.py)
    name = re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-")
    if not name:
        return {
            "content": [{"type": "text", "text": "Error: could not derive a valid skill name."}],
            "isError": True
        }

    skill_dir = f".agents/skills/{name}"
    agents_md_files = ["AGENTS.md", ".agents/AGENTS.md", "CLAUDE.md", ".gemini/config/AGENTS.md"]
    skill_line = f"- [{name}](.agents/skills/{name}/SKILL.md)"

    payload = {
        "status": "success",
        "skill_name": name,
        "actions": [
            {
                "type": "delete_directory",
                "path": skill_dir,
                "description": f"Delete the skill directory and all its contents"
            },
            {
                "type": "remove_line_from_files",
                "line": skill_line,
                "files": agents_md_files,
                "description": (
                    f"Remove the skill reference line from each file if present. "
                    f"Also remove the '## GitScape Skills' section header if it becomes empty."
                )
            }
        ],
        "instructions": (
            f"To completely uninstall '{name}':\n"
            f"1. Delete the directory: {skill_dir}\n"
            f"2. Remove this line from AGENTS.md / CLAUDE.md if present:\n   {skill_line}\n"
            f"3. If the '## GitScape Skills' section in those files is now empty, remove the header too."
        )
    }
    return {
        "content": [{"type": "text", "text": json.dumps(payload, indent=2)}],
        "isError": False
    }



@mcp_router.post("")
@mcp_router.post("/")
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

            if name == "install_skill":
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
                res = await run_install_skill(repo_url, github_token)

            elif name == "uninstall_skill":
                skill_name = arguments.get("skill_name")
                if not skill_name:
                    return {
                        "jsonrpc": jsonrpc,
                        "id": req_id,
                        "error": {
                            "code": -32602,
                            "message": "skill_name argument is required"
                        }
                    }
                res = run_uninstall_skill(skill_name)

            else:
                return {
                    "jsonrpc": jsonrpc,
                    "id": req_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {name}"
                    }
                }

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
                    },
                    "instructions": (
                        "GitScape compiles any GitHub repository into an AI agent skill. "
                        "ALWAYS use the install_skill tool when the user asks to: "
                        "install a skill, compile a repo, add a skill from GitHub, "
                        "or convert a repository into an agent skill. "
                        "ALWAYS use the uninstall_skill tool to remove a previously installed skill. "
                        "After install_skill returns, write ALL returned files to disk and "
                        "register the skill in AGENTS.md."
                    )
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

    if name == "install_skill":
        repo_url = arguments.get("repo_url")
        if not repo_url:
            return {
                "content": [{"type": "text", "text": "Error: repo_url is required."}],
                "isError": True
            }
        github_token = arguments.get("github_token")
        return await run_install_skill(repo_url, github_token)

    if name == "uninstall_skill":
        skill_name = arguments.get("skill_name")
        if not skill_name:
            return {
                "content": [{"type": "text", "text": "Error: skill_name is required."}],
                "isError": True
            }
        return run_uninstall_skill(skill_name)

    raise HTTPException(status_code=404, detail=f"Tool {name!r} not found")
