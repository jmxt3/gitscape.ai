import os
import tempfile
import subprocess
import logging
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

def sign_manifest(manifest_json_str: str) -> Optional[Tuple[str, str]]:
    """
    Sign a manifest.json string using Sigstore Cosign.
    Expects environment variables:
      - GITSCAPE_SIGNING_KEY: The PEM-encoded private key content.
      - COSIGN_PASSWORD: Password for the private key (optional).
    
    Returns:
      (signature_str, bundle_str) if signing is successful, otherwise None.
    """
    key_content = os.environ.get("GITSCAPE_SIGNING_KEY")
    if not key_content:
        logger.info("GITSCAPE_SIGNING_KEY not configured. Skipping cryptographic manifest signing.")
        return None

    # Check if cosign is installed
    try:
        subprocess.run(["cosign", "version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.warning("cosign binary not found on system. Skipping manifest signing.")
        return None

    logger.info("Executing Sigstore cosign manifest signing...")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_dir_path = Path(tmpdir)
        manifest_file = tmp_dir_path / "manifest.json"
        key_file = tmp_dir_path / "cosign.key"
        sig_file = tmp_dir_path / "manifest.json.sig"
        bundle_file = tmp_dir_path / "manifest.json.bundle"

        manifest_file.write_text(manifest_json_str, encoding="utf-8")
        key_file.write_text(key_content, encoding="utf-8")

        env = os.environ.copy()
        # Ensure password is passed if configured
        if "GITSCAPE_SIGNING_PASSWORD" in env and "COSIGN_PASSWORD" not in env:
            env["COSIGN_PASSWORD"] = env["GITSCAPE_SIGNING_PASSWORD"]

        cmd = [
            "cosign", "sign-blob",
            "--key", str(key_file),
            "--output-signature", str(sig_file),
            "--bundle", str(bundle_file),
            str(manifest_file),
            "--yes"
        ]

        try:
            subprocess.run(cmd, check=True, capture_output=True, env=env)
            if sig_file.exists() and bundle_file.exists():
                sig_content = sig_file.read_text(encoding="utf-8")
                bundle_content = bundle_file.read_text(encoding="utf-8")
                logger.info("Successfully generated cryptographically signed manifest signature and bundle.")
                return sig_content, bundle_content
            else:
                logger.error("cosign execution completed but output files were not created.")
                return None
        except subprocess.CalledProcessError as e:
            logger.error(f"cosign signing command failed: {e.stderr.decode('utf-8', errors='ignore')}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during cosign signing: {e}")
            return None
