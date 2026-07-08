# deploy.ps1
# Submits the unified Cloud Build pipeline from the repository root.
# Both the API (FastAPI sidecar) and Web (nginx ingress) images are built in parallel,
# then deployed as a single Cloud Run multi-container service named 'gitscape'.
#
# Usage:
#   .\deploy.ps1                        — full build + deploy
#   .\deploy.ps1 -ImageTag $COMMIT_SHA  — deploy a specific image tag

param (
    [string]$ImageTag = "latest"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GitScape — Multi-Container Deploy"     -ForegroundColor Cyan
Write-Host "  Image tag: $ImageTag"                   -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Push-Location $ScriptDir
try {
    gcloud beta builds submit `
        --config cloudbuild.yaml `
        --substitutions "_IMAGE_TAG=$ImageTag" `
        .

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Cloud Build failed (exit code $LASTEXITCODE)" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployed successfully!"                 -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
