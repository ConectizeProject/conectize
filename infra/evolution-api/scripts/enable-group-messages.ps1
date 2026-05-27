# Ativa recebimento de mensagens de GRUPO na Evolution (obrigatório para relay /pix).
# Uso: .\scripts\enable-group-messages.ps1 -InstanceName Victor

param(
  [string] $InstanceName = 'Victor',
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

$body = @{
  groupsIgnore = $false
  syncFullHistory = $false
  readMessages = $false
  readStatus = $false
  rejectCall = $false
  alwaysOnline = $true
  msgCall = ''
} | ConvertTo-Json -Compress

$headers = @{ apikey = $ApiKey }

Write-Host "Ajustando settings de $InstanceName ..."
$res = Invoke-RestMethod -Method Post -Uri "$BaseUrl/settings/set/$InstanceName" -Headers $headers -Body $body -ContentType 'application/json'
$check = Invoke-RestMethod -Method Get -Uri "$BaseUrl/settings/find/$InstanceName" -Headers $headers

if ($check.groupsIgnore -eq $false) {
  Write-Host 'OK: groupsIgnore=false — mensagens de grupo passam a ser recebidas.'
} else {
  Write-Warning "groupsIgnore ainda está $($check.groupsIgnore). Verifique no manager."
}

$res | ConvertTo-Json -Depth 5
