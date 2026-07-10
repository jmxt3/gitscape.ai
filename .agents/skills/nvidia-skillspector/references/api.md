# API Reference

Generated from parsed symbols — names, signatures, and the one-line purpose from each docstring/comment.

## `contrib/multilingual/annotation.py`
*source: contrib/multilingual/annotation.py*

- **`is_language_compatible`** — `def is_language_compatible(rule_id: str, detected_language: str) -> bool`
  Return ``True`` when *rule_id* is reliable for *detected_language*.
- **`annotate_findings`** — `def annotate_findings( issues: list[dict[str, object]], detected_language: str, ) -> list[dict[str, object]]`
  Add a ``language_compatible`` field to each issue dict.

## `contrib/multilingual/api_pool.py`
*source: contrib/multilingual/api_pool.py*

- **`ApiKey`** — `class ApiKey`
  A single API key with concurrency and rate-limit metadata.
- **`ApiKey.available`** — `def available(self) -> bool`
  ``True`` when this key can accept at least one more caller.
- **`ApiKeyPool`** — `class ApiKeyPool`
  Thread-safe pool of API keys with per-key concurrency slots.
- **`ApiKeyPool.__init__`** — `def __init__(self, keys: list[ApiKey]) -> None`
- **`ApiKeyPool.acquire`** — `def acquire(self, timeout: float | None = None) -> ApiKey`
  Acquire a slot on the least-loaded available key.
- **`ApiKeyPool.try_acquire`** — `def try_acquire(self) -> ApiKey | None`
  Non-blocking acquire — returns a key immediately or ``None``.
- **`ApiKeyPool.release`** — `def release(self, key: ApiKey, *, success: bool = True) -> None`
  Release a slot on *key* back to the pool.
- **`ApiKeyPool.record_retry_success`** — `def record_retry_success(self) -> None`
  Increment the retry-success counter for reporting.
- **`ApiKeyPool.rate_limits_hit`** — `def rate_limits_hit(self) -> int`
  Total number of 429 responses encountered across all keys.
- **`ApiKeyPool.retry_successes`** — `def retry_successes(self) -> int`
  Total number of successful retries after a key switch.
- **`ApiKeyPool.keys_configured`** — `def keys_configured(self) -> int`
  Total number of keys in the pool.
- **`ApiKeyPool.total_capacity`** — `def total_capacity(self) -> int`
  Sum of ``max_concurrent`` across all keys.
- **`ApiKeyPool.active_requests`** — `def active_requests(self) -> int`
  Total active requests across all keys.
- **`ApiKeyPool.snapshot`** — `def snapshot(self) -> dict[str, object]`
  Return a snapshot dict suitable for report metadata.
- **`PooledChatModel`** — `class PooledChatModel`
  LangChain-compatible chat model wrapper with transparent key switching.
- **`PooledChatModel.__init__`** — `def __init__( self, pool: ApiKeyPool, *, max_tokens: int = 4096, timeout: float = 30.0, max_retries: int = _MAX_RATE_LIMIT_RETRIES, ) -> None`
- **`PooledChatModel.invoke`** — `def invoke(self, prompt: str) -> object`
  Synchronous invoke with automatic key switching on rate-limit.
- **`PooledChatModel.ainvoke`** — `def ainvoke(self, prompt: str) -> object`
  Async invoke with automatic key switching on rate-limit.
- **`create_api_key_pool_from_env`** — `def create_api_key_pool_from_env( max_concurrent_per_key: int = _DEFAULT_MAX_CONCURRENT_PER_KEY, ) -> ApiKeyPool | None`
  Build an :class:`ApiKeyPool` from environment variables.

## `contrib/multilingual/batch_scan.py`
*source: contrib/multilingual/batch_scan.py*

- **`main`** — `def main() -> None`
  Entry point for the batch scanner CLI.

## `contrib/multilingual/detection.py`
*source: contrib/multilingual/detection.py*

- **`detect_language`** — `def detect_language(content: str) -> str`
  Heuristic single-file language detection.
- **`detect_skill_language`** — `def detect_skill_language(file_cache: dict[str, str]) -> str`
  Determine the dominant language across all files in a skill.

## `contrib/multilingual/discovery.py`
*source: contrib/multilingual/discovery.py*

- **`discover_skills`** — `def discover_skills(root: Path) -> list[Path]`
  Recursively find all skill directories under *root*.

## `contrib/multilingual/gap_fill.py`
*source: contrib/multilingual/gap_fill.py*

- **`GapFillFinding`** — `class GapFillFinding(BaseModel)`
  A single vulnerability finding from a gap-fill LLM call.
- **`GapFillFinding.to_finding`** — `def to_finding(self, file: str) -> Finding`
  Convert to a :class:`~skillspector.models.Finding` for the report.
- **`GapFillResult`** — `class GapFillResult(BaseModel)`
  Structured LLM response for the gap-fill analyzer.
- **`GapFillAnalyzer`** — `class GapFillAnalyzer(LLMAnalyzerBase)`
  LLM analyzer covering the 8 gap-fill rules for non-English skills.
- **`GapFillAnalyzer.__init__`** — `def __init__(self, language: str, model: str | None = None, api_pool: "ApiKeyPool | None" = None)`
- **`GapFillAnalyzer.build_prompt`** — `def build_prompt(self, batch, **kwargs)`
  Build the LLM prompt for a single batch.
- **`GapFillAnalyzer.parse_response`** — `def parse_response(self, response, batch)`
  Parse raw LLM text into :class:`Finding` objects via manual JSON.
- **`run_gap_fill`** — `def run_gap_fill( file_cache: dict[str, str], language: str, model: str | None = None, api_pool: "ApiKeyPool | None" = None, ) -> list[Finding]`
  Run a single targeted LLM pass covering the 8 gap-fill rules.

## `contrib/multilingual/reports.py`
*source: contrib/multilingual/reports.py*

- **`sorted_results`** — `def sorted_results(results: list[dict[str, object]]) -> list[dict[str, object]]`
  Return *results* sorted by risk score descending.

## `contrib/multilingual/runner.py`
*source: contrib/multilingual/runner.py*

- **`set_api_pool`** — `def set_api_pool(pool: "ApiKeyPool | None") -> None`
  Replace the LLM chat-model factory with a pooled version.
