import { describe, expect, it } from 'vitest'
import {
  extractNfeAccessKey,
  isValidNfeAccessKey,
  nfeAccessKeyCheckDigit,
  nfeAccessKeyModel,
} from '@/lib/fiscal/nfe-access-key'

const ACCESS_KEY = '35240112345678000195550010000001231000000011'

describe('nfe access key', () => {
  it('calcula o dígito verificador', () => {
    expect(nfeAccessKeyCheckDigit(ACCESS_KEY.slice(0, 43))).toBe(1)
    expect(isValidNfeAccessKey(ACCESS_KEY)).toBe(true)
    expect(isValidNfeAccessKey(`${ACCESS_KEY.slice(0, 43)}0`)).toBe(false)
  })

  it('lê o modelo 55 da chave', () => {
    expect(nfeAccessKeyModel(ACCESS_KEY)).toBe('55')
  })

  it('extrai a chave do código de barras, do texto com espaços e do QR do DANFE', () => {
    expect(extractNfeAccessKey(ACCESS_KEY)).toBe(ACCESS_KEY)
    expect(extractNfeAccessKey(`NFe ${ACCESS_KEY.slice(0, 4)} ${ACCESS_KEY.slice(4)}`)).toBe(ACCESS_KEY)
    expect(extractNfeAccessKey(
      `https://www.nfe.fazenda.gov.br/portal/consulta.aspx?chNFe=${ACCESS_KEY}`,
    )).toBe(ACCESS_KEY)
    expect(extractNfeAccessKey('123')).toBeNull()
    expect(extractNfeAccessKey(`${ACCESS_KEY.slice(0, 43)}9`)).toBeNull()
  })
})
