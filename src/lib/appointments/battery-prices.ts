import type { SupabaseClient } from '@supabase/supabase-js'
import { iphoneModels } from '@/lib/data/hotsite-loja'
import { CONECTIZE_HOST_ORGANIZATION_ID } from '@/lib/organizations/constants'

export const BOOKING_DISCOUNT_PERCENT = 5

const MODEL_KEYS: Record<string, readonly string[]> = {
	'iPhone 11': ['11'],
	'iPhone 11 Pro': ['11 pro'],
	'iPhone 11 Pro Max': ['11 pro max'],
	'iPhone 12': ['12 e 12 pro'],
	'iPhone 12 Pro': ['12 e 12 pro'],
	'iPhone 12 Pro Max': ['12 pro max'],
	'iPhone 13': ['13'],
	'iPhone 13 Pro': ['13 pro'],
	'iPhone 13 Pro Max': ['13 pro max'],
	'iPhone 14': ['14'],
	'iPhone 14 Plus': ['14 plus'],
	'iPhone 14 Pro': ['14 pro'],
	'iPhone 14 Pro Max': ['14 pro max'],
	'iPhone 15': ['15'],
	'iPhone 15 Plus': ['15 plus'],
	'iPhone 15 Pro': ['15 pro'],
	'iPhone 15 Pro Max': ['15 pro max'],
	'iPhone 16': ['16'],
	'iPhone 16 Plus': ['16 plus'],
	'iPhone 16 Pro': ['16 pro'],
	'iPhone 16 Pro Max': ['16 pro max'],
	'iPhone 17': ['17'],
	'iPhone 17 Pro': ['17 pro'],
	'iPhone 17 Pro Max': ['17 pro max'],
}

type BatteryProduct = {
	name: string
	salePriceCents: number
}

function batteryModelSuffix (name: string) {
	const lower = name.toLowerCase()
	const marker = 'modelo:'
	const index = lower.indexOf(marker)
	if (index < 0 || !lower.includes('bateria iphone')) return ''
	return name.slice(index + marker.length).trim().toLowerCase()
}

function suffixMatches (suffix: string, key: string) {
	if (suffix === key) return true
	if (!suffix.startsWith(key)) return false
	const rest = suffix.slice(key.length)
	return rest.startsWith(':') || rest.startsWith(' plus:')
}

export function discountedPriceCents (priceCents: number) {
	if (priceCents <= 0) return 0
	return Math.round((priceCents * (100 - BOOKING_DISCOUNT_PERCENT)) / 100)
}

export function matchBatteryProduct <T extends BatteryProduct> (model: string, products: readonly T[]) {
	const keys = MODEL_KEYS[model] || []
	if (!keys.length) return null
	const matches = products.filter((product) => {
		const suffix = batteryModelSuffix(product.name)
		return keys.some((key) => suffixMatches(suffix, key))
	})
	return matches.find((product) => product.salePriceCents > 0) ?? matches[0] ?? null
}

export function mapBatteryPrices (products: readonly BatteryProduct[]) {
	const prices: Record<string, number> = {}
	for (const model of iphoneModels) {
		const match = matchBatteryProduct(model, products)
		if (match && match.salePriceCents > 0) prices[model] = match.salePriceCents
	}
	return prices
}

export async function loadBatteryMaintenancePrices (supabase: SupabaseClient) {
	const { data, error } = await supabase
		.from('products')
		.select('name, sale_price_cents')
		.eq('organization_id', CONECTIZE_HOST_ORGANIZATION_ID)
		.eq('is_active', true)
		.ilike('name', '%Bateria iPhone Modelo:%')
	if (error) {
		console.error('[bateria-precos]', error.message)
		return {}
	}
	return mapBatteryPrices((data ?? []).map((row) => ({
		name: String(row.name || ''),
		salePriceCents: Number(row.sale_price_cents) || 0,
	})))
}
