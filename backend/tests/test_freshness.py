import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app
from app.skillforge.freshness import compute_drift, is_noop_drift

client = TestClient(app)

def test_is_noop_drift():
    # Empty changes list means it's a no-op
    assert is_noop_drift([]) is True

    # Image assets/directories are no-op
    assert is_noop_drift(["assets/logo.png", "docs/images/arch.jpg", "ignored.log"]) is True

    # Any code or documentation file changes are NOT no-op
    assert is_noop_drift(["app/main.py"]) is False
    assert is_noop_drift(["README.md"]) is False
    assert is_noop_drift(["Makefile"]) is False
    assert is_noop_drift(["*"]) is False


@patch("subprocess.run")
def test_compute_drift_no_sha(mock_run):
    # No last SHA provided forces a rebuild
    res = compute_drift(Path("/dummy"), None)
    assert res == ["*"]
    mock_run.assert_not_called()


@patch("subprocess.run")
def test_compute_drift_not_git_repo(mock_run, tmp_path):
    # Directory does not contain .git folder
    res = compute_drift(tmp_path, "sha123")
    assert res == ["*"]
    mock_run.assert_not_called()


@patch("subprocess.run")
def test_compute_drift_sha_not_found(mock_run, tmp_path):
    # Setup mock git repo path
    (tmp_path / ".git").mkdir()

    # Mock subprocess.run for SHA check failing
    import subprocess
    mock_run.side_effect = subprocess.CalledProcessError(1, "git cat-file")

    res = compute_drift(tmp_path, "sha123")
    assert res == ["*"]


@patch("subprocess.run")
def test_compute_drift_success(mock_run, tmp_path):
    # Setup mock git repo path
    (tmp_path / ".git").mkdir()

    # Mock subprocess.run for SHA check (success) and diff (success)
    mock_check = MagicMock()
    mock_diff = MagicMock(stdout="app/main.py\nREADME.md\n")
    mock_run.side_effect = [mock_check, mock_diff]

    res = compute_drift(tmp_path, "sha123")
    assert res == ["app/main.py", "README.md"]


@patch("app.converter.clone_repository")
@patch("app.converter.get_git_sha")
def test_api_freshness_up_to_date(mock_get_sha, mock_clone):
    mock_get_sha.return_value = "commit_123"
    
    resp = client.get("/freshness", params={
        "repo_url": "https://github.com/acme/demo",
        "last_git_head": "commit_123"
    })
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "fresh"
    assert data["git_head"] == "commit_123"
    assert data["changes_since_last"] == []
    mock_clone.assert_called_once()


@patch("app.converter.clone_repository")
@patch("app.converter.get_git_sha")
@patch("app.skillforge.freshness.compute_drift")
def test_api_freshness_stale(mock_compute, mock_get_sha, mock_clone):
    mock_get_sha.return_value = "commit_456"
    mock_compute.return_value = ["app/main.py"]
    
    resp = client.get("/freshness", params={
        "repo_url": "https://github.com/acme/demo",
        "last_git_head": "commit_123"
    })
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "stale"
    assert data["git_head"] == "commit_456"
    assert data["changes_since_last"] == ["app/main.py"]


@patch("app.converter.clone_repository")
@patch("app.converter.get_git_sha")
@patch("app.skillforge.freshness.compute_drift")
def test_api_freshness_noop_drift(mock_compute, mock_get_sha, mock_clone):
    mock_get_sha.return_value = "commit_456"
    mock_compute.return_value = ["assets/logo.png"]
    
    resp = client.get("/freshness", params={
        "repo_url": "https://github.com/acme/demo",
        "last_git_head": "commit_123"
    })
    
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "fresh"
    assert data["git_head"] == "commit_456"
    assert data["changes_since_last"] == ["assets/logo.png"]
