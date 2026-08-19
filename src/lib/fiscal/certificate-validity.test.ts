import { describe, expect, it } from 'vitest'
import {
  fiscalCertificateExpiredMessage,
  isFiscalCertificateExpired,
  isNfceServiceItem,
} from '@/lib/fiscal/certificate-validity'

describe('isFiscalCertificateExpired', () => {
  it('is expired when validUntil is in the past', () => {
    expect(isFiscalCertificateExpired('2020-01-01T00:00:00.000Z', new Date('2026-08-19T12:00:00.000Z'))).toBe(true)
  })

  it('is valid when validUntil is in the future', () => {
    expect(isFiscalCertificateExpired('2027-01-01T00:00:00.000Z', new Date('2026-08-19T12:00:00.000Z'))).toBe(false)
  })

  it('does not block when the date is missing', () => {
    expect(isFiscalCertificateExpired(null)).toBe(false)
    expect(isFiscalCertificateExpired('')).toBe(false)
  })
})

describe('fiscalCertificateExpiredMessage', () => {
  it('includes the Brazilian date', () => {
    expect(fiscalCertificateExpiredMessage(new Date('2026-01-15T12:00:00.000Z'))).toMatch(/venceu em/)
  })
})

describe('isNfceServiceItem', () => {
  it('blocks service kind', () => {
    expect(isNfceServiceItem('service')).toBe(true)
    expect(isNfceServiceItem('SERVICE')).toBe(true)
    expect(isNfceServiceItem('product')).toBe(false)
    expect(isNfceServiceItem(null)).toBe(false)
  })
})