- **`setup_deepseek_compat`** — `def setup_deepseek_compat() -> None`
  Apply DeepSeek compatibility patches permanently (convenience wrapper).
- **`deepseek_compat`** — `def deepseek_compat()`
  Context manager that applies DeepSeek compatibility patches and
- **`scan_state`** — `def scan_state(skill_dir: Path, use_llm: bool) -> dict[str, object]`
  Build the initial LangGraph state for a single skill directory.
- **`cleanup_result`** — `def cleanup_result(result: dict[str, object]) -> None`
  Remove the temporary directory created by the graph, if any.
- **`entry_from_result`** — `def entry_from_result( result: dict[str, object], skill_dir: Path, root: Path, *, detected_language: str = "en", gap_fill_applied: bool = False, gap_fill_findings: int = 0, ) -> dict[str, object]`
  Convert a raw ``graph.invoke()`` result into a batch-report entry.
- **`run_one`** — `def run_one( skill_dir: Path, root: Path, *, use_llm: bool, detected_language: str = "en", gap_fill_applied: bool = False, gap_fill_findings: int = 0, ) -> tuple[dict[str, object], str | None]`
  Scan a single skill through the full graph pipeline.

## `src/skillspector/cleanup.py`
*source: src/skillspector/cleanup.py*

- **`cleanup_result`** — `def cleanup_result(result: dict[str, object]) -> None`
  Remove temp dir from graph result if set.

## `src/skillspector/cli.py`
*source: src/skillspector/cli.py*

- **`FormatChoice`** — `class FormatChoice(StrEnum)`
  Output format choices for the CLI.
- **`TransportChoice`** — `class TransportChoice(StrEnum)`
  Transport choices for the MCP server.
- **`version_callback`** — `def version_callback(value: bool) -> None`
  Print version and exit.
- **`main`** — `def main( version: Annotated[ bool | None, typer.Option( "--version", "-v", help="Show version and exit.", callback=version_callback, is_eager=True, ), ] = None, ) -> None`
  SkillSpector - Security scanner for AI agent skills (LangGraph).
- **`scan`** — `def scan( input_path: Annotated[ str, typer.Argument( help="Path or URL to scan. Supports: Git URL, file URL, zip file, .md file, or directory.", ), ], format: Annotated[ FormatChoice, typer.Option( "`
  Scan a skill for security vulnerabilities.
- **`mcp`** — `def mcp( transport: Annotated[ TransportChoice, typer.Option( "--transport", "-t", help="Transport: FastMCP stdio for local CLI agents, http for remote/A2A callers.", case_sensitive=False, ), ] = Tran`
  Run SkillSpector as an MCP server.
- **`baseline`** — `def baseline( input_path: Annotated[ str, typer.Argument( help="Path or URL to scan. Supports: Git URL, file URL, zip file, .md file, or directory.", ), ], output: Annotated[ Path, typer.Option( "--ou`
  Generate a baseline file that suppresses every finding in the current scan.

## `src/skillspector/graph.py`
*source: src/skillspector/graph.py*

- **`create_graph`** — `def create_graph()`
  Create and compile Skillspector workflow graph.

## `src/skillspector/input_handler.py`
*source: src/skillspector/input_handler.py*

- **`InputHandler`** — `class InputHandler`
  Handles input resolution for different source types.
- **`InputHandler.__init__`** — `def __init__(self) -> None`
- **`InputHandler.resolve`** — `def resolve(self, input_path: str) -> tuple[Path, str]`
  Resolve input to a scannable directory.
- **`InputHandler.cleanup`** — `def cleanup(self) -> None`
  Clean up temporary files created during resolution.
- **`InputHandler.temp_dir_for_cleanup`** — `def temp_dir_for_cleanup(self) -> Path | None`
  Return the temp directory path if one was created (for caller to clean up after graph).

## `src/skillspector/llm_analyzer_base.py`
*source: src/skillspector/llm_analyzer_base.py*

- **`LLMFinding`** — `class LLMFinding(BaseModel)`
  A single finding discovered by an LLM analyzer.
- **`LLMFinding.to_finding`** — `def to_finding(self, file: str) -> Finding`
  Convert to a :class:`Finding` for the graph state.
- **`LLMAnalysisResult`** — `class LLMAnalysisResult(BaseModel)`
  Structured LLM response containing discovered findings.
- **`estimate_tokens`** — `def estimate_tokens(text: str) -> int`
  Approximate token count from character length.
- **`Batch`** — `class Batch`
  One unit of work for an LLM call (single file or file-chunk).
- **`Batch.is_chunk`** — `def is_chunk(self) -> bool`
- **`Batch.file_label`** — `def file_label(self) -> str`
- **`chunk_file_by_lines`** — `def chunk_file_by_lines( content: str, max_tokens: int, overlap_lines: int = CHUNK_OVERLAP_LINES, ) -> list[tuple[str, int, int]]`
  Split *content* into line-range chunks that each fit within *max_tokens*.
- **`findings_in_range`** — `def findings_in_range( findings: list[Finding], start_line: int, end_line: int, ) -> list[Finding]`
  Return findings whose ``start_line`` falls within [start_line, end_line].
- **`number_lines`** — `def number_lines(content: str, start_line: int = 1) -> str`
  Prefix each line with its 1-indexed line number (e.g. ``L1:``, ``L2:``).
- **`LLMAnalyzerBase`** — `class LLMAnalyzerBase`
  Per-file / per-chunk LLM analyzer.
- **`LLMAnalyzerBase.__init__`** — `def __init__(self, base_prompt: str, model: str)`
- **`LLMAnalyzerBase.get_batches`** — `def get_batches( self, file_paths: list[str], file_cache: dict[str, str], findings: list[Finding] | None = None, ) -> list[Batch]`
  Create one :class:`Batch` per file, splitting oversized files into chunks.
- **`LLMAnalyzerBase.build_prompt`** — `def build_prompt(self, batch: Batch, **kwargs: object) -> str`
  Build the LLM prompt for a single batch.
- **`LLMAnalyzerBase.parse_response`** — `def parse_response(self, response: object, batch: Batch) -> list[Finding]`
  Parse the LLM response for a single batch.
