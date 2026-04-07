'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { OrdensRowActions } from './OrdensRowActions'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { getOrdemPortalPath } from '@/lib/orders/ordem-portal-path'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

type Props = {
	order: PortalOrdensListRow
	canDelete?: boolean
}

export function OrdemCard({ order, canDelete }: Props) {
	const customerName = order.customers?.full_name || order.customers?.company_name || '-'
	const deviceText = order.device_models
		? [order.device_models.brand, order.device_models.device_type, order.device_models.model].filter(Boolean).join(' • ') || '-'
		: '-'
	const cpfCnpj = formatCpfCnpj(String(order.customers?.cnpj || order.customers?.cpf))

	return (
		<Link
      href={getOrdemPortalPath(order)}
			draggable={false}
			onDragStart={(e) => e.preventDefault()}
			className="block w-[320px] max-w-[320px] shrink-0 transition-colors hover:opacity-95"
		>
			<Card className="h-full cursor-pointer transition-colors hover:bg-muted/50" draggable={false}>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 bg-muted/30 p-5 pt-3 pb-3">
					<span className="font-semibold">#{order.display_number ?? order.id}</span>
					<OrdensRowActions order={order} canDelete={canDelete} />
				</CardHeader>
				<CardContent className="space-y-2 p-5 pt-3">
					<p className="font-medium leading-tight">{order.title}</p>
					<dl className="grid gap-1 text-sm text-muted-foreground">
						<div className="flex justify-between gap-2">
							<dt>Cliente</dt>
							<dd className="max-w-[180px] truncate text-right" title={customerName}>{customerName}</dd>
						</div>
						<div className="flex justify-between gap-2">
							<dt>Dispositivo</dt>
							<dd className="max-w-[180px] truncate text-right" title={deviceText}>{deviceText}</dd>
						</div>
						<div className="flex justify-between gap-2">
							<dt>CPF/CNPJ</dt>
							<dd>{cpfCnpj}</dd>
						</div>
						<div className="flex justify-between gap-2">
							<dt>Criada</dt>
							<dd>{formatDateTimeBr(order.created_at)}</dd>
						</div>
						{order.estimated_ready_at ? (
							<div className="flex justify-between gap-2">
								<dt>Estimativa</dt>
								<dd>{formatDateTimeBr(order.estimated_ready_at)}</dd>
							</div>
						) : null}
						{order.closed_at ? (
							<div className="flex justify-between gap-2">
								<dt>Finalizada</dt>
								<dd>{formatDateTimeBr(order.closed_at)}</dd>
							</div>
						) : null}
					</dl>
				</CardContent>
			</Card>
		</Link>
	)
}
