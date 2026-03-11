<#
.SYNOPSIS
    Docker installer for Maintenance Manager.
.DESCRIPTION
    Deploys Maintenance Manager into Docker with zero prerequisites beyond Docker itself.
    Polished terminal UI with colored output, progress indicators, and step-by-step feedback.
.PARAMETER Uninstall
    Remove the container, image, and volume with confirmation.
.EXAMPLE
    .\install.ps1
.EXAMPLE
    .\install.ps1 -Uninstall
.EXAMPLE
    irm https://raw.githubusercontent.com/Antonin-Bohac/MaitenanceManager/master/install.ps1 | iex
#>

param(
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$ContainerName = "maintenance-manager"
$ImageName     = "maintenance-manager"
$VolumeName    = "maintenance-manager-data"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Step {
    param(
        [string]$Step,
        [string]$Message
    )
    Write-Host ""
    Write-Host "  [$Step] " -ForegroundColor Cyan -NoNewline
    Write-Host $Message -ForegroundColor White
}

function Write-Success {
    param([string]$Message)
    Write-Host "       [OK] " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Info {
    param([string]$Message)
    Write-Host "       $Message" -ForegroundColor DarkGray
}

function Write-Err {
    param([string]$Message)
    Write-Host "       [ERROR] " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

function Write-Warn {
    param([string]$Message)
    Write-Host "       [WARN] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Show-Banner {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║                                          ║" -ForegroundColor Cyan
    Write-Host "  ║   " -ForegroundColor Cyan -NoNewline
    Write-Host "Maintenance Manager Installer" -ForegroundColor White -NoNewline
    Write-Host "       ║" -ForegroundColor Cyan
    Write-Host "  ║                                          ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Test-PortFree {
    param([int]$Port)
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    } catch {
        return $false
    }
}

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------

if ($Uninstall) {
    Show-Banner

    Write-Host "  The following Docker resources will be removed:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "    Container : $ContainerName" -ForegroundColor White
    Write-Host "    Image     : $ImageName" -ForegroundColor White
    Write-Host "    Volume    : $VolumeName " -ForegroundColor White -NoNewline
    Write-Host "(all app data will be deleted)" -ForegroundColor Red
    Write-Host ""

    $confirm = Read-Host "  Type 'yes' to confirm"
    if ($confirm -ne "yes") {
        Write-Host ""
        Write-Host "  Cancelled." -ForegroundColor Yellow
        Write-Host ""
        exit 0
    }

    Write-Host ""

    # Stop and remove container
    $running = docker ps -aq --filter "name=^${ContainerName}$" 2>$null
    if ($running) {
        Write-Info "Stopping container..."
        docker stop $ContainerName 2>$null | Out-Null
        docker rm $ContainerName 2>$null | Out-Null
        Write-Success "Container removed."
    } else {
        Write-Info "Container not found, skipping."
    }

    # Remove image
    $img = docker images -q $ImageName 2>$null
    if ($img) {
        docker rmi $ImageName 2>$null | Out-Null
        Write-Success "Image removed."
    } else {
        Write-Info "Image not found, skipping."
    }

    # Remove volume
    $vol = docker volume ls -q --filter "name=^${VolumeName}$" 2>$null
    if ($vol) {
        docker volume rm $VolumeName 2>$null | Out-Null
        Write-Success "Volume removed."
    } else {
        Write-Info "Volume not found, skipping."
    }

    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "  ║   Maintenance Manager uninstalled.       ║" -ForegroundColor Green
    Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    exit 0
}

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------

Show-Banner

$totalSteps = 6

# ── Step 1: Docker Check ──────────────────────────────────────────────────

Write-Step "1/$totalSteps" "Checking Docker..."

$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Err "Docker is not installed."
    Write-Host ""
    Write-Host "       Install Docker Desktop for Windows:" -ForegroundColor Yellow
    Write-Host "       https://docs.docker.com/desktop/install/windows-install/" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

try {
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "daemon not running" }
} catch {
    Write-Err "Docker daemon is not running."
    Write-Host "       Please start Docker Desktop and try again." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$dockerVersion = (docker version --format "{{.Server.Version}}" 2>$null)
Write-Success "Docker $dockerVersion detected."

# ── Step 2: Port Selection ────────────────────────────────────────────────

Write-Step "2/$totalSteps" "Finding available port..."

$port = 8000
while ($port -lt 9000) {
    if (Test-PortFree -Port $port) { break }
    $port++
}

if ($port -ge 9000) {
    Write-Err "No free port found in range 8000-8999."
    exit 1
}

Write-Success "Port $port is available."

# ── Step 3: Prepare Build Context ─────────────────────────────────────────

Write-Step "3/$totalSteps" "Preparing build context..."

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "maintenance-manager-build-$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Write Dockerfile
$dockerfile = @"
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git && \
    git clone -b master --single-branch https://github.com/Antonin-Bohac/MaitenanceManager.git /tmp/repo && \
    cp -r /tmp/repo/app /app/app && \
    cp /tmp/repo/requirements.txt /app/ && \
    cp -r /tmp/repo/seed /app/seed && \
    apt-get remove -y git && apt-get autoremove -y && \
    rm -rf /tmp/repo /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r requirements.txt

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV DATA_DIR=/app/data

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
"@
Set-Content -Path (Join-Path $tempDir "Dockerfile") -Value $dockerfile -NoNewline

# Write entrypoint.sh (Linux line endings)
$entrypoint = "#!/bin/bash`nif [ ! -f /app/data/maintenance.db ]; then`n    mkdir -p /app/data`n    cp /app/seed/maintenance.db /app/data/maintenance.db`n    echo `"Seed database loaded.`"`nfi`npython -m app.migrate`nexec uvicorn app.main:app --host 0.0.0.0 --port 8000`n"
# Ensure LF line endings for the bash script inside the Linux container
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $tempDir "entrypoint.sh"), $entrypoint.Replace("`r`n", "`n"), $utf8NoBom)

Write-Success "Dockerfile and entrypoint written."

# ── Step 4: Build Image ──────────────────────────────────────────────────

Write-Step "4/$totalSteps" "Building Docker image (this may take a minute)..."

Write-Host ""

# Remove old container if exists so rebuild is clean
$existing = docker ps -aq --filter "name=^${ContainerName}$" 2>$null
if ($existing) {
    Write-Info "Removing existing container..."
    docker stop $ContainerName 2>$null | Out-Null
    docker rm $ContainerName 2>$null | Out-Null
}

$buildArgs = @("build", "--no-cache", "-t", $ImageName, $tempDir)
$buildProc = Start-Process -FilePath "docker" -ArgumentList $buildArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput (Join-Path $tempDir "build.log") -RedirectStandardError (Join-Path $tempDir "build.err")

# Clean up temp dir
$buildExitCode = $buildProc.ExitCode
if ($buildExitCode -ne 0) {
    $buildErr = Get-Content (Join-Path $tempDir "build.err") -Raw -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    Write-Err "Docker build failed (exit code $buildExitCode)."
    if ($buildErr) { Write-Host "       $buildErr" -ForegroundColor Red }
    exit 1
}

Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue

Write-Success "Image '$ImageName' built successfully."

# ── Step 5: Start Container ──────────────────────────────────────────────

Write-Step "5/$totalSteps" "Starting container..."

# Create volume if needed
docker volume create $VolumeName 2>$null | Out-Null

docker run -d `
    --name $ContainerName `
    -p "${port}:8000" `
    -v "${VolumeName}:/app/data" `
    --restart unless-stopped `
    $ImageName | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to start container."
    exit 1
}

Write-Success "Container '$ContainerName' started on port $port."

# ── Step 6: Health Check ─────────────────────────────────────────────────

Write-Step "6/$totalSteps" "Waiting for application to be ready..."

$maxAttempts = 30
$attempt = 0
$healthy = $false
$spinChars = @('|', '/', '-', '\')

while ($attempt -lt $maxAttempts) {
    $spinChar = $spinChars[$attempt % $spinChars.Length]
    Write-Host "`r       $spinChar Checking... ($attempt/$maxAttempts)" -NoNewline

    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$port/" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {
        # not ready yet
    }

    Start-Sleep -Seconds 2
    $attempt++
}

Write-Host "`r                                          `r" -NoNewline

if ($healthy) {
    Write-Success "Application is healthy!"
} else {
    Write-Warn "Health check timed out. The app may still be starting."
    Write-Info "Check logs: docker logs $ContainerName"
}

# ── Completion Summary ────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║   Maintenance Manager is running!        ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  URL: " -ForegroundColor White -NoNewline
Write-Host "http://localhost:$port" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ── Management Commands ──────────────────" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Stop:      " -ForegroundColor White -NoNewline
Write-Host "docker stop $ContainerName" -ForegroundColor Yellow
Write-Host "  Start:     " -ForegroundColor White -NoNewline
Write-Host "docker start $ContainerName" -ForegroundColor Yellow
Write-Host "  Restart:   " -ForegroundColor White -NoNewline
Write-Host "docker restart $ContainerName" -ForegroundColor Yellow
Write-Host "  Logs:      " -ForegroundColor White -NoNewline
Write-Host "docker logs -f $ContainerName" -ForegroundColor Yellow
Write-Host "  Uninstall: " -ForegroundColor White -NoNewline
Write-Host ".\install.ps1 -Uninstall" -ForegroundColor Yellow
Write-Host ""
