import { describe, expect, it, vi } from 'vitest'
import { CONECTIZE_HOST_ORGANIZATION_ID } from '@/lib/organizations/constants'
import { stripAutoHostOrganizationMembership } from '@/lib/organizations/strip-auto-host-membership'

describe('stripAutoHostOrganizationMembership', () => {
  it('apaga membership somente do user e da org host', async () => {
    const finalEq = vi.fn().mockResolvedValue({ error: null })
    const firstEq = vi.fn().mockReturnValue({ eq: finalEq })
    const del = vi.fn().mockReturnValue({ eq: firstEq })
    const from = vi.fn().mockReturnValue({ delete: del })
    const supabase = { from } as any

    const err = await stripAutoHostOrganizationMembership(supabase, 'u-1')

    expect(err).toBeNull()
    expect(from).toHaveBeenCalledWith('organization_members')
    expect(firstEq).toHaveBeenCalledWith('user_id', 'u-1')
    expect(finalEq).toHaveBeenCalledWith('organization_id', CONECTIZE_HOST_ORGANIZATION_ID)
  })
})
