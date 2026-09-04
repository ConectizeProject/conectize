'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export function MeliCopyButton({
	value,
	display,
	ariaLabel,
	className,
}: {
	value: string
	display?: string
	ariaLabel?: string
	className?: string
}) {
	const [copied, setCopied] = useState(false)
	const timerRef = useRef<number | null>(null)

	useEffect(() => {
		return () => {
			if (timerRef.current != null) window.clearTimeout(timerRef.current)
		}
	}, [])

	const text = String(value || '').trim()
	if (!text) return null

	function handleCopy() {
		const write = navigator?.clipboard?.writeText(text)
		if (!write) {
			toast({
				variant: 'destructive',
				title: 'Não foi possível copiar',
				description: 'Área de transferência indisponível neste navegador.',
			})
			return
		}
		void write
			.then(() => {
				setCopied(true)
				if (timerRef.current != null) window.clearTimeout(timerRef.current)
				timerRef.current = window.setTimeout(() => setCopied(false), 1500)
				toast({
					description: 'Copiado para a área de transferência',
					duration: 2000,
				})
			})
			.catch(() => {
				toast({
					variant: 'destructive',
					title: 'Não foi possível copiar',
					description: 'Verifique permissões do site ou use HTTPS.',
				})
			})
	}

	return (
		<button
			type="button"
			onClick={handleCopy}
			title="Clique para copiar"
			aria-label={ariaLabel || `Copiar ${text}`}
			className={cn(
				'inline-flex max-w-full min-w-0 items-center gap-1 rounded border border-border/60 bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] text-foreground transition-[color,background-color,transform] duration-100 ease-out hover:bg-muted active:scale-95',
				className,
			)}
		>
			<span className="truncate">{display ?? text}</span>
			{copied ? (
				<Check className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
			) : (
				<Copy className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
			)}
		</button>
	)
}

export function MeliIdCopyButton({ id }: { id: string | null }) {
	const code = String(id || '')
		.replace(/^#/, '')
		.trim()
	if (!code) return null
	return (
		<MeliCopyButton
			value={code}
			display={`#${code}`}
			ariaLabel={`Copiar código ${code}`}
		/>
	)
}
