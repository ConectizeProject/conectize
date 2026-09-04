import { describe, expect, it } from 'vitest'
import {
  addBrazilCalendarDays,
  brazilPreviousMonthRange,
  brazilTodayDateString,
  isBirthdayInNextDays,
} from '@/lib/dashboard/brazil-day'

describe('addBrazilCalendarDays', () => {
  it('adds days across month boundaries', () => {
    expect(addBrazilCalendarDays('2026-08-28', 6)).toBe('2026-09-03')
  })

  it('wraps the year', () => {
    expect(addBrazilCalendarDays('2026-12-30', 6)).toBe('2027-01-05')
  })
})

describe('brazilPreviousMonthRange', () => {
  it('uses August when today is 1 September in Brazil', () => {
    const range = brazilPreviousMonthRange(new Date('2026-09-01T02:30:00-03:00'))
    expect(range.label).toBe('2026-08')
    expect(range.displayLabel).toBe('08/2026')
    expect(range.startDate).toBe('2026-08-01')
    expect(range.endDate).toBe('2026-08-31')
    expect(range.startIso).toBe('2026-08-01T03:00:00.000Z')
    expect(range.endIso).toBe('2026-09-01T02:59:59.999Z')
  })

  it('wraps from January to December of the previous year', () => {
    const range = brazilPreviousMonthRange(new Date('2026-01-15T12:00:00-03:00'))
    expect(range.label).toBe('2025-12')
    expect(range.startDate).toBe('2025-12-01')
    expect(range.endDate).toBe('2025-12-31')
  })

  it('uses the last day of February in leap years', () => {
    const range = brazilPreviousMonthRange(new Date('2024-03-01T12:00:00-03:00'))
    expect(range.endDate).toBe('2024-02-29')
  })
})

describe('isBirthdayInNextDays', () => {
  const now = new Date('2026-08-28T12:00:00-03:00')

  it('includes today and the 7 following days', () => {
    expect(isBirthdayInNextDays('2000-08-28', now, 7)).toBe(true)
    expect(brazilTodayDateString(now)).toBe('2026-08-28')
    expect(isBirthdayInNextDays('1999-09-04', now, 7)).toBe(true)
  })

  it('excludes the day after the window', () => {
    expect(isBirthdayInNextDays('1999-09-05', now, 7)).toBe(false)
  })

  it('includes birthdays across the new year', () => {
    const endOfYear = new Date('2026-12-30T12:00:00-03:00')
    expect(isBirthdayInNextDays('1990-01-06', endOfYear, 7)).toBe(true)
    expect(isBirthdayInNextDays('1990-01-07', endOfYear, 7)).toBe(false)
    expect(isBirthdayInNextDays('1990-12-30', endOfYear, 7)).toBe(true)
  })

  it('rejects invalid dates and negative windows', () => {
    expect(isBirthdayInNextDays('not-a-date', now, 7)).toBe(false)
    expect(isBirthdayInNextDays('2000-08-28', now, -1)).toBe(false)
  })
})
