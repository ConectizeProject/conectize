'use client'

import { Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { AuthCardLayout } from '@/components/auth/AuthCardLayout'
import { AuthFormMessages } from '@/components/auth/AuthFormMessages'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	userNeedsMfaChallenge,
} from '@/lib/auth/mfa'
import { assertSafePortalPath } from '@/lib/auth/safe-redirect'
import { useSupabaseBrowserClient } from '@/lib/supabase/use-supabase-browser-client'
import { getAuthErrorMessage } from '@/lib/utils/error-messages'

export function VerifyMfaClient() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const supabase = useSupabaseBrowserClient()

	const redirectTo = useMemo(() => {
		return assertSafePortalPath(searchParams.get('redirectTo'))
	}, [searchParams])

	const [code, setCode] = useState('')
	const [factorId, setFactorId] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	useEffect(() => {
		if (!supabase) {
			setIsLoading(false)
			return
		}

		let alive = true
		void (async () => {
			const { data: userData, error: userErr } = await supabase.auth.getUser()
			if (!alive) return
			if (userErr || !userData?.user) {
				router.replace(
					`/portal/login?redirectTo=${encodeURIComponent(redirectTo)}`,
				)
				return
			}

			const needsChallenge = await userNeedsMfaChallenge(supabase)
			if (!alive) return
			if (!needsChallenge) {
				router.replace(redirectTo)
				return
			}

			const { data, error } = await supabase.auth.mfa.listFactors()
			if (!alive) return
			if (error) {
				setErrorMessage(
					getAuthErrorMessage(
						error,
						'Não foi possível carregar o autenticador.',
					),
				)
				setIsLoading(false)
				return
			}

			const verified = (data?.totp ?? []).find((f) => f.status === 'verified')
			if (!verified?.id) {
				router.replace(redirectTo)
				return
			}

			setFactorId(verified.id)
			setIsLoading(false)
		})()

		return () => {
			alive = false
		}
	}, [supabase, router, redirectTo])

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault()
		if (!supabase || !factorId) return

		const trimmed = code.replace(/\s+/g, '')
		if (!/^\d{6}$/.test(trimmed)) {
			setErrorMessage('Informe o código de 6 dígitos do aplicativo.')
			return
		}

		setIsSubmitting(true)
		setErrorMessage(null)
		try {
			const challenge = await supabase.auth.mfa.challenge({ factorId })
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
				factorId,
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

			router.replace(redirectTo)
			router.refresh()
		} catch (err) {
			setErrorMessage(
				getAuthErrorMessage(err, 'Não foi possível concluir a verificação.'),
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	async function onUseOtherAccount() {
		if (!supabase) {
			router.replace('/portal/login')
			return
		}
		await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
		router.replace(
			`/portal/login?redirectTo=${encodeURIComponent(redirectTo)}`,
		)
	}

	return (
		<AuthCardLayout>
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Verificação em duas etapas</CardTitle>
					<CardDescription>
						Abra o aplicativo autenticador e digite o código de 6 dígitos.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
							<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
							Carregando…
						</div>
					) : (
						<form method="post" onSubmit={onSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="mfa-code">Código</Label>
								<Input
									id="mfa-code"
									name="code"
									inputMode="numeric"
									autoComplete="one-time-code"
									autoFocus
									placeholder="000000"
									maxLength={6}
									value={code}
									onChange={(e) =>
										setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
									}
									disabled={isSubmitting}
								/>
							</div>

							<AuthFormMessages errorMessage={errorMessage} message={null} />

							<div className="flex flex-wrap items-center justify-between gap-2">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={isSubmitting}
									onClick={() => {
										void onUseOtherAccount()
									}}
								>
									Usar outra conta
								</Button>
								<Button type="submit" size="sm" disabled={isSubmitting}>
									{isSubmitting ? 'Verificando…' : 'Continuar'}
								</Button>
							</div>
						</form>
					)}
				</CardContent>
			</Card>
		</AuthCardLayout>
	)
}
