import { describe, expect, it } from 'vitest'
import {
  addBrazilCalendarDays,
  isBirthdayInNextDays,
  brazilTodayDateString,
} from '@/lib/dashboard/brazil-day'

describe('addBrazilCalendarDays', () => {
  it('adds days across month boundaries', () => {
    expect(addBrazilCalendarDays('2026-08-28', 6)).toBe('2026-09-03')
  })

  it('wraps the year', () => {
    expect(addBrazilCalendarDays('2026-12-30', 6)).toBe('2027-01-05')
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
