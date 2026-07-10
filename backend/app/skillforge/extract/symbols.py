"""
Symbol extraction via tree-sitter.

Builds a public API index — exported functions/classes/methods/types with their
signature and a one-line purpose mined from the leading docstring or comment.
This is the deterministic core that replaces prose summarization of the codebase.

Supported grammars: Python, TypeScript/TSX, JavaScript/JSX, Go. Unsupported
languages are skipped (they simply don't contribute symbols).

Author: GitScape.ai
"""
from __future__ import annotations

from pathlib import PurePosixPath
from typing import Optional

from ..models import ApiIndex, ContentUnit, FileKind, Symbol
from ..tslang import SUFFIX_TO_LANG, get_parser as _get_parser

_MAX_SYMBOLS_PER_FILE = 40
_MAX_SIG = 200


# ─── helpers ───────────────────────────────────────────────────────────────


def _collapse(text: str, maxlen: int = _MAX_SIG) -> str:
    out = " ".join(text.split())
    return out[:maxlen]


def _text(node, src: bytes) -> str:
    return src[node.start_byte : node.end_byte].decode("utf-8", "replace")


def _sig_to_body(node, src: bytes, body_field: str = "body") -> str:
    body = node.child_by_field_name(body_field)
    end = body.start_byte if body is not None else node.end_byte
    return _collapse(src[node.start_byte : end].decode("utf-8", "replace"))


def _leading_comment(node, src: bytes) -> str:
    """First line of the run of `//`/`/* */` comments directly above a node."""
    prev = node.prev_sibling
    comments: list[str] = []
    while prev is not None and prev.type == "comment":
        comments.insert(0, _text(prev, src))
        prev = prev.prev_sibling
    if not comments:
        return ""
    raw = comments[0].strip()
    if raw.startswith("/*"):
        raw = raw[2:]
    if raw.endswith("*/"):
        raw = raw[:-2]
    for line in raw.splitlines():
        line = line.strip().lstrip("/").strip().lstrip("*").strip()
        if line:
            return line[:200]
    return ""


def _py_docstring(node, src: bytes) -> str:
    body = node.child_by_field_name("body")
    if body is None:
        return ""
    for ch in body.named_children:
        if ch.type == "expression_statement" and ch.named_children:
            s = ch.named_children[0]
            if s.type == "string":
                raw = _text(s, src).strip()
                raw = raw.strip("'\"").strip()
                for line in raw.splitlines():
                    if line.strip():
                        return line.strip()[:200]
        break  # only the first statement can be a docstring
    return ""


# ─── Python ────────────────────────────────────────────────────────────────


def _py_func(node, src: bytes, path: str, kind: str) -> Optional[Symbol]:
    name_node = node.child_by_field_name("name")
    if name_node is None:
        return None
    name = _text(name_node, src)
    if name.startswith("_") and name != "__init__":
        return None
    params = node.child_by_field_name("parameters")
    ptext = _text(params, src) if params is not None else "()"
    rt = node.child_by_field_name("return_type")
    sig = f"def {name}{ptext}"
    if rt is not None:
        sig += f" -> {_text(rt, src)}"
    return Symbol(
        name=name,
        kind=kind,
        signature=_collapse(sig),
        summary=_py_docstring(node, src),
        source_path=path,
        line=node.start_point[0] + 1,
    )


def _unwrap_decorated(node):
    if node.type == "decorated_definition":
        return node.child_by_field_name("definition") or node.named_children[-1]
    return node


def _py_class(node, src: bytes, path: str) -> list[Symbol]:
    name_node = node.child_by_field_name("name")
    if name_node is None:
        return []
    name = _text(name_node, src)
    if name.startswith("_"):
        return []
    supers = node.child_by_field_name("superclasses")
    sig = f"class {name}{_text(supers, src) if supers is not None else ''}"
    out = [
        Symbol(
            name=name,
            kind="class",
            signature=_collapse(sig),
            summary=_py_docstring(node, src),
            source_path=path,
            line=node.start_point[0] + 1,
        )
    ]
    body = node.child_by_field_name("body")
    if body is not None:
        for ch in body.named_children:
            target = _unwrap_decorated(ch)
            if target.type == "function_definition":
                m = _py_func(target, src, path, kind="method")
                if m is not None:
                    m.name = f"{name}.{m.name}"
                    out.append(m)
    return out


def _python_symbols(root, src: bytes, path: str) -> list[Symbol]:
    out: list[Symbol] = []
    for node in root.named_children:
        target = _unwrap_decorated(node)
        if target.type == "function_definition":
            sym = _py_func(target, src, path, kind="function")
            if sym is not None:
                out.append(sym)
        elif target.type == "class_definition":
            out.extend(_py_class(target, src, path))
    return out


# ─── TypeScript / JavaScript ───────────────────────────────────────────────


