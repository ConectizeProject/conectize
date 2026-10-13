'use client'

import { Barcode, Check, Copy, Loader2, X } from 'lucide-react'

export type ProductBarcodeJob = {
	barcode: string
	status: 'saving' | 'success' | 'error'
}

type Props = {
	serverBarcode: string | null
	job: ProductBarcodeJob | null
	onGenerate: () => void
	onCopy: (text: string) => void
	textClassName?: string
}

export function ProductListBarcodeCell ({
	serverBarcode,
	job,
	onGenerate,
	onCopy,
	textClassName = 'text-sm',
}: Props) {
	const displayBarcode = serverBarcode || job?.barcode || null
	const status = job?.status ?? null

	if (!displayBarcode) {
		return (
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation()
					onGenerate()
				}}
				className={`inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded border border-border/60 bg-muted/70 px-1.5 py-0.5 text-left font-mono transition-colors hover:bg-muted ${textClassName}`}
				aria-label="Gerar código de barras"
				title="Gerar código de barras"
			>
				<Barcode className="h-3 w-3 text-muted-foreground" />
				<span className="truncate">Gerar</span>
			</button>
		)
	}

	return (
		<div
			className={`inline-flex max-w-full min-w-0 items-center gap-1 rounded border border-border/60 bg-muted/70 px-1.5 py-0.5 font-mono ${textClassName}`}
			aria-busy={status === 'saving' || undefined}
		>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation()
					onCopy(displayBarcode)
				}}
				className="inline-flex min-w-0 cursor-pointer items-center gap-1 text-left"
				title="Clique para copiar"
			>
				<span className="truncate">{displayBarcode}</span>
				<Copy className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
			</button>
			{status === 'saving' ? (
				<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
			) : null}
			{status === 'success' ? (
				<Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Salvo" />
			) : null}
			{status === 'error' ? (
				<X className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Falha ao salvar" />
			) : null}
		</div>
	)
}
