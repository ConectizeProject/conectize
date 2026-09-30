import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260930235900_organization_members_mutate_admin_only.sql',
)

describe('organization_members mutate admin-only', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  it('substitui a policy de staff por is_admin no tenant ativo', () => {
    expect(sql).toContain('drop policy if exists organization_members_mutate_staff')
    expect(sql).toContain('create policy organization_members_mutate_admin')
    expect(sql).toMatch(/using\s*\(\s*public\.is_admin\(\)/)
    expect(sql).toMatch(/with check\s*\(\s*public\.is_admin\(\)/)
    expect(sql).not.toMatch(
      /create policy organization_members_mutate_admin[\s\S]*is_staff_or_admin/,
    )
  })

  it('bloqueia autoatribuição de role_in_org admin com JWT de utilizador', () => {
    expect(sql).toContain('prevent_non_admin_org_role_escalation')
    expect(sql).toContain("new.role_in_org = 'admin'")
    expect(sql).toContain('if auth.uid() is null then')
    expect(sql).toContain('raise exception \'permission_denied\'')
  })
})
