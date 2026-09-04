/**
 * Exibe IMEI censurado: 3 primeiros + *** + 3 últimos dígitos.
 * Usa só dígitos quando houver o suficiente; senão, o texto sem espaços.
 */
export function maskImeiForDisplay(
	imei: string | null | undefined,
): string | null {
	const raw = String(imei ?? '').trim()
	if (!raw) return null

	const digits = raw.replace(/\D/g, '')
	const source = digits.length >= 7 ? digits : raw.replace(/\s/g, '')
	if (!source) return null
	if (source.length < 7) return '***'

	return `${source.slice(0, 3)}***${source.slice(-3)}`
}
