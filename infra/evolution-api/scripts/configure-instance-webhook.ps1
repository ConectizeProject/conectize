# Configura webhook da instancia para o Conectize (Docker no Windows).
# Uso: .\scripts\configure-instance-webhook.ps1 -InstanceName Victor

param(
  [Parameter(Mandatory = $true)]
  [string] $InstanceName,
  [string] $WebhookUrl = "http://host.docker.internal:3000/api/webhooks/whatsapp-evolution",
  [string] $ApiKey = $env:WHATSAPP_EVOLUTION_API_KEY,
  [string] $BaseUrl = "http://localhost:8080",
  [switch] $WebhookByEvents
)

if (-not $ApiKey) {
  $envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
  if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
      if ($_ -match "^\s*AUTHENTICATION_API_KEY=(.+)$") { $ApiKey = $Matches[1].Trim() }
    }
  }
}

if (-not $ApiKey) {
  Write-Error "Informe -ApiKey ou AUTHENTICATION_API_KEY no .env da Evolution."
}

$headers = @{ apikey = $ApiKey }

$inner = @{
  enabled = $true
  url = $WebhookUrl
  webhookByEvents = [bool]$WebhookByEvents
  webhookBase64 = $false
  events = @(
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "SEND_MESSAGE"
  )
}
$body = @{ webhook = $inner } | ConvertTo-Json -Compress -Depth 5

Write-Host "Webhook em $InstanceName -> $WebhookUrl (byEvents=$([bool]$WebhookByEvents))" -ForegroundColor Cyan
Invoke-RestMethod -Method Post -Uri "$BaseUrl/webhook/set/$InstanceName" -Headers $headers -Body $body -ContentType "application/json" | Out-Null

$check = Invoke-RestMethod -Method Get -Uri "$BaseUrl/webhook/find/$InstanceName" -Headers $headers
Write-Host "enabled=$($check.enabled) url=$($check.url)" -ForegroundColor Green
Write-Host "events=$($check.events -join ', ')"
if ($check.url -match "localhost:3000") {
  Write-Warning "URL ainda usa localhost:3000 - dentro do Docker isso NAO chega no Next.js. Use host.docker.internal."
}
