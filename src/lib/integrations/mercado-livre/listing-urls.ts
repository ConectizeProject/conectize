const MLB_ITEM_ID_PATTERN = /^MLB\d+$/i

/**
 * URL do painel do vendedor para editar um anúncio no Mercado Livre Brasil.
 * Ex.: https://www.mercadolivre.com.br/anuncios/MLB123/modificar/bomni
 */
export function meliListingEditUrl(
	mlItemId: string | null | undefined,
): string | null {
	const id = String(mlItemId || '')
		.replace(/^#/, '')
		.trim()
		.toUpperCase()
	if (!MLB_ITEM_ID_PATTERN.test(id)) return null
	return `https://www.mercadolivre.com.br/anuncios/${id}/modificar/bomni`
}
