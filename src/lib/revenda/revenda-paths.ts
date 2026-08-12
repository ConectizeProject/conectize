/** Base URL da área de revenda (aparelhos à venda). */
export const REVENDA_BASE = '/portal/revendaaparelhos'

export const revendaPath = {
	/** Listagem unificada (raiz da área). */
	listagem: REVENDA_BASE,
	device: (id: string) => `${REVENDA_BASE}/${id}`,
	vitrine: (id: string) => `${REVENDA_BASE}/${id}/vitrine`,
	nova: `${REVENDA_BASE}/nova`,
	novaNovo: `${REVENDA_BASE}/nova/novo`,
	referenciaPrecos: `${REVENDA_BASE}/referencia-precos`,
}
