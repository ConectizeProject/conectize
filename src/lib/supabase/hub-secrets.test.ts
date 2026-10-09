import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  requireHubOrganizationId,
  resolveHubSecretsReader,
} from '@/lib/supabase/hub-secrets'

describe('hub-secrets', () => {
  it('exige organization_id antes de ler secrets com service role', () => {
    expect(() => requireHubOrganizationId('')).toThrow('hub_secrets_organization_required')
    expect(() => requireHubOrganizationId('   ')).toThrow('hub_secrets_organization_required')
    expect(requireHubOrganizationId(' org-a ')).toBe('org-a')
  })

  it('em testes reusa o client injetado e nao cai no service role', () => {
    vi.stubEnv('VITEST', 'true')
    const fallback = { from: () => null } as unknown as SupabaseClient
    expect(resolveHubSecretsReader(fallback)).toBe(fallback)
  })
})
