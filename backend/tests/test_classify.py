import pytest

from app.skillforge.classify import classify_path
from app.skillforge.models import FileKind


@pytest.mark.parametrize(
    "path,expected",
    [
        ("README.md", FileKind.DOCS),
        ("docs/guide.rst", FileKind.DOCS),
        ("notes.txt", FileKind.DOCS),
        ("pyproject.toml", FileKind.CONFIG),
        ("requirements.txt", FileKind.CONFIG),  # name match beats .txt docs
        ("api/Dockerfile", FileKind.CONFIG),
        (".env.example", FileKind.CONFIG),
        ("web/vite.config.ts", FileKind.CONFIG),  # name match beats .ts source
        ("app/main.py", FileKind.SOURCE),
        ("web/components/App.tsx", FileKind.SOURCE),
        ("pkg/server.go", FileKind.SOURCE),
        ("latest.py", FileKind.SOURCE),  # 'test' substring must NOT trigger TEST
        ("tests/test_api.py", FileKind.TEST),
        ("app/foo_test.go", FileKind.TEST),
        ("web/__tests__/App.spec.tsx", FileKind.TEST),
        ("conftest.py", FileKind.TEST),
        ("assets/logo.bin", FileKind.OTHER),
    ],
)
def test_classify_path(path, expected):
    assert classify_path(path) == expected


def test_windows_separators_normalized():
    assert classify_path("app\\tests\\test_x.py") == FileKind.TEST
