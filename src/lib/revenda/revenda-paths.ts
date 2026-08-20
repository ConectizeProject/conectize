/** Base URL da área de revenda (aparelhos à venda). */
export const REVENDA_BASE = '/portal/revendaaparelhos'

/** Segmentos estáticos irmãos de `[id]` — não são IDs de aparelho. */
export const REVENDA_RESERVED_SEGMENTS = [
	'nova',
	'listagem',
	'referencia-precos',
	'seminovos',
] as const

export function isRevendaReservedSegment (id: string): boolean {
	return (REVENDA_RESERVED_SEGMENTS as readonly string[]).includes(id)
}

export const revendaPath = {
	/** Listagem unificada (raiz da área). */
	listagem: REVENDA_BASE,
	device: (id: string) => `${REVENDA_BASE}/${id}`,
	vitrine: (id: string) => `${REVENDA_BASE}/${id}/vitrine`,
	nova: `${REVENDA_BASE}/nova`,
	novaNovo: `${REVENDA_BASE}/nova/novo`,
	referenciaPrecos: `${REVENDA_BASE}/referencia-precos`,
}
