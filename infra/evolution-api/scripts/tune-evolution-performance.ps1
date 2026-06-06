# Ajusta settings Baileys + lista estado da instância (diagnóstico).
# Uso: .\infra\evolution-api\scripts\tune-evolution-performance.ps1 -InstanceName SUA_INSTANCIA

param(
  [string[]] $InstanceNames = @(),
  [string] $ApiKey = $env:WHATSAPP_EVOLUTION_API_KEY,
  [string] $BaseUrl = 'http://localhost:8080'
)

if (-not $ApiKey) {
  $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
  if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
      if ($_ -match '^\s*AUTHENTICATION_API_KEY=(.+)$') { $ApiKey = $Matches[1].Trim() }
    }
  }
}

if (-not $ApiKey) {
  Write-Error 'Informe -ApiKey ou AUTHENTICATION_API_KEY no .env da Evolution.'
}

$headers = @{ apikey = $ApiKey }

if ($InstanceNames.Count -eq 0) {
  $list = Invoke-RestMethod -Method Get -Uri "$BaseUrl/instance/fetchInstances" -Headers $headers
  $InstanceNames = @($list | ForEach-Object { $_.name })
}

$settingsBody = @{
  groupsIgnore = $false
  syncFullHistory = $false
  readMessages = $false
  readStatus = $false
  rejectCall = $false
  alwaysOnline = $true
  msgCall = ''
} | ConvertTo-Json -Compress

foreach ($name in $InstanceNames) {
  if (-not $name) { continue }
  Write-Host "`n=== $name ===" -ForegroundColor Cyan
  try {
    $state = Invoke-RestMethod -Method Get -Uri "$BaseUrl/instance/connectionState/$name" -Headers $headers
    Write-Host "connectionState: $($state.instance.state)"
  } catch {
    Write-Warning "connectionState: $($_.Exception.Message)"
  }

  Invoke-RestMethod -Method Post -Uri "$BaseUrl/settings/set/$name" -Headers $headers -Body $settingsBody -ContentType 'application/json' | Out-Null
  $check = Invoke-RestMethod -Method Get -Uri "$BaseUrl/settings/find/$name" -Headers $headers
  Write-Host "settings: syncFullHistory=$($check.syncFullHistory) readMessages=$($check.readMessages) alwaysOnline=$($check.alwaysOnline)"
}

Write-Host "`nDica: no .env da Evolution desative DATABASE_SAVE_DATA_NEW_MESSAGE e similares (ver env.example.txt)." -ForegroundColor Yellow
