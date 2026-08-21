'use client'

import { Loader2 } from 'lucide-react'
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

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description?: string
	message: string
	confirmLabel?: string
	cancelLabel?: string
	sending?: boolean
	onConfirm: () => void
}

export function OrderWhatsappMessageDialog({
	open,
	onOpenChange,
	title,
	description,
	message,
	confirmLabel = 'Enviar',
	cancelLabel = 'Cancelar',
	sending = false,
	onConfirm,
}: Props) {
	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				if (sending) return
				onOpenChange(next)
			}}
		>
			<AlertDialogContent className="max-w-lg">
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					{description ? (
						<AlertDialogDescription>{description}</AlertDialogDescription>
					) : null}
				</AlertDialogHeader>
				<div className="max-h-[50vh] overflow-y-auto rounded-md border bg-muted/40 p-3">
					<pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
						{message || '—'}
					</pre>
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={sending}>
						{cancelLabel}
					</AlertDialogCancel>
					<AlertDialogAction
						disabled={sending || !message.trim()}
						onClick={(e) => {
							e.preventDefault()
							onConfirm()
						}}
					>
						{sending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
								Enviando…
							</>
						) : (
							confirmLabel
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
