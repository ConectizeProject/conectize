'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function isValidPassword (value: string) {
  return value.length >= 8
}

function getAuthErrorMessage (error: unknown) {
  const message = typeof error === 'object' && error && 'message' in error ? String((error as any).message || '') : ''
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid email')) return 'E-mail inválido.'
  if (normalized.includes('password should be at least')) return 'Sua senha não atende aos requisitos mínimos.'
  if (normalized.includes('user already registered')) return 'Este e-mail já está cadastrado.'
  if (normalized.includes('email rate limit exceeded')) return 'Você já solicitou muitos e-mails. Tente novamente mais tarde.'
  if (normalized.includes('too many requests')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.'

  return 'Não foi possível concluir o cadastro. Tente novamente.'
}

export function SignupClient () {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    if (!email || !password || !passwordConfirm) return false
    if (password !== passwordConfirm) return false
    return isValidPassword(password)
  }, [email, password, passwordConfirm])

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
        setErrorMessage(getAuthErrorMessage(error))
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
        </CardContent>
      </Card>
    </div>
  )
}
