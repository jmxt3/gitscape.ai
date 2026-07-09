# CSV Toolkit — Code Skill

## What this is

A small, well-tested library for reading, transforming, and writing CSV files.
It exposes a handful of pure functions with no side effects and no network
access. Use it when you need to parse tabular data into typed records.

## When to use

- Parsing a CSV file into a list of dictionaries.
- Writing typed records back out to CSV with a stable column order.
- Validating that every row matches an expected schema.

## Key functions

- `read_csv(path)` returns a list of row dictionaries.
- `write_csv(path, rows)` writes rows preserving header order.
- `validate(rows, schema)` raises on the first row that does not conform.

Everything runs locally and deterministically.
