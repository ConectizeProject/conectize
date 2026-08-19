import { describe, expect, it } from 'vitest'
import { nfceCscForEnvironment } from '@/lib/fiscal/csc'

describe('nfceCscForEnvironment', () => {
  it('uses homologation pair in homologacao', () => {
    const pair = nfceCscForEnvironment({
      fiscal_environment: 'homologacao',
      nfce_csc_id: 'legacy',
      nfce_csc_ciphertext: 'legacy-secret',
      nfce_csc_id_homologacao: '1',
      nfce_csc_ciphertext_homologacao: 'hom-secret',
      nfce_csc_id_producao: '2',
      nfce_csc_ciphertext_producao: 'prod-secret',
    }, 'homologacao')
    expect(pair).toEqual({ id: '1', ciphertext: 'hom-secret' })
  })

  it('uses production pair in producao', () => {
    const pair = nfceCscForEnvironment({
      fiscal_environment: 'producao',
      nfce_csc_id_homologacao: '1',
      nfce_csc_ciphertext_homologacao: 'hom-secret',
      nfce_csc_id_producao: '2',
      nfce_csc_ciphertext_producao: 'prod-secret',
    }, 'producao')
    expect(pair).toEqual({ id: '2', ciphertext: 'prod-secret' })
  })
})
