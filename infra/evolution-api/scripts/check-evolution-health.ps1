# Diagnostico rapido: Docker, volumes, Postgres local, Redis, instancias WhatsApp.
#
# Uso em infra/evolution-api:
#   .\scripts\check-evolution-health.ps1
#
# Da raiz do repo Conectize:
#   .\infra\evolution-api\scripts\check-evolution-health.ps1
#
# Nao rode "cd infra\evolution-api" se o prompt ja estiver nessa pasta.

param(
  [string] $ApiKey = $env:WHATSAPP_EVOLUTION_API_KEY,
  [string] $BaseUrl = 'http://localhost:8080'
)

$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root '.env'

Write-Host ''
Write-Host "Evolution API - diagnostico"
Write-Host $root
Write-Host ''

function Test-Line($msg, $ok) {
  $color = if ($ok) { 'Green' } else { 'Red' }
  $icon = if ($ok) { '[OK]' } else { '[!!]' }
  Write-Host "$icon $msg" -ForegroundColor $color
}

Write-Host '=== Docker ===' -ForegroundColor Cyan
try {
  $composeBase = Join-Path $root 'docker-compose.yml'
  $composePg = Join-Path $root 'docker-compose.postgres.yml'
  $json = docker compose -f $composeBase -f $composePg ps --format json 2>$null
  if (-not $json) {
    $json = docker compose -f $composeBase ps --format json 2>$null
  }
  $ps = @($json | ConvertFrom-Json)
  foreach ($s in $ps) {
    Test-Line "$($s.Service): $($s.State)" ($s.State -eq 'running')
  }
} catch {
  Test-Line 'docker compose ps falhou - Docker Desktop aberto?' $false
}

Write-Host ''
Write-Host '=== Volumes (sessao WhatsApp) ===' -ForegroundColor Cyan
foreach ($vol in @('evolution_instances', 'evolution_store', 'evolution_pg_data')) {
  $exists = (docker volume ls -q --filter "name=$vol" 2>$null) -match $vol
  Test-Line "volume $vol" ([bool]$exists)
}

Write-Host ''
Write-Host '=== .env database ===' -ForegroundColor Cyan
if (Test-Path $envFile) {
  $provider = Select-String -Path $envFile -Pattern '^\s*DATABASE_PROVIDER=(.+)$' | Select-Object -First 1
  $uri = Select-String -Path $envFile -Pattern '^\s*DATABASE_CONNECTION_URI=(.+)$' | Select-Object -First 1
  $isLocal = $uri -and $uri.Line -match 'postgres-evolution'
  Test-Line "DATABASE_PROVIDER=$($provider.Matches.Groups[1].Value)" ($provider -and $provider.Line -notmatch 'psql_bouncer')
  Test-Line 'URI aponta para postgres-evolution (local)' $isLocal
  $saveMsg = Select-String -Path $envFile -Pattern '^\s*DATABASE_SAVE_DATA_NEW_MESSAGE=(.+)$' | Select-Object -First 1
  if ($saveMsg) {
    Test-Line "DATABASE_SAVE_DATA_NEW_MESSAGE=$($saveMsg.Matches.Groups[1].Value)" ($saveMsg.Line -match 'false')
  }
} else {
  Test-Line 'arquivo .env nao encontrado' $false
}

if (-not $ApiKey -and (Test-Path $envFile)) {
  $m = Select-String -Path $envFile -Pattern '^\s*AUTHENTICATION_API_KEY=(.+)$' | Select-Object -First 1
  if ($m) { $ApiKey = $m.Matches.Groups[1].Value.Trim() }
}

Write-Host ''
Write-Host '=== API HTTP ===' -ForegroundColor Cyan
try {
  $h = Invoke-RestMethod -Uri "$BaseUrl/" -TimeoutSec 8
  Test-Line "GET / -> $($h.message)" ($h.status -eq 200)
} catch {
  Test-Line "Evolution nao responde em $BaseUrl" $false
}

if ($ApiKey) {
  Write-Host ''
  Write-Host '=== Instancias ===' -ForegroundColor Cyan
  $headers = @{ apikey = $ApiKey }
  try {
    $list = Invoke-RestMethod -Method Get -Uri "$BaseUrl/instance/fetchInstances" -Headers $headers
    foreach ($inst in @($list)) {
      $name = $inst.name
      try {
        $st = Invoke-RestMethod -Method Get -Uri "$BaseUrl/instance/connectionState/$name" -Headers $headers
        $state = $st.instance.state
        Test-Line "$name -> $state" ($state -eq 'open')
      } catch {
        Test-Line "$name -> erro ao ler estado" $false
      }
    }
    if (-not $list -or @($list).Count -eq 0) {
      Write-Host 'Nenhuma instancia no banco - crie no manager ou reconecte QR.' -ForegroundColor Yellow
    }
  } catch {
    Test-Line 'fetchInstances falhou (apikey errada?)' $false
  }
} else {
  Write-Host 'Pule instancias: defina AUTHENTICATION_API_KEY no arquivo .env' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '=== Windows (manual) ===' -ForegroundColor Cyan
Write-Host '  Docker Desktop: iniciar com o Windows'
Write-Host '  Energia: Suspender = Nunca no plano ativo'
Write-Host '  WSL2: docker info deve listar Server Version'
Write-Host '  Webhook: npm run dev ou app em producao com WhatsApp ativo'
Write-Host ''
Write-Host 'Logs (copie e cole no terminal):'
Write-Host '  docker compose -f docker-compose.yml -f docker-compose.postgres.yml logs --tail 50 evolution-api'
Write-Host ''
