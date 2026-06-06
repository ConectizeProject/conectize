import { describe, expect, it } from 'vitest'
import {
  getWhatsappPixRelayConfig,
  isPixRelayInstance,
} from '@/lib/whatsapp/whatsapp-pix-relay-config'
import { extractEmvPixKeyFromGroupMessage } from '@/lib/whatsapp/whatsapp-pix-relay'

const SAMPLE_KEY =
  '00020101021226910014br.gov.bcb.pix2569qrcodes.fiduciascm.digital/v1/qr/46c3be82-9485-4bbb-a8b5-400e8f1a9f305204000053039865802BR5905Prime6009Sao Paulo61088890000062070503***63047994'

describe('extractEmvPixKeyFromGroupMessage', () => {
  it('preserva EMV completo com espaços internos (ex.: cidade)', () => {
    const got = extractEmvPixKeyFromGroupMessage(SAMPLE_KEY)
    expect(got).toBe(SAMPLE_KEY)
    expect(got).toContain('Sao Paulo')
    expect(got).toMatch(/63047994$/)
  })

  it('preserva prefixo/sufixo fora do EMV sem alterar o trecho EMV', () => {
    const wrapped = `PIX gerado:\n${SAMPLE_KEY}\nCopie acima`
    const got = extractEmvPixKeyFromGroupMessage(wrapped)
    expect(got).toBe(SAMPLE_KEY)
  })

  it('ignora aviso formatado sem EMV', () => {
    expect(extractEmvPixKeyFromGroupMessage('PIX Prime Fox — aguarde')).toBeNull()
  })
})

describe('isPixRelayInstance', () => {
  it('aceita qualquer instancia quando env nao define nome', () => {
    const prev = process.env.WHATSAPP_PIX_RELAY_INSTANCE_NAME
    delete process.env.WHATSAPP_PIX_RELAY_INSTANCE_NAME
    const config = getWhatsappPixRelayConfig()
    expect(isPixRelayInstance('Victor', config)).toBe(true)
    expect(isPixRelayInstance('Conectize', config)).toBe(true)
    if (prev !== undefined) process.env.WHATSAPP_PIX_RELAY_INSTANCE_NAME = prev
  })

  it('filtra por WHATSAPP_PIX_RELAY_INSTANCE_NAME', () => {
    const prev = process.env.WHATSAPP_PIX_RELAY_INSTANCE_NAME
    process.env.WHATSAPP_PIX_RELAY_INSTANCE_NAME = 'Victor'
    const config = getWhatsappPixRelayConfig()
    expect(isPixRelayInstance('Victor', config)).toBe(true)
    expect(isPixRelayInstance('Conectize', config)).toBe(false)
    if (prev !== undefined) process.env.WHATSAPP_PIX_RELAY_INSTANCE_NAME = prev
    else delete process.env.WHATSAPP_PIX_RELAY_INSTANCE_NAME
  })
})
