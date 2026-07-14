import re

pattern_refined2 = re.compile(
    r"--dangerously-skip-permissions|--no-verify|--disable-\w*(safety|security|guard)"
    r"|\bauto[- ]?approve\b|\bwithout (asking|confirmation|permission)\b"
    r"|\bdo not ask (?:the user\b(?! (?:details|questions?|clarification|info|anything|for clarification\b))"
    r"|for (?:permission|confirmation|approval)"
    r"|permission|confirmation|approval"
    r"|before (?:running|executing|modifying|writing|deleting|creating|making))\b",
    re.I
)

positive_cases = [
    "do not ask for permission",
    "do not ask for confirmation",
    "do not ask permission before running this script",
    "do not ask before running a command",
    "do not ask before writing the file",
    "do not ask before executing",
    "do not ask the user for permission",
    "do not ask the user before running",
    "do not ask the user to confirm",
    "do not ask the user.",
    "do not ask the user",
]

negative_cases = [
    "Do not ask multiple subagents to answer the same question.",
    "Do not ask questions that are irrelevant.",
    "Do not ask if you already know.",
    "Do not ask the user details that can be found in the repo.",
    "Do not ask the user for clarification if the files are accessible.",
]

print("=== REFINED PATTERN 2 ===")
for text in positive_cases:
    match = bool(pattern_refined2.search(text))
    print(f"Pos: '{text}' -> {match} (Expected True)")
for text in negative_cases:
    match = bool(pattern_refined2.search(text))
    print(f"Neg: '{text}' -> {match} (Expected False)")
