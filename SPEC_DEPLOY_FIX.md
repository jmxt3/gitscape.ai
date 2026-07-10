# Spec: Fix Cloud Build Artifact Registry Push Failures (502 Bad Gateway)

## Objective
Resolve the Docker push failures (HTTP 502 Bad Gateway) in Cloud Build by replacing the unreliable `docker push --all-tags` command with explicit single-tag pushes.

## Problem Context
During the GitScape unified Cloud Build deployment, the `push-web` step failed with:
```
Step #3 - "push-web": received unexpected HTTP status: 502 Bad Gateway
```
This error commonly happens in Google Artifact Registry when multiple tags pointing to the same image layers are pushed in parallel or in rapid succession via `docker push --all-tags`, causing temporary server-side conflicts or resource limits.

## Proposed Changes
1. Modify the manual push steps in:
   - [cloudbuild.yaml](file:///c:/Users/jmach/dev/GitScape/cloudbuild.yaml)
   - [frontend/cloudbuild.yaml](file:///c:/Users/jmach/dev/GitScape/frontend/cloudbuild.yaml)
   - [backend/cloudbuild.yaml](file:///c:/Users/jmach/dev/GitScape/backend/cloudbuild.yaml)
2. In each of these files, replace `docker push --all-tags <repo_path>` with a specific push of the tag needed for deployment (`:$_IMAGE_TAG`).
3. Retain the `images` block at the bottom of the files, which ensures that Cloud Build still registers and pushes both the specific tag and `latest` tag in post-build artifact collection.

## Verification
- Run a new Cloud Build using `.\deploy.ps1` and verify that the steps build, push, patch, and deploy successfully without hitting 502 Bad Gateway errors.
