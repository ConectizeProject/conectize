'use client'

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ENTRY_CHECK_ITEMS } from '@/lib/orders/entry-check-items'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, Minus, X } from 'lucide-react'
import { useState } from 'react'

export type PublicChecksParsed = {
	status: string
	checks: Record<string, 'ok' | 'fail' | 'na'>
}

type OsPublicDeviceChecksSectionProps = {
	title: string
	/** Usado no resumo quando o aparelho não pôde ser testado */
	momentShort: 'abertura' | 'saída'
	parsed: PublicChecksParsed
}

function buildSummaryLine (parsed: PublicChecksParsed, momentShort: 'abertura' | 'saída'): string {
	if (parsed.status !== 'operante') {
		return `Aparelho não testado no momento da ${momentShort} — toque para ver o motivo`
	}
	const keys = Object.keys(parsed.checks)
	if (keys.length === 0) {
		return 'Nenhum teste registrado no checklist.'
	}
	let ok = 0
	let fail = 0
	let na = 0
	for (const k of keys) {
		const v = parsed.checks[k]
		if (v === 'ok') ok++
		else if (v === 'fail') fail++
		else if (v === 'na') na++
	}
	const total = ok + fail + na
	const bits: string[] = []
	if (ok) bits.push(`${ok} OK`)
	if (fail) bits.push(`${fail} não OK`)
	if (na) bits.push(`${na} não se aplica`)
	return `${total} ${total === 1 ? 'item' : 'itens'} — ${bits.join(' · ')}`
}

const NOT_TESTED_BODY =
	'Não foi possível testar o aparelho (estava desligado ou com display apagado/danificado).'

export function OsPublicDeviceChecksSection ({
	title,
	momentShort,
	parsed,
}: OsPublicDeviceChecksSectionProps) {
	const [open, setOpen] = useState(false)
	const notTested = parsed.status !== 'operante'
	const summaryLine = buildSummaryLine(parsed, momentShort)

	return (
		<Collapsible open={open} onOpenChange={setOpen} className="space-y-2">
			<CollapsibleTrigger
				className={cn(
					'flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 text-left',
					'hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
				)}
			>
				<div className="min-w-0 flex-1 space-y-1">
					<h3 className="text-sm font-medium">{title}</h3>
					<p className="text-sm text-muted-foreground">{summaryLine}</p>
				</div>
				<ChevronDown
					className={cn(
						'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
						open && 'rotate-180',
					)}
					aria-hidden
				/>
			</CollapsibleTrigger>
			<CollapsibleContent className="pt-1">
				{notTested ? (
					<p className="text-sm text-amber-600 dark:text-amber-400 px-0.5">
						{NOT_TESTED_BODY}
					</p>
				) : Object.keys(parsed.checks).length === 0 ? (
					<p className="text-sm text-muted-foreground px-0.5">Nenhum teste registrado.</p>
				) : (
					<ul className="space-y-1.5">
						{ENTRY_CHECK_ITEMS.map((item) => {
							const value = parsed.checks[item.key]
							if (value === undefined) return null
							return (
								<li
									key={item.key}
									className="flex items-center justify-between gap-2 text-sm rounded-md border border-border px-3 py-2 bg-muted/20"
								>
									<span className="text-foreground">{item.label}</span>
									<span className="shrink-0 flex items-center gap-1">
										{value === 'ok' && (
											<>
												<Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
												<span className="text-emerald-600 dark:text-emerald-400">OK</span>
											</>
										)}
										{value === 'fail' && (
											<>
												<X className="h-4 w-4 text-destructive" aria-hidden />
												<span className="text-destructive">Não OK</span>
											</>
										)}
										{value === 'na' && (
											<>
												<Minus className="h-4 w-4 text-muted-foreground" aria-hidden />
												<span className="text-muted-foreground">Não se aplica</span>
											</>
										)}
									</span>
								</li>
							)
						})}
					</ul>
				)}
			</CollapsibleContent>
		</Collapsible>
	)
}
