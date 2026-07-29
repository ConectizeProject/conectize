import { describe, expect, it } from 'vitest'
import { buildServiceOrdersMacroQOrClause } from './portal-ordens-macro-search'

describe('buildServiceOrdersMacroQOrClause', () => {
  it('busca só display_number para 1 dígito', () => {
    expect(buildServiceOrdersMacroQOrClause('5', [])).toBe('display_number.eq.5')
  })

  it('inclui display_number e campos atuais (sem description legada) para OS com 2+ dígitos', () => {
    const clause = buildServiceOrdersMacroQOrClause('574', [])
    expect(clause).toContain('display_number.eq.574')
    expect(clause).toContain('title.ilike.%574%')
    expect(clause).toContain('customer_description.ilike.%574%')
    expect(clause).toContain('receiving_notes.ilike.%574%')
    expect(clause.split(',').some((p) => p.startsWith('description.'))).toBe(false)
  })

  it('inclui customer_id quando há matches de cliente', () => {
    const clause = buildServiceOrdersMacroQOrClause('joao', ['aaa', 'bbb'])
    expect(clause).toContain('customer_id.in.(aaa,bbb)')
    expect(clause.split(',').some((p) => p.startsWith('description.'))).toBe(false)
  })
})