- **`LLMAnalyzerBase.run_batches`** — `def run_batches( self, batches: list[Batch], **kwargs: object, ) -> list[tuple[Batch, list]]`
  Execute LLM calls for all *batches*, returning per-batch parsed results.
- **`LLMAnalyzerBase.arun_batches`** — `def arun_batches( self, batches: list[Batch], *, max_concurrency: int = 10, **kwargs: object, ) -> list[tuple[Batch, list]]`
  Execute LLM calls for all *batches* concurrently.
- **`LLMAnalyzerBase.collect_findings`** — `def collect_findings( self, batch_results: list[tuple[Batch, list]], ) -> list[Finding]`
  Flatten per-batch results into a single :class:`Finding` list.

## `src/skillspector/llm_utils.py`
*source: src/skillspector/llm_utils.py*

- **`is_llm_available`** — `def is_llm_available() -> tuple[bool, str | None]`
  Return ``(available, error_message)`` describing LLM availability.
- **`fetch_model_token_limits`** — `def fetch_model_token_limits(model_label: str) -> tuple[int, int]`
  Return ``(max_input_tokens, max_output_tokens)`` for *model_label*.
- **`AgentCLIChatModel`** — `class AgentCLIChatModel`
  Minimal ``ChatOpenAI``-compatible adapter backed by a CLI provider.
- **`AgentCLIChatModel.__init__`** — `def __init__(self, provider: object, model: str, max_output_tokens: int) -> None`
- **`AgentCLIChatModel.batch`** — `def batch(self, *args: object, **kwargs: object) -> NoReturn`
- **`AgentCLIChatModel.stream`** — `def stream(self, *args: object, **kwargs: object) -> NoReturn`
- **`AgentCLIChatModel.invoke`** — `def invoke(self, prompt: str) -> _AgentCLIMessage`
- **`AgentCLIChatModel.ainvoke`** — `def ainvoke(self, prompt: str) -> _AgentCLIMessage`
- **`AgentCLIChatModel.with_structured_output`** — `def with_structured_output(self, schema: type) -> _StructuredAgentCLIModel`
- **`get_chat_model`** — `def get_chat_model(model: str | None = None) -> BaseChatModel | AgentCLIChatModel`
  Return a chat model for the active provider.
- **`chat_completion`** — `def chat_completion(prompt: str, *, model: str | None = None) -> str`
  Request a single chat completion and return the assistant content.

## `src/skillspector/logging_config.py`
*source: src/skillspector/logging_config.py*

- **`get_logger`** — `def get_logger(name: str) -> logging.Logger`
  Return a logger under the skillspector package namespace.
- **`set_level`** — `def set_level(level: int | str) -> None`
  Set the package root logger and its handler level (e.g. for CLI --verbose).

## `src/skillspector/mcp_server.py`
*source: src/skillspector/mcp_server.py*

- **`run_scan`** — `def run_scan( target: str, *, use_llm: bool = True, output_format: str = "json", yara_rules_dir: str | None = None, ) -> dict[str, Any]`
  Invoke the SkillSpector graph and return a structured verdict.
- **`build_server`** — `def build_server(name: str = "skillspector") -> FastMCP`
  Construct the FastMCP server exposing the ``scan_skill`` tool.
- **`run`** — `def run(transport: str = "stdio", host: str = "127.0.0.1", port: int = 8000) -> None`
  Run the MCP server over ``stdio`` (local agents) or ``http`` (remote/A2A).

## `src/skillspector/model_info.py`
*source: src/skillspector/model_info.py*

- **`get_max_input_tokens`** — `def get_max_input_tokens(model: str) -> int`
  Input token budget for *model* (75 %% of context window).
- **`get_max_output_tokens`** — `def get_max_output_tokens(model: str) -> int`
  Output token budget for *model*.

## `src/skillspector/models.py`
*source: src/skillspector/models.py*

- **`Severity`** — `class Severity(StrEnum)`
  Severity levels for findings (used by all analyzers).
- **`Location`** — `class Location`
  Location of a finding within a file (used by all analyzers).
- **`AnalyzerFinding`** — `class AnalyzerFinding`
  Common finding type produced by any analyzer (static, behavioral, MCP, semantic).
- **`Finding`** — `class Finding`
  Finding model for graph state and report output (shape aligned with to_dict).
- **`Finding.to_dict`** — `def to_dict(self) -> dict[str, object]`
  Return a JSON-serializable dict representation (full finding shape).
- **`AnalyzerPlugin`** — `class AnalyzerPlugin(Protocol)`
  Analyzer plugin protocol: name/stage/availability and an ``analyze`` entry point.
- **`AnalyzerPlugin.analyze`** — `def analyze(self, state: SkillspectorState) -> list[Finding]`
  Analyze graph state and return findings.
- **`AnalyzerPlugin.is_available`** — `def is_available(self) -> bool`
  Return whether the analyzer can run in current environment.

## `src/skillspector/multi_skill.py`
*source: src/skillspector/multi_skill.py*

- **`SkillDirectory`** — `class SkillDirectory`
  A detected skill within a multi-skill directory.
- **`MultiSkillDetectionResult`** — `class MultiSkillDetectionResult`
  Result of scanning a directory for multiple skills.
- **`detect_skills`** — `def detect_skills(directory: Path) -> MultiSkillDetectionResult`
  Detect whether a directory contains multiple independent skills.

## `src/skillspector/nodes/analyzers/behavioral_ast.py`
*source: src/skillspector/nodes/analyzers/behavioral_ast.py*

- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Parse Python files via AST and detect dangerous execution patterns.

## `src/skillspector/nodes/analyzers/behavioral_taint_tracking.py`
*source: src/skillspector/nodes/analyzers/behavioral_taint_tracking.py*

- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Parse Python files and detect source\u2192sink data flows.

## `src/skillspector/nodes/analyzers/common.py`
*source: src/skillspector/nodes/analyzers/common.py*

- **`make_dummy_finding`** — `def make_dummy_finding(analyzer_id: str) -> Finding`
  Create a deterministic dummy finding for a stub analyzer.
- **`is_code_example`** — `def is_code_example(context: str) -> bool`
  Return True when the context appears to be a code example or documentation snippet.
