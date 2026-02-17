/**
 * Utilitários para formatação e parsing de valores monetários em centavos.
 */

export function parseMoneyToCents(value: string): number {
	const cleaned = String(value || '')
		.trim()
		.replace(/\s/g, '')
		.replace(/\./g, '')
		.replace(',', '.')
		.replace(/[^0-9.-]/g, '')

	const n = Number.parseFloat(cleaned)
	if (!Number.isFinite(n)) return 0
	if (n <= 0) return 0
	return Math.round(n * 100)
}

export function formatCentsBr(cents: number): string {
	const n = Number(cents || 0) / 100
	return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatMoneyInputBr(value: string): string {
	const digits = String(value || '').replace(/\D/g, '').slice(0, 12)
	if (!digits) return ''

	const cents = Number.parseInt(digits, 10)
	if (!Number.isFinite(cents) || cents <= 0) return '0,00'

	const n = cents / 100
	return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
