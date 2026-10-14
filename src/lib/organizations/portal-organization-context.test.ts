import { describe, expect, it } from 'vitest'
import { canReuseCachedPortalOrganization } from './portal-organization-context'

describe('canReuseCachedPortalOrganization', () => {
  it('permite platform_admin sem membership', () => {
    expect(canReuseCachedPortalOrganization({
      role: 'platform_admin',
      hasStaffMembership: false,
      hasAccountantMembership: false,
    })).toBe(true)
  })

  it('exige membership staff/admin na org em cache', () => {
    expect(canReuseCachedPortalOrganization({
      role: 'staff',
      hasStaffMembership: true,
      hasAccountantMembership: false,
    })).toBe(true)
    expect(canReuseCachedPortalOrganization({
      role: 'admin',
      hasStaffMembership: false,
      hasAccountantMembership: false,
    })).toBe(false)
  })

  it('exige membership accountant na org em cache', () => {
    expect(canReuseCachedPortalOrganization({
      role: 'accountant',
      hasStaffMembership: false,
      hasAccountantMembership: true,
    })).toBe(true)
    expect(canReuseCachedPortalOrganization({
      role: 'accountant',
      hasStaffMembership: true,
      hasAccountantMembership: false,
    })).toBe(false)
  })

  it('não reutiliza cache para retailer/user (força resolve completo)', () => {
    expect(canReuseCachedPortalOrganization({
      role: 'retailer',
      hasStaffMembership: true,
      hasAccountantMembership: false,
    })).toBe(false)
    expect(canReuseCachedPortalOrganization({
      role: 'user',
      hasStaffMembership: false,
      hasAccountantMembership: false,
    })).toBe(false)
  })
})
