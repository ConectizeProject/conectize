# Migrations legadas (sem timestamp)

Arquivos como `add_share_token.sql` **não entram** no `supabase db push` (padrão exigido: `YYYYMMDDHHMMSS_nome.sql`).

O schema deles **já está** no banco de produção (aplicado no passado via SQL manual ou deploy antigo).

**Não renomeie** esses arquivos para timestamp agora — o CLI tentaria executá-los de novo e poderia conflitar.

## Fluxo recomendado daqui pra frente

1. Toda alteração nova → arquivo `supabase/migrations/20260521120000_descricao.sql`
2. `npx supabase@2.20.12 db push` (remoto linkado) ou `--local` em dev
3. Se o cloud estiver à frente do histórico → `.\supabase\scripts\sync-migration-history.ps1` (uma vez após alinhar)

## Versões só no remoto (órfãs)

Se o CLI listar versões no remoto que não existem na pasta local, use **uma vez**:

```powershell
npx supabase@2.20.12 migration repair --status reverted 20240320000000 20240320000003 20240321000001 20250305214254
```

Depois rode `sync-migration-history.ps1` (sem incluir essas versões — elas não são locais).
