'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { OrderStatusBadge } from '@/components/orders'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function getAuthErrorMessage(error: unknown) {
  const message = typeof error === 'object' && error && 'message' in error ? String((error as any).message || '') : ''
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) return 'E-mail ou senha inválidos.'
  if (normalized.includes('email not confirmed')) return 'Seu e-mail ainda não foi confirmado.'
  if (normalized.includes('too many requests')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
  if (normalized.includes('password should be at least')) return 'Sua senha não atende aos requisitos mínimos.'
  if (normalized.includes('user already registered')) return 'Este e-mail já está cadastrado.'
  if (normalized.includes('user not found')) return 'Usuário não encontrado.'
  if (normalized.includes('email rate limit exceeded')) return 'Você já solicitou muitos e-mails. Tente novamente mais tarde.'

  return 'Não foi possível concluir o login. Tente novamente.'
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function isValidCpf(value: string) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  return true
}

function getOsSearchErrorMessage(error?: string | null) {
  if (error === 'cpf_invalido') return 'CPF inválido. Confira e tente novamente.'
  if (error === 'nascimento_obrigatorio') return 'Informe a data de nascimento.'
  if (error === 'nascimento_invalido') return 'Data de nascimento inválida.'
  if (error === 'not_found') return 'Não encontramos nenhuma OS com estes dados.'
  if (error === 'missing_service_role') return 'Consulta indisponível no momento. Tente novamente mais tarde.'
  return 'Não foi possível consultar agora. Tente novamente.'
}

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
        setErrorMessage(getAuthErrorMessage(error))
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
        setErrorMessage(getAuthErrorMessage(error))
        return
      }

      setMessage('Enviamos um link de acesso para seu e-mail. Abra o link para entrar no portal.')
    } catch (err) {
      setErrorMessage('Não foi possível enviar o link agora. Tente novamente.')
    } finally {
      setIsSubmitting(false)
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
        setErrorMessage(getAuthErrorMessage(error))
        return
      }

      router.replace(redirectTo)
    } catch (err) {
      setErrorMessage('Não foi possível entrar agora. Tente novamente.')
    } finally {
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
        setOsError(getOsSearchErrorMessage(payload?.error))
        return
      }

      setOsResults(Array.isArray(payload.orders) ? payload.orders : [])
    } catch (err) {
      setOsError('Não foi possível consultar agora. Tente novamente.')
    } finally {
      setOsLoading(false)
    }
  }

  return (
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
              <form onSubmit={onSubmit} className="space-y-4 mt-4">
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
  )
}
