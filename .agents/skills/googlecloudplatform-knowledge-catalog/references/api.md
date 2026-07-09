# API Reference

Generated from parsed symbols — names, signatures, and the one-line purpose from each docstring/comment.

## `okf/src/reference_agent/agent.py`
*source: okf/src/reference_agent/agent.py*

- **`build_bq_agent`** — `def build_bq_agent(model: str = DEFAULT_MODEL) -> Agent`
- **`build_web_agent`** — `def build_web_agent(model: str = DEFAULT_MODEL) -> Agent`

## `okf/src/reference_agent/bundle/document.py`
*source: okf/src/reference_agent/bundle/document.py*

- **`OKFDocumentError`** — `class OKFDocumentError(ValueError)`
- **`OKFDocument`** — `class OKFDocument`
- **`OKFDocument.parse`** — `def parse(cls, text: str) -> "OKFDocument"`
- **`OKFDocument.serialize`** — `def serialize(self) -> str`
- **`OKFDocument.validate`** — `def validate(self) -> None`

## `okf/src/reference_agent/bundle/index.py`
*source: okf/src/reference_agent/bundle/index.py*

- **`regenerate_indexes`** — `def regenerate_indexes( bundle_root: Path, *, model: str = _FALLBACK_MODEL, synthesize: Callable[..., str] = synthesize_description, ) -> list[Path]`

## `okf/src/reference_agent/bundle/paths.py`
*source: okf/src/reference_agent/bundle/paths.py*

- **`concept_id_to_path`** — `def concept_id_to_path(bundle_root: Path, concept_id: tuple[str, ...]) -> Path`
- **`path_to_concept_id`** — `def path_to_concept_id(bundle_root: Path, path: Path) -> tuple[str, ...]`
- **`parse_concept_id`** — `def parse_concept_id(s: str) -> tuple[str, ...]`

## `okf/src/reference_agent/bundle/synthesizer.py`
*source: okf/src/reference_agent/bundle/synthesizer.py*

- **`synthesize_description`** — `def synthesize_description( rel_path: str, children: list[tuple[str, str]], *, model: str, ) -> str`

## `okf/src/reference_agent/cli.py`
*source: okf/src/reference_agent/cli.py*

- **`main`** — `def main(argv: list[str] | None = None) -> int`

## `okf/src/reference_agent/runner.py`
*source: okf/src/reference_agent/runner.py*

- **`ReferenceRunner`** — `class ReferenceRunner`
- **`ReferenceRunner.__init__`** — `def __init__( self, source: Source, bundle_root: Path, model: str = DEFAULT_MODEL, web_seeds: list[str] | None = None, web_max_pages: int = 100, web_allowed_hosts: set[str] | None = None, web_allowed_`
- **`ReferenceRunner.enrich_concept`** — `def enrich_concept(self, ref: ConceptRef) -> None`
- **`ReferenceRunner.run_web_pass`** — `def run_web_pass(self) -> None`
- **`ReferenceRunner.enrich_all`** — `def enrich_all(self, only: list[tuple[str, ...]] | None = None) -> int`

## `okf/src/reference_agent/sources/base.py`
*source: okf/src/reference_agent/sources/base.py*

- **`ConceptRef`** — `class ConceptRef`
- **`ConceptRef.id_str`** — `def id_str(self) -> str`
- **`Source`** — `class Source(ABC)`
- **`Source.list_concepts`** — `def list_concepts(self) -> list[ConceptRef]`
- **`Source.read_concept`** — `def read_concept(self, ref: ConceptRef) -> dict[str, Any]`
- **`Source.sample_rows`** — `def sample_rows(self, ref: ConceptRef, n: int = 5) -> list[dict[str, Any]] | None`
- **`Source.find`** — `def find(self, concept_id: tuple[str, ...]) -> ConceptRef | None`

## `okf/src/reference_agent/sources/bigquery.py`
*source: okf/src/reference_agent/sources/bigquery.py*

