'use client'

import { Loader2, Mail } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AuthCardLayout } from '@/components/auth/AuthCardLayout'
import { AuthDivider } from '@/components/auth/AuthDivider'
import { AuthFormMessages } from '@/components/auth/AuthFormMessages'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { SupabaseLoginStatusNotice } from '@/components/auth/SupabaseLoginStatusNotice'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildPortalAuthCallbackUrl } from '@/lib/auth/callback-url'
import { shouldSkipDuplicateLoginSessionProbe } from '@/lib/auth/login-session-probe-guard'
import { assertSafePortalPath } from '@/lib/auth/safe-redirect'
import { getAuthSiteOrigin } from '@/lib/auth/site-origin'
import type { SupabasePlatformStatusBanner } from '@/lib/supabase/platform-status'
import { useSupabaseBrowserClient } from '@/lib/supabase/use-supabase-browser-client'
import {
	getAuthErrorMessage,
	isAuthNetworkError,
} from '@/lib/utils/error-messages'

type LoginClientProps = {
	/** Fallback quando a query `redirectTo` some no primeiro paint (servidor sem param). */
	fallbackReturnPath?: string
	supabasePlatformStatus?: SupabasePlatformStatusBanner | null
}

export function LoginClient({
	fallbackReturnPath = '/portal',
	supabasePlatformStatus = null,
}: LoginClientProps) {
	const router = useRouter()
	const searchParams = useSearchParams()

	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isSendingRecovery, setIsSendingRecovery] = useState(false)
	const [message, setMessage] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [isRedirecting, setIsRedirecting] = useState(false)
	const [isGoogleLoading, setIsGoogleLoading] = useState(false)
	const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false)

	const redirectTo = useMemo(() => {
		const q = searchParams.get('redirectTo')
		if (q) return assertSafePortalPath(q)
		return assertSafePortalPath(fallbackReturnPath)
	}, [searchParams, fallbackReturnPath])

	const supabase = useSupabaseBrowserClient()

	const siteOrigin = getAuthSiteOrigin()

	const redirectIfValidSessionRan = useRef(false)

	useEffect(() => {
		const oauthError = searchParams.get('error')
		if (!oauthError?.trim()) return
		setErrorMessage(
			getAuthErrorMessage(
				{ message: oauthError },
				'Não foi possível concluir o login. Tente novamente.',
			),
		)
	}, [searchParams])

	/**
	 * 1) Para o auto-refresh do GoTrue antes de qualquer outra chamada — evita ticks / recover
	 *    em loop quando o host do Supabase não resolve (DNS).
	 * 2) Só então verifica sessão + usuário uma vez para redirecionar quem já está logado.
	 */
	useEffect(() => {
		if (!supabase) return

		let alive = true

		void (async () => {
			await supabase.auth.stopAutoRefresh()
			if (!alive) return
			// Strict Mode remonta rápido: evita segunda leva de getSession/getUser
			if (shouldSkipDuplicateLoginSessionProbe()) return

			const { data: sessionData, error: sessionErr } =
				await supabase.auth.getSession()
			if (!alive) return

			if (sessionData?.session) {
				const { data: userData, error: userErr } = await supabase.auth.getUser()
				if (!alive) return

				if (!userErr && userData?.user) {
					redirectIfValidSessionRan.current = true
					router.replace(redirectTo)
					return
				}

				if (userErr && isAuthNetworkError(userErr)) {
					setErrorMessage(getAuthErrorMessage(userErr, ''))
					redirectIfValidSessionRan.current = true
					router.replace(redirectTo)
					return
				}

				if (!isAuthNetworkError(userErr)) {
					await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
				}
				return
			}

			if (sessionErr) {
				if (isAuthNetworkError(sessionErr)) {
					setErrorMessage(getAuthErrorMessage(sessionErr, ''))
				} else {
					await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
				}
				return
			}
		})()

		return () => {
			alive = false
			void supabase.auth.startAutoRefresh()
		}
	}, [router, redirectTo, supabase])

	useEffect(() => {
		if (!isRedirecting) return
		router.refresh()
		const id = setTimeout(() => router.replace(redirectTo), 80)
		return () => clearTimeout(id)
	}, [isRedirecting, router, redirectTo])

	async function onForgotPassword(event?: React.MouseEvent<HTMLButtonElement>) {
		event?.preventDefault()
		setErrorMessage(null)
		setMessage(null)

		const trimmedEmail = email.trim()
		if (!trimmedEmail) {
			setErrorMessage('Informe seu e-mail para recuperar a senha.')
			return
		}

		setIsSendingRecovery(true)

		try {
			if (!supabase) {
				setErrorMessage(
					'Configuração do Supabase ausente. Não é possível redefinir a senha agora.',
				)
				return
			}
			const redirectToUrl = buildPortalAuthCallbackUrl(
				'/portal/redefinir-senha',
				siteOrigin,
			)

			const { error } = await supabase.auth.resetPasswordForEmail(
				trimmedEmail,
				{
					redirectTo: redirectToUrl,
				},
			)

			if (error) {
				setErrorMessage(
					getAuthErrorMessage(
						error,
						'Não foi possível solicitar a redefinição agora. Tente novamente.',
					),
				)
				return
			}

			setMessage(
				'Se existir uma conta com este e-mail, enviaremos um link para redefinir sua senha. Pode levar alguns minutos — verifique também o spam/lixo eletrônico.',
			)
		} catch (err) {
			setErrorMessage(
				getAuthErrorMessage(
					err,
					'Não foi possível solicitar a redefinição agora. Tente novamente.',
				),
			)
		} finally {
			setIsSendingRecovery(false)
		}
	}

	async function onMagicLinkLogin() {
		setErrorMessage(null)
		setMessage(null)

		const trimmedEmail = email.trim()
		if (!trimmedEmail) {
			setErrorMessage('Informe seu e-mail para receber o link.')
			return
		}

		setIsMagicLinkLoading(true)

		try {
			if (!supabase) {
				setErrorMessage(
					'Configuração do Supabase ausente. Não é possível enviar o link agora.',
				)
				return
			}
			const emailRedirectTo = buildPortalAuthCallbackUrl(redirectTo, siteOrigin)

			const { error } = await supabase.auth.signInWithOtp({
				email: trimmedEmail,
				options: {
					emailRedirectTo,
				},
			})

			if (error) {
				setErrorMessage(
					getAuthErrorMessage(
						error,
						'Não foi possível enviar o link agora. Tente novamente.',
					),
				)
				return
			}

			setMessage(
				'Enviamos um link de acesso para seu e-mail. Abra o link para entrar no portal.',
			)
		} catch (err) {
			setErrorMessage(
				getAuthErrorMessage(
					err,
					'Não foi possível enviar o link agora. Tente novamente.',
				),
			)
		} finally {
			setIsMagicLinkLoading(false)
		}
	}

	async function onGoogleLogin() {
		setErrorMessage(null)
		setIsGoogleLoading(true)
		try {
			if (!supabase) {
				setErrorMessage(
					'Configuração do Supabase ausente. Não é possível entrar com Google agora.',
				)
				return
			}
			const oauthRedirect = buildPortalAuthCallbackUrl(redirectTo, siteOrigin)

			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: { redirectTo: oauthRedirect },
			})

			if (error) {
				setErrorMessage(
					getAuthErrorMessage(
						error,
						'Não foi possível entrar com Google. Tente novamente.',
					),
				)
				return
			}
			if (data?.url) {
				window.location.href = data.url
			}
		} catch (err) {
			setErrorMessage(
				getAuthErrorMessage(
					err,
					'Não foi possível entrar com Google. Tente novamente.',
				),
			)
		} finally {
			setIsGoogleLoading(false)
		}
	}

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault()
		setIsSubmitting(true)
		setErrorMessage(null)
		setMessage(null)

		const trimmedEmail = email.trim()
		if (!trimmedEmail) {
			setIsSubmitting(false)
			setErrorMessage('Informe seu e-mail.')
			return
		}

		if (!password) {
			setIsSubmitting(false)
			setErrorMessage('Informe sua senha.')
			return
		}

		try {
			if (!supabase) {
				setErrorMessage(
					'Configuração do Supabase ausente. Não é possível entrar agora.',
				)
				setIsSubmitting(false)
				return
			}
			const { error } = await supabase.auth.signInWithPassword({
				email: trimmedEmail,
				password,
			})

			if (error) {
				setErrorMessage(
					getAuthErrorMessage(
						error,
						'Não foi possível concluir o login. Tente novamente.',
					),
				)
				setIsSubmitting(false)
				return
			}

			setIsRedirecting(true)
		} catch (err) {
			setErrorMessage(
				getAuthErrorMessage(
					err,
					'Não foi possível entrar agora. Tente novamente.',
				),
			)
			setIsSubmitting(false)
		}
	}

	const redirectOverlay =
		isRedirecting && typeof document !== 'undefined'
			? createPortal(
					<div
						className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm pointer-events-auto select-none"
						aria-live="polite"
						aria-busy="true"
						role="status"
						tabIndex={-1}
					>
						<div className="flex flex-col items-center gap-4">
							<Loader2
								className="h-12 w-12 animate-spin text-primary"
								aria-hidden
							/>
							<p className="text-sm font-medium text-muted-foreground">
								Entrando no portal…
							</p>
						</div>
					</div>,
					document.body,
				)
			: null

	return (
		<>
			{redirectOverlay}
			<AuthCardLayout>
				<div className="flex w-full max-w-md flex-col">
					{supabasePlatformStatus ? (
						<SupabaseLoginStatusNotice status={supabasePlatformStatus} />
					) : null}
					<Card className="w-full max-w-md">
						<CardHeader>
							<CardTitle>Área do cliente</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-6">
								<form onSubmit={onSubmit} className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="email">E-mail</Label>
										<Input
											id="email"
											name="email"
											type="email"
											autoComplete="email"
											placeholder="Digite seu e-mail"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
										/>
									</div>

									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<Label htmlFor="password">Senha</Label>
											<button
												type="button"
												onClick={(e) => {
													e.preventDefault()
													e.stopPropagation()
													onForgotPassword(e)
												}}
												disabled={isSendingRecovery || isSubmitting}
												className="text-sm text-primary-accessible underline-offset-4 hover:underline disabled:opacity-50 disabled:pointer-events-none"
											>
												{isSendingRecovery
													? 'Enviando…'
													: 'Esqueci minha senha'}
											</button>
										</div>
										<Input
											id="password"
											name="password"
											type="password"
											autoComplete="current-password"
											placeholder="Digite sua senha"
											value={password}
											onChange={(e) => setPassword(e.target.value)}
										/>
									</div>

									<AuthFormMessages
										errorMessage={errorMessage}
										message={message}
									/>

									<div className="flex items-center justify-end gap-2">
										<Button type="button" variant="outline" size="sm" asChild>
											<a href="/portal/cadastro">Cadastre-se</a>
										</Button>
										<Button type="submit" size="sm" disabled={isSubmitting}>
											{isSubmitting ? 'Entrando…' : 'Entrar'}
										</Button>
									</div>
								</form>

								<AuthDivider />

								<div className="space-y-2">
									<Button
										type="button"
										variant="outline"
										className="w-full"
										disabled={isSubmitting || isMagicLinkLoading}
										onClick={onMagicLinkLogin}
									>
										{isMagicLinkLoading ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin" />
												Enviando link…
											</>
										) : (
											<>
												<Mail className="h-4 w-4" />
												Entrar somente com e-mail
											</>
										)}
									</Button>

									<GoogleSignInButton
										loading={isGoogleLoading}
										loadingLabel="Entrando com Google…"
										label="Entrar com Google"
										disabled={isSubmitting}
										onClick={onGoogleLogin}
									/>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</AuthCardLayout>
		</>
	)
}
