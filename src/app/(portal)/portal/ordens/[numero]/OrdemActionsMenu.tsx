'use client'

import {
	Copy,
	History,
	Mail,
	MessageCircle,
	MoreVertical,
	Printer,
	Receipt,
	Tag,
	Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { Button } from '@/components/ui/button'
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
import { toast } from '@/hooks/use-toast'
import { getLabelWindowFeatures, getPrintWindowFeatures } from '@/lib/ordem-print'
import {
	buildOrderEmailSubject,
	buildOrderMessage,
} from '@/lib/ordem-share-message'
import {
	isExitConsiderationsEmpty,
	shouldRequireExitConsiderationsOnStatusChange,
} from '@/lib/orders/exit-considerations'
import { ORDER_STATUS_LABELS } from '@/lib/orders/order-status'
import { isOrderWarrantyTermsUnset } from '@/lib/orders/order-warranty-terms'
import { usePortalOrganizationName } from '@/lib/portal/portal-branding-context'
import { formatPhoneForWhatsApp } from '@/lib/utils/format-phone'
import { OrderStatusBlockerAlertDialog } from '../OrderStatusBlockerAlertDialog'
import { useOrderStatusUpdate } from '../use-order-status-update'
import { useOrderWhatsappShare } from '../use-order-whatsapp-share'
import { OrderEditHistoryDialog } from './OrderEditHistoryDialog'

type Props = {
	orderId: string
	publicOrderPath: string | null
	displayNumber: string | number
	title: string
	customerName: string
	device: string
	status: string
	estimatedReadyAt: string | null
	mobilePhone?: string | null
	email?: string | null
	isFinalized: boolean
	canDelete: boolean
	deleteOrderAction: (formData: FormData) => Promise<unknown>
	/** Permite excluir linhas do histórico dentro do diálogo */
	isAdmin?: boolean
	deviceExitChecks: unknown
	exitPhotoCount: number
	warrantyTemplateId: string | null
	warrantyText: string | null
}

export function OrdemActionsMenu({
	orderId,
	publicOrderPath,
	displayNumber,
	title,
	customerName,
	device,
	status,
	estimatedReadyAt,
	mobilePhone,
	email,
	isFinalized: _isFinalized,
	canDelete,
	deleteOrderAction,
	isAdmin = false,
	deviceExitChecks,
	exitPhotoCount,
	warrantyTemplateId,
	warrantyText,
}: Props) {
	const organizationName = usePortalOrganizationName()
	const {
		updating,
		updateStatus,
		blockerDialog,
		dismissBlockers,
		ReadyPickupConfirmDialog,
	} = useOrderStatusUpdate()
	const { openShare, shareLoading, ShareDialog } =
		useOrderWhatsappShare(orderId)
	const [historyOpen, setHistoryOpen] = useState(false)
	const [publicUrl, setPublicUrl] = useState<string | null>(
		publicOrderPath && typeof window !== 'undefined'
			? `${window.location.origin}${publicOrderPath}`
			: null,
	)
	const [deleteOpen, setDeleteOpen] = useState(false)
	const [deleteSubmitting, setDeleteSubmitting] = useState(false)
	const [exitConsiderationsOpen, setExitConsiderationsOpen] = useState(false)
	const [pendingFinalizeStatus, setPendingFinalizeStatus] = useState<
		string | null
	>(null)
	const [finalizeBlockers, setFinalizeBlockers] = useState<{
		exit: boolean
		warranty: boolean
	} | null>(null)

	useEffect(() => {
		if (publicOrderPath && typeof window !== 'undefined') {
			setPublicUrl(`${window.location.origin}${publicOrderPath}`)
			return
		}
		if (!publicOrderPath && orderId) {
			let cancelled = false
			fetch(`/api/portal/ordens/${orderId}/share-link`)
				.then((res) => res.json())
				.then((data) => {
					if (!cancelled && data?.url) setPublicUrl(data.url)
				})
				.catch(() => {})
			return () => {
				cancelled = true
			}
		}
	}, [orderId, publicOrderPath])

	const orderHref = publicUrl ?? ''
	const statusLabel = ORDER_STATUS_LABELS[status] ?? status
	const message = orderHref
		? buildOrderMessage({
				displayNumber,
				title,
				customerName,
				device,
				status: statusLabel,
				estimatedReadyAt,
				orderHref,
				organizationName,
			})
		: ''
	const whatsappNumber = mobilePhone ? formatPhoneForWhatsApp(mobilePhone) : ''
	const whatsappHref =
		whatsappNumber && message
			? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
			: null
	const mailtoHref =
		email && message
			? `mailto:${email}?subject=${encodeURIComponent(buildOrderEmailSubject(displayNumber, organizationName))}&body=${encodeURIComponent(message)}`
			: null

	async function handleStatusChange(
		newStatus: string,
		options?: {
			confirmIncompleteExit?: boolean
			confirmFinalizeWithoutWarranty?: boolean
		},
	) {
		const confirmIncompleteExit = options?.confirmIncompleteExit === true
		const confirmFinalizeWithoutWarranty =
			options?.confirmFinalizeWithoutWarranty === true
		if (
			!confirmIncompleteExit &&
			!confirmFinalizeWithoutWarranty &&
			shouldRequireExitConsiderationsOnStatusChange(status, newStatus)
		) {
			const exitEmpty = isExitConsiderationsEmpty(
				deviceExitChecks,
				exitPhotoCount,
			)
			const warrantyUnset = isOrderWarrantyTermsUnset({
				warranty_template_id: warrantyTemplateId,
				warranty_text: warrantyText,
			})
			if (exitEmpty || warrantyUnset) {
				setPendingFinalizeStatus(newStatus)
				setFinalizeBlockers({ exit: exitEmpty, warranty: warrantyUnset })
				setExitConsiderationsOpen(true)
				return
			}
		}

		const result = await updateStatus(orderId, newStatus, {
			confirmIncompleteExit,
			confirmFinalizeWithoutWarranty,
		})
		if (result === 'ok') {
			setExitConsiderationsOpen(false)
			setPendingFinalizeStatus(null)
			setFinalizeBlockers(null)
		}
	}

	async function handleConfirmDelete() {
		setDeleteSubmitting(true)
		try {
			const fd = new FormData()
			fd.set('orderId', orderId)
			await deleteOrderAction(fd)
		} finally {
			setDeleteSubmitting(false)
		}
	}

	return (
		<>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						aria-label="Mais opções"
						className="h-9 px-3"
					>
						<MoreVertical className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-48">
					<DropdownMenuItem
						onClick={() =>
							window.open(
								`/api/portal/ordens/${orderId}/print`,
								'_blank',
								getPrintWindowFeatures(),
							)
						}
					>
						<Printer className="h-4 w-4 mr-2" />
						Imprimir OS
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() =>
							window.open(
								`/api/portal/ordens/${orderId}/cupom`,
								'_blank',
								getPrintWindowFeatures(),
							)
						}
					>
						<Receipt className="h-4 w-4 mr-2" />
						Imprimir cupom
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() =>
							window.open(
								`/api/portal/ordens/${orderId}/label`,
								'_blank',
								getLabelWindowFeatures(),
							)
						}
					>
						<Tag className="h-4 w-4 mr-2" />
						Imprimir etiqueta
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{whatsappHref || message ? (
						<DropdownMenuItem
							disabled={shareLoading}
							onSelect={(e) => {
								e.preventDefault()
								void openShare(message, whatsappHref)
							}}
						>
							<MessageCircle className="h-4 w-4 mr-2" />
							{shareLoading ? 'Preparando…' : 'Enviar WhatsApp'}
						</DropdownMenuItem>
					) : null}
					{message ? (
						<DropdownMenuItem
							onClick={() => {
								navigator?.clipboard
									?.writeText(message)
									.then(() => {
										toast({
											variant: 'success',
											title: 'Copiado',
											description:
												'Dados copiados para a área de transferência.',
											duration: 2000,
										})
									})
									.catch(() => {
										toast({
											variant: 'destructive',
											title: 'Não foi possível copiar',
											description:
												'Permita o uso da área de transferência ou copie manualmente.',
										})
									})
							}}
						>
							<Copy className="h-4 w-4 mr-2" />
							Copiar dados
						</DropdownMenuItem>
					) : null}
					{mailtoHref ? (
						<DropdownMenuItem asChild>
							<a href={mailtoHref}>
								<Mail className="h-4 w-4 mr-2" />
								Enviar email
							</a>
						</DropdownMenuItem>
					) : null}
					{whatsappHref || message || mailtoHref ? (
						<DropdownMenuSeparator />
					) : null}
					<DropdownMenuItem
						onSelect={(e) => {
							e.preventDefault()
							setHistoryOpen(true)
						}}
					>
						<History className="h-4 w-4 mr-2" />
						Histórico de edições
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuSub>
						<DropdownMenuSubTrigger disabled={updating}>
							Alterar status
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							{Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
								<DropdownMenuItem
									key={value}
									onClick={() => {
										void handleStatusChange(value)
									}}
									disabled={updating || status === value}
								>
									{label}
								</DropdownMenuItem>
							))}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					{canDelete ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onSelect={(e) => {
									e.preventDefault()
									setDeleteOpen(true)
								}}
							>
								<Trash2 className="h-4 w-4 mr-2" />
								Excluir OS
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>

			<OrderEditHistoryDialog
				orderId={orderId}
				isAdmin={isAdmin}
				open={historyOpen}
				onOpenChange={setHistoryOpen}
			/>

			{ReadyPickupConfirmDialog}
			{ShareDialog}

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

			<AlertDialog
				open={exitConsiderationsOpen}
				onOpenChange={(open) => {
					setExitConsiderationsOpen(open)
					if (!open) {
						setPendingFinalizeStatus(null)
						setFinalizeBlockers(null)
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Antes de finalizar</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="space-y-3 text-sm text-muted-foreground">
								<p>
									{finalizeBlockers?.exit && finalizeBlockers?.warranty
										? 'Há pendências nesta ordem. Confira abaixo e confirme se deseja finalizar assim mesmo.'
										: 'Há uma pendência nesta ordem. Confira abaixo e confirme se deseja finalizar assim mesmo.'}
								</p>
								<ul className="list-disc space-y-2 pl-5 text-foreground">
									{finalizeBlockers?.exit ? (
										<li>
											Considerações de saída incompletas (checklist de saída
											e/ou fotos de saída não registrados).
										</li>
									) : null}
									{finalizeBlockers?.warranty ? (
										<li>
											Termos de garantia não definidos (sem modelo nem texto de
											garantia na ordem — impressão e link público ficarão sem
											termo para o cliente).
										</li>
									) : null}
								</ul>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={updating}>Voltar</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault()
								const next = pendingFinalizeStatus
								const blockers = finalizeBlockers
								if (!next || !blockers) return
								void handleStatusChange(next, {
									confirmIncompleteExit: blockers.exit,
									confirmFinalizeWithoutWarranty: blockers.warranty,
								})
							}}
							disabled={updating || !pendingFinalizeStatus || !finalizeBlockers}
						>
							{updating ? 'Salvando…' : 'Sim, finalizar'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir ordem de serviço?</AlertDialogTitle>
						<AlertDialogDescription>
							A ordem <strong>#{displayNumber}</strong> — {title} — será
							excluída permanentemente. Esta ação não pode ser desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteSubmitting}>
							Cancelar
						</AlertDialogCancel>
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
		</>
	)
}
