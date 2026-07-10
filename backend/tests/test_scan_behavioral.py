"""
Behavioral (tree-sitter AST) analysis tests — GS-EXE-010.

Verifies the risk gradient (docs vs scripts), obfuscation-chain escalation, and
— critically — that a dangerous call shown in a *documentation* code block never
becomes an unbypassable hard-block, while the same call in a shipped script can.
"""
from app.skillforge.models import ScanStatus, Severity
from app.skillforge.package import has_unbypassable_finding
from app.skillforge.scan import scan_skill
from app.skillforge.scan.behavioral import extract_code_blocks


def _ids(report):
    return {f.id for f in report.findings}


def _exe010(report):
    return [f for f in report.findings if f.id == "GS-EXE-010"]


# ── fenced-block extraction ──────────────────────────────────────────────────

def test_extract_code_blocks_maps_language_and_offset():
    md = "intro\n\n```python\nx = 1\n```\n"
    blocks = extract_code_blocks(md)
    assert len(blocks) == 1
    lang, code, offset = blocks[0]
    assert lang == "python" and "x = 1" in code and offset == 3


def test_unlabeled_and_shell_blocks_are_ignored():
    md = "```\nplain\n```\n```bash\ncurl x\n```\n"
    assert extract_code_blocks(md) == []


# ── docs tier (never a hard block) ───────────────────────────────────────────

def test_doc_eval_is_warn_not_fail():
    md = "# Skill\n\n```python\nresult = eval(user_input)\n```\n"
    report = scan_skill(md, {})
    hits = _exe010(report)
    assert hits and hits[0].severity == Severity.MEDIUM
    assert report.status == ScanStatus.WARN


def test_doc_chain_is_fail_but_bypassable():
    md = "# Skill\n\n```python\nexec(compile(payload, '<s>', 'exec'))\n```\n"
    report = scan_skill(md, {})
    hits = _exe010(report)
    assert hits and hits[0].severity == Severity.HIGH  # doc chain caps at HIGH
    assert report.status == ScanStatus.FAIL
    assert not has_unbypassable_finding(report)  # a doc example must not hard-block


def test_js_new_function_detected():
    md = "# Skill\n\n```js\nconst f = new Function('return ' + x);\n```\n"
    report = scan_skill(md, {})
    assert "GS-EXE-010" in _ids(report)


# ── script tier (can hard block) ─────────────────────────────────────────────

def test_script_chain_is_critical_and_unbypassable():
    scripts = {"helper.py": "import base64\nexec(compile(base64.b64decode(x), '<s>', 'exec'))\n"}
    report = scan_skill("# Skill", {}, scripts=scripts)
    hits = _exe010(report)
    assert hits and hits[0].severity == Severity.CRITICAL
    assert report.status == ScanStatus.FAIL
    assert has_unbypassable_finding(report)  # RCE chain in a real script never ships


# ── false-positive guards ────────────────────────────────────────────────────

def test_prose_mentioning_eval_is_not_flagged():
    # "eval" in prose, no code block → nothing to parse → no behavioral finding.
    report = scan_skill("# Skill\n\nAvoid using eval() on untrusted input.\n", {})
    assert "GS-EXE-010" not in _ids(report)


def test_benign_fenced_code_is_clean():
    md = "# Skill\n\n```python\nrows = read_csv(path)\nwrite_csv(out, rows)\n```\n"
    report = scan_skill(md, {})
    assert "GS-EXE-010" not in _ids(report)
    assert report.status == ScanStatus.PASS


def test_regex_dot_exec_is_not_flagged():
    # `.exec` on a regex is common and benign; only whitelisted callees fire.
    md = "# Skill\n\n```js\nconst m = /foo/.exec(str);\n```\n"
    report = scan_skill(md, {})
    assert "GS-EXE-010" not in _ids(report)
