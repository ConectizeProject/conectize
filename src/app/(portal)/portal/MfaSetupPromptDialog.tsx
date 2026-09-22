'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	mfaSetupDismissStorageKey,
	shouldPromptMfaSetup,
} from '@/lib/auth/mfa'

type MfaSetupPromptDialogProps = {
	userId: string
	realRole: string
	hasVerifiedMfa: boolean
}

export function MfaSetupPromptDialog({
	userId,
	realRole,
	hasVerifiedMfa,
}: MfaSetupPromptDialogProps) {
	const [open, setOpen] = useState(false)

	useEffect(() => {
		if (!shouldPromptMfaSetup(realRole, hasVerifiedMfa)) {
			setOpen(false)
			return
		}
		try {
			const dismissed = window.localStorage.getItem(
				mfaSetupDismissStorageKey(userId),
			)
			if (dismissed === '1') {
				setOpen(false)
				return
			}
		} catch {
			// localStorage indisponível — ainda mostra o modal
		}
		setOpen(true)
	}, [userId, realRole, hasVerifiedMfa])

	function dismiss() {
		try {
			window.localStorage.setItem(mfaSetupDismissStorageKey(userId), '1')
		} catch {
			// ignore
		}
		setOpen(false)
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) dismiss()
				else setOpen(true)
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Shield className="h-5 w-5" aria-hidden />
						Ative a autenticação em duas etapas
					</DialogTitle>
					<DialogDescription>
						Contas de equipe (admin e staff) ficam mais seguras com um app
						autenticador (Google Authenticator, Authy, etc.). Por enquanto você
						pode pular e ativar depois em Segurança.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button type="button" variant="outline" onClick={dismiss}>
						Pular por enquanto
					</Button>
					<Button type="button" asChild>
						<Link href="/portal/seguranca" onClick={() => setOpen(false)}>
							Ativar agora
						</Link>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
