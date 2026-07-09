# Architecture

## Directory structure

```
├── okf/
│   ├── bundles/
│   ├── samples/
│   ├── src/
│   └── tests/
├── samples/
│   ├── discovery/
│   └── enrichment/
└── toolbox/
    ├── enrichment/
    └── mdcode/
```

## Modules

- `okf/src/reference_agent/agent.py` — 2 public symbols
- `okf/src/reference_agent/bundle/document.py` — 5 public symbols
- `okf/src/reference_agent/bundle/index.py` — 1 public symbols
- `okf/src/reference_agent/bundle/paths.py` — 3 public symbols
- `okf/src/reference_agent/bundle/synthesizer.py` — 1 public symbols
- `okf/src/reference_agent/cli.py` — 1 public symbols
- `okf/src/reference_agent/runner.py` — 5 public symbols
- `okf/src/reference_agent/sources/base.py` — 7 public symbols
- `okf/src/reference_agent/sources/bigquery.py` — 5 public symbols
- `okf/src/reference_agent/tools/bundle_tools.py` — 2 public symbols
- `okf/src/reference_agent/tools/context.py` — 8 public symbols
- `okf/src/reference_agent/tools/source_tools.py` — 3 public symbols
- `okf/src/reference_agent/tools/web_tools.py` — 1 public symbols
- `okf/src/reference_agent/viewer/generator.py` — 3 public symbols
- `okf/src/reference_agent/web/fetcher.py` — 3 public symbols
- `samples/discovery/agent.py` — 1 public symbols
- `samples/discovery/tools.py` — 1 public symbols
- `samples/discovery/utils.py` — 1 public symbols
- `samples/enrichment/sample/data/create_data.py` — 3 public symbols
- `samples/enrichment/src/enrichment/documentation/agent.py` — 2 public symbols
- `samples/enrichment/src/enrichment/documentation/sources.py` — 1 public symbols
- `samples/enrichment/src/enrichment/download.py` — 1 public symbols
- `samples/enrichment/src/enrichment/enrich.py` — 1 public symbols
- `samples/enrichment/src/enrichment/metadata/catalog.py` — 1 public symbols
- `samples/enrichment/src/enrichment/metadata/snapshot.py` — 5 public symbols
- `samples/enrichment/src/enrichment/publish.py` — 1 public symbols
- `samples/enrichment/src/enrichment/util/markdown.py` — 1 public symbols
- `samples/enrichment/src/tools/fileskb/main.py` — 3 public symbols
- `toolbox/enrichment/src/agent/enrich/agent.ts` — 1 public symbols
- `toolbox/enrichment/src/agent/enrich/command.ts` — 2 public symbols
- `toolbox/enrichment/src/agent/tools.ts` — 2 public symbols
- `toolbox/enrichment/src/tools/md/fileset.ts` — 8 public symbols
- `toolbox/enrichment/src/tools/md/server.ts` — 1 public symbols
- `toolbox/mdcode/src/libts/gcp/api.ts` — 4 public symbols
- `toolbox/mdcode/src/libts/gcp/bigquery.ts` — 6 public symbols
- `toolbox/mdcode/src/libts/gcp/context.ts` — 6 public symbols
- `toolbox/mdcode/src/libts/gcp/crm.ts` — 5 public symbols
- `toolbox/mdcode/src/libts/gcp/dataplex.ts` — 20 public symbols
- `toolbox/mdcode/src/libts/layout.ts` — 3 public symbols
- `toolbox/mdcode/src/libts/layouts/documents.ts` — 10 public symbols
- `toolbox/mdcode/src/libts/layouts/standard.ts` — 8 public symbols
- `toolbox/mdcode/src/libts/manifest.ts` — 10 public symbols
- `toolbox/mdcode/src/libts/metadata.ts` — 2 public symbols
- `toolbox/mdcode/src/libts/snapshot.ts` — 10 public symbols
- `toolbox/mdcode/src/libts/source.ts` — 3 public symbols
- `toolbox/mdcode/src/libts/sources/bq-dataset.ts` — 5 public symbols
- `toolbox/mdcode/src/libts/sources/entrygroup.ts` — 5 public symbols
- `toolbox/mdcode/src/libts/sources/kb.ts` — 5 public symbols
- `toolbox/mdcode/src/libts/sync.ts` — 9 public symbols
- `toolbox/mdcode/src/tool/commands.ts` — 5 public symbols
- `toolbox/mdcode/src/tool/mcp.ts` — 1 public symbols

