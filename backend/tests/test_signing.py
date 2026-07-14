import pytest
import os
import subprocess
from unittest.mock import patch, MagicMock
from app.skillforge.signing import sign_manifest

def test_sign_manifest_no_key(monkeypatch):
    monkeypatch.delenv("GITSCAPE_SIGNING_KEY", raising=False)
    res = sign_manifest("{}")
    assert res is None


@patch("subprocess.run")
def test_sign_manifest_no_cosign_binary(mock_run, monkeypatch):
    monkeypatch.setenv("GITSCAPE_SIGNING_KEY", "dummy-key-content")
    
    # Mock subprocess.run raising FileNotFoundError when checking version
    mock_run.side_effect = FileNotFoundError()
    
    res = sign_manifest("{}")
    assert res is None
    mock_run.assert_called_once_with(["cosign", "version"], capture_output=True, check=True)


@patch("subprocess.run")
def test_sign_manifest_success(mock_run, monkeypatch):
    monkeypatch.setenv("GITSCAPE_SIGNING_KEY", "dummy-key-content")
    monkeypatch.setenv("GITSCAPE_SIGNING_PASSWORD", "dummy-password")
    
    # Mock first run (version check) and second run (sign command)
    mock_version_ok = MagicMock()
    mock_sign_ok = MagicMock()
    mock_run.side_effect = [mock_version_ok, mock_sign_ok]

    # Mock Path.write_text and Path.read_text of temporary output files
    # since we want to simulate the files actually being created
    from pathlib import Path
    orig_read_text = Path.read_text
    orig_exists = Path.exists

    def mock_exists(self):
        if self.name in ("manifest.json.sig", "manifest.json.bundle"):
            return True
        return orig_exists(self)

    def mock_read_text(self, *args, **kwargs):
        if self.name == "manifest.json.sig":
            return "dummy-signature"
        if self.name == "manifest.json.bundle":
            return "dummy-bundle"
        return orig_read_text(self, *args, **kwargs)

    with patch.object(Path, "exists", mock_exists):
        with patch.object(Path, "read_text", mock_read_text):
            res = sign_manifest('{"a": 1}')
            assert res == ("dummy-signature", "dummy-bundle")
            
    # Verify cosign sign-blob was called with correct args
    assert mock_run.call_count == 2
    args, kwargs = mock_run.call_args
    assert "cosign" in args[0]
    assert "sign-blob" in args[0]
    assert "--yes" in args[0]
    assert kwargs.get("env", {}).get("COSIGN_PASSWORD") == "dummy-password"
