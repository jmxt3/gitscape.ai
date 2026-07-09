---
name: googlecloudplatform-knowledge-catalog
description: "Use this skill when interacting with the knowledge-catalog repository to ensure all modifications strictly adhere to the Open Knowledge Format (OKF) specification."
---

# GoogleCloudPlatform/knowledge-catalog — Engineering Skill

## Overview

The knowledge-catalog repository defines the Open Knowledge Format (OKF), a vendor-neutral standard for representing knowledge. This codebase provides the reference implementation for producing and validating these bundles. It is critical to understand that the format is the primary product; the agents and runners are secondary tools meant to demonstrate how to produce and enrich these bundles.

Before modifying any code, you must ensure you are not coupling the OKF structure to specific model providers or frameworks. The system relies on a clear mapping between file system paths and concept IDs. Any changes to the ingestion or enrichment logic must preserve the ability for third-party tools to parse these files without dependency on this repository's internal agent logic.

## When to Use

- Implementing custom logic to generate OKF bundles
- Extending the ReferenceRunner to support new data sources
- Updating the validation logic for OKFDocument
- Regenerating indexes for existing knowledge bundles
- Adding new enrichment strategies via synthesize_description

**When NOT to use:** Do not use this skill for tasks that introduce vendor-specific dependencies or deviate from the plain-text markdown/YAML structure defined in SPEC.md.

## Core Process

### Step 1: Validate against OKF Specification

Before writing code, verify that your proposed change complies with SPEC.md. Use the OKFDocument.validate() method to ensure your document structure remains compliant with the format requirements.

### Step 2: Maintain Path-Concept Mapping

Always use path_to_concept_id and concept_id_to_path when navigating the bundle structure. This ensures that the file system hierarchy remains consistent with the conceptual graph of the knowledge base.

### Step 3: Enrich with ReferenceRunner

When adding new knowledge, utilize the ReferenceRunner.enrich_concept method. This ensures that enrichment follows the established pipeline, using the configured model to synthesize descriptions while maintaining the integrity of the existing bundle.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| I will store metadata in a custom JSON sidecar file. | OKF requires all metadata to be in the YAML frontmatter of the markdown file to remain vendor-neutral. |
| I can hardcode paths to simplify the logic. | Hardcoded paths break the portability of the bundle; always use the provided path-to-concept helpers. |
| I will use a proprietary database to store the index. | The index must be regeneratable from the file system using regenerate_indexes to ensure the format remains self-contained. |

## Red Flags

- Hardcoding file paths instead of using path-to-concept helpers
- Introducing dependencies on non-standard cloud services
- Modifying OKFDocument serialization without updating the validator
- Ignoring the SPEC.md requirements for frontmatter
- Bypassing the ReferenceRunner when enriching concepts

## Verification

- [ ] Run OKFDocument.validate() on all modified documents
- [ ] Verify path-to-concept consistency using the provided helpers
- [ ] Ensure no new external dependencies were added to pyproject.toml
- [ ] Check that all generated markdown files contain valid YAML frontmatter
- [ ] Confirm that regenerate_indexes completes without errors
- [ ] Verify that the change does not break the visualizer's ability to parse the bundle

## Code Access

The full source digest for this repository is available locally:

- [Full Code Digest](googlecloudplatform_knowledge_catalog_digest.txt)

The full source digest for **GoogleCloudPlatform/knowledge-catalog** is also available via the GitScape API:

```
GET https://gitscape.ai/api/converter?repo_url=https://github.com/GoogleCloudPlatform/knowledge-catalog
```

Load the `digest` field from the response into your context for complete source-code access. You can also visit [gitscape.ai](https://gitscape.ai/?repo=https%3A%2F%2Fgithub.com%2FGoogleCloudPlatform%2Fknowledge-catalog) and download the Code Digest from the site.