- **`get_line_number`** — `def get_line_number(content: str, offset: int) -> int`
  Return the 1-based line number for a character offset in *content*.
- **`get_context`** — `def get_context(content: str, match_start: int, context_lines: int = 3) -> str`
  Extract surrounding lines from *content* around the match at *match_start* (char offset).
- **`get_context_from_lines`** — `def get_context_from_lines(lines: list[str], lineno: int, window: int = 3) -> str`
  Extract surrounding lines given pre-split *lines* and a 1-based *lineno*.
- **`resolve_dotted_name`** — `def resolve_dotted_name(node: ast.expr) -> str | None`
  Build a dotted name string from a Name or Attribute node.
- **`apply_import_aliases`** — `def apply_import_aliases(name: str, aliases: dict[str, str]) -> str`
  Rewrite a resolved call name to its fully-qualified form using import aliases.
- **`resolve_call_name`** — `def resolve_call_name(node: ast.Call, aliases: dict[str, str] | None = None) -> str | None`
  Extract a dotted call name like ``'os.system'`` from a Call node.
- **`resolve_dynamic_import_call`** — `def resolve_dynamic_import_call( node: ast.Call, aliases: dict[str, str] | None = None ) -> str | None`
  Resolve ``importlib.import_module('mod').attr(...)`` to the dotted sink ``'mod.attr'``.
- **`build_import_aliases`** — `def build_import_aliases(tree: ast.Module) -> dict[str, str]`
  Map locally bound names to their fully-qualified import paths.
- **`build_type_map`** — `def build_type_map(tree: ast.Module) -> dict[str, str]`
  Infer variable types from constructor calls.
- **`resolve_call_name_typed`** — `def resolve_call_name_typed( node: ast.Call, type_map: dict[str, str] | None = None, aliases: dict[str, str] | None = None, ) -> str | None`
  Like ``resolve_call_name`` but consults *type_map* for instance methods.
- **`get_source_segment`** — `def get_source_segment(lines: list[str], lineno: int, end_lineno: int | None) -> str`
  Extract the source text for a given line range, truncated to 200 chars.

## `src/skillspector/nodes/analyzers/mcp_least_privilege.py`
*source: src/skillspector/nodes/analyzers/mcp_least_privilege.py*

- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Analyze manifest permissions vs code capabilities; emit LP1-LP4 findings.

## `src/skillspector/nodes/analyzers/mcp_rug_pull.py`
*source: src/skillspector/nodes/analyzers/mcp_rug_pull.py*

- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Analyze skill for rug-pull risks (RP1–RP3).

## `src/skillspector/nodes/analyzers/mcp_tool_poisoning.py`
*source: src/skillspector/nodes/analyzers/mcp_tool_poisoning.py*

- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Analyze MCP tool manifest for tool-poisoning indicators (TP1-TP4).

## `src/skillspector/nodes/analyzers/osv_client.py`
*source: src/skillspector/nodes/analyzers/osv_client.py*

- **`VulnResult`** — `class VulnResult`
  A single vulnerability found for a package.
- **`clear_cache`** — `def clear_cache() -> None`
  Clear the in-memory vulnerability cache.
- **`query_batch`** — `def query_batch( packages: list[tuple[str, str | None]], ecosystem: str, ) -> list[list[VulnResult]]`
  Query OSV.dev for vulnerabilities across a batch of packages.
- **`is_available`** — `def is_available() -> bool`
  Quick connectivity check against the OSV.dev API (HEAD-like POST).
- **`was_osv_reachable`** — `def was_osv_reachable() -> bool`
  Return True if the last query_batch() call succeeded.

## `src/skillspector/nodes/analyzers/pattern_defaults.py`
*source: src/skillspector/nodes/analyzers/pattern_defaults.py*

- **`PatternCategory`** — `class PatternCategory(StrEnum)`
  Categories of vulnerability patterns.
- **`get_explanation`** — `def get_explanation(pattern_id: str) -> str`
  Get default explanation for a pattern ID.
- **`get_remediation`** — `def get_remediation(pattern_id: str) -> str`
  Get default remediation for a pattern ID.
- **`get_category`** — `def get_category(rule_id: str) -> str`
  Get category string for a rule ID (for report output).
- **`get_pattern_name`** — `def get_pattern_name(rule_id: str) -> str`
  Get human-readable pattern name for a rule ID (for report output).

## `src/skillspector/nodes/analyzers/semantic_developer_intent.py`
*source: src/skillspector/nodes/analyzers/semantic_developer_intent.py*

- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Discover developer-intent findings via LLM analysis.

## `src/skillspector/nodes/analyzers/semantic_quality_policy.py`
*source: src/skillspector/nodes/analyzers/semantic_quality_policy.py*

- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Discover quality/policy findings via LLM analysis.

## `src/skillspector/nodes/analyzers/semantic_security_discovery.py`
*source: src/skillspector/nodes/analyzers/semantic_security_discovery.py*

- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Detect semantic intent and attack-phrasing risks using LLM analysis.

## `src/skillspector/nodes/analyzers/static_patterns_agent_snooping.py`
*source: src/skillspector/nodes/analyzers/static_patterns_agent_snooping.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for agent snooping patterns (AS1–AS3).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run agent_snooping patterns and return findings.

## `src/skillspector/nodes/analyzers/static_patterns_anti_refusal.py`
*source: src/skillspector/nodes/analyzers/static_patterns_anti_refusal.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for anti-refusal statements (AR1-AR3).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run anti_refusal patterns and return findings.

## `src/skillspector/nodes/analyzers/static_patterns_data_exfiltration.py`
*source: src/skillspector/nodes/analyzers/static_patterns_data_exfiltration.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for data exfiltration patterns (E1–E5).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run data_exfiltration patterns and return findings.

## `src/skillspector/nodes/analyzers/static_patterns_excessive_agency.py`
*source: src/skillspector/nodes/analyzers/static_patterns_excessive_agency.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for excessive agency patterns (EA1–EA4).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run excessive_agency patterns and return findings.

## `src/skillspector/nodes/analyzers/static_patterns_harmful_content.py`
*source: src/skillspector/nodes/analyzers/static_patterns_harmful_content.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for harmful content patterns (P5).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run harmful_content patterns and return findings.

