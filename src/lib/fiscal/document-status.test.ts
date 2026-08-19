import { describe, expect, it } from 'vitest'
import {
  canDownloadFiscalXml,
  isSefazCancelConfirmed,
  isSefazDenied,
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

describe('isSefazDenied', () => {
  it('accepts denegation codes', () => {
    expect(isSefazDenied('110')).toBe(true)
    expect(isSefazDenied('301')).toBe(true)
    expect(isSefazDenied('302')).toBe(true)
    expect(isSefazDenied('100')).toBe(false)
  })
})
