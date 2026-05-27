# Sobe Evolution + Redis + Postgres local (schema evolution_api criado pelo Prisma na 1ª subida).
# Uso em infra/evolution-api: .\scripts\up-with-local-postgres.ps1
# Da raiz do repo: .\infra\evolution-api\scripts\up-with-local-postgres.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$envFile = Join-Path $root '.env'
if (-not (Test-Path $envFile)) {
  Write-Error "Crie .env a partir de env.example.txt em $root"
}

& (Join-Path $PSScriptRoot 'apply-local-postgres-env.ps1')

Write-Host "`nSubindo containers..." -ForegroundColor Cyan
docker compose -f docker-compose.yml -f docker-compose.postgres.yml --env-file .env up -d

Write-Host "`nAguardando Postgres + Evolution (ate ~90s)..." -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds(90)
$ready = $false
while ((Get-Date) -lt $deadline) {
  try {
    $h = Invoke-RestMethod -Uri 'http://localhost:8080/' -TimeoutSec 5
    if ($h.status -eq 200) { $ready = $true; break }
  } catch { }
  Start-Sleep -Seconds 3
}

if ($ready) {
  Write-Host "Evolution OK: $($h.message) (versao $($h.version))" -ForegroundColor Green
} else {
  Write-Warning 'API ainda nao respondeu — veja: docker compose -f docker-compose.yml -f docker-compose.postgres.yml logs -f evolution-api'
}

Write-Host "`nProximo: .\scripts\check-evolution-health.ps1" -ForegroundColor Yellow
