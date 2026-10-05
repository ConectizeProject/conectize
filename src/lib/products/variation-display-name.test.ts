import { describe, expect, it } from 'vitest'
import {
  composePortalVariationDisplayName,
  inferVariationAttributeKeysFromChildNames,
  inferVariationAttributeKeysFromChildValues,
  parseVariationNameAgainstParent,
  pickVariationAttributeValuesForKeys,
  resolveVariationAttributesFromName,
  splitPortalVariationDisplayName,
  variationAttributesNeedRepair,
} from '@/lib/products/variation-display-name'

describe('variation-display-name', () => {
  it('compõe nome com atributo sem espaço após :', () => {
    expect(
      composePortalVariationDisplayName('Display iPhone', ['Modelo'], { Modelo: '8G Black' }),
    ).toBe('Display iPhone Modelo:8G Black')
  })

  it('parseia nome completo com Modelo', () => {
    expect(
      parseVariationNameAgainstParent('Display iPhone', 'Display iPhone Modelo:8G Black'),
    ).toEqual([{ key: 'Modelo', value: '8G Black' }])
  })

  it('parseia nome curto sem prefixo do pai', () => {
    expect(
      parseVariationNameAgainstParent('Display iPhone', '16 Pro Max'),
    ).toEqual([{ key: '', value: '16 Pro Max' }])
  })

  it('infere Modelo a partir de filhos mistos', () => {
    const keys = inferVariationAttributeKeysFromChildNames('Display iPhone', [
      'Display iPhone Modelo:8G Black',
      '16 Pro Max',
      'Display iPhone modelo:XR',
    ])
    expect(keys).toEqual(['Modelo'])
  })

  it('resolve nome curto para Modelo', () => {
    const r = resolveVariationAttributesFromName('Display iPhone', '16 Pro Max', ['Modelo'])
    expect(r.values).toEqual({ Modelo: '16 Pro Max' })
    expect(r.displayName).toBe('Display iPhone Modelo:16 Pro Max')
  })

  it('detecta necessidade de reparo quando keys vazias e o nome ainda tem atributo', () => {
    expect(
      variationAttributesNeedRepair({
        parentName: 'Display iPhone',
        parentKeys: [],
        children: [{ name: 'Display iPhone Modelo:8G Black', values: {} }],
      }),
    ).toBe(true)
  })

  it('não repara keys vazias depois que o atributo foi removido de verdade', () => {
    expect(
      variationAttributesNeedRepair({
        parentName: 'Display iPhone',
        parentKeys: [],
        children: [{ name: 'Display iPhone', values: {} }],
      }),
    ).toBe(false)
  })

  it('repara keys vazias quando o filho ainda guarda valores estruturados', () => {
    expect(
      variationAttributesNeedRepair({
        parentName: 'Display iPhone',
        parentKeys: [],
        children: [{ name: 'Display iPhone', values: { Modelo: '8G Black' } }],
      }),
    ).toBe(true)
  })

  it('infere chaves a partir dos valores dos filhos', () => {
    expect(
      inferVariationAttributeKeysFromChildValues([
        { Cor: 'Azul', Tamanho: 'M' },
        { cor: 'Preto' },
      ]),
    ).toEqual(['Cor', 'Tamanho'])
  })

  it('remove do filho a chave que o pai excluiu', () => {
    expect(
      pickVariationAttributeValuesForKeys(['Cor'], {
        Cor: 'Azul',
        Tamanho: 'M',
      }),
    ).toEqual({ Cor: 'Azul' })
    expect(pickVariationAttributeValuesForKeys([], { Modelo: '8G' })).toEqual({})
  })

  it('separa prefixo do pai para exibição', () => {
    expect(
      splitPortalVariationDisplayName(
        'Display iPhone Modelo:8G Black',
        'Display iPhone',
      ),
    ).toEqual({
      parentLabel: 'Display iPhone',
      suffix: 'Modelo:8G Black',
    })
  })
})
