# Alinha o histórico remoto (schema_migrations) com as migrations locais COM timestamp.
# Use quando o cloud já tem o schema, mas o CLI tenta reaplicar tudo no db push.
#
# Pré-requisitos:
#   npx supabase@2.20.12 login
#   npx supabase@2.20.12 link --project-ref SEU_REF
#
# Uso:
#   .\supabase\scripts\sync-migration-history.ps1 -DryRun
#   .\supabase\scripts\sync-migration-history.ps1
#   npx supabase@2.20.12 migration list
#   npx supabase@2.20.12 db push

param(
  [string[]] $PendingVersions = @('20260520120000', '20260520130000'),
  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$migrationsDir = Join-Path $root 'supabase\migrations'

if (-not (Test-Path (Join-Path $root 'supabase\.temp\project-ref'))) {
  Write-Error 'Projeto não linkado. Rode: npx supabase@2.20.12 link --project-ref SEU_REF'
}

$all = Get-ChildItem (Join-Path $migrationsDir '*.sql') | ForEach-Object {
  if ($_.BaseName -match '^(\d{14})_') { $Matches[1] }
} | Sort-Object -Unique

$toMark = $all | Where-Object { $PendingVersions -notcontains $_ }

Write-Host "Migrations locais com timestamp: $($all.Count)"
Write-Host "Marcar como applied (sem rodar SQL): $($toMark.Count)"
Write-Host "Ficam pendentes para db push: $($PendingVersions -join ', ')"
Write-Host ''

if ($DryRun) {
  Write-Host 'Dry-run — versões que receberiam repair --status applied:'
  $toMark | ForEach-Object { Write-Host "  $_" }
  exit 0
}

if ($toMark.Count -eq 0) {
  Write-Host 'Nada para marcar.'
  exit 0
}

Write-Host 'Rodando migration repair em lotes (evita limite de linha de comando)...'
Push-Location $root
try {
  $batchSize = 15
  for ($i = 0; $i -lt $toMark.Count; $i += $batchSize) {
    $end = [Math]::Min($i + $batchSize - 1, $toMark.Count - 1)
    $batch = $toMark[$i..$end]
    Write-Host "  Lote $([int]($i / $batchSize) + 1): $($batch[0]) .. $($batch[-1]) ($($batch.Count) versoes)"
    $args = @('supabase@2.20.12', 'migration', 'repair', '--status', 'applied') + $batch
    & npx @args
    if ($LASTEXITCODE -ne 0) {
      Write-Error "migration repair falhou no lote com $($batch[0])"
    }
  }
  Write-Host ''
  Write-Host 'OK. Proximo passo:'
  Write-Host '  npx supabase@2.20.12 migration list'
  Write-Host '  npx supabase@2.20.12 db push'
}
finally {
  Pop-Location
}