- **`BigQuerySource`** — `class BigQuerySource(Source)`
- **`BigQuerySource.__init__`** — `def __init__(self, dataset: str, billing_project: str | None = None)`
- **`BigQuerySource.list_concepts`** — `def list_concepts(self) -> list[ConceptRef]`
- **`BigQuerySource.read_concept`** — `def read_concept(self, ref: ConceptRef) -> dict[str, Any]`
- **`BigQuerySource.sample_rows`** — `def sample_rows( self, ref: ConceptRef, n: int = 5 ) -> list[dict[str, Any]] | None`

## `okf/src/reference_agent/tools/bundle_tools.py`
*source: okf/src/reference_agent/tools/bundle_tools.py*

- **`read_existing_doc`** — `def read_existing_doc(concept_id: str) -> dict[str, Any] | None`
  Return the existing OKF document for this concept, if one is already on
- **`write_concept_doc`** — `def write_concept_doc( concept_id: str, frontmatter: dict[str, Any], body: str, ) -> dict[str, Any]`
  Write (or overwrite) the OKF markdown document for this concept.

## `okf/src/reference_agent/tools/context.py`
*source: okf/src/reference_agent/tools/context.py*

- **`ToolContext`** — `class ToolContext`
- **`WebState`** — `class WebState`
- **`set_context`** — `def set_context(source: Source, bundle_root: Path) -> None`
- **`get_context`** — `def get_context() -> ToolContext`
- **`set_web_state`** — `def set_web_state( allowed_hosts: set[str], max_pages: int, *, seeds: list[str] | None = None, allowed_path_prefixes: list[str] | None = None, denied_path_substrings: list[str] | None = None, max_dept`
- **`get_web_state`** — `def get_web_state() -> WebState`
- **`clear_web_state`** — `def clear_web_state() -> None`
- **`is_web_pass`** — `def is_web_pass() -> bool`
  True while the runner is executing the web-ingestion pass.

## `okf/src/reference_agent/tools/source_tools.py`
*source: okf/src/reference_agent/tools/source_tools.py*

- **`list_concepts`** — `def list_concepts() -> list[dict[str, Any]]`
  List every concept the active source advertises.
- **`read_concept_raw`** — `def read_concept_raw(concept_id: str) -> dict[str, Any]`
  Fetch raw structured metadata for a single concept from its source.
- **`sample_rows`** — `def sample_rows(concept_id: str, n: int = 5) -> dict[str, Any]`
  Pull a small sample of rows from the underlying asset, if supported.

## `okf/src/reference_agent/tools/web_tools.py`
*source: okf/src/reference_agent/tools/web_tools.py*

- **`fetch_url`** — `def fetch_url(url: str) -> dict[str, Any]`
  Fetch a single web page and return its content as markdown plus its

## `okf/src/reference_agent/viewer/generator.py`
*source: okf/src/reference_agent/viewer/generator.py*

- **`Concept`** — `class Concept`
- **`Concept.to_node`** — `def to_node(self) -> dict[str, Any]`
- **`generate_visualization`** — `def generate_visualization( bundle_root: Path, out_path: Path, *, bundle_name: str | None = None, ) -> dict[str, int]`
  Walk a bundle and write a single self-contained HTML visualization.

## `okf/src/reference_agent/web/fetcher.py`
*source: okf/src/reference_agent/web/fetcher.py*

- **`FetchError`** — `class FetchError(Exception)`
- **`Page`** — `class Page`
- **`fetch_and_parse`** — `def fetch_and_parse(url: str, *, timeout: float = 10.0) -> Page`

## `samples/discovery/agent.py`
*source: samples/discovery/agent.py*

- **`load_instruction`** — `def load_instruction() -> str`
  Loads the agent instruction from the SKILL.md file.

## `samples/discovery/tools.py`
*source: samples/discovery/tools.py*

