import pytest

from app.skillforge.assemble import assemble, estimate_tokens
from app.skillforge.errors import BuildError
from app.skillforge.extract import build_extract
from app.skillforge.models import ContentUnit, FileKind, RepoMeta

PY = '''\
def serve(port: int) -> None:
    """Start the server."""
    return None

class Engine:
    """Core engine."""
    def run(self):
        """Run it."""
        return 1
'''

README = "# Demo\n\nA tiny demo project that does things.\n\n## Install\n\n```bash\npip install demo\n```\n"


def _units():
    return [
        ContentUnit(path="app/main.py", content=PY, kind=FileKind.SOURCE, language="Python"),
        ContentUnit(path="requirements.txt", content="fastapi\nrequests\n", kind=FileKind.CONFIG),
        ContentUnit(path="README.md", content=README, kind=FileKind.DOCS),
    ]


def _meta():
    return RepoMeta(
        owner="acme", repo="demo", repo_url="https://github.com/acme/demo",
        primary_languages=["Python"], files_analyzed=3, readme=README,
        structure_overview="└── app/\n    └── core/\n",
    )


def test_assemble_produces_skill_and_references():
    units = _units()
    extract = build_extract(units, readme=README)
    skill = assemble(_meta(), extract, units)

    assert skill.name == "acme-demo"
    assert skill.skill_md.startswith("---\nname: acme-demo\n")
    assert 'description: "' in skill.skill_md
    assert "## What this is" in skill.skill_md
    assert "## API quick-reference" in skill.skill_md
    assert "serve" in skill.skill_md  # a real parsed symbol
    assert "A tiny demo project" in skill.skill_md  # README intro used

    assert "references/api.md" in skill.references
    assert "references/architecture.md" in skill.references
    assert "serve" in skill.references["references/api.md"]
    assert "*source: app/main.py*" in skill.references["references/api.md"]

    # provenance maps the api chunk back to the source file
    api_prov = next(p for p in skill.provenance if p.chunk == "references/api.md")
    assert "app/main.py" in api_prov.source_paths


def test_description_within_limit():
    units = _units()
    extract = build_extract(units, readme=README)
    skill = assemble(_meta(), extract, units)
    assert len(skill.description) <= 1024


def test_token_budget_enforced_then_fails():
    units = _units()
    extract = build_extract(units, readme=README)

    # Generous budget — stays whole.
    full = assemble(_meta(), extract, units, token_budget=5000)
    assert estimate_tokens(full.skill_md) <= 5000

    # Impossibly tight budget — even trimmed output can't fit.
    with pytest.raises(BuildError):
        assemble(_meta(), extract, units, token_budget=1)
