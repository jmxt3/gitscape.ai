"""
Behavioral analysis of code via tree-sitter (GS-EXE-010).

Regex rules match text; this walks the *parsed* AST of fenced code blocks (and
any shipped script files) to catch dangerous dynamic execution with far fewer
false positives — and to spot obfuscation *chains* like `exec(compile(...))` or
`eval(atob(...))` that a single regex can't reliably see.

Risk gradient — a payload in an executable script file is trusted at run time and
weighs more than the same construct shown in a documentation code block:

              | fenced code in docs | real script file
  chain       | HIGH                | CRITICAL
  exec/eval   | MEDIUM              | HIGH
  subprocess… | LOW                 | MEDIUM

So a `eval()` shown as a README example never hard-blocks an export, while the
same call inside a shipped `.py` can. tree-sitter is error-tolerant, so partial
snippets still parse; any parser error is swallowed (never breaks the scan).

The dangerous-call taxonomy is derived from NVIDIA SkillSpector's behavioral AST
analyzer (https://github.com/NVIDIA/SkillSpector), Apache-2.0. See
THIRD_PARTY_NOTICES.md.

Author: GitScape.ai
"""
from __future__ import annotations

import re

from ..models import Confidence, ScanFinding, Severity
from ..tslang import SUFFIX_TO_LANG, get_parser
from .context import ScanContext
from .registry import Rule

# fenced-block language label -> grammar key
_FENCE_LANG = {
    "python": "python", "py": "python", "python3": "python",
    "javascript": "javascript", "js": "javascript", "node": "javascript",
    "typescript": "typescript", "ts": "typescript",
    "tsx": "tsx", "jsx": "javascript",
    "go": "go", "golang": "go",
}
_FENCE = re.compile(r"```([A-Za-z0-9_+#-]*)[ \t]*\r?\n(.*?)```", re.S)

# grammar -> (call node type, callee field name)
_CALL = {
    "python": ("call", "function"),
    "javascript": ("call_expression", "function"),
    "typescript": ("call_expression", "function"),
    "tsx": ("call_expression", "function"),
    "go": ("call_expression", "function"),
}

# exec/eval tier — HIGH in scripts, MEDIUM in docs (CRITICAL/HIGH when chained)
_EXEC: dict[str, set[str]] = {
    "python": {"exec", "eval", "os.system"},
    "javascript": {"eval", "child_process.exec", "child_process.execSync"},
    "typescript": {"eval", "child_process.exec", "child_process.execSync"},
    "tsx": {"eval", "child_process.exec", "child_process.execSync"},
    "go": set(),
}
# lower tier — MEDIUM in scripts, LOW in docs
_LOWER: dict[str, set[str]] = {
    "python": {"compile", "__import__", "subprocess.run", "subprocess.call",
               "subprocess.Popen", "subprocess.check_output", "subprocess.check_call",
               "pickle.loads", "marshal.loads"},
    "javascript": set(),
    "typescript": set(),
    "tsx": set(),
    "go": {"exec.Command", "exec.CommandContext"},
}
# decode/danger callees that, nested inside an exec/eval argument, mark a chain
_DECODE = {"base64.b64decode", "bytes.fromhex", "codecs.decode", "atob",
           "exec", "eval", "compile", "__import__", "marshal.loads", "pickle.loads"}

_MAX_FINDINGS = 25  # don't flood on a pathological input


def extract_code_blocks(markdown: str) -> list[tuple[str, str, int]]:
    """Yield (grammar_key, code, line_offset) for supported fenced blocks."""
    out: list[tuple[str, str, int]] = []
    for m in _FENCE.finditer(markdown):
        lang = _FENCE_LANG.get((m.group(1) or "").lower())
        if not lang:
            continue
        out.append((lang, m.group(2), markdown.count("\n", 0, m.start(2))))
    return out


def _walk(node):
    stack = [node]
    while stack:
        n = stack.pop()
        yield n
        stack.extend(n.children)


def _txt(node, src: bytes) -> str:
    return src[node.start_byte:node.end_byte].decode("utf-8", "replace")


def _snip(node, src: bytes) -> str:
    return " ".join(_txt(node, src).split())[:120]


def _detect(lang: str, code: str, is_script: bool) -> list[tuple[Severity, Confidence, str, int, str]]:
    """Return (severity, confidence, snippet, rel_line, label) for dangerous calls."""
    parser = get_parser(lang)
    src = code.encode("utf-8")
    tree = parser.parse(src)
    call_type, callee_field = _CALL[lang]
    exec_set, lower_set = _EXEC[lang], _LOWER[lang]
    hits: list[tuple[Severity, Confidence, str, int, str]] = []

    for node in _walk(tree.root_node):
        # `new Function(...)` (JS/TS) — dynamic code construction
        if lang in ("javascript", "typescript", "tsx") and node.type == "new_expression":
            ctor = node.child_by_field_name("constructor")
            if ctor is not None and _txt(ctor, src) == "Function":
                sev = Severity.HIGH if is_script else Severity.MEDIUM
                conf = Confidence.HIGH if is_script else Confidence.MEDIUM
                hits.append((sev, conf, _snip(node, src), node.start_point[0], "new Function"))
            continue

        if node.type != call_type:
            continue
        callee = node.child_by_field_name(callee_field)
        if callee is None:
            continue
        name = _txt(callee, src)
        if name in exec_set:
            tier = "exec"
        elif name in lower_set:
            tier = "lower"
        else:
            continue

        chained = False
        if tier == "exec":
            args = node.child_by_field_name("arguments")
            if args is not None:
                for sub in _walk(args):
                    if sub is node or sub.type not in ("call", "call_expression"):
                        continue
                    subcallee = sub.child_by_field_name("function")
                    if subcallee is not None and _txt(subcallee, src) in _DECODE:
                        chained = True
                        break

        if chained:
            sev = Severity.CRITICAL if is_script else Severity.HIGH
            conf = Confidence.HIGH if is_script else Confidence.MEDIUM
        elif tier == "exec":
            sev = Severity.HIGH if is_script else Severity.MEDIUM
            conf = Confidence.HIGH if is_script else Confidence.MEDIUM
        else:
            sev = Severity.MEDIUM if is_script else Severity.LOW
            conf = Confidence.MEDIUM if is_script else Confidence.LOW
        hits.append((sev, conf, _snip(node, src), node.start_point[0], name))
    return hits


def check_behavioral(ctx: ScanContext, rule: Rule) -> list[ScanFinding]:
    """GS-EXE-010: AST-based dangerous-call detection over code blocks + scripts."""
    findings: list[ScanFinding] = []
    for label, text in ctx.all_surfaces():
        suffix = ("." + label.rsplit(".", 1)[-1].lower()) if "." in label else ""
        script_lang = SUFFIX_TO_LANG.get(suffix)
        if script_lang is not None:
            blocks = [(script_lang, text, 0)]
            is_script = True
        else:
            blocks = extract_code_blocks(text)
            is_script = False
        for lang, code, offset in blocks:
            try:
                hits = _detect(lang, code, is_script)
            except Exception:
                continue  # a parser error must never break the scan
            for sev, conf, snip, rel_line, name in hits:
                chain = " (obfuscation chain)" if sev in (Severity.CRITICAL,) or (
                    not is_script and sev == Severity.HIGH) else ""
                findings.append(rule.finding(
                    file=label, line=offset + rel_line + 1, snippet=snip,
                    severity=sev, confidence=conf,
                    message=f"Dangerous dynamic execution via `{name}`{chain} (AST-detected).",
                ))
                if len(findings) >= _MAX_FINDINGS:
                    return findings
    return findings
