import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20261001180000_block_global_scope_admin_tenant_breakout.sql',
)
const contextPath = join(
  process.cwd(),
  'src/lib/organizations/portal-organization-context.ts',
)

describe('block global-scope admin tenant breakout', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  const contextSource = readFileSync(contextPath, 'utf8')

  it('desliga is_global_scope_admin e tira o helper de is_admin / is_staff_or_admin', () => {
    expect(sql).toContain('create or replace function public.is_global_scope_admin ()')
    expect(sql).toMatch(/select false;/)
    expect(sql).toContain('create or replace function public.is_staff_or_admin ()')
    expect(sql).toContain('create or replace function public.is_admin ()')
    expect(sql).not.toMatch(
      /create or replace function public\.is_admin \(\)[\s\S]*is_global_scope_admin/,
    )
    expect(sql).not.toMatch(
      /create or replace function public\.is_staff_or_admin \(\)[\s\S]*is_global_scope_admin/,
    )
  })

  it('impede user_portal_context de apontar para org sem membership', () => {
    expect(sql).toContain('user_can_activate_organization')
    expect(sql).toContain('drop policy if exists user_portal_context_own')
    expect(sql).toContain('public.user_can_activate_organization(active_organization_id)')
    expect(sql).not.toMatch(
      /create policy organizations_select_members[\s\S]*is_global_scope_admin/,
    )
  })

  it('não trata admin de tenant sem membership como escopo global no portal', () => {
    expect(contextSource).toContain('const globalPortalScope = isPlatformAdmin')
    expect(contextSource).not.toContain("normalized === 'admin' && !hasAnyOrgMembership")
  })
})
