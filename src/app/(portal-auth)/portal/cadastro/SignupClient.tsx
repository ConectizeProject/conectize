'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthCardLayout } from '@/components/auth/AuthCardLayout'
import { AuthDivider } from '@/components/auth/AuthDivider'
import { AuthFormMessages } from '@/components/auth/AuthFormMessages'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildPortalAuthCallbackUrl } from '@/lib/auth/callback-url'
import { PORTAL_COMPLETE_PROFILE_PATH } from '@/lib/auth/portal-auth-paths'
import { reserveSignupIp } from '@/lib/auth/reserve-signup-ip'
import { AUTH_PASSWORD_MIN_LENGTH, isValidPassword } from '@/lib/auth/password-rules'
import { getAuthSiteOrigin } from '@/lib/auth/site-origin'
import { useSupabaseBrowserClient } from '@/lib/supabase/use-supabase-browser-client'
import { getAuthErrorMessage } from '@/lib/utils/error-messages'

function completeProfilePath() {
  if (typeof window === 'undefined') return PORTAL_COMPLETE_PROFILE_PATH
  const origem = new URLSearchParams(window.location.search).get('origem')
  if (origem !== 'agendamento') return PORTAL_COMPLETE_PROFILE_PATH
  return `${PORTAL_COMPLETE_PROFILE_PATH}?origem=agendamento`
}

export function SignupClient() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const supabase = useSupabaseBrowserClient()

  const canSubmit = useMemo(() => {
    if (!email || !password || !passwordConfirm) return false
    if (password !== passwordConfirm) return false
    return isValidPassword(password)
  }, [email, password, passwordConfirm])

  const siteOrigin = getAuthSiteOrigin()

  async function onGoogleSignup() {
    setErrorMessage(null)
    setIsGoogleLoading(true)
    try {
      if (!supabase) {
        setErrorMessage('Configuração do Supabase ausente. Não é possível cadastrar com Google agora.')
        return
      }
      const allowed = await reserveSignupIp()
      if (!allowed) {
        setErrorMessage('Este endereço já criou 3 contas hoje. Tente novamente amanhã.')
        return
      }
      const oauthRedirect = buildPortalAuthCallbackUrl(
        completeProfilePath(),
        siteOrigin,
      )

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: oauthRedirect },
      })

      if (error) {
        setErrorMessage(
          getAuthErrorMessage(
            error,
            'Não foi possível cadastrar com Google. Tente novamente.',
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
          'Não foi possível cadastrar com Google. Tente novamente.',
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

    if (!password || !passwordConfirm) {
      setIsSubmitting(false)
      setErrorMessage('Informe a senha e confirme.')
      return
    }

    if (password !== passwordConfirm) {
      setIsSubmitting(false)
      setErrorMessage('As senhas não conferem.')
      return
    }

    if (!isValidPassword(password)) {
      setIsSubmitting(false)
      setErrorMessage(
        `A senha deve ter pelo menos ${AUTH_PASSWORD_MIN_LENGTH} caracteres.`,
      )
      return
    }

    try {
      if (!supabase) {
        setErrorMessage('Configuração do Supabase ausente. Não é possível concluir o cadastro agora.')
        return
      }
      const allowed = await reserveSignupIp()
      if (!allowed) {
        setErrorMessage('Este endereço já criou 3 contas hoje. Tente novamente amanhã.')
        return
      }
      const emailRedirectTo = buildPortalAuthCallbackUrl(
        completeProfilePath(),
        siteOrigin,
      )

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo,
        },
      })

      if (error) {
        setErrorMessage(
          getAuthErrorMessage(
            error,
            'Não foi possível concluir o cadastro. Tente novamente.',
          ),
        )
        return
      }

      if (data?.session) {
        router.refresh()
        router.replace(completeProfilePath())
        return
      }

      setMessage(
        'Enviamos um e-mail de confirmação. Abra o link para finalizar o cadastro.',
      )
    } catch (err) {
      setErrorMessage(getAuthErrorMessage(err, 'Não foi possível concluir o cadastro. Tente novamente.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCardLayout>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>
            Cadastre-se para acompanhar suas ordens. Na tela seguinte, informe o CPF para vincular seu cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <form method="post" action="/portal/cadastro" onSubmit={onSubmit} className="space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">Confirmar senha</Label>
                <Input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repita a senha"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                />
              </div>

              <AuthFormMessages errorMessage={errorMessage} message={message} />

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="link" size="sm" asChild>
                  <Link href="/portal/login">Já tenho conta</Link>
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !canSubmit}
                >
                  {isSubmitting ? 'Cadastrando…' : 'Criar conta'}
                </Button>
              </div>
            </form>

            <AuthDivider />

            <GoogleSignInButton
              loading={isGoogleLoading}
              loadingLabel="Cadastrando com Google…"
              label="Cadastrar com Google"
              disabled={isSubmitting}
              onClick={onGoogleSignup}
            />
          </div>
        </CardContent>
      </Card>
    </AuthCardLayout>
  )
}