## `src/skillspector/nodes/analyzers/static_patterns_memory_poisoning.py`
*source: src/skillspector/nodes/analyzers/static_patterns_memory_poisoning.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for memory poisoning patterns (MP1–MP3).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run memory_poisoning patterns and return findings.

## `src/skillspector/nodes/analyzers/static_patterns_output_handling.py`
*source: src/skillspector/nodes/analyzers/static_patterns_output_handling.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for output handling patterns (OH1–OH3).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run output_handling patterns and return findings.

## `src/skillspector/nodes/analyzers/static_patterns_privilege_escalation.py`
*source: src/skillspector/nodes/analyzers/static_patterns_privilege_escalation.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for privilege escalation patterns (PE1–PE5).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run privilege_escalation patterns and return findings.

## `src/skillspector/nodes/analyzers/static_patterns_prompt_injection.py`
*source: src/skillspector/nodes/analyzers/static_patterns_prompt_injection.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for prompt injection patterns (P1–P4).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run prompt_injection patterns and return findings.

## `src/skillspector/nodes/analyzers/static_patterns_rogue_agent.py`
*source: src/skillspector/nodes/analyzers/static_patterns_rogue_agent.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for rogue agent patterns (RA1–RA2).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run rogue_agent patterns and return findings.

## `src/skillspector/nodes/analyzers/static_patterns_ssrf.py`
*source: src/skillspector/nodes/analyzers/static_patterns_ssrf.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for server-side request forgery patterns (SSRF1–SSRF3).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run SSRF patterns and return findings.

## `src/skillspector/nodes/analyzers/static_patterns_supply_chain.py`
*source: src/skillspector/nodes/analyzers/static_patterns_supply_chain.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for supply chain patterns (SC1–SC3).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run supply_chain patterns (SC1–SC6) and trigger analysis (TR1–TR3).

## `src/skillspector/nodes/analyzers/static_patterns_system_prompt_leakage.py`
*source: src/skillspector/nodes/analyzers/static_patterns_system_prompt_leakage.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for system prompt leakage patterns (P6–P8).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run system_prompt_leakage patterns and return findings.

## `src/skillspector/nodes/analyzers/static_patterns_tool_misuse.py`
*source: src/skillspector/nodes/analyzers/static_patterns_tool_misuse.py*

- **`analyze`** — `def analyze(content: str, file_path: str, file_type: str) -> list[AnalyzerFinding]`
  Analyze content for tool misuse patterns (TM1–TM3).
- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run tool_misuse patterns and return findings.

## `src/skillspector/nodes/analyzers/static_runner.py`
*source: src/skillspector/nodes/analyzers/static_runner.py*

- **`analyzer_finding_to_finding`** — `def analyzer_finding_to_finding( af: AnalyzerFinding, get_remediation_fn: Callable[[str], str] | None = None, ) -> Finding`
  Convert an AnalyzerFinding (from any analyzer) to graph-state Finding.
- **`run_static_patterns`** — `def run_static_patterns( state: dict[str, object], pattern_modules: list, ) -> list[Finding]`
  Run one or more pattern modules over state components/file_cache.

## `src/skillspector/nodes/analyzers/static_yara.py`
*source: src/skillspector/nodes/analyzers/static_yara.py*

- **`node`** — `def node(state: SkillspectorState) -> AnalyzerNodeResponse`
  Run YARA rules against all skill artifacts and return findings.

## `src/skillspector/nodes/build_context.py`
*source: src/skillspector/nodes/build_context.py*

- **`build_context`** — `def build_context(state: SkillspectorState) -> dict[str, object]`
  Build flat ScanContext fields from state skill_path (local directory).

## `src/skillspector/nodes/deduplicate.py`
*source: src/skillspector/nodes/deduplicate.py*

- **`deduplicate`** — `def deduplicate(findings: list[Finding]) -> list[Finding]`
  Deduplicate a list of findings, returning a reduced list.

## `src/skillspector/nodes/meta_analyzer.py`
*source: src/skillspector/nodes/meta_analyzer.py*

- **`MetaAnalyzerFinding`** — `class MetaAnalyzerFinding(BaseModel)`
  A single finding evaluated by the meta-analyzer LLM (filter/enrich mode).
- **`OverallAssessment`** — `class OverallAssessment(BaseModel)`
  Overall risk assessment for the analyzed file.
- **`MetaAnalyzerResult`** — `class MetaAnalyzerResult(BaseModel)`
  Top-level structured response from the meta-analyzer LLM.
- **`LLMMetaAnalyzer`** — `class LLMMetaAnalyzer(LLMAnalyzerBase)`
  Per-file LLM filter/enrichment of static findings.
- **`LLMMetaAnalyzer.__init__`** — `def __init__(self, model: str)`
- **`LLMMetaAnalyzer.build_prompt`** — `def build_prompt(self, batch: Batch, **kwargs: object) -> str`
- **`LLMMetaAnalyzer.parse_response`** — `def parse_response( self, response: MetaAnalyzerResult, batch: Batch, ) -> list[dict[str, object]]`
  Convert the validated Pydantic response to dicts for ``apply_filter``.
- **`LLMMetaAnalyzer.apply_filter`** — `def apply_filter( self, findings: list[Finding], batch_results: list[tuple[Batch, list[dict[str, object]]]], ) -> list[Finding]`
  Keep only LLM-confirmed findings, enriched with explanation / remediation.
- **`meta_analyzer`** — `def meta_analyzer(state: SkillspectorState) -> MetaAnalyzerResponse`
  Filter and enrich findings via per-file LLM calls.

## `src/skillspector/nodes/report.py`
*source: src/skillspector/nodes/report.py*

- **`report`** — `def report(state: SkillspectorState) -> dict[str, object]`
  Generate SARIF, compute risk score, and set report_body from output_format.

## `src/skillspector/nodes/resolve_input.py`
*source: src/skillspector/nodes/resolve_input.py*

- **`resolve_input`** — `def resolve_input(state: SkillspectorState) -> dict[str, object]`
  Resolve input to a scannable directory.

## `src/skillspector/providers/__init__.py`
*source: src/skillspector/providers/__init__.py*

- **`raise_no_llm_api_key_configured`** — `def raise_no_llm_api_key_configured() -> NoReturn`
  Raise the shared no-LLM-credentials error.
