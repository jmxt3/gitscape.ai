# Setup

## Quick Start

### Installation

Create and activate a virtual environment first (all `make` targets assume the venv is active). Use **uv** or **pip**; the Makefile uses `uv` if available, otherwise `pip`.

**Quick install with uv (CLI-only):**

```bash
uv tool install git+https://github.com/NVIDIA/skillspector.git

## Commands

```bash
uv tool install git+https://github.com/NVIDIA/skillspector.git
uv tool install 'skillspector[mcp] @ git+https://github.com/NVIDIA/skillspector.git'
git clone https://github.com/NVIDIA/skillspector.git
uv venv .venv && source .venv/bin/activate
make install
make install-dev
make docker-build
docker run --rm -v "$PWD:/scan" skillspector scan ./my-skill/ --no-llm
docker run --rm \
python -m contrib.batch_scan.batch_scan ./my-skills/ --no-llm
python -m contrib.batch_scan.batch_scan ./my-skills/ --workers 20 -f json -o report.json
python -m contrib.batch_scan.batch_scan ./tests/fixtures/ -f terminal --workers 20
```
