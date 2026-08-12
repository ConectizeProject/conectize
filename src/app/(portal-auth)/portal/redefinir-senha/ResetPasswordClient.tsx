'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AUTH_PASSWORD_MIN_LENGTH, isValidPassword } from '@/lib/auth/password-rules'
import { useSupabaseBrowserClient } from '@/lib/supabase/use-supabase-browser-client'
import { AuthCardLayout } from '@/components/auth/AuthCardLayout'
import { AuthFormMessages } from '@/components/auth/AuthFormMessages'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAuthErrorMessage } from '@/lib/utils/error-messages'
import { Loader2 } from 'lucide-react'

export function ResetPasswordClient() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  const supabase = useSupabaseBrowserClient()

  const isValidatingLink = hasSession === null

  const canSubmit = useMemo(() => {
    if (!hasSession) return false
    if (!password || !passwordConfirm) return false
    if (password !== passwordConfirm) return false
    return isValidPassword(password)
  }, [hasSession, password, passwordConfirm])

  useEffect(() => {
    if (!supabase) {
      setHasSession(false)
      setErrorMessage('Configuração do Supabase ausente. Não é possível redefinir a senha agora.')
      return
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        if (timeoutId !== undefined) clearTimeout(timeoutId)
        setHasSession(true)
        setErrorMessage(null)
      }
    })

    supabase.auth.getSession()
      .then(({ data }) => {
        if (data.session) {
          if (timeoutId !== undefined) clearTimeout(timeoutId)
          setHasSession(true)
          setErrorMessage(null)
        } else {
          timeoutId = setTimeout(() => {
            setHasSession((h) => {
              if (h === null) {
                setErrorMessage('Link inválido ou expirado. Solicite a redefinição novamente.')
                return false
              }
              return h
            })
          }, 500)
        }
      })
      .catch(() => {
        setHasSession(false)
        setErrorMessage('Não foi possível validar sua sessão. Tente novamente.')
      })

    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [supabase])

  async function onSubmit(event: React.FormEvent) {
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
      setErrorMessage(`A senha deve ter pelo menos ${AUTH_PASSWORD_MIN_LENGTH} caracteres.`)
      return
    }

    if (!supabase) {
      setIsSubmitting(false)
      setErrorMessage('Configuração do Supabase ausente. Não é possível redefinir a senha agora.')
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setErrorMessage(getAuthErrorMessage(error, 'Não foi possível redefinir sua senha. Tente novamente.'))
        return
      }

      setMessage('Senha atualizada com sucesso. Você já pode continuar.')
      router.refresh()
      router.replace('/portal')
    } catch (err) {
      setErrorMessage(getAuthErrorMessage(err, 'Não foi possível redefinir sua senha agora. Tente novamente.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCardLayout>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>Crie uma nova senha para sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {isValidatingLink ? (
              <div
                className="flex items-center gap-2 text-sm text-muted-foreground py-1"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                Validando link…
              </div>
            ) : null}

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
                disabled={isValidatingLink}
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
                disabled={isValidatingLink}
              />
            </div>

            <AuthFormMessages errorMessage={errorMessage} message={message} />

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !canSubmit || isValidatingLink}
            >
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
    </AuthCardLayout>
  )
}