- **`get_metadata_provider`** — `def get_metadata_provider() -> ModelMetadataProvider`
  Return the active provider for token-budget + default-model lookups.
- **`get_active_provider`** — `def get_active_provider() -> ModelMetadataProvider`
  Return the active provider (alias for :func:`get_metadata_provider`).
- **`resolve_provider_credentials`** — `def resolve_provider_credentials() -> tuple[str, str | None] | None`
  Return ``(api_key, base_url)`` from the active provider.
- **`resolve_chat_model_credentials`** — `def resolve_chat_model_credentials() -> tuple[str, str | None] | None`
  Return credentials used for chat model construction, including fallback.
- **`create_chat_model`** — `def create_chat_model( model: str, *, max_tokens: int, timeout: float | None = 120, ) -> BaseChatModel`
  Create the active provider's native LangChain chat model.

## `src/skillspector/providers/_agent_cli.py`
*source: src/skillspector/providers/_agent_cli.py*

- **`AgentCLIError`** — `class AgentCLIError(RuntimeError)`
  Raised when an agent CLI call fails for any reason (fail-closed).
- **`find_binary`** — `def find_binary(name: str) -> str | None`
  Return the absolute path of *name* on PATH, or ``None`` if absent.
- **`CliSpec`** — `class CliSpec`
  Everything provider-specific about one agent CLI, behind one lookup.
- **`get_spec`** — `def get_spec(name: str) -> CliSpec`
  Return the :class:`CliSpec` for *name*, or raise for an unknown CLI.
- **`is_available`** — `def is_available(binary_name: str) -> tuple[bool, str | None]`
  Return ``(available, reason)``: the binary is on PATH AND authenticated.
- **`run_agent_cli`** — `def run_agent_cli( binary_name: str, prompt: str, *, model: str, max_output_tokens: int = 8192, timeout: float = CLI_TIMEOUT_SECONDS, ) -> str`
  Run an agent CLI and return the assistant response text.

## `src/skillspector/providers/_agent_cli_base.py`
*source: src/skillspector/providers/_agent_cli_base.py*

- **`AgentCLIProviderBase`** — `class AgentCLIProviderBase`
  Base for providers that drive a local agent CLI (no API key needed).
- **`AgentCLIProviderBase.resolve_credentials`** — `def resolve_credentials(self) -> tuple[str, str | None] | None`
  No HTTP credentials needed — the CLI handles auth itself.
- **`AgentCLIProviderBase.is_available`** — `def is_available(self) -> tuple[bool, str | None]`
  Binary on PATH AND authenticated (delegates to the registry probe).
- **`AgentCLIProviderBase.complete`** — `def complete(self, prompt: str, *, model: str, max_output_tokens: int = 8192) -> str`
  Invoke the CLI via the hardened runner and return the assistant text.
- **`AgentCLIProviderBase.get_context_length`** — `def get_context_length(self, model: str) -> int | None`
- **`AgentCLIProviderBase.get_max_output_tokens`** — `def get_max_output_tokens(self, model: str) -> int | None`
- **`AgentCLIProviderBase.resolve_model`** — `def resolve_model(self, slot: str = "default") -> str`
  Return the model to forward to the CLI.

## `src/skillspector/providers/anthropic/provider.py`
*source: src/skillspector/providers/anthropic/provider.py*

- **`AnthropicProvider`** — `class AnthropicProvider`
  Anthropic credentials + bundled-YAML metadata provider.
- **`AnthropicProvider.resolve_credentials`** — `def resolve_credentials(self) -> tuple[str, str | None] | None`
  Return ``(api_key, base_url)`` from ``ANTHROPIC_API_KEY``.
- **`AnthropicProvider.create_chat_model`** — `def create_chat_model( self, model: str, *, max_tokens: int, timeout: float | None = 120, ) -> BaseChatModel | None`
  Create ``ChatAnthropic`` using native Anthropic credentials.
- **`AnthropicProvider.get_context_length`** — `def get_context_length(self, model: str) -> int | None`
- **`AnthropicProvider.get_max_output_tokens`** — `def get_max_output_tokens(self, model: str) -> int | None`
- **`AnthropicProvider.resolve_model`** — `def resolve_model(self, slot: str = "default") -> str`
  Resolve model: ``SKILLSPECTOR_MODEL`` env > slot default > ``DEFAULT_MODEL``.

## `src/skillspector/providers/anthropic_proxy/provider.py`
*source: src/skillspector/providers/anthropic_proxy/provider.py*

- **`AnthropicProxyProvider`** — `class AnthropicProxyProvider`
  Anthropic proxy provider for Vertex-style raw-predict endpoints.
- **`AnthropicProxyProvider.resolve_credentials`** — `def resolve_credentials(self) -> tuple[str, str | None] | None`
  Return ``(api_key, endpoint_url)`` from proxy env vars.
- **`AnthropicProxyProvider.create_chat_model`** — `def create_chat_model( self, model: str, *, max_tokens: int, timeout: float | None = 120, ) -> BaseChatModel | None`
  Create ``ChatAnthropic`` with custom transport for the proxy.
- **`AnthropicProxyProvider.get_context_length`** — `def get_context_length(self, model: str) -> int | None`
- **`AnthropicProxyProvider.get_max_output_tokens`** — `def get_max_output_tokens(self, model: str) -> int | None`
- **`AnthropicProxyProvider.resolve_model`** — `def resolve_model(self, slot: str = "default") -> str`
  Resolve model: ``SKILLSPECTOR_MODEL`` env > slot default > DEFAULT_MODEL.

## `src/skillspector/providers/antigravity_cli/provider.py`
*source: src/skillspector/providers/antigravity_cli/provider.py*

- **`AntigravityCLIProvider`** — `class AntigravityCLIProvider(AgentCLIProviderBase)`
  Antigravity CLI provider (registered but disabled; fail-closed).

## `src/skillspector/providers/base.py`
*source: src/skillspector/providers/base.py*

- **`ModelMetadataProvider`** — `class ModelMetadataProvider(Protocol)`
  Provider-side knowledge about models — token budgets and defaults.
