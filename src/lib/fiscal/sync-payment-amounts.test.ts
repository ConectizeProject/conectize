import { describe, expect, it } from 'vitest'
import { allocateCentsByWeight, syncAmountRowsToTotal } from './sync-payment-amounts'

describe('allocateCentsByWeight', () => {
  it('coloca o total inteiro quando há um peso', () => {
    expect(allocateCentsByWeight([100], 250)).toEqual([250])
  })

  it('mantém a proporção e fecha a soma', () => {
    expect(allocateCentsByWeight([60, 40], 200)).toEqual([120, 80])
    expect(allocateCentsByWeight([1, 1], 101).reduce((sum, value) => sum + value, 0)).toBe(101)
  })

  it('joga o total na última linha quando os pesos estão zerados', () => {
    expect(allocateCentsByWeight([0, 0], 100)).toEqual([0, 100])
  })
})

describe('syncAmountRowsToTotal', () => {
  it('atualiza a única forma de pagamento para o novo total', () => {
    expect(syncAmountRowsToTotal([{ type: '17', valueCents: 1000 }], 1800)).toEqual([1800])
  })

  it('não altera pagamento 90', () => {
    expect(syncAmountRowsToTotal([{ type: '90', valueCents: 0 }], 1800)).toEqual([0])
  })

  it('reparte o novo total entre as formas e mantém sem pagamento zerado', () => {
    expect(syncAmountRowsToTotal([
      { type: '01', valueCents: 6000 },
      { type: '17', valueCents: 4000 },
      { type: '90', valueCents: 0 },
    ], 5000)).toEqual([3000, 2000, 0])
  })
})
