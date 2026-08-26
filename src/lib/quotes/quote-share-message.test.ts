import { describe, expect, it } from 'vitest'
import { addDaysYmd, defaultQuoteValidUntilYmd, saoPauloYmd } from './quote-dates'
import { buildQuoteMessage } from './quote-share-message'

describe('quote-dates', () => {
  it('soma 7 dias a uma data civil', () => {
    expect(addDaysYmd('2026-08-25', 7)).toBe('2026-09-01')
  })

  it('validade padrão é hoje + 7', () => {
    expect(defaultQuoteValidUntilYmd()).toBe(addDaysYmd(saoPauloYmd(), 7))
  })
})

describe('quote-share-message', () => {
  it('monta mensagem sem aparelho', () => {
    const text = buildQuoteMessage({
      displayNumber: 12,
      title: 'Troca de tela',
      customerName: 'Maria Silva',
      status: 'Rascunho',
      validUntil: '2026-09-01',
      totalCents: 15000,
      quoteHref: 'https://example.com/orcamento/abc',
      organizationName: 'Loja Teste',
    })
    expect(text).toContain('Olá Maria')
    expect(text).toContain('Orçamento #12')
    expect(text).toContain('Troca de tela')
    expect(text).toContain('https://example.com/orcamento/abc')
    expect(text).not.toContain('Aparelho')
  })
})
