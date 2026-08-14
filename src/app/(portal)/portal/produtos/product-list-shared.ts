import type { CSSProperties } from 'react'

export type ProductRow = {
	id: string
	bling_id?: string | null
	bling_sync_pending?: boolean
	parent_bling_id?: string | null
	parent_product_id?: string | null
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
	has_variations?: boolean
	parent_name?: string | null
}

export function productListShowsStock (product: ProductRow): boolean {
	if (product.kind === 'service') return false
	if (product.has_variations) return false
	return Boolean(product.has_stock_movements)
}

const MAX_PRODUCT_LIST_IMAGE_URL_LEN = 2048

/**
 * URLs de capa vindas do Bling, Tray, VTEX, lojas próprias, etc. — não dá para manter lista fechada de hosts.
 * Só aceita `http:` / `https:` com hostname válido (evita `javascript:` e esquemas estranhos).
 */
export function isSafeProductListImageUrl (raw: string): boolean {
	const t = String(raw || '').trim()
	if (!t || t.length > MAX_PRODUCT_LIST_IMAGE_URL_LEN) return false
	try {
		const u = new URL(t)
		if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
		if (!u.hostname || u.hostname.length > 253) return false
		return true
	} catch {
		return false
	}
}

/** Largura fixa em px da coluna do checkbox (tabela + card). Repetir no primeiro `<col>` do colgroup. */
export const productTableCheckboxColumnWidthPx = 32

/** Largura fixa da coluna Ações (última); alinhar ao último `<col>`. */
export const productTableActionsColumnWidthPx = 48

/**
 * Estilo inline para travar a 1ª coluna em px (evita sobra de `table-layout: fixed` ir para ela).
 * `head`: mantém padding vertical do cabeçalho.
 */
export function getProductTableCheckboxColumnStyle (variant: 'head' | 'body'): CSSProperties {
	const w = productTableCheckboxColumnWidthPx
	const base: CSSProperties = {
		width: w,
		maxWidth: w,
		minWidth: w,
		paddingLeft: 0,
		paddingRight: 0,
		boxSizing: 'border-box',
		overflow: 'hidden',
		verticalAlign: 'middle',
	}
	if (variant === 'head') {
		return { ...base, paddingTop: 8, paddingBottom: 8 }
	}
	return { ...base, padding: 0 }
}

/** Classes auxiliares (reforço Tailwind; largura real vem do style inline). */
export const productTableCheckboxColumnClass =
	'shrink-0 px-0 box-border overflow-hidden'

/** Checklist na tabela: quadrado, cinza claro; cor primária só quando totalmente marcado. */
export const productTableCheckboxClass =
	'h-[18px] w-[18px] shrink-0 rounded-[3px] border shadow-none ring-offset-background ' +
	'border-muted-foreground/20 bg-muted/50 text-primary-foreground ' +
	'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground ' +
	'data-[state=indeterminate]:border-muted-foreground/35 data-[state=indeterminate]:bg-muted/60 data-[state=indeterminate]:text-muted-foreground ' +
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
	'disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-3.5 [&_svg]:w-3.5'
