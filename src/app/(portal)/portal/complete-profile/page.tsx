import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CompleteProfileClient } from './CompleteProfileClient'

export default async function CompleteProfilePage ({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user

  if (!user) await redirectToPortalLogin()
  const isEmailConfirmed = Boolean(user.email_confirmed_at)

  const { data: appUser } = await supabase
    .from('users')
    .select('cpf, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: customer } = await supabase
    .from('customers')
    .select('id, cpf, full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const cpf = appUser?.cpf || customer?.cpf || null
  const fullName = appUser?.full_name || customer?.full_name || null
  const isCpfLocked = Boolean(cpf)

  return (
    <div className="max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>{cpf ? 'Dados de cadastro' : 'Complete seu cadastro'}</CardTitle>
          <CardDescription>
            {cpf
              ? 'Atualize seus dados. O CPF não pode ser alterado após vinculado.'
              : 'Informe seu CPF para acessar suas ordens de serviço.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isEmailConfirmed ? (
            <Alert className="mb-4">
              <AlertTitle>Confirme seu e-mail</AlertTitle>
              <AlertDescription>
                Seu e-mail ainda não foi validado. Abra o link de confirmação que enviamos para continuar com acesso completo.
              </AlertDescription>
            </Alert>
          ) : null}
          <CompleteProfileClient
            initialCpf={cpf}
            initialFullName={fullName}
            isCpfLocked={isCpfLocked}
            initialError={error
              ? (error === 'cpf_invalido'
                  ? 'CPF inválido. Confira e tente novamente.'
                  : error === 'vinculo_falhou'
                    ? 'Não foi possível vincular sua conta à assistência. Abra o link do cadastro novamente ou fale com o suporte.'
                    : 'Não foi possível vincular seu CPF agora. Tente novamente.')
              : undefined}
          />

          {cpf ? (
            <div className="pt-4">
              <Button variant="outline" asChild className="w-full">
                <a href="/portal">Voltar</a>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}


