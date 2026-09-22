'use client'

import QRCode from 'qrcode'
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { appConfirm } from '@/lib/ui/app-dialogs'
import { useSupabaseBrowserClient } from '@/lib/supabase/use-supabase-browser-client'
import { getAuthErrorMessage } from '@/lib/utils/error-messages'

type TotpFactor = {
	id: string
	friendly_name?: string | null
	status: string
	factor_type: string
}

type EnrollDraft = {
	factorId: string
	qrCodeDataUrl: string
	secret: string
}

export function SegurancaMfaClient() {
	const supabase = useSupabaseBrowserClient()
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState(false)
	const [factors, setFactors] = useState<TotpFactor[]>([])
	const [enroll, setEnroll] = useState<EnrollDraft | null>(null)
	const [code, setCode] = useState('')
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	const verifiedFactors = factors.filter((f) => f.status === 'verified')
	const hasVerified = verifiedFactors.length > 0

	const refreshFactors = useCallback(async () => {
		if (!supabase) return
		const { data, error } = await supabase.auth.mfa.listFactors()
		if (error) {
			setErrorMessage(
				getAuthErrorMessage(
					error,
					'Não foi possível carregar a autenticação em duas etapas.',
				),
			)
			setFactors([])
			return
		}
		setErrorMessage(null)
		setFactors((data?.totp ?? []) as TotpFactor[])
	}, [supabase])

	useEffect(() => {
		if (!supabase) {
			setLoading(false)
			return
		}
		void (async () => {
			setLoading(true)
			await refreshFactors()
			setLoading(false)
		})()
	}, [supabase, refreshFactors])

	async function startEnroll() {
		if (!supabase) return
		setBusy(true)
		setErrorMessage(null)
		setCode('')
		try {
			const { data, error } = await supabase.auth.mfa.enroll({
				factorType: 'totp',
				friendlyName: 'Authenticator',
			})
			if (error || !data) {
				setErrorMessage(
					getAuthErrorMessage(
						error,
						'Não foi possível iniciar a ativação do autenticador.',
					),
				)
				return
			}

			const totp = data.totp
			const qrCodeDataUrl = await QRCode.toDataURL(totp.uri, {
				margin: 1,
				width: 220,
			})
			setEnroll({
				factorId: data.id,
				qrCodeDataUrl,
				secret: totp.secret,
			})
		} catch (err) {
			setErrorMessage(
				getAuthErrorMessage(
					err,
					'Não foi possível iniciar a ativação do autenticador.',
				),
			)
		} finally {
			setBusy(false)
		}
	}

	async function cancelEnroll() {
		if (!supabase || !enroll) {
			setEnroll(null)
			setCode('')
			return
		}
		setBusy(true)
		try {
			await supabase.auth.mfa.unenroll({ factorId: enroll.factorId })
		} catch {
			// ignore cleanup errors
		} finally {
			setEnroll(null)
			setCode('')
			setBusy(false)
			await refreshFactors()
		}
	}

	async function confirmEnroll() {
		if (!supabase || !enroll) return
		const trimmed = code.replace(/\s+/g, '')
		if (!/^\d{6}$/.test(trimmed)) {
			setErrorMessage('Informe o código de 6 dígitos do aplicativo.')
			return
		}

		setBusy(true)
		setErrorMessage(null)
		try {
			const challenge = await supabase.auth.mfa.challenge({
				factorId: enroll.factorId,
			})
			if (challenge.error || !challenge.data) {
				setErrorMessage(
					getAuthErrorMessage(
						challenge.error,
						'Não foi possível validar o código.',
					),
				)
				return
			}

			const verified = await supabase.auth.mfa.verify({
				factorId: enroll.factorId,
				challengeId: challenge.data.id,
				code: trimmed,
			})
			if (verified.error) {
				setErrorMessage(
					getAuthErrorMessage(
						verified.error,
						'Código inválido. Confira o app e tente novamente.',
					),
				)
				return
			}

			setEnroll(null)
			setCode('')
			await refreshFactors()
			toast({
				variant: 'success',
				title: '2FA ativado',
				description:
					'A autenticação em duas etapas está ativa nesta conta.',
			})
		} catch (err) {
			setErrorMessage(
				getAuthErrorMessage(err, 'Não foi possível confirmar o código.'),
			)
		} finally {
			setBusy(false)
		}
	}

	async function removeFactor(factorId: string) {
		if (!supabase) return
		const ok = await appConfirm({
			title: 'Desativar autenticação em duas etapas?',
			description:
				'Sua conta voltará a exigir apenas senha ou login social. Você pode ativar de novo quando quiser.',
			confirmLabel: 'Desativar',
			destructive: true,
		})
		if (!ok) return

		setBusy(true)
		setErrorMessage(null)
		try {
			const { error } = await supabase.auth.mfa.unenroll({ factorId })
			if (error) {
				setErrorMessage(
					getAuthErrorMessage(
						error,
						'Não foi possível desativar o autenticador.',
					),
				)
				return
			}
			await refreshFactors()
			toast({
				variant: 'success',
				title: '2FA desativado',
				description: 'A autenticação em duas etapas foi removida.',
			})
		} catch (err) {
			setErrorMessage(
				getAuthErrorMessage(err, 'Não foi possível desativar o autenticador.'),
			)
		} finally {
			setBusy(false)
		}
	}

	if (loading) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
				Carregando…
			</div>
		)
	}

	if (!supabase) {
		return (
			<Alert variant="destructive">
				<AlertTitle>Configuração indisponível</AlertTitle>
				<AlertDescription>
					Não foi possível conectar ao serviço de autenticação.
				</AlertDescription>
			</Alert>
		)
	}

	return (
		<div className="space-y-6">
			{errorMessage ? (
				<Alert variant="destructive">
					<AlertTitle>Não foi possível concluir</AlertTitle>
					<AlertDescription>{errorMessage}</AlertDescription>
				</Alert>
			) : null}

			{hasVerified && !enroll ? (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-lg">
							<ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden />
							Autenticação em duas etapas ativa
						</CardTitle>
						<CardDescription>
							No próximo login será pedido o código do aplicativo autenticador.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{verifiedFactors.map((factor) => (
							<div
								key={factor.id}
								className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
							>
								<div>
									<p className="text-sm font-medium">
										{factor.friendly_name || 'Authenticator'}
									</p>
									<p className="text-xs text-muted-foreground">TOTP</p>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={busy}
									onClick={() => {
										void removeFactor(factor.id)
									}}
								>
									<ShieldOff className="mr-1.5 h-4 w-4" aria-hidden />
									Desativar
								</Button>
							</div>
						))}
					</CardContent>
				</Card>
			) : null}

			{!hasVerified && !enroll ? (
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Ativar autenticador</CardTitle>
						<CardDescription>
							Use Google Authenticator, Authy, 1Password ou outro app TOTP.
							Escaneie o QR e confirme com o código de 6 dígitos.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							type="button"
							disabled={busy}
							onClick={() => {
								void startEnroll()
							}}
						>
							{busy ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
									Preparando…
								</>
							) : (
								'Ativar 2FA'
							)}
						</Button>
					</CardContent>
				</Card>
			) : null}

			{enroll ? (
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Confirmar aplicativo</CardTitle>
						<CardDescription>
							Escaneie o QR no app autenticador e digite o código gerado.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={enroll.qrCodeDataUrl}
								alt="QR Code para ativar o autenticador"
								width={220}
								height={220}
								className="rounded-md border bg-white p-2"
							/>
							<div className="space-y-2 text-sm">
								<p className="text-muted-foreground">
									Se não puder escanear, digite a chave manualmente:
								</p>
								<code className="block break-all rounded-md bg-muted px-2 py-1.5 text-xs">
									{enroll.secret}
								</code>
							</div>
						</div>

						<div className="space-y-2 max-w-xs">
							<Label htmlFor="mfa-enroll-code">Código de 6 dígitos</Label>
							<Input
								id="mfa-enroll-code"
								inputMode="numeric"
								autoComplete="one-time-code"
								placeholder="000000"
								maxLength={6}
								value={code}
								onChange={(e) =>
									setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
								}
								disabled={busy}
							/>
						</div>

						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								disabled={busy}
								onClick={() => {
									void confirmEnroll()
								}}
							>
								{busy ? 'Confirmando…' : 'Confirmar e ativar'}
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={busy}
								onClick={() => {
									void cancelEnroll()
								}}
							>
								Cancelar
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}
		</div>
	)
}
