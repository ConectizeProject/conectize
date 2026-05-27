import { describe, expect, it } from 'vitest'
import { parse3utoolsText } from './parse-3utools'

const SAMPLE_IPHONE_12 = `iPhone 12 Black 64GB
ActivationState                                   Activated
ProductType                                       iPhone13,2
HardwareModel                                     D53gAP
DeviceColor                                       1
ModelNumber                                       MGJ53
RegionInfo                                        HN/A
InternationalMobileEquipmentIdentity              350640544361503
InternationalMobileEquipmentIdentity2             350640544181869
SerialNumber                                      HT2HX28G0F0N`

describe('parse3utoolsText', () => {
  it('interpreta primeira linha "Modelo Cor XXGB"', () => {
    const parsed = parse3utoolsText(SAMPLE_IPHONE_12)
    expect(parsed.model).toBe('iPhone 12')
    expect(parsed.color).toBe('Black')
    expect(parsed.storage_gb).toBe('64')
  })

  it('interpreta primeira linha "Modelo XXGB Cor"', () => {
    const parsed = parse3utoolsText(`iPhone 15 Pro Max 256GB Blue Titanium
ProductType                                       iPhone16,2`)
    expect(parsed.model).toBe('iPhone 15 Pro Max')
    expect(parsed.storage_gb).toBe('256')
    expect(parsed.color).toBe('Blue Titanium')
  })

  it('usa ProductType quando não há linha de título', () => {
    const parsed = parse3utoolsText(`ProductType                                       iPhone13,2
HardwareModel                                     D53gAP
DeviceColor                                       1
SerialNumber                                      HT2HX28G0F0N`)
    expect(parsed.model).toBe('iPhone 12')
    expect(parsed.color).toBe('1')
  })

  it('não confunde iPhone13,2 com iPhone 13', () => {
    const parsed = parse3utoolsText(`ProductType                                       iPhone13,2`)
    expect(parsed.model).toBe('iPhone 12')
    expect(parsed.model).not.toBe('iPhone 13')
  })

  it('separa modelo e cor composta com GB no final', () => {
    const parsed = parse3utoolsText(`iPhone 12 Pro Max Pacific Blue 128GB
ProductType                                       iPhone13,4
HardwareModel                                     D54pAP`)
    expect(parsed.model).toBe('iPhone 12 Pro Max')
    expect(parsed.color).toBe('Pacific Blue')
    expect(parsed.storage_gb).toBe('128')
  })
})
