# Ajusta .env para Postgres local + saves leves (nao altera AUTHENTICATION_API_KEY).
param(
  [string] $EnvPath = (Join-Path (Split-Path $PSScriptRoot -Parent) '.env')
)

if (-not (Test-Path $EnvPath)) {
  Write-Error "Arquivo nao encontrado: $EnvPath"
}

$backup = "$EnvPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $EnvPath $backup
Write-Host "Backup: $backup"

$lines = Get-Content $EnvPath
$out = New-Object System.Collections.Generic.List[string]
$inDbBlock = $false
$skipUntilBlank = $false

$localDb = @(
  'DATABASE_ENABLED=true',
  'DATABASE_PROVIDER=postgresql',
  'DATABASE_CONNECTION_URI=postgresql://evolution:evolution@postgres-evolution:5432/evolution?schema=evolution_api',
  '# Supabase remoto (desativado — Postgres local):',
  '# DATABASE_PROVIDER=psql_bouncer',
  '# DATABASE_BOUNCER_CONNECTION_URI=...',
  '# DATABASE_CONNECTION_URI=...',
  'DATABASE_CONNECTION_CLIENT_NAME=conectize_evolution',
  'DATABASE_SAVE_DATA_INSTANCE=true',
  'DATABASE_SAVE_DATA_NEW_MESSAGE=false',
  'DATABASE_SAVE_MESSAGE_UPDATE=false',
  'DATABASE_SAVE_DATA_CONTACTS=false',
  'DATABASE_SAVE_DATA_CHATS=false',
  'DATABASE_SAVE_DATA_LABELS=false',
  'DATABASE_SAVE_DATA_HISTORIC=false'
)

foreach ($line in $lines) {
  if ($line -match '^\s*DATABASE_') {
    if (-not $inDbBlock) {
      $inDbBlock = $true
      $skipUntilBlank = $true
      foreach ($l in $localDb) { $out.Add($l) }
      continue
    }
    continue
  }
  if ($skipUntilBlank -and $line -match '^\s*#\s*Se o provedor') {
    $skipUntilBlank = $false
    continue
  }
  if ($skipUntilBlank -and $line -match '^\s*#\s*-\s*') {
    $skipUntilBlank = $false
  }
  if ($skipUntilBlank -and $line -match '^\s*CACHE_') {
    $skipUntilBlank = $false
    $out.Add($line)
    continue
  }
  if ($skipUntilBlank -and [string]::IsNullOrWhiteSpace($line)) {
    continue
  }
  if ($skipUntilBlank) { continue }
  $out.Add($line)
}

if (-not $inDbBlock) {
  $idx = 0
  for ($i = 0; $i -lt $out.Count; $i++) {
    if ($out[$i] -match '^\s*#') { $idx = $i + 1 }
  }
  foreach ($l in $localDb) { $out.Insert($idx, $l); $idx++ }
}

Set-Content -Path $EnvPath -Value $out -Encoding UTF8
Write-Host ".env atualizado para Postgres local + DATABASE_SAVE_* otimizado." -ForegroundColor Green
