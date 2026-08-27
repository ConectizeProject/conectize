import { describe, expect, it } from 'vitest'
import {
  canDownloadFiscalXml,
  canDeleteFiscalDocument,
  isSefazCancelConfirmed,
  isSefazDenied,
  fiscalCancelDeadlineHint,
  isNfceCancelDeadlineExpired,
} from '@/lib/fiscal/document-status'

describe('isSefazCancelConfirmed', () => {
  it('accepts 135 and 155', () => {
    expect(isSefazCancelConfirmed('135')).toBe(true)
    expect(isSefazCancelConfirmed('155')).toBe(true)
  })

  it('rejects other event statuses', () => {
    expect(isSefazCancelConfirmed('136')).toBe(false)
    expect(isSefazCancelConfirmed('501')).toBe(false)
    expect(isSefazCancelConfirmed('573')).toBe(false)
    expect(isSefazCancelConfirmed(null)).toBe(false)
  })
})

describe('canDownloadFiscalXml', () => {
  it('allows authorized and canceled notes', () => {
    expect(canDownloadFiscalXml('authorized')).toBe(true)
    expect(canDownloadFiscalXml('canceled')).toBe(true)
    expect(canDownloadFiscalXml('pending')).toBe(false)
    expect(canDownloadFiscalXml('rejected')).toBe(false)
  })
})

describe('canDeleteFiscalDocument', () => {
  it('allows pending draft without access key', () => {
    expect(canDeleteFiscalDocument('pending', null)).toBe(true)
    expect(canDeleteFiscalDocument('pending', '')).toBe(true)
  })

  it('allows rejected notes', () => {
    expect(canDeleteFiscalDocument('rejected', '3526...')).toBe(true)
    expect(canDeleteFiscalDocument('rejected', null)).toBe(true)
  })

  it('blocks sent, authorized, denied and canceled notes', () => {
    expect(canDeleteFiscalDocument('pending', '35260800000000000000000000000000000000000000')).toBe(false)
    expect(canDeleteFiscalDocument('authorized', null)).toBe(false)
    expect(canDeleteFiscalDocument('denied', null)).toBe(false)
    expect(canDeleteFiscalDocument('canceled', null)).toBe(false)
  })
})

describe('isSefazDenied', () => {
  it('accepts denegation codes', () => {
    expect(isSefazDenied('110')).toBe(true)
    expect(isSefazDenied('301')).toBe(true)
    expect(isSefazDenied('302')).toBe(true)
    expect(isSefazDenied('100')).toBe(false)
  })
})

describe('fiscalCancelDeadlineHint', () => {
  it('uses 30 minutes for NFC-e and 24 hours for NF-e', () => {
    expect(fiscalCancelDeadlineHint('65')).toContain('30 minutos')
    expect(fiscalCancelDeadlineHint('55')).toContain('24 horas')
  })
})

describe('isNfceCancelDeadlineExpired', () => {
  it('expires after 30 minutes from authorization', () => {
    const authorizedAt = '2026-08-26T14:10:00.000Z'
    expect(isNfceCancelDeadlineExpired(authorizedAt, new Date('2026-08-26T14:39:59.000Z'))).toBe(false)
    expect(isNfceCancelDeadlineExpired(authorizedAt, new Date('2026-08-26T14:40:00.000Z'))).toBe(true)
  })
})
