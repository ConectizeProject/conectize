/**
 * Datas (YYYY-MM-DD, America/Sao_Paulo) em que a loja não agenda.
 * Edite esta lista para incluir ou remover feriados.
 */
export const FERIADOS_LOJA: readonly string[] = [
	'2026-11-20',
	'2026-12-25',
	'2027-01-01',
]

const feriadoSet = new Set(FERIADOS_LOJA)

export function isFeriadoLoja (dateKey: string) {
	return feriadoSet.has(dateKey)
}