- **`ModelMetadataProvider.get_context_length`** — `def get_context_length(self, model: str) -> int | None`
- **`ModelMetadataProvider.get_max_output_tokens`** — `def get_max_output_tokens(self, model: str) -> int | None`
- **`ModelMetadataProvider.resolve_model`** — `def resolve_model(self, slot: str = "default") -> str`
- **`CredentialsProvider`** — `class CredentialsProvider(Protocol)`
  Anything that can supply ``(api_key, base_url)`` for the LLM client.
- **`CredentialsProvider.resolve_credentials`** — `def resolve_credentials(self) -> tuple[str, str | None] | None`
- **`ChatModelProvider`** — `class ChatModelProvider(Protocol)`
  Anything that can construct its native LangChain chat model.
- **`ChatModelProvider.create_chat_model`** — `def create_chat_model( self, model: str, *, max_tokens: int, timeout: float | None = 120, ) -> BaseChatModel | None`
- **`AgentCLICapable`** — `class AgentCLICapable(Protocol)`
  Optional extension for providers that drive a local agent CLI.
- **`AgentCLICapable.is_available`** — `def is_available(self) -> tuple[bool, str | None]`
- **`AgentCLICapable.complete`** — `def complete( self, prompt: str, *, model: str, max_output_tokens: int, ) -> str`
- **`LLMProvider`** — `class LLMProvider(ModelMetadataProvider, CredentialsProvider, ChatModelProvider, Protocol)`
  Complete provider surface used by SkillSpector's LLM stack.
- **`has_cli_capability`** — `def has_cli_capability(provider: object) -> bool`
  Return ``True`` when *provider* implements the :class:`AgentCLICapable` interface.

## `src/skillspector/providers/bedrock/provider.py`
*source: src/skillspector/providers/bedrock/provider.py*

- **`BedrockProvider`** — `class BedrockProvider`
  AWS Bedrock provider — SigV4 auth via boto3, bundled-YAML metadata.
- **`BedrockProvider.resolve_credentials`** — `def resolve_credentials(self) -> tuple[str, str | None] | None`
  Bedrock uses SigV4, not ``(api_key, base_url)`` — always returns ``None``.
- **`BedrockProvider.create_chat_model`** — `def create_chat_model( self, model: str, *, max_tokens: int, timeout: float | None = 120, ) -> BaseChatModel | None`
  Construct a ``ChatBedrockConverse`` bound to a Bedrock client.
- **`BedrockProvider.get_context_length`** — `def get_context_length(self, model: str) -> int | None`
- **`BedrockProvider.get_max_output_tokens`** — `def get_max_output_tokens(self, model: str) -> int | None`
- **`BedrockProvider.resolve_model`** — `def resolve_model(self, slot: str = "default") -> str`
  Resolve model: ``SKILLSPECTOR_MODEL`` env > slot default > ``DEFAULT_MODEL``.

## `src/skillspector/providers/chat_models.py`
*source: src/skillspector/providers/chat_models.py*

- **`validate_base_url`** — `def validate_base_url(url: str | None) -> None`
  Warn if *url* is not a well-formed http(s) URL.
- **`create_openai_compatible_chat_model`** — `def create_openai_compatible_chat_model( *, model: str, credentials: tuple[str, str | None] | None, max_tokens: int, timeout: float | None = 120, default_headers: dict[str, str] | None = None, ) -> Ba`
  Create ``ChatOpenAI`` for providers serving OpenAI-compatible endpoints.

## `src/skillspector/providers/claude_cli/provider.py`
*source: src/skillspector/providers/claude_cli/provider.py*

- **`ClaudeCLIProvider`** — `class ClaudeCLIProvider(AgentCLIProviderBase)`
  Claude CLI provider (no API key; uses the local ``claude`` login).

## `src/skillspector/providers/codex_cli/provider.py`
*source: src/skillspector/providers/codex_cli/provider.py*

- **`CodexCLIProvider`** — `class CodexCLIProvider(AgentCLIProviderBase)`
  Codex CLI provider (no API key; uses the local ``codex`` login).

## `src/skillspector/providers/gemini_cli/provider.py`
*source: src/skillspector/providers/gemini_cli/provider.py*

- **`GeminiCLIProvider`** — `class GeminiCLIProvider(AgentCLIProviderBase)`
  Gemini CLI provider (no API key; uses the local ``gemini`` login).

## `src/skillspector/providers/nv_build/provider.py`
*source: src/skillspector/providers/nv_build/provider.py*

- **`NvBuildProvider`** — `class NvBuildProvider`
  build.nvidia.com credentials + bundled-YAML metadata provider.
- **`NvBuildProvider.resolve_credentials`** — `def resolve_credentials(self) -> tuple[str, str | None] | None`
  Return ``(api_key, base_url)`` from ``NVIDIA_INFERENCE_KEY``.
- **`NvBuildProvider.create_chat_model`** — `def create_chat_model( self, model: str, *, max_tokens: int, timeout: float | None = 120, ) -> BaseChatModel | None`
  Create ``ChatOpenAI`` for the build.nvidia.com endpoint.
- **`NvBuildProvider.get_context_length`** — `def get_context_length(self, model: str) -> int | None`
  Look up *model*'s context window in the bundled ``model_registry.yaml``.
- **`NvBuildProvider.get_max_output_tokens`** — `def get_max_output_tokens(self, model: str) -> int | None`
  Look up *model*'s max-output cap in the bundled ``model_registry.yaml``.
- **`NvBuildProvider.resolve_model`** — `def resolve_model(self, slot: str = "default") -> str`
  Resolve model: ``SKILLSPECTOR_MODEL`` env > slot default > ``DEFAULT_MODEL``.

## `src/skillspector/providers/openai/provider.py`
*source: src/skillspector/providers/openai/provider.py*

- **`OpenAIProvider`** — `class OpenAIProvider`
  Stock OpenAI credentials + bundled-YAML metadata provider.
- **`OpenAIProvider.resolve_credentials`** — `def resolve_credentials(self) -> tuple[str, str | None] | None`
  Return ``(api_key, base_url)`` from ``OPENAI_API_KEY`` / ``OPENAI_BASE_URL``.
- **`OpenAIProvider.create_chat_model`** — `def create_chat_model( self, model: str, *, max_tokens: int, timeout: float | None = 120, ) -> BaseChatModel | None`
  Create ``ChatOpenAI`` using standard OpenAI environment variables.
