import { describe, expect, it } from 'vitest'
import {
  inboundNfeItemStockExternalReference,
  parseInboundNfeAccessKeyFromStockRef,
} from '@/lib/fiscal/inbound-nfe-stock-ref'

describe('inboundNfeItemStockExternalReference', () => {
  it('usa chave de acesso e item id para referência única', () => {
    expect(
      inboundNfeItemStockExternalReference({
        accessKey: '35240112345678000190550010000001231000001234',
        documentId: 'doc-1',
        itemId: 'item-1',
      }),
    ).toBe(
      'nfe:35240112345678000190550010000001231000001234:item:item-1',
    )
  })

  it('cai para documentId quando não há chave', () => {
    expect(
      inboundNfeItemStockExternalReference({
        accessKey: null,
        documentId: 'doc-2',
        itemId: 'item-9',
      }),
    ).toBe('nfe_entrada:doc-2:item:item-9')
  })

  it('gera refs distintas por item na mesma nota', () => {
    const a = inboundNfeItemStockExternalReference({
      accessKey: 'chave',
      documentId: 'doc',
      itemId: 'a',
    })
    const b = inboundNfeItemStockExternalReference({
      accessKey: 'chave',
      documentId: 'doc',
      itemId: 'b',
    })
    expect(a).not.toBe(b)
  })
})

describe('parseInboundNfeAccessKeyFromStockRef', () => {
  it('lê chave simples e com sufixo de item', () => {
    expect(
      parseInboundNfeAccessKeyFromStockRef(
        'nfe:35240112345678000190550010000001231000001234',
      ),
    ).toBe('35240112345678000190550010000001231000001234')
    expect(
      parseInboundNfeAccessKeyFromStockRef(
        'nfe:35240112345678000190550010000001231000001234:item:abc',
      ),
    ).toBe('35240112345678000190550010000001231000001234')
  })

  it('ignora refs sem prefixo nfe:', () => {
    expect(parseInboundNfeAccessKeyFromStockRef('nfe_entrada:doc:item:1')).toBe(
      '',
    )
  })
})
