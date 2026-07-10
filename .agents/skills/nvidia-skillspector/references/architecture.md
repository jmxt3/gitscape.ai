# Architecture

## Purpose

**Security scanner for AI agent skills.** Detect vulnerabilities, malicious patterns, and security risks before installing agent skills.

## Entry Points

- `src/skillspector/cli.py` — application entry point
- `contrib/multilingual/batch_scan.py` — script entry point

## Module Map

| Module | Purpose | Symbols | Key exports |
|---|---|---|---|
| `contrib/multilingual/annotation.py` | — | 2 | `is_language_compatible`, `annotate_findings` |
| `contrib/multilingual/api_pool.py` | — | 19 | `ApiKey`, `ApiKey.available`, `ApiKeyPool` (+16 more) |
| `contrib/multilingual/batch_scan.py` | — | 1 | `main` |
| `contrib/multilingual/detection.py` | — | 2 | `detect_language`, `detect_skill_language` |
| `contrib/multilingual/discovery.py` | — | 1 | `discover_skills` |
| `contrib/multilingual/gap_fill.py` | — | 8 | `GapFillFinding`, `GapFillFinding.to_finding`, `GapFillResult` (+5 more) |
| `contrib/multilingual/reports.py` | — | 1 | `sorted_results` |
| `contrib/multilingual/runner.py` | — | 7 | `set_api_pool`, `setup_deepseek_compat`, `deepseek_compat` (+4 more) |
| `src/skillspector/cleanup.py` | — | 1 | `cleanup_result` |
| `src/skillspector/cli.py` | — | 7 | `FormatChoice`, `TransportChoice`, `version_callback` (+4 more) |
| `src/skillspector/graph.py` | — | 1 | `create_graph` |
| `src/skillspector/input_handler.py` | — | 5 | `InputHandler`, `InputHandler.__init__`, `InputHandler.resolve` (+2 more) |
| `src/skillspector/llm_analyzer_base.py` | — | 18 | `LLMFinding`, `LLMFinding.to_finding`, `LLMAnalysisResult` (+15 more) |
| `src/skillspector/llm_utils.py` | — | 11 | `is_llm_available`, `fetch_model_token_limits`, `AgentCLIChatModel` (+8 more) |
| `src/skillspector/logging_config.py` | — | 2 | `get_logger`, `set_level` |
| `src/skillspector/mcp_server.py` | — | 3 | `run_scan`, `build_server`, `run` |
| `src/skillspector/model_info.py` | — | 2 | `get_max_input_tokens`, `get_max_output_tokens` |
| `src/skillspector/models.py` | — | 8 | `Severity`, `Location`, `AnalyzerFinding` (+5 more) |
| `src/skillspector/multi_skill.py` | — | 3 | `SkillDirectory`, `MultiSkillDetectionResult`, `detect_skills` |
| `src/skillspector/nodes/analyzers/behavioral_ast.py` | — | 1 | `node` |
| `src/skillspector/nodes/analyzers/behavioral_taint_tracking.py` | — | 1 | `node` |
| `src/skillspector/nodes/analyzers/common.py` | — | 13 | `make_dummy_finding`, `is_code_example`, `get_line_number` (+10 more) |
| `src/skillspector/nodes/analyzers/mcp_least_privilege.py` | — | 1 | `node` |
| `src/skillspector/nodes/analyzers/mcp_rug_pull.py` | — | 1 | `node` |
| `src/skillspector/nodes/analyzers/mcp_tool_poisoning.py` | — | 1 | `node` |
| `src/skillspector/nodes/analyzers/osv_client.py` | — | 5 | `VulnResult`, `clear_cache`, `query_batch` (+2 more) |
| `src/skillspector/nodes/analyzers/pattern_defaults.py` | — | 5 | `PatternCategory`, `get_explanation`, `get_remediation` (+2 more) |
| `src/skillspector/nodes/analyzers/semantic_developer_intent.py` | — | 1 | `node` |
| `src/skillspector/nodes/analyzers/semantic_quality_policy.py` | — | 1 | `node` |
| `src/skillspector/nodes/analyzers/semantic_security_discovery.py` | — | 1 | `node` |
| `src/skillspector/nodes/analyzers/static_patterns_agent_snooping.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_anti_refusal.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_data_exfiltration.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_excessive_agency.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_harmful_content.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_memory_poisoning.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_output_handling.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_privilege_escalation.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_prompt_injection.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_rogue_agent.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_ssrf.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_supply_chain.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_system_prompt_leakage.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_patterns_tool_misuse.py` | — | 2 | `analyze`, `node` |
| `src/skillspector/nodes/analyzers/static_runner.py` | — | 2 | `analyzer_finding_to_finding`, `run_static_patterns` |
| `src/skillspector/nodes/analyzers/static_yara.py` | — | 1 | `node` |
| `src/skillspector/nodes/build_context.py` | — | 1 | `build_context` |
| `src/skillspector/nodes/deduplicate.py` | — | 1 | `deduplicate` |
| `src/skillspector/nodes/meta_analyzer.py` | — | 9 | `MetaAnalyzerFinding`, `OverallAssessment`, `MetaAnalyzerResult` (+6 more) |
| `src/skillspector/nodes/report.py` | — | 1 | `report` |
| `src/skillspector/nodes/resolve_input.py` | — | 1 | `resolve_input` |
| `src/skillspector/providers/__init__.py` | — | 6 | `raise_no_llm_api_key_configured`, `get_metadata_provider`, `get_active_provider` (+3 more) |
| `src/skillspector/providers/_agent_cli.py` | — | 6 | `AgentCLIError`, `find_binary`, `CliSpec` (+3 more) |
| `src/skillspector/providers/_agent_cli_base.py` | — | 7 | `AgentCLIProviderBase`, `AgentCLIProviderBase.resolve_credentials`, `AgentCLIProviderBase.is_available` (+4 more) |
| `src/skillspector/providers/anthropic/provider.py` | — | 6 | `AnthropicProvider`, `AnthropicProvider.resolve_credentials`, `AnthropicProvider.create_chat_model` (+3 more) |
| `src/skillspector/providers/anthropic_proxy/provider.py` | — | 6 | `AnthropicProxyProvider`, `AnthropicProxyProvider.resolve_credentials`, `AnthropicProxyProvider.create_chat_model` (+3 more) |
| `src/skillspector/providers/antigravity_cli/provider.py` | — | 1 | `AntigravityCLIProvider` |
| `src/skillspector/providers/base.py` | — | 13 | `ModelMetadataProvider`, `ModelMetadataProvider.get_context_length`, `ModelMetadataProvider.get_max_output_tokens` (+10 more) |
| `src/skillspector/providers/bedrock/provider.py` | — | 6 | `BedrockProvider`, `BedrockProvider.resolve_credentials`, `BedrockProvider.create_chat_model` (+3 more) |
| `src/skillspector/providers/chat_models.py` | — | 2 | `validate_base_url`, `create_openai_compatible_chat_model` |
| `src/skillspector/providers/claude_cli/provider.py` | — | 1 | `ClaudeCLIProvider` |
| `src/skillspector/providers/codex_cli/provider.py` | — | 1 | `CodexCLIProvider` |
| `src/skillspector/providers/gemini_cli/provider.py` | — | 1 | `GeminiCLIProvider` |
| `src/skillspector/providers/nv_build/provider.py` | — | 6 | `NvBuildProvider`, `NvBuildProvider.resolve_credentials`, `NvBuildProvider.create_chat_model` (+3 more) |
| `src/skillspector/providers/openai/provider.py` | — | 6 | `OpenAIProvider`, `OpenAIProvider.resolve_credentials`, `OpenAIProvider.create_chat_model` (+3 more) |
| `src/skillspector/providers/registry.py` | — | 2 | `lookup_context_length`, `lookup_max_output_tokens` |
| `src/skillspector/sarif_models.py` | — | 17 | `SarifRegion`, `SarifArtifactLocation`, `SarifPhysicalLocation` (+14 more) |
| `src/skillspector/state.py` | — | 5 | `SkillspectorState`, `LLMCallRecord`, `llm_call_record` (+2 more) |
| `src/skillspector/suppression.py` | — | 13 | `finding_fingerprint`, `SuppressionRule`, `SuppressionRule.matches` (+10 more) |

