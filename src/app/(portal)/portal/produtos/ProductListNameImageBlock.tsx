'use client'

import Image from 'next/image'
import { isAllowedProductImageHost, type ProductRow } from './product-list-shared'

type Props = {
	product: ProductRow
	/** Na tabela desktop, uma linha com reticências; nos cards, quebra de linha. */
	nameTruncate?: boolean
}

/**
 * Nome + miniatura. Em variações, a barrinha antes da foto fica no meio vertical (alinhada à miniatura).
 */
export function ProductListNameImageBlock ({ product, nameTruncate = false }: Props) {
	return (
		<div
			className={
				product.is_variation
					? 'relative flex min-w-0 items-center gap-3 pl-6'
					: 'flex min-w-0 items-start gap-3'
			}
		>
			{product.is_variation ? (
				<span
					className="absolute left-0 top-1/2 h-px w-5 -translate-y-1/2 bg-border"
					aria-hidden="true"
				/>
			) : null}
			<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card">
				{(() => {
					const url = product.image_url
					if (!url) {
						return null
					}
					try {
						const parsed = new URL(url)
						if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
							return null
						}
						if (!isAllowedProductImageHost(parsed.hostname)) {
							return null
						}
					} catch {
						return null
					}
					return (
						<Image
							src={url}
							alt={product.name}
							width={40}
							height={40}
							className="object-cover"
						/>
					)
				})() || (
					<span className="text-[10px] font-medium uppercase text-muted-foreground">
						{product.name?.slice(0, 2) || '?'}
					</span>
				)}
			</div>
			<div className="flex min-w-0 flex-col gap-0.5">
				<div className="flex flex-wrap items-center gap-2 font-medium">
					<span
						className={`min-w-0 ${nameTruncate ? 'truncate' : 'break-words'} ${product.is_active ? '' : 'text-muted-foreground line-through'}`}
					>
						{product.name}
					</span>
					{!product.is_active && (
						<span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
							Inativo
						</span>
					)}
					{product.bling_id && product.bling_sync_pending && (
						<span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
							Desincronizado
						</span>
					)}
				</div>
				{product.created_at && (
					<span className="text-[11px] text-muted-foreground">
						Criado em {new Date(product.created_at).toLocaleDateString('pt-BR')}
					</span>
				)}
			</div>
		</div>
	)
}
