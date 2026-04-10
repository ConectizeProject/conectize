import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DocumentMaskedInput } from '@/app/(portal)/portal/clientes/DocumentMaskedInput'
import { DadosEmpresaSubmitButton } from './DadosEmpresaSubmitButton'
import { DadosEmpresaToastClient } from './DadosEmpresaToastClient'
import { formatCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatCepBr } from '@/lib/utils/format-cep'
import { onlyDigits } from '@/lib/utils/strings'

async function updateCompanyAction(formData: FormData) {
  'use server'

  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) await redirectToPortalLogin()

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'admin') redirect('/portal/ordens')

  const name = String(formData.get('name') || '').trim()
  const cnpj = onlyDigits(String(formData.get('cnpj') || '')).slice(0, 14) || null
  const address = String(formData.get('address') || '').trim() || null
  const complement = String(formData.get('complement') || '').trim() || null
  const zipCode = onlyDigits(String(formData.get('zipCode') || '')).slice(0, 8) || null
  const city = String(formData.get('city') || '').trim() || null
  const state = String(formData.get('state') || '').trim().slice(0, 2) || null
  const phone = String(formData.get('phone') || '').trim() || null
  const email = String(formData.get('email') || '').trim() || null
  const logoUrl = String(formData.get('logoUrl') || '').trim() || null

  await supabase
    .from('company_settings')
    .update({
      name: name || null,
      cnpj,
      address,
      complement,
      zip_code: zipCode,
      city,
      state,
      phone,
      email,
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  redirect('/portal/admin/dados-empresa?ok=1')
}

export default async function DadosEmpresaPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ ok?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) await redirectToPortalLogin()

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'admin') redirect('/portal/ordens')

  const { data: company } = await supabase
    .from('company_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  const c = company || {}

  return (
    <div className="space-y-6">
      <DadosEmpresaToastClient />
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
            <CardDescription>
              Estes dados aparecem no cabeçalho da impressão das ordens de serviço.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateCompanyAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da empresa</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={c.name || ''}
                  placeholder="Ex: Conectize Assistência Técnica"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <DocumentMaskedInput
                  name="cnpj"
                  defaultValue={formatCnpj(String(c.cnpj ?? ''))}
                  placeholder="00.000.000/0001-00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">URL do logo</Label>
                <Input
                  id="logoUrl"
                  name="logoUrl"
                  defaultValue={c.logo_url || ''}
                  placeholder="/logo_conectize.svg ou URL completa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  name="address"
                  defaultValue={c.address || ''}
                  placeholder="Rua, número"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="complement">Complemento</Label>
                <Input
                  id="complement"
                  name="complement"
                  defaultValue={c.complement || ''}
                  placeholder="Sala, andar, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zipCode">CEP</Label>
                  <Input
                    id="zipCode"
                    name="zipCode"
                    defaultValue={formatCepBr(c.zip_code)}
                    placeholder="00000-000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    name="city"
                    defaultValue={c.city || ''}
                    placeholder="Belo Horizonte"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state">Estado (UF)</Label>
                  <Input
                    id="state"
                    name="state"
                    defaultValue={c.state || ''}
                    placeholder="MG"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={c.phone || ''}
                    placeholder="(31) 99999-9999"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={c.email || ''}
                  placeholder="contato@empresa.com.br"
                />
              </div>

              <DadosEmpresaSubmitButton />
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