## External dependencies

- `google-adk` *(declared in samples/discovery/requirements.txt)*
- `google-cloud-dataplex` *(declared in samples/discovery/requirements.txt)*
- `google-api-core` *(declared in samples/discovery/requirements.txt)*
- `google-auth` *(declared in samples/enrichment/src/requirements.txt)*
- `google-cloud-bigquery` *(declared in samples/enrichment/src/requirements.txt)*
- `mcp` *(declared in samples/enrichment/src/requirements.txt)*
- `pyyaml` *(declared in samples/enrichment/src/requirements.txt)*

## Internal imports

- `samples/discovery/agent.py` → `.`, `.utils`
- `samples/discovery/tools.py` → `.utils`
- `samples/enrichment/src/enrichment/documentation/agent.py` → `.sources`
- `toolbox/enrichment/src/agent/enrich/command.ts` → `./agent.js`, `../tools`
- `toolbox/enrichment/src/agent/main.ts` → `./enrich/command.js`
- `toolbox/enrichment/src/tools/md/main.ts` → `./fileset`, `./server`
- `toolbox/enrichment/src/tools/md/server.ts` → `./fileset`
- `toolbox/mdcode/src/libts/gcp/api.ts` → `./context`
- `toolbox/mdcode/src/libts/gcp/bigquery.ts` → `./api`, `./context`
- `toolbox/mdcode/src/libts/gcp/crm.ts` → `./api`, `./context`
- `toolbox/mdcode/src/libts/gcp/dataplex.ts` → `./api`, `./context`, `./crm`
- `toolbox/mdcode/src/libts/layout.ts` → `./metadata`, `./layouts/standard`, `./layouts/documents`
- `toolbox/mdcode/src/libts/layouts/documents.ts` → `../metadata`, `../layout`
- `toolbox/mdcode/src/libts/layouts/standard.ts` → `../layout`, `../metadata`
- `toolbox/mdcode/src/libts/manifest.ts` → `./gcp`, `./source`
- `toolbox/mdcode/src/libts/snapshot.ts` → `./gcp/context`, `./gcp/dataplex`, `./metadata`, `./manifest`, `./layout`
- `toolbox/mdcode/src/libts/source.ts` → `./gcp`, `./gcp/bigquery`, `./gcp/dataplex`, `./layout`, `./sources/entrygroup`, `./sources/bq-dataset`, `./sources/kb`
- `toolbox/mdcode/src/libts/sources/bq-dataset.ts` → `../gcp`, `../gcp/bigquery`, `../layout`, `../source`
- `toolbox/mdcode/src/libts/sources/entrygroup.ts` → `../gcp`, `../gcp/dataplex`, `../layout`, `../source`
- `toolbox/mdcode/src/libts/sources/kb.ts` → `../gcp`, `../gcp/dataplex`, `../layout`, `../source`
- `toolbox/mdcode/src/libts/sync.ts` → `./gcp`, `./snapshot`
- `toolbox/mdcode/src/tool/commands.ts` → `../libts`, `../libts/gcp/dataplex`, `../libts/gcp/context`
- `toolbox/mdcode/src/tool/main.ts` → `./commands`, `./mcp`
- `toolbox/mdcode/src/tool/mcp.ts` → `../libts`, `../libts/gcp`
- `toolbox/mdcode/tests/libts/mocks.ts` → `../../src/libts/gcp`, `../../src/libts/gcp/bigquery`
- `toolbox/mdcode/tests/libts/scenarios.ts` → `../../src/libts`, `../../src/libts/gcp`, `../../src/libts/gcp/bigquery`, `./mocks`