- **`knowledge_catalog_search`** — `def knowledge_catalog_search( query: str, ) -> dict[str, list[str] | str]`
  Searches Knowledge Catalog using Semantic Search capabilities.

## `samples/discovery/utils.py`
*source: samples/discovery/utils.py*

- **`get_consumer_project`** — `def get_consumer_project() -> str`
  Extracts the consumer project from the environment variable.

## `samples/enrichment/sample/data/create_data.py`
*source: samples/enrichment/sample/data/create_data.py*

- **`create_dataset`** — `def create_dataset(bq: bigquery.Client, project_id: str)`
- **`create_table`** — `def create_table(bq: bigquery.Client, project_id: str)`
- **`main`** — `def main()`

## `samples/enrichment/src/enrichment/documentation/agent.py`
*source: samples/enrichment/src/enrichment/documentation/agent.py*

- **`create_runner`** — `def create_runner(name: str, tools: list[t.Any], config_dir: pathlib.Path) -> InMemoryRunner`
- **`run_task`** — `def run_task(runner: InMemoryRunner, prompt: str)`

## `samples/enrichment/src/enrichment/documentation/sources.py`
*source: samples/enrichment/src/enrichment/documentation/sources.py*

- **`load_sources_config`** — `def load_sources_config(dir: pathlib.Path, instruction: str, tools: t.List[t.Any]) -> t.Tuple[str, t.List[t.Any]]`

## `samples/enrichment/src/enrichment/download.py`
*source: samples/enrichment/src/enrichment/download.py*

- **`main`** — `def main()`

## `samples/enrichment/src/enrichment/enrich.py`
*source: samples/enrichment/src/enrichment/enrich.py*

- **`main`** — `def main()`

## `samples/enrichment/src/enrichment/metadata/catalog.py`
*source: samples/enrichment/src/enrichment/metadata/catalog.py*

- **`lookup_table_info`** — `def lookup_table_info(table_name: str) -> t.Tuple[str, bool]`

## `samples/enrichment/src/enrichment/metadata/snapshot.py`
*source: samples/enrichment/src/enrichment/metadata/snapshot.py*

- **`download_entries`** — `def download_entries(dir: pathlib.Path, dataset: str)`
- **`publish_entries`** — `def publish_entries(dir: pathlib.Path)`
- **`list_entries`** — `def list_entries(dir: pathlib.Path)`
- **`update_entry`** — `def update_entry(dir: pathlib.Path, out_dir: pathlib.Path, table_name: str, content: str)`
- **`show_entry`** — `def show_entry(dir: pathlib.Path, table_name: str)`

## `samples/enrichment/src/enrichment/publish.py`
*source: samples/enrichment/src/enrichment/publish.py*

- **`main`** — `def main()`

## `samples/enrichment/src/enrichment/util/markdown.py`
*source: samples/enrichment/src/enrichment/util/markdown.py*

- **`parse`** — `def parse(md: str) -> t.Tuple[t.Dict[str, t.Any], str]`

## `samples/enrichment/src/tools/fileskb/main.py`
*source: samples/enrichment/src/tools/fileskb/main.py*

- **`list_contents`** — `def list_contents(path: str = '') -> str`
  List the contents of a directory in the knowledge base.
- **`read_file`** — `def read_file(path: str) -> str`
  Read the contents of a file in the knowledge base.
- **`search_content`** — `def search_content(query: str, path: str = '') -> t.List[t.Dict[str, t.Any]]`
  Search for a text query (regex supported) within markdown files.

## `toolbox/enrichment/src/agent/enrich/agent.ts`
*source: toolbox/enrichment/src/agent/enrich/agent.ts*

- **`createAgent`** — `function createAgent(tools: adk.ToolUnion[]): adk.Agent`

## `toolbox/enrichment/src/agent/enrich/command.ts`
*source: toolbox/enrichment/src/agent/enrich/command.ts*

- **`EnrichOptions`** — `interface EnrichOptions`
- **`enrichCommand`** — `async function enrichCommand(options: EnrichOptions)`

