'use client'

import { Copy } from 'lucide-react'
import { maskImeiForDisplay } from '@/lib/seminovos/mask-imei'
import { copyImeiWithPortalToast } from '@/lib/seminovos/resale-portal-clipboard'
import { cn } from '@/lib/utils'

type Props = {
	imei: string | null | undefined
	className?: string
}

export function ResaleMaskedImeiButton({ imei, className }: Props) {
	const raw = String(imei ?? '').trim()
	const masked = maskImeiForDisplay(raw)
	if (!masked) return null

	return (
		<button
			type="button"
			title="Clique para copiar IMEI"
			aria-label={`Copiar IMEI ${masked}`}
			className={cn(
				'inline-flex max-w-full min-w-0 items-center gap-1 rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-[color,background-color,transform] duration-100 ease-out hover:bg-muted hover:text-foreground active:scale-95',
				className,
			)}
			onClick={(e) => {
				e.preventDefault()
				e.stopPropagation()
				void copyImeiWithPortalToast(raw)
			}}
		>
			<span className="truncate tabular-nums">{masked}</span>
			<Copy className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
		</button>
	)
}