- **`OpenAIProvider.get_context_length`** — `def get_context_length(self, model: str) -> int | None`
- **`OpenAIProvider.get_max_output_tokens`** — `def get_max_output_tokens(self, model: str) -> int | None`
- **`OpenAIProvider.resolve_model`** — `def resolve_model(self, slot: str = "default") -> str`
  Resolve model: ``SKILLSPECTOR_MODEL`` env > slot default > ``DEFAULT_MODEL``.

## `src/skillspector/providers/registry.py`
*source: src/skillspector/providers/registry.py*

- **`lookup_context_length`** — `def lookup_context_length(default_yaml_path: str, model: str) -> int | None`
  Return ``context_length`` for *model* from the resolved YAML registry.
- **`lookup_max_output_tokens`** — `def lookup_max_output_tokens(default_yaml_path: str, model: str) -> int | None`
  Return ``max_output_tokens`` for *model* from the resolved YAML registry.

## `src/skillspector/sarif_models.py`
*source: src/skillspector/sarif_models.py*

- **`SarifRegion`** — `class SarifRegion(BaseModel)`
  Region within an artifact (line/column range).
- **`SarifArtifactLocation`** — `class SarifArtifactLocation(BaseModel)`
  Reference to an artifact (file) in the run.
- **`SarifPhysicalLocation`** — `class SarifPhysicalLocation(BaseModel)`
  Physical location (artifact + optional region).
- **`SarifLocation`** — `class SarifLocation(BaseModel)`
  Result location (physical and/or logical).
- **`SarifMessage`** — `class SarifMessage(BaseModel)`
  SARIF message object (required: text).
- **`SarifSuppression`** — `class SarifSuppression(BaseModel)`
  SARIF suppression object — marks a result as suppressed (e.g. via a baseline).
- **`SarifResult`** — `class SarifResult(BaseModel)`
  A single analysis result (finding).
- **`SarifReportingDescriptor`** — `class SarifReportingDescriptor(BaseModel)`
  Rule metadata (SARIF reportingDescriptor).
- **`SarifDriver`** — `class SarifDriver(BaseModel)`
  Tool driver (required: name; optional: version, rules).
- **`SarifTool`** — `class SarifTool(BaseModel)`
  Tool that produced the run.
- **`SarifArtifact`** — `class SarifArtifact(BaseModel)`
  Artifact (file) analyzed in the run.
- **`SarifNotification`** — `class SarifNotification(BaseModel)`
  A notification about a condition encountered during tool execution.
- **`SarifInvocation`** — `class SarifInvocation(BaseModel)`
  Describes a single tool invocation (SARIF ``run.invocations[]``).
- **`SarifRun`** — `class SarifRun(BaseModel)`
  A single run (one tool invocation).
- **`SarifLog`** — `class SarifLog(BaseModel)`
  Top-level SARIF log (SARIF 2.1.0).
- **`SarifLog.runs_non_empty`** — `def runs_non_empty(self) -> SarifLog`
- **`validate_sarif_report`** — `def validate_sarif_report(data: object) -> None`
  Validate that data has the minimal SARIF 2.1.0 structure. Raises ValidationError if invalid.

## `src/skillspector/state.py`
*source: src/skillspector/state.py*

- **`SkillspectorState`** — `class SkillspectorState(TypedDict, total=False)`
  Graph state shared by all nodes.
- **`LLMCallRecord`** — `class LLMCallRecord(TypedDict)`
  One LLM-stage telemetry record (an entry in ``llm_call_log``).
- **`llm_call_record`** — `def llm_call_record(node_id: str, *, ok: bool, error: str | None = None) -> LLMCallRecord`
  Build one telemetry record for ``SkillspectorState['llm_call_log']``.
- **`AnalyzerNodeResponse`** — `class AnalyzerNodeResponse(TypedDict)`
  Strict analyzer update payload for graph state.
- **`MetaAnalyzerResponse`** — `class MetaAnalyzerResponse(TypedDict)`
  Strict meta-analyzer update payload for graph state.

## `src/skillspector/suppression.py`
*source: src/skillspector/suppression.py*

- **`finding_fingerprint`** — `def finding_fingerprint(finding: Finding) -> str`
  Return a stable short fingerprint for *finding*.
- **`SuppressionRule`** — `class SuppressionRule`
  A glob-based suppression rule. Empty rules (no field set) never match.
- **`SuppressionRule.matches`** — `def matches(self, finding: Finding) -> bool`
  True when every field this rule specifies glob-matches *finding*.
- **`SuppressedFinding`** — `class SuppressedFinding`
  A finding paired with the reason it was suppressed.
- **`SuppressedFinding.to_dict`** — `def to_dict(self) -> dict[str, object]`
  JSON-serializable form: the full finding plus its suppression reason.
- **`Baseline`** — `class Baseline`
  Loaded baseline: glob rules plus exact fingerprint suppressions.
- **`Baseline.reason_for`** — `def reason_for(self, finding: Finding) -> str | None`
  Return the suppression reason for *finding*, or None if not suppressed.
- **`Baseline.is_empty`** — `def is_empty(self) -> bool`
  True when the baseline has no rules and no fingerprints.
- **`baseline_from_dict`** — `def baseline_from_dict(data: dict[str, Any]) -> Baseline`
  Build a :class:`Baseline` from a parsed mapping (YAML/JSON).
- **`load_baseline`** — `def load_baseline(path: str | Path) -> Baseline`
  Load a baseline file (YAML or JSON) into a :class:`Baseline`.
- **`partition_findings`** — `def partition_findings( findings: list[Finding], baseline: Baseline | None ) -> tuple[list[Finding], list[SuppressedFinding]]`
  Split *findings* into (kept, suppressed) using *baseline*.
- **`build_baseline_dict`** — `def build_baseline_dict( findings: list[Finding], reason: str = "Accepted finding (auto-generated baseline)", ) -> dict[str, object]`
  Build a baseline mapping that fingerprint-suppresses every given finding.
- **`dump_baseline`** — `def dump_baseline(data: dict[str, object], path: str | Path) -> None`
  Write a baseline mapping to *path* as YAML (``.json`` extension -> JSON).
