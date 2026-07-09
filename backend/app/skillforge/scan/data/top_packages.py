"""
Vendored lists of high-download PyPI and npm package names.

Used by the typosquat heuristic (GS-DEP-005): a declared dependency that is one
edit away from a popular name — but not the name itself — is a classic
typosquat vector (e.g. `reqeusts`, `beautifulsop`, `crossenv`). Not exhaustive;
a representative top set is enough to catch the common attacks without pulling a
network dependency.

Author: GitScape.ai
"""
from __future__ import annotations

PYPI_TOP: frozenset[str] = frozenset({
    "requests", "urllib3", "boto3", "botocore", "setuptools", "certifi", "idna",
    "charset-normalizer", "python-dateutil", "six", "numpy", "pandas", "packaging",
    "pyyaml", "cryptography", "click", "jinja2", "markupsafe", "wheel", "attrs",
    "pydantic", "fastapi", "starlette", "flask", "django", "sqlalchemy", "aiohttp",
    "httpx", "scipy", "matplotlib", "pillow", "pytest", "tox", "virtualenv", "pip",
    "wrapt", "rsa", "colorama", "protobuf", "grpcio", "google-api-core", "psutil",
    "scikit-learn", "torch", "tensorflow", "transformers", "openai", "anthropic",
    "tqdm", "rich", "typer", "uvicorn", "gunicorn", "celery", "redis", "pymongo",
    "psycopg2", "psycopg2-binary", "asyncpg", "greenlet", "lxml", "beautifulsoup4",
    "selenium", "scrapy", "websocket-client", "websockets", "paramiko", "fabric",
    "docker", "kubernetes", "ansible", "jsonschema", "pyjwt", "oauthlib", "bcrypt",
    "passlib", "python-dotenv", "environs", "loguru", "sentry-sdk", "boltons",
    "google-cloud-storage", "azure-storage-blob", "pyarrow", "dask", "networkx",
    "sympy", "seaborn", "plotly", "dash", "streamlit", "gradio", "langchain",
    "llama-index", "tiktoken", "faiss-cpu", "chromadb", "sentence-transformers",
})

NPM_TOP: frozenset[str] = frozenset({
    "react", "react-dom", "lodash", "axios", "express", "chalk", "commander",
    "debug", "next", "vue", "webpack", "babel-core", "typescript", "eslint",
    "prettier", "jest", "mocha", "chai", "vite", "rollup", "esbuild", "dotenv",
    "moment", "dayjs", "uuid", "classnames", "redux", "react-redux", "zustand",
    "tailwindcss", "postcss", "autoprefixer", "styled-components", "@emotion/react",
    "socket.io", "ws", "cors", "body-parser", "cookie-parser", "helmet", "morgan",
    "mongoose", "sequelize", "prisma", "pg", "mysql2", "redis", "ioredis", "knex",
    "graphql", "apollo-server", "@apollo/client", "node-fetch", "cross-env",
    "rimraf", "glob", "fs-extra", "yargs", "inquirer", "ora", "nanoid", "semver",
    "jsonwebtoken", "bcrypt", "bcryptjs", "passport", "nodemailer", "winston",
    "pino", "zod", "yup", "joi", "date-fns", "rxjs", "immer", "formik",
    "react-router-dom", "react-query", "@tanstack/react-query", "framer-motion",
    "three", "d3", "chart.js", "recharts", "puppeteer", "playwright", "cheerio",
})

ALL_TOP: frozenset[str] = PYPI_TOP | NPM_TOP


def edit_distance_at_most_one(a: str, b: str) -> bool:
    """True when a and b differ by at most one edit.

    Counts a single insertion, deletion, substitution, OR adjacent transposition
    (Damerau) as distance one — transpositions like `reqeusts`/`requests` are one
    of the most common typosquat patterns, so treating them as distance one
    materially improves detection.
    """
    if a == b:
        return True
    la, lb = len(a), len(b)
    if abs(la - lb) > 1:
        return False
    if la == lb:
        # one substitution, or one adjacent transposition
        diffs = [i for i, (x, y) in enumerate(zip(a, b)) if x != y]
        if len(diffs) == 1:
            return True
        if len(diffs) == 2 and diffs[1] == diffs[0] + 1:
            i, j = diffs
            return a[i] == b[j] and a[j] == b[i]
        return False
    # one insertion/deletion: walk the shorter against the longer
    if la > lb:
        a, b = b, a
        la, lb = lb, la
    i = j = 0
    diff = 0
    while i < la and j < lb:
        if a[i] == b[j]:
            i += 1
            j += 1
        else:
            diff += 1
            if diff > 1:
                return False
            j += 1  # skip the extra char in the longer string
    return True
