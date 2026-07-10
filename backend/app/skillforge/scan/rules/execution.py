"""
Malicious-execution rules (GS-EXE) — code-layer attacks.

Remote code execution (fetch-and-run), decode-and-run, destructive commands,
and reverse shells. These are the payloads that make a skill actively dangerous
rather than merely sloppy, so most sit at CRITICAL.

Portions derived from NVIDIA SkillSpector (https://github.com/NVIDIA/SkillSpector),
Apache-2.0. See THIRD_PARTY_NOTICES.md.

Author: GitScape.ai
"""
from __future__ import annotations

import re

from ...models import Confidence, Severity
from ..registry import Rule
from ..taxonomy import Category

C = Category.MALICIOUS_EXECUTION

RULES: list[Rule] = [
    Rule(
        id="GS-EXE-001", name="execution.pipe_to_shell", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"(curl|wget|iwr|Invoke-WebRequest)\b[^\n|]{0,160}\|\s*(sh|bash|zsh|python3?|iex|Invoke-Expression)\b",
            re.I),
        message="Remote code execution: downloads and pipes a script straight into a shell.",
        remediation="Never pipe a network response into a shell; download, review, then run.",
    ),
    Rule(
        id="GS-EXE-002", name="execution.fetch_then_eval", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"(exec|eval)\s*\(\s*(requests\.get|urllib\.request\.urlopen|urlopen|fetch)\b"
            r"|iex\s*\(\s*(iwr|Invoke-WebRequest)",
            re.I),
        message="Remote code execution: fetches a URL and evaluates the response.",
    ),
    Rule(
        id="GS-EXE-003", name="execution.decode_then_exec", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"(exec|eval)\s*\(\s*(base64\.b64decode|bytes\.fromhex|codecs\.decode)"
            r"|base64\s+-d[^\n|]{0,80}\|\s*(sh|bash)"
            r"|FromBase64String[^\n]{0,80}(Invoke-Expression|iex)",
            re.I),
        message="Obfuscated execution: decodes an encoded blob and executes it.",
    ),
    Rule(
        id="GS-EXE-004", name="execution.destructive_command", category=C,
        severity=Severity.HIGH, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"\brm\s+-rf?\s+(/|~|\$HOME|\*)"
            r"|\bmkfs\b|\bdd\s+[^\n]*of=/dev/"
            r"|:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:"
            r"|Remove-Item\s+[^\n]*-Recurse[^\n]*-Force[^\n]*(C:|~|\$env:)"
            r"|\bdel\s+/[sq]\s+/[sq]\b"
            r"|\bDROP\s+(TABLE|DATABASE)\b",
            re.I),
        message="Destructive command that can delete files, disks, or databases.",
    ),
    Rule(
        id="GS-EXE-005", name="execution.reverse_shell", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"\bnc\s+[^\n]*-e\b|/dev/tcp/\d|bash\s+-i\s+>&|/dev/tcp/[\d.]+/\d+"
            r"|socket\.socket[^\n]{0,120}(dup2|subprocess)",
            re.I),
        message="Reverse shell: opens an outbound interactive shell to a remote host.",
    ),
    Rule(
        id="GS-EXE-006", name="execution.dynamic_eval", category=C,
        severity=Severity.MEDIUM, confidence=Confidence.LOW,
        pattern=re.compile(r"\b(eval|exec)\s*\(|new\s+Function\s*\(", re.I),
        message="Dynamic code evaluation in a shipped script.",
    ),
    Rule(
        id="GS-EXE-007", name="execution.chmod_downloaded", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"(curl|wget)\b[^\n]{0,120}(-o|-O|>)[^\n]{0,60}(&&|;)\s*(chmod\s+\+x|\./)",
            re.I),
        message="Downloads a file and immediately makes it executable / runs it.",
    ),
    Rule(
        # Cryptominer signatures (ported from SkillSpector's cryptominer YARA).
        id="GS-EXE-008", name="execution.cryptominer", category=C,
        severity=Severity.CRITICAL, confidence=Confidence.HIGH,
        pattern=re.compile(
            r"stratum\+(?:tcp|ssl)://|\bxmrig\b|\bminerd\b|\bcpuminer\b|--donate-level\b"
            r"|\bcoinhive\b|\bcryptonight\b|\bnicehash\b"
            r"|(?:pool\.)?(?:minexmr|nanopool|supportxmr|f2pool|ethermine)\.(?:com|org)",
            re.I),
        message="Cryptominer: mining-pool protocol or known miner binary reference.",
        remediation="Remove the cryptominer; a skill must never run mining workloads.",
    ),
    Rule(
        # Offensive-tooling / webshell signatures (ported from SkillSpector's
        # hacktools + webshells YARA — kept to near-exclusively offensive strings).
        id="GS-EXE-009", name="execution.hacktool", category=C,
        severity=Severity.HIGH, confidence=Confidence.MEDIUM,
        pattern=re.compile(
            r"\bmimikatz\b|sekurlsa::logonpasswords|Invoke-Mimikatz|\bmeterpreter\b"
            r"|\bmsfvenom\b|\bmsfconsole\b|\bLaZagne\b|\bResponder\.py\b"
            r"|(?:eval|system|assert|passthru|shell_exec)\s*\(\s*\$_(?:POST|GET|REQUEST)",
            re.I),
        message="Offensive tooling / webshell signature (credential dumping, exploitation, or PHP webshell).",
        remediation="Remove the offensive-tooling reference; it has no place in a legitimate skill.",
    ),
]
