import re

pattern_old = re.compile(
    r"--dangerously-skip-permissions|--no-verify|--disable-\w*(safety|security|guard)"
    r"|\bauto[- ]?approve\b|\bwithout (asking|confirmation|permission)\b|\bdo not ask\b",
    re.I
)

pattern_new = re.compile(
    r"--dangerously-skip-permissions|--no-verify|--disable-\w*(safety|security|guard)"
    r"|\bauto[- ]?approve\b|\bwithout (asking|confirmation|permission)\b"
    r"|\bdo not ask (?:the user|for (?:permission|confirmation|approval)|permission|confirmation|approval|before (?:running|executing|modifying|writing|deleting))\b",
    re.I
)

positive_cases = [
    "do not ask for permission",
    "do not ask the user",
    "do not ask for confirmation",
    "do not ask permission before running this script",
    "do not ask before running a command",
    "do not ask before writing the file",
    "do not ask before executing",
]

negative_cases = [
    "Do not ask multiple subagents to answer the same question.",
    "Do not ask questions that are irrelevant.",
    "Do not ask if you already know.",
    "Do not ask the user details that can be found in the repo.",
]

print("=== OLD PATTERN ===")
for text in positive_cases:
    match = bool(pattern_old.search(text))
    print(f"Pos: '{text}' -> {match}")
for text in negative_cases:
    match = bool(pattern_old.search(text))
    print(f"Neg: '{text}' -> {match} (Expected False)")

print("\n=== NEW PATTERN ===")
for text in positive_cases:
    match = bool(pattern_new.search(text))
    print(f"Pos: '{text}' -> {match} (Expected True)")
for text in negative_cases:
    match = bool(pattern_new.search(text))
    print(f"Neg: '{text}' -> {match} (Expected False)")
