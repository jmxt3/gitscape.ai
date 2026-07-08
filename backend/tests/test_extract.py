from app.skillforge.extract import build_extract
from app.skillforge.extract.examples import build_examples
from app.skillforge.extract.graph import build_import_graph
from app.skillforge.extract.setup import build_setup
from app.skillforge.extract.symbols import build_api_index, extract_symbols
from app.skillforge.models import ContentUnit, FileKind

PY_SRC = '''\
from .models import Thing

def run(x: int) -> int:
    """Run the thing."""
    return x + 1

def _helper():
    return 0

class Service:
    """A service."""
    def __init__(self, name):
        self.name = name
    def handle(self, req):
        """Handle a request."""
        return req
    def _private(self):
        return 1
'''

TS_SRC = '''\
/** Greet someone. */
export function greet(name: string): string {
  return `hi ${name}`;
}

export const add = (a: number, b: number): number => a + b;

export interface Opts {
  verbose: boolean;
}

export class Client {
  send(x: number) { return x; }
  _hidden() { return 0; }
}
'''


def _u(path, content, kind):
    return ContentUnit(path=path, content=content, kind=kind, size=len(content))


def test_python_symbols():
    syms = extract_symbols(_u("app/main.py", PY_SRC, FileKind.SOURCE))
    by_name = {s.name: s for s in syms}
    assert "run" in by_name and by_name["run"].kind == "function"
    assert "def run(x: int) -> int" in by_name["run"].signature
    assert by_name["run"].summary == "Run the thing."
    assert "_helper" not in by_name  # private function excluded
    assert "Service" in by_name and by_name["Service"].kind == "class"
    assert "Service.__init__" in by_name
    assert "Service.handle" in by_name and by_name["Service.handle"].kind == "method"
    assert "Service._private" not in by_name


def test_typescript_symbols():
    syms = extract_symbols(_u("web/svc.ts", TS_SRC, FileKind.SOURCE))
    by_name = {s.name: s for s in syms}
    assert "greet" in by_name and by_name["greet"].kind == "function"
    assert by_name["greet"].summary == "Greet someone."
    assert "add" in by_name and by_name["add"].kind == "function"
    assert "Opts" in by_name and by_name["Opts"].kind == "type"
    assert "Client" in by_name and by_name["Client"].kind == "class"
    assert "Client.send" in by_name
    assert "Client._hidden" not in by_name


def test_build_api_index_skips_non_source():
    units = [
        _u("a.py", "def f():\n    pass\n", FileKind.SOURCE),
        _u("tests/test_a.py", "def test_f():\n    assert True\n", FileKind.TEST),
        _u("README.md", "# doc", FileKind.DOCS),
    ]
    index = build_api_index(units)
    assert "a.py" in index.modules
    assert "tests/test_a.py" not in index.modules  # tests excluded from API index


def test_import_graph_external_and_internal():
    units = [
        _u("requirements.txt", "fastapi[standard]>=0.1\nrequests\n# comment\n", FileKind.CONFIG),
        _u("web/package.json", '{"dependencies":{"react":"^18"},"devDependencies":{"vite":"^5"}}', FileKind.CONFIG),
        _u("app/main.py", "from .models import X\nimport os\n", FileKind.SOURCE),
    ]
    g = build_import_graph(units)
    ext = {d.name for d in g.external}
    assert {"fastapi", "requests", "react", "vite"} <= ext
    assert g.internal["app/main.py"] == [".models"]  # only relative import kept


def test_setup_commands_and_section():
    readme = (
        "# Demo\n\n"
        "## Installation\n\n"
        "```bash\n$ pip install demo\nuv sync\n```\n\n"
        "## Other\n\nnope\n"
    )
    info = build_setup([], readme=readme)
    assert "pip install demo" in info.commands
    assert "uv sync" in info.commands
    assert "Installation" in info.quickstart
    assert "nope" not in info.quickstart  # stops at next section


def test_examples_dedupe_and_score():
    block = "```python\nresult = compute(1, 2)\nprint(result)\n```\n"
    dup = block  # identical -> deduped
    short = "```python\nx\n```\n"  # below min length -> dropped
    doc = _u("docs/guide.md", block + "\n" + dup + "\n" + short, FileKind.DOCS)
    examples = build_examples([doc])
    assert len(examples) == 1
    assert examples[0].language == "python"
    assert examples[0].score > 0


def test_build_extract_smoke():
    units = [
        _u("app/main.py", PY_SRC, FileKind.SOURCE),
        _u("requirements.txt", "fastapi\n", FileKind.CONFIG),
        _u("README.md", "## Usage\n\n```bash\npip install x\n```\n", FileKind.DOCS),
    ]
    extract = build_extract(units, readme=units[-1].content)
    assert extract.api_index.total >= 3
    assert any(d.name == "fastapi" for d in extract.import_graph.external)
    assert "pip install x" in extract.setup.commands
