import { iphoneModels } from '@/lib/data/hotsite-loja'

export function batteryModelSlug (value: string) {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

/** Resolve `?modelo=iphone-13` (ou o nome do modelo) para o rótulo usado no agendamento. */
export function batteryModelFromQuery (value: string | null | undefined, models: readonly string[] = iphoneModels) {
	const slug = batteryModelSlug(String(value || '').trim())
	if (!slug) return ''
	return models.find((model) => batteryModelSlug(model) === slug) || ''
}
