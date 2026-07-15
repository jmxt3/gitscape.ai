import pytest
import os
import json
from unittest.mock import patch, MagicMock
from app.registry_store import (
    list_registry_skills,
    get_scanned_detail,
    save_scanned_skill,
    STATIC_REGISTRY_SKILLS,
)

@pytest.fixture(autouse=True)
def clean_in_memory_scans():
    import app.registry_store as store
    store.IN_MEMORY_SCANS = []


def test_list_registry_skills_no_gcs(monkeypatch):
    monkeypatch.delenv("GITSCAPE_REGISTRY_BUCKET", raising=False)
    
    skills = list_registry_skills()
    # Should contain exactly the static seeds
    assert len(skills) == len(STATIC_REGISTRY_SKILLS)
    assert skills[0]["owner"] == "stripe"


@patch("app.registry_store._get_storage_client")
def test_list_registry_skills_with_gcs_index_exists(mock_get_client, monkeypatch):
    monkeypatch.setenv("GITSCAPE_REGISTRY_BUCKET", "test-bucket")
    
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    
    mock_get_client.return_value = mock_client
    mock_client.bucket.return_value = mock_bucket
    mock_bucket.blob.return_value = mock_blob
    
    mock_blob.exists.return_value = True
    
    dynamic_scan = {
        "repo_url": "https://github.com/custom/repo",
        "name": "repo",
        "owner": "custom",
        "repo": "repo",
        "description": "Custom parsed skill.",
        "primary_languages": ["Go"],
        "files_analyzed": 50,
        "grade": "A",
        "status": "PASS",
        "risk_score": 0,
        "findings_count": 0,
        "freshness": "fresh"
    }
    
    mock_blob.download_as_text.return_value = json.dumps([dynamic_scan])
    
    skills = list_registry_skills()
    # Should combine STATIC_REGISTRY_SKILLS + the dynamic_scan
    assert len(skills) == len(STATIC_REGISTRY_SKILLS) + 1
    assert any(s.get("owner") == "custom" for s in skills)
    mock_bucket.blob.assert_called_with("scans_index.json")


@patch("app.registry_store._get_storage_client")
def test_get_scanned_detail_hit(mock_get_client, monkeypatch):
    monkeypatch.setenv("GITSCAPE_REGISTRY_BUCKET", "test-bucket")
    
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    
    mock_get_client.return_value = mock_client
    mock_client.bucket.return_value = mock_bucket
    mock_bucket.blob.return_value = mock_blob
    
    mock_blob.exists.return_value = True
    detail_payload = {"repo_url": "https://github.com/custom/repo", "risk_score": 10}
    mock_blob.download_as_text.return_value = json.dumps(detail_payload)
    
    detail = get_scanned_detail("custom", "repo")
    assert detail == detail_payload
    mock_bucket.blob.assert_called_with("scans/custom-repo.json")


@patch("app.registry_store._get_storage_client")
def test_save_scanned_skill_gcs(mock_get_client, monkeypatch):
    monkeypatch.setenv("GITSCAPE_REGISTRY_BUCKET", "test-bucket")
    
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_detail_blob = MagicMock()
    mock_index_blob = MagicMock()
    
    mock_get_client.return_value = mock_client
    mock_client.bucket.return_value = mock_bucket
    
    # Bucket.blob called twice: first for detail path, second for index path
    mock_bucket.blob.side_effect = [mock_detail_blob, mock_index_blob]
    
    mock_index_blob.exists.return_value = False
    
    detail_data = {
        "repo_url": "https://github.com/custom/repo",
        "name": "repo",
        "owner": "custom",
        "repo": "repo",
        "description": "My custom repository description.",
        "primary_languages": ["Python"],
        "files_analyzed": 100,
        "grade": "B",
        "status": "WARN",
        "risk_score": 12,
        "findings": [{"rule": "test", "severity": "MEDIUM", "message": "hello", "file": "main.py"}]
    }
    
    save_scanned_skill("custom", "repo", detail_data)
    
    # 1. Detail blob uploaded
    mock_detail_blob.upload_from_string.assert_called_once()
    # 2. Index blob uploaded
    mock_index_blob.upload_from_string.assert_called_once()
    
    # Check that uploaded index doesn't include findings list
    uploaded_index_str = mock_index_blob.upload_from_string.call_args[0][0]
    uploaded_index = json.loads(uploaded_index_str)
    assert len(uploaded_index) == 1
    assert "findings" not in uploaded_index[0]
    assert uploaded_index[0]["findings_count"] == 1
