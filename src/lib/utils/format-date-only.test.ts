import { describe, expect, it } from 'vitest'
import { addBrazilCalendarDays } from '@/lib/dashboard/brazil-day'
import { formatDateOnlyBr } from '@/lib/utils/format-date'

describe('formatDateOnlyBr', () => {
  it('keeps the civil day for Postgres date (no UTC midnight shift)', () => {
    // new Date('2026-09-26') would show 25/09 in America/Sao_Paulo
    expect(formatDateOnlyBr('2026-09-26')).toBe('26/09/2026')
  })

  it('formats warranty end 90 days later without shifting the sale day', () => {
    const sale = '2026-09-26'
    expect(formatDateOnlyBr(sale)).toBe('26/09/2026')
    expect(formatDateOnlyBr(addBrazilCalendarDays(sale, 90))).toBe('25/12/2026')
  })
})