def _ts_decl(decl, src: bytes, path: str, comment_host) -> list[Symbol]:
    line = comment_host.start_point[0] + 1
    summary = _leading_comment(comment_host, src)
    out: list[Symbol] = []

    if decl.type in ("function_declaration", "generator_function_declaration"):
        name_node = decl.child_by_field_name("name")
        if name_node is not None:
            out.append(Symbol(
                name=_text(name_node, src), kind="function",
                signature=_sig_to_body(decl, src), summary=summary,
                source_path=path, line=line,
            ))
    elif decl.type in ("class_declaration", "abstract_class_declaration"):
        name_node = decl.child_by_field_name("name")
        cname = _text(name_node, src) if name_node is not None else "default"
        out.append(Symbol(
            name=cname, kind="class", signature=_sig_to_body(decl, src),
            summary=summary, source_path=path, line=line,
        ))
        body = decl.child_by_field_name("body")
        if body is not None:
            for ch in body.named_children:
                if ch.type == "method_definition":
                    mname_node = ch.child_by_field_name("name")
                    if mname_node is None:
                        continue
                    mname = _text(mname_node, src)
                    if mname.startswith("#") or mname.startswith("_"):
                        continue
                    out.append(Symbol(
                        name=f"{cname}.{mname}", kind="method",
                        signature=_sig_to_body(ch, src),
                        summary="", source_path=path,
                        line=ch.start_point[0] + 1,
                    ))
    elif decl.type == "lexical_declaration":
        for d in decl.named_children:
            if d.type != "variable_declarator":
                continue
            name_node = d.child_by_field_name("name")
            value = d.child_by_field_name("value")
            if name_node is None or value is None:
                continue
            if value.type in ("arrow_function", "function", "function_expression"):
                vbody = value.child_by_field_name("body")
                end = vbody.start_byte if vbody is not None else d.end_byte
                sig = _collapse(src[decl.start_byte : end].decode("utf-8", "replace"))
                out.append(Symbol(
                    name=_text(name_node, src), kind="function", signature=sig,
                    summary=summary, source_path=path, line=line,
                ))
    elif decl.type in ("interface_declaration", "type_alias_declaration", "enum_declaration"):
        name_node = decl.child_by_field_name("name")
        if name_node is not None:
            out.append(Symbol(
                name=_text(name_node, src), kind="type",
                signature=_sig_to_body(decl, src, body_field="body"),
                summary=summary, source_path=path, line=line,
            ))
    return out


def _ts_symbols(root, src: bytes, path: str) -> list[Symbol]:
    out: list[Symbol] = []
    for node in root.named_children:
        if node.type != "export_statement":
            continue
        decl = node.child_by_field_name("declaration")
        if decl is None:
            for ch in node.named_children:
                if ch.type.endswith(("_declaration", "_statement")) or ch.type in (
                    "class_declaration", "function_declaration", "lexical_declaration",
                ):
                    decl = ch
                    break
        if decl is not None:
            out.extend(_ts_decl(decl, src, path, comment_host=node))
    return out


# ─── Go ────────────────────────────────────────────────────────────────────


def _go_symbols(root, src: bytes, path: str) -> list[Symbol]:
    out: list[Symbol] = []
    for node in root.named_children:
        if node.type in ("function_declaration", "method_declaration"):
            name_node = node.child_by_field_name("name")
            if name_node is None:
                continue
            name = _text(name_node, src)
            if not name[:1].isupper():  # exported identifiers start uppercase
                continue
            out.append(Symbol(
                name=name,
                kind="method" if node.type == "method_declaration" else "function",
                signature=_sig_to_body(node, src),
                summary=_leading_comment(node, src),
                source_path=path, line=node.start_point[0] + 1,
            ))
        elif node.type == "type_declaration":
            for spec in node.named_children:
                if spec.type != "type_spec":
                    continue
                name_node = spec.child_by_field_name("name")
                if name_node is None:
                    continue
                name = _text(name_node, src)
                if not name[:1].isupper():
                    continue
                out.append(Symbol(
                    name=name, kind="type", signature=_collapse(_text(spec, src)),
                    summary=_leading_comment(node, src),
                    source_path=path, line=spec.start_point[0] + 1,
                ))
    return out


_DISPATCH = {
    "python": _python_symbols,
    "typescript": _ts_symbols,
    "tsx": _ts_symbols,
    "javascript": _ts_symbols,
    "go": _go_symbols,
}


def extract_symbols(unit: ContentUnit) -> list[Symbol]:
    """Parse one source unit into its public symbols ([] if unsupported)."""
    suffix = PurePosixPath(unit.path).suffix.lower()
    lang = SUFFIX_TO_LANG.get(suffix)
    if lang is None:
        return []
    parser = _get_parser(lang)
    src = unit.content.encode("utf-8")
    tree = parser.parse(src)
    syms = _DISPATCH[lang](tree.root_node, src, unit.path)
    return syms[:_MAX_SYMBOLS_PER_FILE]


def build_api_index(units: list[ContentUnit]) -> ApiIndex:
    """Build the public API index from all source (non-test) units."""
    index = ApiIndex()
    for unit in units:
        if unit.kind != FileKind.SOURCE:
            continue
        syms = extract_symbols(unit)
        if syms:
            index.modules[unit.path] = syms
    return index
