import { describe, expect, it } from 'vitest'
import { batteryModelFromQuery } from './battery-model-query'

describe('batteryModelFromQuery', () => {
	it('resolve o slug sem confundir Pro e Pro Max', () => {
		expect(batteryModelFromQuery('iphone-13')).toBe('iPhone 13')
		expect(batteryModelFromQuery('iphone-13-pro')).toBe('iPhone 13 Pro')
		expect(batteryModelFromQuery('iphone-13-pro-max')).toBe('iPhone 13 Pro Max')
		expect(batteryModelFromQuery('iphone-14-plus')).toBe('iPhone 14 Plus')
	})

	it('aceita o nome do modelo e ignora valor desconhecido', () => {
		expect(batteryModelFromQuery('iPhone 17 Pro Max')).toBe('iPhone 17 Pro Max')
		expect(batteryModelFromQuery('iphone-13-mini')).toBe('')
		expect(batteryModelFromQuery('')).toBe('')
		expect(batteryModelFromQuery(null)).toBe('')
	})
})
