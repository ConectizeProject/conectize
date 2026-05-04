import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerCustomerFromOsLinkAction } from './actions'
import { CadastroClienteGoogleButton } from './CadastroClienteGoogleButton'

export const metadata = {
  title: 'Criar conta — cliente',
  robots: { index: false, follow: false },
}

export default async function CadastroClientePage ({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; ref_os?: string; error?: string }>
}) {
  const sp = await searchParams
  const orgSlug = String(sp.org || '').trim().toLowerCase()
  const refOs = String(sp.ref_os || '').trim()
  const err = sp.error

  if (!orgSlug || !refOs) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Link incompleto</CardTitle>
            <CardDescription>Abra o cadastro a partir do link enviado com a ordem de serviço.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Ir ao início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background px-4 py-4">
        <div className="container max-w-lg">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Início
          </Link>
        </div>
      </header>

      <main className="flex-1 container max-w-lg px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Criar conta</CardTitle>
            <CardDescription>
              Cadastro vinculado à assistência. Depois você poderá acompanhar suas ordens no portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {err ? (
              <p className="text-sm text-destructive mb-4">
                {err === 'os_invalida' && 'Link da ordem inválido ou expirado.'}
                {err === 'email_em_uso' && 'Este e-mail já está em uso.'}
                {err === 'dados_invalidos' && 'Preencha todos os campos obrigatórios.'}
                {err === 'senhas_nao_conferem' && 'As senhas não conferem. Digite novamente.'}
                {err === 'google_oauth' && 'Não foi possível iniciar o cadastro com Google. Tente novamente.'}
                {err === 'documento_invalido' && 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.'}
                {err === 'config' && 'Serviço indisponível. Tente mais tarde.'}
                {err === 'cadastro_falhou' &&
                  'Não foi possível finalizar o vínculo com a assistência. Tente novamente em instantes.'}
                {!['os_invalida', 'email_em_uso', 'dados_invalidos', 'senhas_nao_conferem', 'google_oauth', 'documento_invalido', 'config', 'cadastro_falhou'].includes(String(err)) &&
                  'Não foi possível concluir o cadastro.'}
              </p>
            ) : null}
            <div className='mb-4'>
              <CadastroClienteGoogleButton orgSlug={orgSlug} refOs={refOs} />
            </div>
            <div className='relative mb-4'>
              <div className='absolute inset-0 flex items-center'>
                <span className='w-full border-t' />
              </div>
              <div className='relative flex justify-center text-xs uppercase'>
                <span className='bg-card px-2 text-muted-foreground'>ou</span>
              </div>
            </div>
            <form action={registerCustomerFromOsLinkAction} className="space-y-4">
              <input type="hidden" name="orgSlug" value={orgSlug} />
              <input type="hidden" name="refOs" value={refOs} />
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input id="fullName" name="fullName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document">CPF ou CNPJ (somente números)</Label>
                <Input id="document" name="document" inputMode="numeric" required maxLength={14} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">Confirmar senha</Label>
                <Input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full">
                Criar conta
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
