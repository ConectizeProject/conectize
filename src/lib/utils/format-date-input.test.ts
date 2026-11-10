import { describe, expect, it } from 'vitest'
import {
  brDateToYmd,
  formatDateInputBr,
  localDateToYmd,
  ymdToBrDate,
  ymdToLocalDate,
} from './format-date-input'

describe('format-date-input', () => {
  it('mascara digitacao parcial', () => {
    expect(formatDateInputBr('1')).toBe('1')
    expect(formatDateInputBr('10')).toBe('10')
    expect(formatDateInputBr('101')).toBe('10/1')
    expect(formatDateInputBr('1011')).toBe('10/11')
    expect(formatDateInputBr('10112026')).toBe('10/11/2026')
  })

  it('converte br <-> ymd', () => {
    expect(brDateToYmd('10/11/2026')).toBe('2026-11-10')
    expect(ymdToBrDate('2026-11-10')).toBe('10/11/2026')
    expect(brDateToYmd('31/02/2026')).toBe('')
  })

  it('converte Date local', () => {
    const date = ymdToLocalDate('2026-11-10')
    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(10)
    expect(date?.getDate()).toBe(10)
    expect(localDateToYmd(new Date(2026, 10, 10))).toBe('2026-11-10')
  })
})
