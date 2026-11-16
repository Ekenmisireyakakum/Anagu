<#
.SYNOPSIS
  ANAGU Platform - Windows Setup Script
.DESCRIPTION
  Checks prerequisites, creates .env from .env.example if needed,
  starts infrastructure services (postgres, redis, minio, mosquitto),
  and waits for PostgreSQL to be healthy.
#>

$ErrorActionPreference = "Stop"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " ANAGU Land Administration Platform - Setup" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------
# 1. Check Docker is available and running
# ------------------------------------------------------------------
Write-Host "[1/5] Checking Docker..." -ForegroundColor Yellow
try {
  $dockerVersion = docker --version 2>&1
  Write-Host "  Found: $dockerVersion" -ForegroundColor Green
} catch {
  Write-Error "Docker is not installed or not in PATH. Install Docker Desktop from https://www.docker.com/products/docker-desktop"
  exit 1
}

try {
  docker info 2>&1 | Out-Null
  Write-Host "  Docker daemon is running." -ForegroundColor Green
} catch {
  Write-Error "Docker daemon is not running. Please start Docker Desktop."
  exit 1
}

# ------------------------------------------------------------------
# 2. Create .env from .env.example if it does not exist
# ------------------------------------------------------------------
Write-Host "[2/5] Checking .env file..." -ForegroundColor Yellow
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir    = Split-Path -Parent $scriptDir
$envFile    = Join-Path $rootDir ".env"
$envExample = Join-Path $rootDir ".env.example"

if (-not (Test-Path $envFile)) {
  if (Test-Path $envExample) {
    Copy-Item $envExample $envFile
    Write-Host "  Created .env from .env.example." -ForegroundColor Green
    Write-Host "  ** Please review $envFile and update secrets before continuing. **" -ForegroundColor Magenta
  } else {
    Write-Error ".env.example not found at $envExample"
    exit 1
  }
} else {
  Write-Host "  .env already exists, skipping." -ForegroundColor Green
}

# ------------------------------------------------------------------
# 3. Start infrastructure services only (not Besu or app services)
# ------------------------------------------------------------------
Write-Host "[3/5] Starting infrastructure services (postgres, redis, minio, mosquitto)..." -ForegroundColor Yellow
Set-Location $rootDir
docker compose up -d postgres redis minio mosquitto
if ($LASTEXITCODE -ne 0) {
  Write-Error "docker compose up failed. Check Docker and docker-compose.yml."
  exit 1
}
Write-Host "  Services started." -ForegroundColor Green

# ------------------------------------------------------------------
# 4. Wait for PostgreSQL to be healthy
# ------------------------------------------------------------------
Write-Host "[4/5] Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt     = 0
$healthy     = $false
do {
  Start-Sleep -Seconds 2
  $attempt++
  $status  = docker compose ps postgres --format json 2>&1
  $healthy = ($status | Select-String -Pattern '"Health":"healthy"' -Quiet)
  if ($healthy) {
    Write-Host "  PostgreSQL is healthy." -ForegroundColor Green
    break
  }
  Write-Host "  Waiting... (attempt $attempt/$maxAttempts)" -ForegroundColor Gray
} while ($attempt -lt $maxAttempts)

if (-not $healthy) {
  Write-Warning "PostgreSQL did not become healthy within the timeout. Check: docker compose logs postgres"
}

# ------------------------------------------------------------------
# 5. Print service status
# ------------------------------------------------------------------
Write-Host "[5/5] Service status:" -ForegroundColor Yellow
docker compose ps postgres redis minio mosquitto

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " Infrastructure ready!" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Review and update .env with real secrets" -ForegroundColor White
Write-Host "  2. Install dependencies: npm install" -ForegroundColor White
Write-Host "  3. Run DB migrations: cd packages/database; npx prisma migrate dev" -ForegroundColor White
Write-Host "  4. Start API: npm run dev:api" -ForegroundColor White
Write-Host "  5. Start Web: npm run dev:web" -ForegroundColor White
Write-Host ""