## Dependency Flow

```mermaid
graph TD
    contrib_multilingual["contrib/multilingual/"]
    src_skillspector_nodes_analyzers["src/skillspector/nodes/analyzers/"]
    src_skillspector_providers["src/skillspector/providers/"]
    src_skillspector_providers_anthropic["src/skillspector/providers/anthropic/"]
    src_skillspector_providers_anthropic_proxy["src/skillspector/providers/anthropic_proxy/"]
    src_skillspector_providers_antigravity_cli["src/skillspector/providers/antigravity_cli/"]
    src_skillspector_providers_bedrock["src/skillspector/providers/bedrock/"]
    src_skillspector_providers_claude_cli["src/skillspector/providers/claude_cli/"]
    src_skillspector_providers_codex_cli["src/skillspector/providers/codex_cli/"]
    src_skillspector_providers_gemini_cli["src/skillspector/providers/gemini_cli/"]
    src_skillspector_providers_nv_build["src/skillspector/providers/nv_build/"]
    src_skillspector_providers_openai["src/skillspector/providers/openai/"]
    src_skillspector_providers --> src_skillspector_providers_anthropic
    src_skillspector_providers --> src_skillspector_providers_anthropic_proxy
    src_skillspector_providers --> src_skillspector_providers_antigravity_cli
    src_skillspector_providers --> src_skillspector_providers_bedrock
    src_skillspector_providers --> src_skillspector_providers_claude_cli
    src_skillspector_providers --> src_skillspector_providers_codex_cli
    src_skillspector_providers --> src_skillspector_providers_gemini_cli
    src_skillspector_providers --> src_skillspector_providers_nv_build
    src_skillspector_providers --> src_skillspector_providers_openai
```

## Conventions

- Primary languages: Python, TypeScript, Shell
- Tests located in: `contrib/multilingual/tests`, `contrib/multilingual/tests/docs`, `contrib/multilingual/tests/tests-pro`
- Configuration files: `Dockerfile`, `Makefile`
- 282 public symbols across 69 source modules

## Directory Structure

```
├── .github/
│   └── workflows/
├── contrib/
│   └── multilingual/
├── docs/
│   └── plans/
├── extensions/
├── src/
│   └── skillspector/
└── tests/
    ├── docker/
    ├── fixtures/
    ├── integration/
    ├── nodes/
    ├── provider/
    └── unit/
```
