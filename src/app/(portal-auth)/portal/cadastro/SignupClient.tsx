'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAuthErrorMessage } from '@/lib/utils/error-messages'

function isValidPassword (value: string) {
  return value.length >= 8
}

export function SignupClient () {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    if (!email || !password || !passwordConfirm) return false
    if (password !== passwordConfirm) return false
    return isValidPassword(password)
  }, [email, password, passwordConfirm])

  async function onGoogleSignup() {
    setErrorMessage(null)
    setIsGoogleLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const callbackUrl = new URL('/portal/auth/callback', window.location.origin)
      callbackUrl.searchParams.set('redirectTo', '/portal/complete-profile')

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl.toString() },
      })

      if (error) {
        setErrorMessage(getAuthErrorMessage(error, 'Não foi possível cadastrar com Google. Tente novamente.'))
        return
      }
      if (data?.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setErrorMessage('Não foi possível cadastrar com Google. Tente novamente.')
    } finally {
      setIsGoogleLoading(false)
    }
  }

  async function onSubmit (event: React.FormEvent) {
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
      setErrorMessage('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    try {
      const supabase = createSupabaseBrowserClient()
      const redirectUrl = new URL('/portal/auth/callback', window.location.origin)
      redirectUrl.searchParams.set('redirectTo', '/portal/complete-profile')

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: redirectUrl.toString(),
        },
      })

      if (error) {
        setErrorMessage(getAuthErrorMessage(error, 'Não foi possível concluir o cadastro. Tente novamente.'))
        return
      }

      if (data?.session) {
        router.replace('/portal/complete-profile')
        return
      }

      setMessage('Enviamos um e-mail de confirmação. Abra o link para finalizar o cadastro.')
    } catch (err) {
      setErrorMessage('Não foi possível concluir o cadastro. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen pt-32 pb-20 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>Cadastre-se para acompanhar suas ordens.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isSubmitting || isGoogleLoading}
              onClick={onGoogleSignup}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando com Google…
                </>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Cadastrar com Google
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

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

            {errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : null}
            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? 'Cadastrando…' : 'Criar conta'}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              Já tem conta?{' '}
              <Link href="/portal/login" className="underline">
                Entrar
              </Link>
            </p>
          </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
