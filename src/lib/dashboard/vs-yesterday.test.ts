import { describe, expect, it } from 'vitest'
import { vsYesterdayDelta, vsYesterdayLabel } from '@/lib/dashboard/vs-yesterday'

describe('vsYesterdayDelta', () => {
  it('returns a signed percent when yesterday has a baseline', () => {
    expect(vsYesterdayDelta(1200, 1000)).toEqual({ percent: 20, direction: 'up' })
    expect(vsYesterdayDelta(800, 1000)).toEqual({ percent: -20, direction: 'down' })
    expect(vsYesterdayDelta(1000, 1000)).toEqual({ percent: 0, direction: 'flat' })
  })

  it('handles a zero yesterday without dividing by zero', () => {
    expect(vsYesterdayDelta(0, 0)).toEqual({ percent: 0, direction: 'flat' })
    expect(vsYesterdayDelta(500, 0)).toEqual({ percent: null, direction: 'up' })
  })
})

describe('vsYesterdayLabel', () => {
  it('formats a compact percent without a vs-ontem suffix', () => {
    expect(vsYesterdayLabel({ percent: 12, direction: 'up' })).toBe('+12%')
    expect(vsYesterdayLabel({ percent: -8, direction: 'down' })).toBe('-8%')
    expect(vsYesterdayLabel({ percent: 0, direction: 'flat' })).toBe('0%')
    expect(vsYesterdayLabel({ percent: null, direction: 'up' })).toBe('+')
  })
})