## `toolbox/enrichment/src/agent/tools.ts`
*source: toolbox/enrichment/src/agent/tools.ts*

- **`loadMcpTools`** — `async function loadMcpTools(configPath: string): Promise<adk.MCPToolset[]>`
- **`loadSkills`** — `async function loadSkills(configPath: string): Promise<adk.SkillToolset[]>`

## `toolbox/enrichment/src/tools/md/fileset.ts`
*source: toolbox/enrichment/src/tools/md/fileset.ts*

- **`SearchResult`** — `interface SearchResult`
- **`MarkdownFileset`** — `class MarkdownFileset`
- **`MarkdownFileset.constructor`** — `constructor(root: string)`
- **`MarkdownFileset.safePath`** — `private safePath(relativePath: string): string`
- **`MarkdownFileset.listContents`** — `async listContents(relativePath: string = ''): Promise<string>`
- **`MarkdownFileset.readFile`** — `async readFile(relativePath: string): Promise<string>`
- **`MarkdownFileset.getMarkdownFiles`** — `private async getMarkdownFiles(dir: string): Promise<string[]>`
- **`MarkdownFileset.searchContents`** — `async searchContents(query: string, relativePath: string = ''): Promise<SearchResult[] | string>`

## `toolbox/enrichment/src/tools/md/server.ts`
*source: toolbox/enrichment/src/tools/md/server.ts*

- **`runServer`** — `async function runServer(fileset: MarkdownFileset)`

## `toolbox/mdcode/src/libts/gcp/api.ts`
*source: toolbox/mdcode/src/libts/gcp/api.ts*

- **`ApiResult`** — `interface ApiResult<T>`
- **`ApiClient`** — `class ApiClient`
- **`ApiClient.constructor`** — `constructor(endpoint: string, pathPrefix: string, context: context.ApiContext)`
- **`ApiClient.context`** — `get context(): context.ApiContext`

## `toolbox/mdcode/src/libts/gcp/bigquery.ts`
*source: toolbox/mdcode/src/libts/gcp/bigquery.ts*

- **`Dataset`** — `interface Dataset`
- **`Table`** — `interface Table`
- **`BigQueryClient`** — `class BigQueryClient extends api.ApiClient`
- **`BigQueryClient.constructor`** — `constructor(ctx: context.ApiContext)`
- **`BigQueryClient.getDataset`** — `async getDataset(project: string, dataset: string): Promise<api.ApiResult<Dataset>>`
- **`BigQueryClient.listTables`** — `async *listTables(project: string, dataset: string): AsyncGenerator<Table>`

## `toolbox/mdcode/src/libts/gcp/context.ts`
*source: toolbox/mdcode/src/libts/gcp/context.ts*

- **`ApiContext`** — `class ApiContext`
- **`ApiContext.constructor`** — `constructor(project: string, location: string, token: string)`
- **`ApiContext.token`** — `get token(): string`
- **`ApiContext.log`** — `log(message: string, data?: any)`
- **`ApiContext.default`** — `static default(): ApiContext`
- **`ApiContext.refresh`** — `refresh()`

## `toolbox/mdcode/src/libts/gcp/crm.ts`
*source: toolbox/mdcode/src/libts/gcp/crm.ts*

- **`Project`** — `interface Project`
- **`ResourceManagerClient`** — `class ResourceManagerClient extends api.ApiClient`
- **`ResourceManagerClient.constructor`** — `constructor(ctx: context.ApiContext)`
- **`ResourceManagerClient.getProject`** — `async getProject(project: string): Promise<api.ApiResult<Project>>`
- **`fixProject`** — `async function fixProject(resource: string, ctx: context.ApiContext): Promise<string>`

## `toolbox/mdcode/src/libts/gcp/dataplex.ts`
*source: toolbox/mdcode/src/libts/gcp/dataplex.ts*

