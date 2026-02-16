'use client'

import { useEffect, useMemo, useState } from 'react'
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

  if (normalized.includes('password should be at least')) return 'Sua senha não atende aos requisitos mínimos.'
  if (normalized.includes('same password')) return 'A nova senha precisa ser diferente da senha atual.'
  if (normalized.includes('too many requests')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.'

  return 'Não foi possível redefinir sua senha. Tente novamente.'
}

export function ResetPasswordClient () {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  const canSubmit = useMemo(() => {
    if (!hasSession) return false
    if (!password || !passwordConfirm) return false
    if (password !== passwordConfirm) return false
    return isValidPassword(password)
  }, [hasSession, password, passwordConfirm])

  useEffect(() => {
    try {
      const supabase = createSupabaseBrowserClient()
      supabase.auth.getSession()
        .then(({ data }) => {
          setHasSession(Boolean(data?.session))
          if (!data?.session) {
            setErrorMessage('Link inválido ou expirado. Solicite a redefinição novamente.')
          }
        })
        .catch(() => {
          setHasSession(false)
          setErrorMessage('Não foi possível validar sua sessão. Tente novamente.')
        })
    } catch (err) {
      setHasSession(false)
      setErrorMessage('Configuração do Supabase ausente. Não é possível redefinir a senha agora.')
    }
  }, [])

  async function onSubmit (event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)
    setMessage(null)

    if (!hasSession) {
      setIsSubmitting(false)
      setErrorMessage('Link inválido ou expirado. Solicite a redefinição novamente.')
      return
    }

    if (!password || !passwordConfirm) {
      setIsSubmitting(false)
      setErrorMessage('Informe a nova senha e confirme.')
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
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setErrorMessage(getAuthErrorMessage(error))
        return
      }

      setMessage('Senha atualizada com sucesso. Você já pode continuar.')
      router.replace('/portal')
    } catch (err) {
      setErrorMessage('Não foi possível redefinir sua senha agora. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen pt-32 pb-20 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>Crie uma nova senha para sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
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
              <Label htmlFor="passwordConfirm">Confirmar nova senha</Label>
              <Input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                placeholder="Repita a nova senha"
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
              {isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              <Link href="/portal/login" className="underline">
                Voltar para o login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

