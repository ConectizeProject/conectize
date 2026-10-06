import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20261006220000_lock_host_identity_and_scope_parent_stock.sql',
)

describe('lock host identity and scope parent stock', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  it('bloqueia JWT de alterar organizations.is_host e created_at', () => {
    expect(sql).toContain('prevent_host_identity_tampering')
    expect(sql).toContain('if auth.uid() is null then')
    expect(sql).toContain('new.is_host is distinct from old.is_host')
    expect(sql).toContain('new.created_at is distinct from old.created_at')
    expect(sql).toContain("raise exception 'permission_denied'")
    expect(sql).toContain(
      'create trigger organizations_prevent_host_identity_tampering',
    )
  })

  it('restringe estoque de produto pai ao organization_id do filho', () => {
    expect(sql).toContain('create or replace function public.trg_clear_parent_product_stock')
    expect(sql).toContain('p.organization_id = new.organization_id')
    expect(sql).toContain('c.organization_id = p.organization_id')
    expect(sql).toContain(
      'create or replace function public.product_has_variation_children',
    )
  })
})