- **`EntryGroup`** — `interface EntryGroup`
- **`EntryType`** — `interface EntryType`
- **`AspectType`** — `interface AspectType`
- **`Aspect`** — `interface Aspect`
- **`Entry`** — `interface Entry`
- **`CatalogClient`** — `class CatalogClient extends api.ApiClient`
- **`CatalogClient.constructor`** — `constructor(ctx: context.ApiContext)`
- **`CatalogClient.getEntryGroup`** — `async getEntryGroup(project: string, location: string, entryGroup: string): Promise<api.ApiResult<EntryGroup>>`
- **`CatalogClient.getEntryType`** — `async getEntryType(project: string, location: string, type: string): Promise<api.ApiResult<EntryType>>`
- **`CatalogClient.getAspectType`** — `async getAspectType(project: string, location: string, type: string): Promise<api.ApiResult<AspectType>>`
- **`CatalogClient.getEntry`** — `async getEntry(project: string, location: string, entryGroup: string, entry: string, aspects?: string[]): Promise<api.ApiResult<Entry>>`
- **`CatalogClient.lookupEntry`** — `async lookupEntry(project: string, location: string, name: string, aspects?: string[]): Promise<api.ApiResult<Entry>>`
- **`CatalogClient.modifyEntry`** — `async modifyEntry(project: string, location: string, entry: Entry, updateMask?: string[], aspectKeys?: string[]): Promise<api.ApiResult<Entry>>`
- **`CatalogClient.updateEntry`** — `async updateEntry(entry: Entry, updateMask?: string[], aspectKeys?: string[]): Promise<api.ApiResult<Entry>>`
- **`CatalogClient.listEntries`** — `async *listEntries(project: string, location: string, entryGroup: string): AsyncGenerator<Entry, void, unknown>`
- **`CatalogClient.createEntry`** — `async createEntry(project: string, location: string, entryGroup: string, entryId: string, entry?: Entry): Promise<api.ApiResult<Entry>>`
- **`CatalogClient.createEntryGroup`** — `async createEntryGroup(project: string, location: string, entryGroupId: string, entryGroup?: EntryGroup): Promise<api.ApiResult<EntryGroup>>`
- **`catalogContainer`** — `function catalogContainer(project: string, location: string, entryGroup: string=''): string`
  Constructs canonical names for catalog container resources, identified by project, location and
- **`_typeRefToName`** — `function _typeRefToName(ref: string, type: string): string`
  Converts project.location.type to projects/${project}/locations/${location}/typeTypes/${type}
- **`_nameToTypeRef`** — `function _nameToTypeRef(name: string): string`
  Converts projects/${project}/locations/${location}/typeTypes/${type} -> project.location.type

## `toolbox/mdcode/src/libts/layout.ts`
*source: toolbox/mdcode/src/libts/layout.ts*

- **`Layouts`** — `enum Layouts`
- **`CatalogLayout`** — `interface CatalogLayout`
- **`createLayout`** — `function createLayout(layout: Layouts, catalogPath: string): CatalogLayout`

## `toolbox/mdcode/src/libts/layouts/documents.ts`
*source: toolbox/mdcode/src/libts/layouts/documents.ts*

- **`DocumentsLayout`** — `class DocumentsLayout implements CatalogLayout`
- **`DocumentsLayout.constructor`** — `constructor(catalogPath: string)`
- **`DocumentsLayout.init`** — `async init(): Promise<void>`
- **`DocumentsLayout.entryExists`** — `entryExists(name: string): boolean`
- **`DocumentsLayout.listEntries`** — `listEntries(): string[]`
- **`DocumentsLayout.loadEntry`** — `async loadEntry(name: string): Promise<md.Entry>`
- **`DocumentsLayout.saveEntry`** — `async saveEntry(name: string, entry: md.Entry): Promise<void>`
- **`DocumentsLayout.deleteEntry`** — `async deleteEntry(name: string): Promise<void>`
- **`parseMarkdown`** — `function parseMarkdown(content: string): { entry: md.Entry|null; body: string }`
- **`toMarkdown`** — `function toMarkdown(entry: md.Entry, body: string): string`

