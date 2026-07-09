"""
ScapeGuard threat taxonomy — the single source of truth for categories.

Each category maps to a stable issue-code prefix and to the two compliance
frames GitScape reports against: the OWASP Agentic Skills Top 10 (AST01–AST10,
2026) and the OWASP LLM Top 10 (LLM01–LLM10). Keeping the mappings here as data
means a corrected AST slug is a one-line change, not a rule rewrite.

Author: GitScape.ai
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Category(str, Enum):
    """Threat categories. The value is the report/UI slug."""

    PROMPT_INJECTION = "prompt_injection"
    SECRETS = "secrets"
    DATA_EXFILTRATION = "data_exfiltration"
    MALICIOUS_EXECUTION = "malicious_execution"
    SUPPLY_CHAIN = "supply_chain"
    OBFUSCATION = "obfuscation"
    CONTENT_EXPOSURE = "content_exposure"
    EXCESSIVE_AGENCY = "excessive_agency"
    STRUCTURE = "structure"


@dataclass(frozen=True)
class CategoryInfo:
    slug: Category
    prefix: str  # issue-code prefix, e.g. "GS-INJ"
    title: str  # human label for the UI
    owasp_ast: tuple[str, ...] = ()
    owasp_llm: tuple[str, ...] = ()
    description: str = ""


# NOTE: OWASP Agentic Skills Top 10 (AST) slugs reflect the 2026 draft category
# ordering; they live here as data so they can be re-pinned once the numbering
# is finalized without touching any rule module.
CATEGORIES: dict[Category, CategoryInfo] = {
    Category.PROMPT_INJECTION: CategoryInfo(
        Category.PROMPT_INJECTION, "GS-INJ", "Prompt Injection",
        owasp_ast=("AST01",), owasp_llm=("LLM01",),
        description="Attempts to override agent instructions or hijack behavior via skill text.",
    ),
    Category.SECRETS: CategoryInfo(
        Category.SECRETS, "GS-SEC", "Secrets & Credentials",
        owasp_ast=("AST05",), owasp_llm=("LLM02", "LLM06"),
        description="Hardcoded API keys, tokens, and private keys embedded in the skill.",
    ),
    Category.DATA_EXFILTRATION: CategoryInfo(
        Category.DATA_EXFILTRATION, "GS-EXF", "Data Exfiltration",
        owasp_ast=("AST04",), owasp_llm=("LLM02",),
        description="Instructions or code that send secrets, environment, or files to an external endpoint.",
    ),
    Category.MALICIOUS_EXECUTION: CategoryInfo(
        Category.MALICIOUS_EXECUTION, "GS-EXE", "Malicious Execution",
        owasp_ast=("AST02",), owasp_llm=("LLM05",),
        description="Remote code execution, destructive commands, and reverse shells.",
    ),
    Category.SUPPLY_CHAIN: CategoryInfo(
        Category.SUPPLY_CHAIN, "GS-DEP", "Supply Chain",
        owasp_ast=("AST03",), owasp_llm=("LLM03",),
        description="Unpinned, unverifiable, or URL-sourced dependencies and install-script abuse.",
    ),
    Category.OBFUSCATION: CategoryInfo(
        Category.OBFUSCATION, "GS-OBF", "Obfuscation",
        owasp_ast=("AST06",), owasp_llm=("LLM01",),
        description="Hidden text, encoded payloads, and homoglyph tricks used to evade review.",
    ),
    Category.CONTENT_EXPOSURE: CategoryInfo(
        Category.CONTENT_EXPOSURE, "GS-CNT", "Untrusted Content",
        owasp_ast=("AST07",), owasp_llm=("LLM08",),
        description="Skill fetches and acts on untrusted third-party content (indirect injection risk).",
    ),
    Category.EXCESSIVE_AGENCY: CategoryInfo(
        Category.EXCESSIVE_AGENCY, "GS-AGY", "Excessive Agency",
        owasp_ast=("AST08",), owasp_llm=("LLM06",),
        description="Privilege escalation, safety-bypass flags, config tampering, and direct money access.",
    ),
    Category.STRUCTURE: CategoryInfo(
        Category.STRUCTURE, "GS-STR", "Structure & Quality",
        description="Structural completeness checks for engineering (framework) skills.",
    ),
}


def info(cat: Category) -> CategoryInfo:
    return CATEGORIES[cat]
