# Testing Patterns

Quick reference for writing tests in GitScape. Use alongside the `test-driven-development` skill.

## Test Setup (FastAPI + pytest)

```python
# api/tests/conftest.py
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock
from api.app.main import create_app

@pytest.fixture
def app():
    return create_app()

@pytest.fixture
async def client(app):
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
def mock_github():
    with patch("api.app.skill_builder.github_client") as mock:
        mock.get_repo = MagicMock()
        mock.get_contents = MagicMock()
        yield mock

@pytest.fixture
def mock_gemini():
    with patch("api.app.skillforge.assemble.gemini_client") as mock:
        mock.generate_content = AsyncMock()
        yield mock
```

## Test Structure: Arrange → Act → Assert

```python
def test_skill_name_sanitizes_spaces():
    # Arrange
    raw_name = "my cool repo"
    
    # Act
    result = generate_skill_name(raw_name)
    
    # Assert
    assert result == "my-cool-repo"
```

## Naming Tests

Test names should read like specifications:

```python
# BAD
def test_skill():
def test_generate():
def test_error():

# GOOD  
def test_generate_skill_returns_zip_for_valid_repo():
def test_generate_skill_returns_404_for_private_repo():
def test_skill_name_replaces_underscores_with_hyphens():
```

## Mocking External Services

Mock at the service boundary, not at the HTTP level:

```python
# GOOD: Mock at the GitHub client boundary
def test_skill_generation_handles_github_404(client, mock_github):
    mock_github.get_contents.side_effect = GithubException(404, "Not Found")
    response = client.post("/api/skills", json={"repo": "owner/missing"})
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()

# GOOD: Mock at the Gemini client boundary
def test_assembler_returns_fallback_on_gemini_error(mock_gemini):
    mock_gemini.generate_content.side_effect = Exception("Model unavailable")
    result = assemble_skill(files=[...])
    assert result is not None  # Falls back gracefully
```

## Test Pyramid for GitScape

```
E2E (5%)         → Full skill generation from real GitHub repo
Integration (15%) → FastAPI endpoint + mock external services
Unit (80%)        → Individual functions: name sanitizer, file filter, assembler
```

## Edge Cases to Always Cover

For any function or endpoint, cover:

| Scenario | GitScape Example |
|----------|-----------------|
| Valid input | `{"repo": "owner/repo"}` returns 200 |
| Invalid format | `{"repo": "notarepo"}` returns 422 |
| External failure | GitHub 404 → API 404, not 500 |
| Empty result | Repo with no relevant files |
| Rate limit | GitHub 429 → API 429 with retry-after |
| Large input | Repo with 1000+ files handles gracefully |

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| Testing implementation details | Test the public interface (return value, side effect) |
| Shared mutable state between tests | Use fixtures that reset state |
| Snapshot tests for LLM output | LLM output is non-deterministic; test structure, not content |
| `time.sleep()` in tests | Use `pytest-asyncio` timeouts and async fixtures |
| Testing everything in one test | One concept per test |