## `toolbox/mdcode/src/libts/layouts/standard.ts`
*source: toolbox/mdcode/src/libts/layouts/standard.ts*

- **`StandardLayout`** — `class StandardLayout implements CatalogLayout`
- **`StandardLayout.constructor`** — `constructor(catalogPath: string)`
- **`StandardLayout.init`** — `async init(): Promise<void>`
- **`StandardLayout.entryExists`** — `entryExists(name: string): boolean`
- **`StandardLayout.listEntries`** — `listEntries(): string[]`
- **`StandardLayout.loadEntry`** — `async loadEntry(name: string): Promise<md.Entry>`
- **`StandardLayout.saveEntry`** — `async saveEntry(name: string, entry: md.Entry): Promise<void>`
- **`StandardLayout.deleteEntry`** — `async deleteEntry(name: string): Promise<void>`

## `toolbox/mdcode/src/libts/manifest.ts`
*source: toolbox/mdcode/src/libts/manifest.ts*

- **`SnapshotConfig`** — `interface SnapshotConfig`
- **`PublishingConfig`** — `interface PublishingConfig`
- **`Scope`** — `interface Scope`
- **`CatalogManifest`** — `class CatalogManifest`
- **`CatalogManifest.constructor`** — `private constructor( source: CatalogSource, snapshotConfig?: SnapshotConfig, publishingConfig?: PublishingConfig )`
- **`CatalogManifest.initWithEntryGroup`** — `static async initWithEntryGroup(name: string, ctx: gcp.ApiContext): Promise<CatalogManifest>`
- **`CatalogManifest.initWithBigQuery`** — `static async initWithBigQuery(dataset: string, ctx: gcp.ApiContext): Promise<CatalogManifest>`
- **`CatalogManifest.initWithKnowledgeBase`** — `static async initWithKnowledgeBase(name: string, ctx: gcp.ApiContext): Promise<CatalogManifest>`
- **`CatalogManifest.load`** — `static async load(path: string, ctx: gcp.ApiContext): Promise<CatalogManifest>`
- **`CatalogManifest.save`** — `save(path: string): void`

## `toolbox/mdcode/src/libts/metadata.ts`
*source: toolbox/mdcode/src/libts/metadata.ts*

- **`Aspect`** — `interface Aspect`
  Defines metadata objects provided by the catalog snapshot
- **`Entry`** — `interface Entry`

## `toolbox/mdcode/src/libts/snapshot.ts`
*source: toolbox/mdcode/src/libts/snapshot.ts*

- **`CatalogSnapshot`** — `class CatalogSnapshot`
- **`CatalogSnapshot.constructor`** — `private constructor(basePath: string, manifest: CatalogManifest)`
- **`CatalogSnapshot.fromPath`** — `static async fromPath(basePath: string, ctx: gcp.ApiContext): Promise<CatalogSnapshot>`
- **`CatalogSnapshot.entryTypes`** — `get entryTypes(): Map<string, dataplex.EntryType>`
- **`CatalogSnapshot.aspectTypes`** — `get aspectTypes(): Map<string, dataplex.AspectType>`
- **`CatalogSnapshot.listEntries`** — `async listEntries(): Promise<string[]>`
- **`CatalogSnapshot.lookupEntry`** — `async lookupEntry(name: string): Promise<md.Entry>`
- **`CatalogSnapshot.updateEntry`** — `async updateEntry(entry: md.Entry, fields: string[]): Promise<void>`
- **`CatalogSnapshot.createEntry`** — `async createEntry(name: string, entry: md.Entry): Promise<void>`
- **`CatalogSnapshot.deleteEntry`** — `async deleteEntry(name: string): Promise<void>`

## `toolbox/mdcode/src/libts/source.ts`
*source: toolbox/mdcode/src/libts/source.ts*

