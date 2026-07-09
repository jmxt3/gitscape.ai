import pytest
import json
from fastapi.testclient import TestClient
from main import app
from app import converter
from app.skillforge import models

client = TestClient(app)


def test_list_tools():
    resp = client.get("/mcp/tools")
    assert resp.status_code == 200
    data = resp.json()
    assert "tools" in data
    tools = data["tools"]
    assert len(tools) == 1
    assert tools[0]["name"] == "install_skill"


def test_call_tool_not_found():
    resp = client.post("/mcp/call", json={"name": "invalid_tool", "arguments": {}})
    assert resp.status_code == 404


def test_call_tool_install_skill_missing_args():
    resp = client.post("/mcp/call", json={"name": "install_skill", "arguments": {}})
    assert resp.status_code == 200
    data = resp.json()
    assert "content" in data
    assert len(data["content"]) == 1
    assert "Error:" in data["content"][0]["text"]


def test_call_tool_install_skill_success(monkeypatch):
    # Mock clone_repository to create the directory
    def mock_clone(repo_url, clone_path, github_token=None):
        import os
        os.makedirs(clone_path, exist_ok=True)
    monkeypatch.setattr(converter, "clone_repository", mock_clone)

    # Mock generate_markdown_digest to return a fake digest and metadata
    def mock_digest(repo_url, clone_path, return_metadata=False):
        digest = (
            "Repository: https://github.com/acme/demo\n"
            "Files analyzed: 1\n"
            "Directory structure:\n"
            "└── demo/\n"
            "    └── main.py\n"
            "================================================\n"
            "FILE: main.py\n"
            "================================================\n"
            "def foo():\n"
            "    return 'bar'\n"
        )
        metadata = {
            "owner": "acme",
            "repo": "demo",
            "primary_languages": ["Python"],
            "files_analyzed": 1,
            "readme": "README content",
            "file_structure": "└── main.py\n",
            "structure_overview": "└── main.py/\n",
        }
        if return_metadata:
            return digest, metadata
        return digest
    monkeypatch.setattr(converter, "generate_markdown_digest", mock_digest)

    # Mock get_git_sha
    monkeypatch.setattr(converter, "get_git_sha", lambda path: "abc123sha")

    resp = client.post(
        "/mcp/call",
        json={
            "name": "install_skill",
            "arguments": {
                "repo_url": "https://github.com/acme/demo"
            }
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "content" in data
    assert len(data["content"]) == 1
    
    text = data["content"][0]["text"]
    payload = json.loads(text)
    assert payload["status"] == "success"
    assert payload["skill_name"] == "acme-demo"
    assert "files" in payload
    
    files = payload["files"]
    assert ".agents/skills/acme-demo/SKILL.md" in files
    assert ".agents/skills/acme-demo/manifest.json" in files
    assert any(k.startswith(".agents/skills/acme-demo/references/") for k in files.keys())
    
    # Check manifest content
    manifest_data = json.loads(files[".agents/skills/acme-demo/manifest.json"])
    assert manifest_data["source_git_head"] == "abc123sha"
    assert manifest_data["built_at"] is not None
