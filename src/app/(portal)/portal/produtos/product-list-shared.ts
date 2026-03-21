export type ProductRow = {
	id: string
	bling_id?: string | null
	bling_sync_pending?: boolean
	parent_bling_id?: string | null
	kind?: 'product' | 'service' | null
	name: string
	sku?: string | null
	barcode?: string | null
	image_url?: string | null
	sale_price_cents?: number | null
	cost_price_cents?: number | null
	is_active?: boolean
	created_at?: string
	current_stock?: number
	has_stock_movements?: boolean
	is_variation?: boolean
	parent_name?: string | null
}

const allowedImageHosts = new Set<string>([
	'm.media-amazon.com',
	'http2.mlstatic.com',
	'elastobor.vtexassets.com',
	'nacionalsmart.com.br',
])

export function isAllowedProductImageHost (hostname: string): boolean {
	const h = hostname.toLowerCase()
	if (allowedImageHosts.has(h)) return true
	if (h === 'bling.com.br' || h.endsWith('.bling.com.br')) return true
	if (h === 'tcdn.com.br' || h.endsWith('.tcdn.com.br')) return true
	return false
}

/** Checklist na tabela: quadrado, cinza claro; cor primária só quando totalmente marcado. */
export const productTableCheckboxClass =
	'h-[18px] w-[18px] shrink-0 rounded-[3px] border shadow-none ring-offset-background ' +
	'border-muted-foreground/20 bg-muted/50 text-primary-foreground ' +
	'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground ' +
	'data-[state=indeterminate]:border-muted-foreground/35 data-[state=indeterminate]:bg-muted/60 data-[state=indeterminate]:text-muted-foreground ' +
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
	'disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-3.5 [&_svg]:w-3.5'