- **`Sources`** — `enum Sources`
- **`CatalogSource`** — `interface CatalogSource`
- **`createSource`** — `async function createSource(type: string, name: string, ctx: gcp.ApiContext): Promise<CatalogSource>`

## `toolbox/mdcode/src/libts/sources/bq-dataset.ts`
*source: toolbox/mdcode/src/libts/sources/bq-dataset.ts*

- **`BigQueryDatasetSource`** — `class BigQueryDatasetSource implements CatalogSource`
- **`BigQueryDatasetSource.constructor`** — `constructor(type: string, name: string, datasets: Map<string, bq.Dataset>)`
- **`BigQueryDatasetSource.entries`** — `async *entries(ctx: gcp.ApiContext): AsyncGenerator<gcp.Entry, void, unknown>`
- **`BigQueryDatasetSource.localName`** — `localName(entry: gcp.Entry): string`
- **`BigQueryDatasetSource.serviceName`** — `serviceName(localName: string): string`

## `toolbox/mdcode/src/libts/sources/entrygroup.ts`
*source: toolbox/mdcode/src/libts/sources/entrygroup.ts*

- **`EntryGroupSource`** — `class EntryGroupSource implements CatalogSource`
- **`EntryGroupSource.constructor`** — `constructor(type: string, name: string, entryGroup: dataplex.EntryGroup)`
- **`EntryGroupSource.entries`** — `async *entries(ctx: gcp.ApiContext): AsyncGenerator<gcp.Entry, void, unknown>`
- **`EntryGroupSource.localName`** — `localName(entry: gcp.Entry): string`
- **`EntryGroupSource.serviceName`** — `serviceName(localName: string): string`

## `toolbox/mdcode/src/libts/sources/kb.ts`
*source: toolbox/mdcode/src/libts/sources/kb.ts*

- **`KnowledgeBaseSource`** — `class KnowledgeBaseSource implements CatalogSource`
- **`KnowledgeBaseSource.constructor`** — `constructor(type: string, name: string, entryGroup: dataplex.EntryGroup)`
- **`KnowledgeBaseSource.entries`** — `async *entries(ctx: gcp.ApiContext): AsyncGenerator<gcp.Entry, void, unknown>`
- **`KnowledgeBaseSource.localName`** — `localName(entry: gcp.Entry): string`
- **`KnowledgeBaseSource.serviceName`** — `serviceName(localName: string): string`

## `toolbox/mdcode/src/libts/sync.ts`
*source: toolbox/mdcode/src/libts/sync.ts*

- **`SyncResult`** — `interface SyncResult`
- **`ValidationResult`** — `interface ValidationResult`
- **`StatusResult`** — `interface StatusResult`
- **`CatalogSync`** — `class CatalogSync`
- **`CatalogSync.constructor`** — `constructor(catalog: gcp.CatalogClient, snapshot: CatalogSnapshot)`
- **`CatalogSync.pull`** — `async pull(): Promise<SyncResult>`
- **`CatalogSync.push`** — `async push(options?: { force?: boolean, validateOnly?: boolean; }): Promise<SyncResult>`
- **`CatalogSync.validate`** — `async validate(): Promise<ValidationResult>`
- **`CatalogSync.status`** — `async status(): Promise<StatusResult>`

## `toolbox/mdcode/src/tool/commands.ts`
*source: toolbox/mdcode/src/tool/commands.ts*

- **`InitOptions`** — `interface InitOptions`
- **`PushOptions`** — `interface PushOptions`
- **`init`** — `async function init(options: InitOptions): Promise<number>`
- **`pull`** — `async function pull(): Promise<number>`
- **`push`** — `async function push(options: PushOptions): Promise<number>`

## `toolbox/mdcode/src/tool/mcp.ts`
*source: toolbox/mdcode/src/tool/mcp.ts*

- **`startServer`** — `async function startServer(basePath: string = '.')`
