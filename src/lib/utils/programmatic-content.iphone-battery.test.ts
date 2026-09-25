import { describe, expect, it } from 'vitest'
import { brands, getServiceBySlug } from '@/lib/data/services'
import { generateProgrammaticContent } from '@/lib/utils/programmatic-content'

const service = getServiceBySlug('troca-de-bateria')
const brand = brands.apple
const iphone = brand.deviceTypes.iphone

describe('conteúdo de troca de bateria iPhone', () => {
  it('trata o hub como a página geral', () => {
    if (!service) throw new Error('serviço ausente')
    const content = generateProgrammaticContent({ service, brand, deviceType: iphone })

    expect(content.title).toBe('Troca de Bateria iPhone em BH | Conectize')
    expect(content.h1).toBe('Troca de Bateria do iPhone em Belo Horizonte')
    expect(content.description).toContain('iPhone')
    expect(content.description).toContain('Belo Horizonte')
    expect(content.description).toContain('12 meses')
    expect(content.description.length).toBeGreaterThanOrEqual(120)
    expect(content.description.length).toBeLessThanOrEqual(155)
    expect(content.sections.intro).toContain('Trocamos a bateria do iPhone')
    expect(content.sections.intro).not.toMatch(/página geral|página própria|abaixo estão/i)
    expect(content.sections.faq.find((item) => item.q.includes('garantia'))?.a).toContain('12 meses')
  })

  it('trata a página do iPhone 13 como intenção específica', () => {
    if (!service) throw new Error('serviço ausente')
    const content = generateProgrammaticContent({
      service,
      brand,
      deviceType: iphone,
      model: {
        slug: 'iphone-13',
        name: 'iphone-13',
        displayName: 'iPhone 13',
        brand: 'apple',
        deviceType: 'iphone',
        service: 'troca-de-bateria'
      }
    })

    expect(content.title).toBe('Troca de Bateria iPhone 13 em BH | Conectize')
    expect(content.h1).toBe('Troca de Bateria do iPhone 13 em Belo Horizonte')
    expect(content.description).toContain('iPhone 13')
    expect(content.description).not.toContain('Ideal para iPhone com queda')
    expect(content.description.length).toBeGreaterThanOrEqual(120)
    expect(content.description.length).toBeLessThanOrEqual(155)
    expect(content.sections.intro).toContain('iPhone 13')
    expect(content.sections.intro).not.toMatch(/página geral|página própria|esta página/i)
  })
})
