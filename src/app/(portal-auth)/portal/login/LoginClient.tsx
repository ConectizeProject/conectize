'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { getAuthErrorMessage, getOsSearchErrorMessage } from '@/lib/utils/error-messages'
import { isValidCpf, onlyDigits } from '@/lib/utils/strings'
import { OrderStatusBadge } from '@/components/orders'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2 } from 'lucide-react'

type OrderSummary = {
  id: string
  display_number: number | null
  status: string
  title: string | null
  created_at: string
  updated_at: string | null
  estimated_ready_at: string | null
}

export function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loginMode, setLoginMode] = useState<'password' | 'os'>('os')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingRecovery, setIsSendingRecovery] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [osCpf, setOsCpf] = useState('')
  const [osBirthDate, setOsBirthDate] = useState('')
  const [osResults, setOsResults] = useState<OrderSummary[] | null>(null)
  const [osError, setOsError] = useState<string | null>(null)
  const [osLoading, setOsLoading] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const redirectTo = useMemo(() => {
    const value = searchParams.get('redirectTo')
    if (!value) return '/portal'
    if (!value.startsWith('/portal')) return '/portal'
    return value
  }, [searchParams])

  useEffect(() => {
    try {
      const supabase = createSupabaseBrowserClient()
      supabase.auth.getSession()
        .then(({ data }) => {
          if (data?.session) router.replace('/portal')
        })
        .catch(() => { })
    } catch (err) {
      // Sem env do Supabase: mantém a tela de login renderizando
    }
  }, [router])

  useEffect(() => {
    if (!isRedirecting) return
    const id = setTimeout(() => router.replace(redirectTo), 80)
    return () => clearTimeout(id)
  }, [isRedirecting, router, redirectTo])

  async function onForgotPassword() {
    setErrorMessage(null)
    setMessage(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setErrorMessage('Informe seu e-mail para recuperar a senha.')
      return
    }

    setIsSendingRecovery(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const redirectUrl = new URL('/portal/auth/callback', window.location.origin)
      redirectUrl.searchParams.set('redirectTo', '/portal/redefinir-senha')

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: redirectUrl.toString(),
      })

      if (error) {
        setErrorMessage(getAuthErrorMessage(error, 'Não foi possível solicitar a redefinição agora. Tente novamente.'))
        return
      }

      setMessage('Se existir uma conta com este e-mail, enviaremos um link para redefinir sua senha. Pode levar alguns minutos — verifique também o spam/lixo eletrônico.')
    } catch (err) {
      setErrorMessage('Não foi possível solicitar a redefinição agora. Tente novamente.')
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

    setIsSubmitting(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const redirectUrl = new URL('/portal/auth/callback', window.location.origin)
      redirectUrl.searchParams.set('redirectTo', redirectTo)

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: redirectUrl.toString(),
        },
      })

      if (error) {
        setErrorMessage(getAuthErrorMessage(error, 'Não foi possível enviar o link agora. Tente novamente.'))
        return
      }

      setMessage('Enviamos um link de acesso para seu e-mail. Abra o link para entrar no portal.')
    } catch (err) {
      setErrorMessage('Não foi possível enviar o link agora. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onGoogleLogin() {
    setErrorMessage(null)
    setIsGoogleLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const callbackUrl = new URL('/portal/auth/callback', window.location.origin)
      callbackUrl.searchParams.set('redirectTo', redirectTo)

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl.toString() },
      })

      if (error) {
        setErrorMessage(getAuthErrorMessage(error, 'Não foi possível entrar com Google. Tente novamente.'))
        return
      }
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setErrorMessage('Não foi possível entrar com Google. Tente novamente.')
    } finally {
      setIsGoogleLoading(false)
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (loginMode !== 'password') return

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
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (error) {
        setErrorMessage(getAuthErrorMessage(error, 'Não foi possível concluir o login. Tente novamente.'))
        setIsSubmitting(false)
        return
      }

      setIsRedirecting(true)
    } catch (err) {
      setErrorMessage('Não foi possível entrar agora. Tente novamente.')
      setIsSubmitting(false)
    }
  }

  async function onSearchOrders(event: React.FormEvent) {
    event.preventDefault()
    setOsError(null)
    setOsResults(null)

    const cpfDigits = onlyDigits(osCpf).slice(0, 11)
    if (!isValidCpf(cpfDigits)) {
      setOsError('CPF inválido. Confira e tente novamente.')
      return
    }

    if (!osBirthDate) {
      setOsError('Informe a data de nascimento.')
      return
    }

    setOsLoading(true)

    try {
      const response = await fetch('/api/portal/os-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfDigits, birthDate: osBirthDate }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.ok) {
        setOsError(getOsSearchErrorMessage(payload?.error, 'Não foi possível consultar agora. Tente novamente.'))
        return
      }

      setOsResults(Array.isArray(payload.orders) ? payload.orders : [])
    } catch (err) {
      setOsError('Não foi possível consultar agora. Tente novamente.')
    } finally {
      setOsLoading(false)
    }
  }

  const redirectOverlay = isRedirecting && typeof document !== 'undefined' ? createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm pointer-events-auto select-none"
      aria-live="polite"
      aria-busy="true"
      role="status"
      tabIndex={-1}
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium text-muted-foreground">Entrando no portal…</p>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      {redirectOverlay}
      <div className="min-h-screen pt-32 pb-20 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Área do cliente</CardTitle>
            <CardDescription>Escolha como deseja entrar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={loginMode}
              onValueChange={(value) => {
                const nextMode = value === 'password' ? 'password' : 'os'
                setLoginMode(nextMode)
                setErrorMessage(null)
                setMessage(null)
                setOsError(null)
                setOsResults(null)
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="os" className="flex-1">
                  Consultar OS
                </TabsTrigger>
                <TabsTrigger value="password" className="flex-1">
                  E-mail e senha
                </TabsTrigger>
              </TabsList>

              {loginMode === 'os' ? null : (
                <div className="space-y-4 mt-4">


                  <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="voce@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <TabsContent value="password" className="mt-0">
                      <div className="space-y-2">
                        <Label htmlFor="password">Senha</Label>
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>

                      <div className="pt-2 space-y-2">
                        <button
                          type="button"
                          onClick={onForgotPassword}
                          disabled={isSendingRecovery || isSubmitting}
                          className="text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50 disabled:pointer-events-none"
                        >
                          {isSendingRecovery ? 'Enviando e-mail…' : 'Esqueci minha senha'}
                        </button>
                        <p className="text-xs text-muted-foreground">
                          Pode levar alguns minutos. Verifique também o spam/lixo eletrônico.
                        </p>
                      </div>
                    </TabsContent>

                    {errorMessage ? (
                      <p className="text-sm text-destructive">{errorMessage}</p>
                    ) : null}
                    {message ? (
                      <p className="text-sm text-muted-foreground">{message}</p>
                    ) : null}

                    <Button
                      type="button"
                      variant="link"
                      className="w-full disabled:opacity-50"
                      disabled={isSubmitting}
                      onClick={onMagicLinkLogin}
                    >
                      Realizar login sem senha
                    </Button>

                    <Button type="submit" className="w-full  disabled:opacity-50" disabled={isSubmitting}>
                      {isSubmitting ? 'Entrando…' : 'Entrar'}
                    </Button>
                    <p className="text-sm text-muted-foreground text-center">
                      Não tem conta?{' '}
                      <a href="/portal/cadastro" className="underline">
                        Cadastre-se
                      </a>
                    </p>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">ou</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isSubmitting || isGoogleLoading}
                    onClick={onGoogleLogin}
                  >
                    {isGoogleLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Entrando com Google…
                      </>
                    ) : (
                      <>
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Entrar com Google
                      </>
                    )}
                  </Button>

                </div>
              )}

              <TabsContent value="os" className="mt-4 space-y-4">
                <form onSubmit={onSearchOrders} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      name="cpf"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={osCpf}
                      onChange={(e) => setOsCpf(formatCpfCnpj(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="birthDate">Data de nascimento</Label>
                    <Input
                      id="birthDate"
                      name="birthDate"
                      type="date"
                      value={osBirthDate}
                      onChange={(e) => setOsBirthDate(e.target.value)}
                    />
                  </div>

                  {osError ? (
                    <p className="text-sm text-destructive">{osError}</p>
                  ) : null}

                  <Button type="submit" className="w-full" disabled={osLoading}>
                    {osLoading ? 'Buscando…' : 'Buscar OS'}
                  </Button>
                </form>

                {osResults ? (
                  osResults.length ? (
                    <div className="space-y-3">
                      {osResults.map((order) => (
                        <div key={order.id} className="rounded-md border p-3 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">OS #{order.display_number ?? order.id}</div>
                            <OrderStatusBadge status={order.status} />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {order.title ? order.title : 'Ordem de serviço'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Aberta em {formatDateTimeBr(order.created_at)} • Última atualização {formatDateTimeBr(order.updated_at || order.estimated_ready_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma OS encontrada.</p>
                  )
                ) : null}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
