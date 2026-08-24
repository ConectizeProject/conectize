'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { OrderWhatsappMessageDialog } from './OrderWhatsappMessageDialog'

type SharePreview = {
	message: string
	to: string | null
	waMeUrl: string | null
	evolutionAvailable: boolean
}

/**
 * Enviar WhatsApp da OS: se houver Evolution cadastrada, abre modal e envia pela API
 * (prioriza a instância com Mensagens automáticas); caso contrário usa wa.me.
 */
export function useOrderWhatsappShare(orderId: string) {
	const [dialogOpen, setDialogOpen] = useState(false)
	const [sending, setSending] = useState(false)
	const [preview, setPreview] = useState<SharePreview | null>(null)
	const [loading, setLoading] = useState(false)

	const closeDialog = useCallback(() => {
		if (sending) return
		setDialogOpen(false)
	}, [sending])

	const openShare = useCallback(
		async (fallbackMessage?: string, fallbackWaMeUrl?: string | null) => {
			setLoading(true)
			try {
				const res = await fetch(
					`/api/portal/ordens/${orderId}/whatsapp-message?mode=share`,
				)
				const data = await res.json().catch(() => null)
				if (res.ok && data?.ok) {
					const message = String(data.message || fallbackMessage || '').trim()
					const evolutionAvailable = data.evolution_available === true
					const hasPhone = data.has_phone === true || Boolean(data.to)
					const waMeUrl =
						(typeof data.wa_me_url === 'string' ? data.wa_me_url : null) ||
						fallbackWaMeUrl ||
						null

					if (evolutionAvailable && hasPhone && message) {
						setPreview({
							message,
							to: data.to ? String(data.to) : null,
							waMeUrl,
							evolutionAvailable: true,
						})
						setDialogOpen(true)
						return
					}

					if (waMeUrl) {
						window.open(waMeUrl, '_blank', 'noopener,noreferrer')
						return
					}

					if (evolutionAvailable && !hasPhone) {
						toast({
							title: 'Cliente sem celular',
							description:
								'Cadastre o WhatsApp do cliente para enviar pela Evolution.',
							variant: 'destructive',
						})
						return
					}
				}

				if (fallbackWaMeUrl) {
					window.open(fallbackWaMeUrl, '_blank', 'noopener,noreferrer')
					return
				}

				toast({
					title: 'Não foi possível abrir o WhatsApp',
					description: 'Verifique o telefone do cliente e o link da OS.',
					variant: 'destructive',
				})
			} catch {
				if (fallbackWaMeUrl) {
					window.open(fallbackWaMeUrl, '_blank', 'noopener,noreferrer')
					return
				}
				toast({
					title: 'Falha ao preparar WhatsApp',
					variant: 'destructive',
				})
			} finally {
				setLoading(false)
			}
		},
		[orderId],
	)

	const confirmSend = useCallback(async () => {
		if (!preview?.message) return
		setSending(true)
		try {
			const res = await fetch(`/api/portal/ordens/${orderId}/whatsapp-message`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mode: 'share',
					text: preview.message,
				}),
			})
			const data = await res.json().catch(() => null)
			if (!res.ok || !data?.ok) {
				toast({
					title: 'Falha ao enviar WhatsApp',
					description: String(data?.detail || data?.error || 'Tente novamente.'),
					variant: 'destructive',
				})
				return
			}
			toast({
				variant: 'success',
				title: 'WhatsApp enviado',
				description: 'Mensagem enviada pela Evolution.',
			})
			setDialogOpen(false)
		} finally {
			setSending(false)
		}
	}, [orderId, preview])

	useEffect(() => {
		setDialogOpen(false)
		setPreview(null)
	}, [orderId])

	const ShareDialog = (
		<OrderWhatsappMessageDialog
			open={dialogOpen}
			onOpenChange={(open) => {
				if (!open) closeDialog()
				else setDialogOpen(true)
			}}
			title="Enviar WhatsApp"
			description="A mensagem abaixo será enviada pela Evolution (instância de Mensagens automáticas, quando houver) para o celular do cliente."
			message={preview?.message || ''}
			confirmLabel="Enviar"
			cancelLabel="Cancelar"
			sending={sending}
			onConfirm={() => {
				void confirmSend()
			}}
		/>
	)

	return {
		openShare,
		shareLoading: loading,
		ShareDialog,
	}
}
