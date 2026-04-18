'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { OrderStatusBlockerAlertDialog } from './OrderStatusBlockerAlertDialog'
import { useOrderStatusUpdate } from './use-order-status-update'
import { Button } from '@/components/ui/button'
import { Printer, MessageCircle, Mail, Copy, Tag, MoreVertical, Trash2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { getLabelWindowFeatures, getPrintWindowFeatures } from '@/lib/ordem-print'
import { buildOrderMessage } from '@/lib/ordem-share-message'
import { ORDER_STATUS_LABELS } from '@/lib/orders/order-status'
import { formatPhoneForWhatsApp } from '@/lib/utils/format-phone'
import type { PortalOrdensListRow } from '@/lib/orders/portal-ordens-list-types'

type Props = {
	order: PortalOrdensListRow
	canDelete?: boolean
}

export function OrdensRowActions({ order, canDelete = false }: Props) {
	const router = useRouter()
	const { updating, updateStatus, blockerDialog, dismissBlockers } = useOrderStatusUpdate()
	const [fetchedPublicUrl, setFetchedPublicUrl] = useState<string | null>(null)
	const [deleteOpen, setDeleteOpen] = useState(false)
	const [deleteSubmitting, setDeleteSubmitting] = useState(false)

	const customer = order.customers
	const deviceModel = order.device_models
	const displayNumber = order.display_number ?? order.id
	const customerName = customer?.is_company ? (customer?.company_name || customer?.full_name || '') : (customer?.full_name || '')
	const device = deviceModel
		? [deviceModel.brand, deviceModel.device_type, deviceModel.model].filter(Boolean).join(' • ') || '-'
		: '-'
	const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status

	const publicPath = order.share_token ? `/os/${order.share_token}` : null
	const orderHref =
		fetchedPublicUrl ??
		(publicPath && typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : '')

	useEffect(() => {
		if (publicPath || fetchedPublicUrl) return
		let cancelled = false
		fetch(`/api/portal/ordens/${order.id}/share-link`)
			.then((res) => res.json())
			.then((data) => {
				if (!cancelled && data?.url) setFetchedPublicUrl(data.url)
			})
			.catch(() => { })
		return () => { cancelled = true }
	}, [order.id, publicPath, fetchedPublicUrl])
	const message = orderHref ? buildOrderMessage({
		displayNumber,
		title: order.title,
		customerName,
		device,
		status: statusLabel,
		estimatedReadyAt: order.estimated_ready_at,
		orderHref,
		titleSuffix: false,
		includeStatus: false,
	}) : ''

	const whatsappNumber = customer?.mobile_phone ? formatPhoneForWhatsApp(customer.mobile_phone) : ''
	const whatsappHref = whatsappNumber && message ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : null
	const mailtoHref = customer?.email && message
		? `mailto:${customer.email}?subject=${encodeURIComponent(`Ordem de Serviço #${displayNumber} - Conectize`)}&body=${encodeURIComponent(message)}`
		: null

	async function handleStatusChange(
		newStatus: string,
		options?: {
			confirmIncompleteExit?: boolean
			confirmFinalizeWithoutWarranty?: boolean
		},
	) {
		await updateStatus(order.id, newStatus, {
			confirmIncompleteExit: options?.confirmIncompleteExit === true,
			confirmFinalizeWithoutWarranty:
				options?.confirmFinalizeWithoutWarranty === true,
		})
	}

	async function handleConfirmDelete() {
		setDeleteSubmitting(true)
		try {
			const res = await fetch(`/api/portal/ordens/${order.id}`, {
				method: 'DELETE',
			})
			const data = await res.json().catch(() => null)
			if (!res.ok || !data?.ok) {
				toast({ title: 'Erro ao excluir OS', variant: 'destructive' })
				return
			}
			toast({
				variant: 'success',
				title: 'OS excluída',
				description: `Ordem #${displayNumber} excluída com sucesso.`,
			})
			router.refresh()
		} finally {
			setDeleteSubmitting(false)
		}
	}

	const itemClass = 'py-1 px-2 text-xs'
	const iconClass = 'h-3.5 w-3.5 mr-1.5 shrink-0'

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="sm" className="h-7 w-3 p-0" aria-label="Mais opções">
						<MoreVertical className="h-3.5 w-3.5" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-36 p-1">
					<DropdownMenuItem
						className={itemClass}
						onClick={() => window.open(`/api/portal/ordens/${order.id}/print`, '_blank', getPrintWindowFeatures())}
					>
						<Printer className={iconClass} />
						Imprimir OS
					</DropdownMenuItem>
					<DropdownMenuItem
						className={itemClass}
						onClick={() => window.open(`/api/portal/ordens/${order.id}/label`, '_blank', getLabelWindowFeatures())}
					>
						<Tag className={iconClass} />
						Imprimir etiqueta
					</DropdownMenuItem>
					{whatsappHref ? (
						<DropdownMenuItem asChild>
							<a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={itemClass}>
								<MessageCircle className={iconClass} />
								Enviar WhatsApp
							</a>
						</DropdownMenuItem>
					) : null}
					{message ? (
						<DropdownMenuItem
							className={itemClass}
							onClick={() => {
								navigator?.clipboard?.writeText(message).then(() => {
									toast({
										variant: 'success',
										title: 'Copiado',
										description: 'Dados copiados para a área de transferência.',
										duration: 2000,
									})
								}).catch(() => {
									toast({
										variant: 'destructive',
										title: 'Não foi possível copiar',
										description: 'Permita o uso da área de transferência ou copie manualmente.',
									})
								})
							}}
						>
							<Copy className={iconClass} />
							Copiar dados
						</DropdownMenuItem>
					) : null}
					{mailtoHref ? (
						<DropdownMenuItem asChild>
							<a href={mailtoHref} className={itemClass}>
								<Mail className={iconClass} />
								Enviar por email
							</a>
						</DropdownMenuItem>
					) : null}
					<DropdownMenuSeparator className="my-1" />
					<DropdownMenuItem asChild className={itemClass}>
						<Link href={`/portal/ordens/nova?duplicate=${order.id}`} className="flex items-center">
							<Copy className={iconClass} />
							Duplicar OS
						</Link>
					</DropdownMenuItem>
					<DropdownMenuSub>
						<DropdownMenuSubTrigger disabled={updating} className={itemClass}>
							Alterar status
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent className="min-w-36 p-1">
							{Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
								<DropdownMenuItem
									key={value}
									className={itemClass}
									onClick={() => {
										void handleStatusChange(value)
									}}
									disabled={updating || order.status === value}
								>
									{label}
								</DropdownMenuItem>
							))}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					{canDelete ? (
						<>
							<DropdownMenuSeparator className="my-1" />
							<DropdownMenuItem
								className={`${itemClass} text-destructive focus:text-destructive`}
								onSelect={(e) => {
									e.preventDefault()
									setDeleteOpen(true)
								}}
							>
								<Trash2 className={iconClass} />
								Excluir OS
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>

			<OrderStatusBlockerAlertDialog
				open={!!blockerDialog}
				blocker={blockerDialog}
				updating={updating}
				onOpenChange={(open) => {
					if (!open) dismissBlockers()
				}}
				onConfirm={() => {
					if (!blockerDialog) return
					void handleStatusChange(blockerDialog.status, {
						confirmIncompleteExit: blockerDialog.exit,
						confirmFinalizeWithoutWarranty: blockerDialog.warranty,
					})
				}}
			/>

			{canDelete ? (
				<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Excluir ordem de serviço?</AlertDialogTitle>
							<AlertDialogDescription>
								A ordem <strong>#{displayNumber}</strong> — {order.title} — será excluída permanentemente. Esta ação não pode ser desfeita.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={deleteSubmitting}>Cancelar</AlertDialogCancel>
							<AlertDialogAction
								onClick={(e) => {
									e.preventDefault()
									handleConfirmDelete()
								}}
								disabled={deleteSubmitting}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								{deleteSubmitting ? 'Excluindo…' : 'Excluir'}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			) : null}
		</>
	)
}
