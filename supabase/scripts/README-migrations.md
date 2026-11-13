# Migrations — fluxo Conectize

## Problema que você viu

| Sintoma | Causa |
|---------|--------|
| `Skipping migration add_*.sql` | Legado sem timestamp — ver `LEGACY-MIGRATIONS.md` |
| `Remote migration versions not found` | Versões órfãs só no cloud |
| `column "brand" does not exist` | CLI reaplicou baseline antiga em DB já atualizado |

## Corrigir o histórico no cloud (uma vez)

**1.** Versões órfãs só no remoto (se o CLI ainda pedir):

```powershell
npx supabase@3.1.0 migration repair --status reverted --remote 20240320000000 20240320000003 20240321000001 20250305214254
```

**2.** Marcar como já aplicadas todas as migrations locais **exceto** as que ainda faltam no cloud:

```powershell
cd C:\Users\vhvsi\OneDrive\Documentos\Projetos\conectize
.\supabase\scripts\sync-migration-history.ps1 -DryRun
.\supabase\scripts\sync-migration-history.ps1
```

Por padrão, ficam pendentes só: `20260520120000`, `20260520130000`.  
Para mudar: `-PendingVersions '20260520120000','20260520130000','20260519120000'`

**3.** Conferir e aplicar o que falta:

```powershell
npx supabase@3.1.0 migration list --remote
npx supabase@3.1.0 db push --remote
```

**4.** Validar WhatsApp: `verify-whatsapp-migrations.sql` no SQL Editor.

A baseline `20260225100000` foi tornada **idempotente** (não quebra se `brand` já foi removida).

## Dia a dia (novas migrations)

```powershell
# 1. Criar arquivo
# supabase/migrations/20260521143000_minha_feature.sql

# 2. Remoto (produção / staging linkado)
npx supabase@3.1.0 db push --remote

# 3. Local (Docker, .env.local com 127.0.0.1:54321)
npx supabase@3.1.0 db push
```

## Local vs cloud

| Ambiente | URL típica | Comando (CLI v3) |
|----------|------------|------------------|
| Dev Docker | `http://127.0.0.1:54321` | `db push` (local por padrão) |
| Cloud | `https://xxx.supabase.co` | `link` + `db push --remote` |

## CLI

Use **`npx supabase@3.1.0`**.

Breaking changes da v3 relevantes aqui:
- `db push` / `migration list` / `migration repair` miram o **stack local** por padrão.
- Para o projeto linkado (cloud), passe **`--remote`**.
- Em CI/scripts não interativos, use também `--yes` em comandos que alteram o remoto.
- Em `config.toml`, `[inbucket]` virou `[local_smtp]`.

## Ter certeza

`supabase/scripts/verify-whatsapp-migrations.sql` no SQL Editor.
