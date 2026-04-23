import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CadastroEmpresaForm } from './CadastroEmpresaForm'

export const metadata = {
  title: 'Cadastro de empresa — Conectize',
  robots: { index: false, follow: false },
}

export default async function CadastroEmpresaPage ({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const initialError = sp.error

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-background px-4 py-4">
        <div className="container max-w-lg flex items-center justify-between">
          <Link href="/planos" className="text-sm text-muted-foreground hover:text-foreground">
            ← Planos
          </Link>
          <Link href="/portal/login" className="text-sm font-medium">
            Já tenho conta
          </Link>
        </div>
      </header>

      <main className="flex-1 container max-w-lg px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar empresa</CardTitle>
            <CardDescription>
              Você será o administrador da organização. Use um CNPJ válido e um e-mail ainda não cadastrado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CadastroEmpresaForm initialError={initialError} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
