export type MeliMosaicCell =
	| { kind: 'image'; url: string | null }
	| { kind: 'overflow'; extra: number }

export type MeliMosaicGridSlot = MeliMosaicCell | { kind: 'empty' }

function normalizeThumb(url: string | null | undefined): string | null {
	const t = String(url || '').trim()
	return t || null
}

/**
 * Mosaico no padrão do Mercado Livre:
 * 1–4 fotos; acima de 4, as 3 primeiras + célula `+(n − 3)`.
 */
export function buildMeliMosaicCells(
	thumbs: Array<string | null | undefined>,
): MeliMosaicCell[] {
	const list = thumbs.map(normalizeThumb)
	if (list.length === 0) return [{ kind: 'image', url: null }]
	if (list.length <= 4) {
		return list.map((url) => ({ kind: 'image' as const, url }))
	}
	return [
		...list.slice(0, 3).map((url) => ({ kind: 'image' as const, url })),
		{ kind: 'overflow', extra: list.length - 3 },
	]
}

/** Grade 2×2 fixa: 2 fotos no topo; 3 no L-superior; 4 preenche; 5+ com +N. */
export function buildMeliMosaicGridSlots(
	thumbs: Array<string | null | undefined>,
): MeliMosaicGridSlot[] {
	const cells = buildMeliMosaicCells(thumbs)
	if (cells.length <= 1) return cells

	const slots: MeliMosaicGridSlot[] = [...cells]
	while (slots.length < 4) {
		slots.push({ kind: 'empty' })
	}
	return slots.slice(0, 4)
}

export function meliMosaicUsesGrid(thumbCount: number): boolean {
	return thumbCount >= 2
}
