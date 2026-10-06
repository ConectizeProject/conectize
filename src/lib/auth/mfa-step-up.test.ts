import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isMfaStepUpPending } from '@/lib/auth/mfa'

describe('isMfaStepUpPending', () => {
  it('só pede desafio quando AAL1 precisa subir para AAL2', () => {
    expect(isMfaStepUpPending('aal1', 'aal2')).toBe(true)
    expect(isMfaStepUpPending('aal2', 'aal2')).toBe(false)
    expect(isMfaStepUpPending('aal1', 'aal1')).toBe(false)
    expect(isMfaStepUpPending(null, 'aal2')).toBe(false)
  })
})

describe('portal API MFA gate', () => {
  it('exige desafio MFA nas rotas require* do portal e do fiscal', () => {
    const portalApi = readFileSync(
      join(process.cwd(), 'src/lib/auth/portal-api.ts'),
      'utf8',
    )
    const fiscalAccess = readFileSync(
      join(process.cwd(), 'src/lib/fiscal/portal-access.ts'),
      'utf8',
    )

    expect(portalApi).toContain('userNeedsMfaChallenge')
    expect(portalApi).toContain("error: 'mfa_required'")
    expect(portalApi).toContain('rejectPendingMfa')
    expect(fiscalAccess).toContain('userNeedsMfaChallenge')
    expect(fiscalAccess).toContain("error: 'mfa_required'")
  })
})
