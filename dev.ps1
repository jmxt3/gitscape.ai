# dev.ps1 — Launch GitScape backend + frontend for local development.
#
# Usage:
#   .\dev.ps1              # start both servers (clears ports first)
#   .\dev.ps1 -BackendOnly # backend only
#   .\dev.ps1 -FrontOnly   # frontend only
#
# Backend:  http://127.0.0.1:8081  (FastAPI / uvicorn, --reload)
# Frontend: http://localhost:5173   (Vite dev server, proxies /api → 8081)

param(
    [switch]$BackendOnly,
    [switch]$FrontOnly
)

$Root     = $PSScriptRoot
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Venv     = Join-Path $Backend ".venv\Scripts\Activate.ps1"

# ── port cleanup ─────────────────────────────────────────────────────────────

function Stop-Port {
    param([int]$Port)

    # netstat -ano lists  Proto  LocalAddr  ForeignAddr  State  PID
    $lines = netstat -ano 2>$null |
             Select-String "^\s+TCP\s+.*:$Port\s+.*LISTENING"

    if (-not $lines) {
        Write-Host "  port $Port  free" -ForegroundColor DarkGray
        return
    }

    $pids = $lines |
            ForEach-Object { ($_ -split '\s+')[-1] } |
            Sort-Object -Unique

    foreach ($portPid in $pids) {
        try {
            $proc = Get-Process -Id $portPid -ErrorAction Stop
            Write-Host "  port $Port  killing PID $portPid ($($proc.Name))" -ForegroundColor Yellow
            Stop-Process -Id $portPid -Force -ErrorAction Stop
        } catch {
            Write-Host "  port $Port  PID $portPid already gone" -ForegroundColor DarkGray
        }
    }

    # Brief wait so the OS releases the socket before the new server binds.
    Start-Sleep -Milliseconds 400
}

# ── pre-flight checks ────────────────────────────────────────────────────────

if (-not $FrontOnly) {
    if (-not (Test-Path $Venv)) {
        Write-Error "Backend venv not found at $Venv`nRun: cd backend && uv sync"
        exit 1
    }
}

if (-not $BackendOnly) {
    if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
        Write-Error "node_modules missing. Run: cd frontend && npm install"
        exit 1
    }
}

# ── clear ports ──────────────────────────────────────────────────────────────

Write-Host "Clearing ports..." -ForegroundColor DarkCyan
if (-not $FrontOnly)   { Stop-Port 8081 }
if (-not $BackendOnly) { Stop-Port 5173 }
Write-Host ""

# ── helpers ──────────────────────────────────────────────────────────────────

function Start-Pane {
    param([string]$Title, [string]$Command)
    Start-Process powershell -ArgumentList `
        "-NoExit", "-Command", `
        "`$Host.UI.RawUI.WindowTitle = '$Title'; $Command"
}

# ── launch ───────────────────────────────────────────────────────────────────

if (-not $FrontOnly) {
    $backendCmd = @"
cd '$Backend'
. '$Venv'
Write-Host '▶ ScapeGuard backend  →  http://127.0.0.1:8081' -ForegroundColor Cyan
Write-Host '  Docs: http://127.0.0.1:8081/docs' -ForegroundColor DarkCyan
python -m uvicorn main:app --host 127.0.0.1 --port 8081 --reload
"@
    Start-Pane -Title "GitScape — backend :8081" -Command $backendCmd
    Write-Host "✓ Backend window opened  (http://127.0.0.1:8081)" -ForegroundColor Green
}

if (-not $BackendOnly) {
    $frontCmd = @"
cd '$Frontend'
Write-Host '▶ GitScape frontend  →  http://localhost:5173' -ForegroundColor Magenta
npm run dev
"@
    Start-Pane -Title "GitScape — frontend :5173" -Command $frontCmd
    Write-Host "✓ Frontend window opened (http://localhost:5173)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Press any key to close this launcher window..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
