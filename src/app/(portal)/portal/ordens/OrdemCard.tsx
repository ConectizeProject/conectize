'use client'

import { Calendar, Smartphone, User } from 'lucide-react'
import Link from 'next/link'
import type { MouseEvent } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'
import type {
	PortalOrdensCustomerSummary,
	PortalOrdensDeviceModelSummary,
	PortalOrdensListRow,
} from '@/lib/orders/portal-ordens-list-types'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateTimeShortBrNoComma } from '@/lib/utils/format-date'
import { formatPhoneBr } from '@/lib/utils/format-phone'
import { onlyDigits } from '@/lib/utils/strings'
import { OrdensRowActions } from './OrdensRowActions'

/** CNPJ: 14 dígitos (ou armazenado no campo cpf com mais de 11 dígitos). */
function customerDocIsCnpj (c: PortalOrdensCustomerSummary | null): boolean {
	if (!c) return false
	const cnpjDigits = onlyDigits(String(c.cnpj ?? ''))
	if (cnpjDigits.length > 11) return true
	const cpfFieldDigits = onlyDigits(String(c.cpf ?? ''))
	return cpfFieldDigits.length > 11
}

function formatDeviceCardLine(dm: PortalOrdensDeviceModelSummary | null): string {
	if (!dm) return '—'
	const brandRaw = dm.brand?.trim() || ''
	const typeRaw = dm.device_type?.trim() || ''
	const modelRaw = dm.model?.trim() || ''
	const brandLower = brandRaw.toLowerCase()
	const typeLower = typeRaw.toLowerCase()
	const parts: string[] = []
	if (brandRaw && brandLower !== 'apple') {
		parts.push(brandRaw)
	}
	if (typeRaw && typeLower !== 'smartphone') {
		parts.push(typeRaw)
	}
	if (modelRaw) {
		parts.push(modelRaw)
	}
	return parts.length ? parts.join(' • ') : '—'
}

function formatOrdemCardDatesLine (order: PortalOrdensListRow): string {
	const parts: string[] = [formatDateTimeShortBrNoComma(order.created_at)]
	if (order.estimated_ready_at) {
		parts.push(formatDateTimeShortBrNoComma(order.estimated_ready_at))
	}
	if (order.closed_at) {
		parts.push(formatDateTimeShortBrNoComma(order.closed_at))
	}
	return parts.filter((p) => p && p !== '-').join(' • ') || '—'
}

type Props = {
	order: PortalOrdensListRow
	canDelete?: boolean
	/** Kanban / lista vertical: largura fluida em vez de cartão fixo para carrossel */
	layout?: 'carousel' | 'list'
	/** Kanban: evita navegar após soltar o arraste (clique fantasma no Link) */
	onLinkClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}

export function OrdemCard({ order, canDelete, layout = 'carousel', onLinkClick }: Props) {
	const customerName = order.customers?.full_name || order.customers?.company_name || '—'
	const deviceText = formatDeviceCardLine(order.device_models)
	const hideCpfCelular = customerDocIsCnpj(order.customers)
	const cpfCnpjFmt = formatCpfCnpj(String(order.customers?.cnpj || order.customers?.cpf || ''))
	const celularFmt = formatPhoneBr(order.customers?.mobile_phone)
	const cpfCelularLine = hideCpfCelular
		? ''
		: [cpfCnpjFmt || null, celularFmt].filter(Boolean).join(' • ') || '—'
	const datesLine = formatOrdemCardDatesLine(order)

	const shellClass =
		layout === 'list'
			? 'relative block w-full max-w-full min-w-0'
			: 'relative block w-[320px] max-w-[320px] shrink-0'
	const ordemHref = getOrdemPortalPath(order)
	const linkClass = 'min-w-0 flex-1 truncate font-semibold transition-colors hover:opacity-95'

	return (
		<div className={shellClass}>
			<Card className="h-full cursor-pointer transition-colors hover:bg-muted/50" draggable={false}>
				<CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 bg-muted/30 p-0 px-4 pt-2 pb-2">
					<Link
						href={ordemHref}
						draggable={false}
						onDragStart={(e) => e.preventDefault()}
						onClick={onLinkClick}
						transitionTypes={['nav-forward']}
						className={linkClass}
					>
						#{order.display_number ?? order.id}
					</Link>
					<div
						className="relative z-20 shrink-0"
						onPointerDown={(e) => {
							e.stopPropagation()
						}}
						onClick={(e) => {
							e.preventDefault()
							e.stopPropagation()
						}}
					>
						<OrdensRowActions order={order} canDelete={canDelete} />
					</div>
				</CardHeader>
				<Link
					href={ordemHref}
					draggable={false}
					onDragStart={(e) => e.preventDefault()}
					onClick={onLinkClick}
					transitionTypes={['nav-forward']}
					className="block transition-colors hover:opacity-95"
				>
					<CardContent className="space-y-2 p-4">
						<p className="font-medium leading-tight">{order.title}</p>
						<div className="flex items-start gap-2">
							<User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
							<div className="min-w-0 flex-1 flex flex-col gap-0 text-sm text-muted-foreground">
								<p className="truncate leading-snug" title={customerName}>{customerName}</p>
								{hideCpfCelular ? null : (
									<p className="text-xs leading-snug text-muted-foreground" title={cpfCelularLine}>{cpfCelularLine}</p>
								)}
							</div>
						</div>
						<div className="flex items-start gap-2">
							<Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
							<p className="min-w-0 flex-1 truncate text-sm leading-snug text-muted-foreground" title={deviceText}>{deviceText}</p>
						</div>
						<div className="flex items-start gap-2">
							<Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
							<p className="min-w-0 flex-1 truncate text-sm leading-snug text-muted-foreground" title={datesLine}>{datesLine}</p>
						</div>
					</CardContent>
				</Link>
			</Card>
		</div>
	)
}
