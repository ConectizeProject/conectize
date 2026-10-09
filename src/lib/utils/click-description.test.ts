import { describe, expect, it } from 'vitest'
import { resolveBatteryModelLanding } from '@/app/(marketing)/servicos/battery-model-page'
import { brands, services } from '@/lib/data/services'
import { formatModelName } from '@/lib/utils/format-model-name'
import { generateProgrammaticContent } from '@/lib/utils/programmatic-content'
import { buildServiceProductSlug } from '@/lib/utils/service-product-slug'

function assertClickDescription(description: string) {
	expect(description.length).toBeGreaterThanOrEqual(140)
	expect(description.length).toBeLessThanOrEqual(155)
	expect(description.endsWith('.')).toBe(true)
	expect(description).not.toMatch(
		/Conteúdo voltado|sinais comuns|FAQ específico/,
	)
	expect(description.includes(', com sinais')).toBe(false)
}

describe('descriptions de serviço orientadas a clique', () => {
	it('cobre serviço, marca e modelo sem cortar a frase', () => {
		for (const service of services) {
			for (const brandSlug of service.brands) {
				const brand = brands[brandSlug]
				if (!brand) continue
				const excluded = service.excludedDeviceTypes?.[brandSlug] || []
				for (const deviceType of Object.values(brand.deviceTypes)) {
					if (excluded.includes(deviceType.slug)) continue
					const hub = generateProgrammaticContent({
						service,
						brand,
						deviceType,
					})
					assertClickDescription(hub.description)
					expect(hub.title.length).toBeLessThanOrEqual(60)
					expect(hub.title).not.toMatch(/Smartphone .* Motorola|Apple BH/)

					for (const modelSlug of deviceType.models) {
						const content = generateProgrammaticContent({
							service,
							brand,
							deviceType,
							model: {
								slug: modelSlug,
								name: modelSlug,
								displayName: formatModelName(modelSlug),
								brand: brand.slug,
								deviceType: deviceType.slug,
								service: service.slug,
							},
						})
						assertClickDescription(content.description)
						expect(content.title.length).toBeLessThanOrEqual(60)
						expect(content.title).toContain(
							formatModelName(modelSlug).split(' ')[0]
								? formatModelName(modelSlug)
								: modelSlug,
						)
						expect(content.description).toContain(formatModelName(modelSlug))
					}
				}
			}
		}
	})

	it('diferencia iPhone 17 Pro Max e Moto G54', () => {
		const screen = services.find((service) => service.slug === 'troca-de-tela')
		if (!screen) throw new Error('serviço ausente')
		const iphone = generateProgrammaticContent({
			service: screen,
			brand: brands.apple,
			deviceType: brands.apple.deviceTypes.iphone,
			model: {
				slug: 'iphone-17-pro-max',
				name: 'iphone-17-pro-max',
				displayName: 'iPhone 17 Pro Max',
				brand: 'apple',
				deviceType: 'iphone',
				service: 'troca-de-tela',
			},
		})
		const moto = generateProgrammaticContent({
			service: screen,
			brand: brands.motorola,
			deviceType: brands.motorola.deviceTypes.smartphone,
			model: {
				slug: 'moto-g54',
				name: 'moto-g54',
				displayName: 'Moto G54',
				brand: 'motorola',
				deviceType: 'smartphone',
				service: 'troca-de-tela',
			},
		})

		expect(iphone.title).toBe(
			'Troca de tela do iPhone 17 Pro Max em BH | Conectize',
		)
		expect(moto.title).toBe(
			'Troca de tela do Moto G54 em BH com garantia | Conectize',
		)
		expect(iphone.description).toContain('iPhone 17 Pro Max')
		expect(moto.description).toContain('Moto G54')
		expect(moto.description).not.toContain('Smartphone')
		assertClickDescription(iphone.description)
		assertClickDescription(moto.description)

		const batteryIphone = resolveBatteryModelLanding(
			buildServiceProductSlug({
				serviceSlug: 'troca-de-bateria',
				brandSlug: 'apple',
				modelSlug: 'iphone-17-pro-max',
			}),
		)
		const batteryMoto = resolveBatteryModelLanding(
			buildServiceProductSlug({
				serviceSlug: 'troca-de-bateria',
				brandSlug: 'motorola',
				modelSlug: 'moto-g54',
			}),
		)
		expect(batteryIphone?.seo.title).toBe(
			'Troca de Bateria iPhone 17 Pro Max em BH | Conectize',
		)
		expect(batteryMoto?.seo.title).toBe(
			'Troca de Bateria Moto G54 em BH | Conectize',
		)
		assertClickDescription(batteryIphone?.seo.description || '')
		assertClickDescription(batteryMoto?.seo.description || '')
		expect(batteryIphone?.seo.description).toContain('12 meses')
		expect(batteryMoto?.seo.description).toContain('Moto G54')
	})
})
