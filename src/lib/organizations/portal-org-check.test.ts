import { describe, expect, it } from 'vitest'
import { portalOrgCheckIsFresh } from './portal-org-check'

const userId = '82d82c46-1adb-4de0-9289-77bf2c3d5ea6'
const now = 1_700_000_000_000

describe('portalOrgCheckIsFresh', () => {
  it('aceita a checagem do mesmo usuário dentro de 10 minutos', () => {
    expect(portalOrgCheckIsFresh(userId, `${userId}.${now - 60_000}`, now)).toBe(true)
  })

  it('recusa usuário diferente, valor vazio e checagem vencida', () => {
    expect(portalOrgCheckIsFresh(userId, `outro.${now}`, now)).toBe(false)
    expect(portalOrgCheckIsFresh(userId, null, now)).toBe(false)
    expect(portalOrgCheckIsFresh(userId, `${userId}.${now - 11 * 60 * 1000}`, now)).toBe(false)
  })
})
