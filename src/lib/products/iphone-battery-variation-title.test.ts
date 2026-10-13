import { describe, expect, it } from 'vitest'
import {
  iphoneBatteryListVariationName,
  iphoneBatteryVariationModel,
} from './iphone-battery-variation-title'

describe('iphoneBatteryVariationModel', () => {
  it('lê o modelo no sufixo do SKU', () => {
    expect(iphoneBatteryVariationModel('BATERIAIP17PM')).toBe('17 Pro Max')
    expect(iphoneBatteryVariationModel('BATERIAIP12E12P')).toBe('12 e 12 Pro')
    expect(iphoneBatteryVariationModel('BATERIAIP16E')).toBe('16e')
    expect(iphoneBatteryVariationModel('BATERIAIPSE3')).toBe('SE (2022)')
  })

  it('ignora o SKU do produto pai e códigos desconhecidos', () => {
    expect(iphoneBatteryVariationModel('BATERIAIP')).toBe(null)
    expect(iphoneBatteryVariationModel('BATERIAIP99')).toBe(null)
    expect(iphoneBatteryVariationModel(null)).toBe(null)
  })
})

describe('iphoneBatteryListVariationName', () => {
  it('repõe o título quando o nome da variação é só o do pai', () => {
    expect(
      iphoneBatteryListVariationName('Bateria iPhone', 'Bateria iPhone', 'BATERIAIP17PM'),
    ).toBe('Bateria iPhone Modelo:17 Pro Max')
  })

  it('mantém um nome que já traz o modelo', () => {
    expect(
      iphoneBatteryListVariationName(
        'Bateria iPhone Modelo:11',
        'Bateria iPhone',
        'BATERIAIP11',
      ),
    ).toBe('Bateria iPhone Modelo:11')
  })
})
