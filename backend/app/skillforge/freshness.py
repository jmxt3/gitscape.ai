import subprocess
import logging
from pathlib import Path
from typing import List, Optional
from app.converter import TEXT_EXTS, _EXTENSIONLESS_TEXT

logger = logging.getLogger(__name__)

def compute_drift(repo_path: Path, last_git_sha: Optional[str]) -> List[str]:
    """
    Run git diff --name-only between last_git_sha and HEAD in the cloned repository path.
    If last_git_sha is None or if the command fails (e.g., sha doesn't exist),
    returns ["*"] indicating a complete rebuild/drift.
    """
    if not last_git_sha:
        logger.info("No last_git_sha provided. Forcing full rebuild.")
        return ["*"]

    # Verify git repository exists
    if not (repo_path / ".git").exists():
        logger.warning(f"Not a git repository: {repo_path}")
        return ["*"]

    # Check if last_git_sha is a valid commit
    try:
        subprocess.run(
            ["git", "-C", str(repo_path), "cat-file", "-e", last_git_sha],
            capture_output=True,
            check=True
        )
    except subprocess.CalledProcessError:
        logger.warning(f"Git commit SHA {last_git_sha} not found in repository. Forcing full rebuild.")
        return ["*"]

    # Retrieve changed files
    try:
        res = subprocess.run(
            ["git", "-C", str(repo_path), "diff", "--name-only", last_git_sha, "HEAD"],
            capture_output=True,
            text=True,
            check=True
        )
        changed = [line.strip() for line in res.stdout.splitlines() if line.strip()]
        return changed
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to run git diff: {e}")
        return ["*"]


def is_noop_drift(changed_files: List[str]) -> bool:
    """
    Determine if the changed files list is a no-op drift.
    Returns True if:
      - The list of changed files is empty (last_git_sha matches HEAD)
      - None of the changed files are code or documentation files that could affect skill output.
    """
    if not changed_files:
        return True

    if "*" in changed_files:
        return False

    for file_path_str in changed_files:
        path = Path(file_path_str)
        # Check if suffix matches any text extension
        if path.suffix.lower() in TEXT_EXTS:
            return False
        # Check if extensionless file matches well-known text files
        if path.name.lower() in _EXTENSIONLESS_TEXT:
            return False

    # If we made it here, only non-text files (images, assets, ignored configs, etc.) changed
    return True
