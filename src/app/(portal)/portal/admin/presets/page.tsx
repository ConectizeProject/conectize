'use server'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DadosEmpresaSubmenu } from '@/app/(portal)/portal/admin/dados-empresa/DadosEmpresaSubmenu'

async function requireAdmin () {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) redirect('/portal/login')

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'admin') redirect('/portal/ordens')

  return supabase
}

export default async function PresetsPage () {
  await requireAdmin()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações gerais</h1>
        <p className="text-sm text-muted-foreground">
          Configurações gerais, aparelhos e presets reutilizáveis.
        </p>
      </div>

      <DadosEmpresaSubmenu />

      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Modelos de garantia</CardTitle>
            <CardDescription>
              Cadastre textos de garantia para uso nas ordens de serviço. O texto escolhido aparece na impressão e na visão pública.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Gerencie os modelos em <span className="font-medium">Configurações &gt; Modelos de garantia</span>.
            </div>
            <Button asChild>
              <Link href="/portal/admin/garantias">
                Abrir modelos de garantia
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


