import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import {
  ensurePortalOrganizationContext,
  getPortalOrganizationId,
} from '@/lib/organizations/portal-organization-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { onlyDigits } from '@/lib/utils/strings'
import {
  getFiscalCertificatePublic,
  normalizeFiscalProfileInput,
  saveFiscalCertificate,
  upsertFiscalProfile,
  type FiscalEnvironment,
  type TaxRegime,
} from '@/lib/fiscal/profile'
import { CnpjMaskedInput } from './CnpjMaskedInput'
import { FiscalAddressFields } from './FiscalAddressFields'
import { FiscalCertificateActions } from './FiscalCertificateActions'
import { FiscalSettingsToastClient } from './FiscalSettingsToastClient'
import { SefazCommunicationTestButton } from './SefazCommunicationTestButton'
import { StateRegistrationField } from './StateRegistrationField'

async function canEditFiscalData (
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  organizationId: string,
  userRole: string | null | undefined,
): Promise<boolean> {
  if (userRole === 'platform_admin') return true
  const { data: row } = await supabase
    .from('organization_members')
    .select('role_in_org')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  return row?.role_in_org === 'admin'
}

function optionalNumber (formData: FormData, name: string, fallback: number) {
  const value = Number(formData.get(name))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

async function updateFiscalAction (formData: FormData) {
  'use server'

  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) await redirectToPortalLogin()

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) redirect('/portal/ordens')

  const allowed = await canEditFiscalData(supabase, user.id, organizationId, me?.role)
  if (!allowed) redirect('/portal/ordens')

  const profile = normalizeFiscalProfileInput({
    legalName: String(formData.get('legalName') || ''),
    tradeName: String(formData.get('tradeName') || ''),
    cnpj: String(formData.get('cnpj') || ''),
    stateRegistration: String(formData.get('stateRegistration') || ''),
    stateRegistrationExempt: formData.get('stateRegistrationExempt') === 'on',
    municipalRegistration: String(formData.get('municipalRegistration') || ''),
    taxRegime: String(formData.get('taxRegime') || 'simples_nacional') as TaxRegime,
    street: String(formData.get('street') || ''),
    number: String(formData.get('number') || ''),
    complement: String(formData.get('complement') || ''),
    district: String(formData.get('district') || ''),
    zipCode: String(formData.get('zipCode') || ''),
    city: String(formData.get('city') || ''),
    state: String(formData.get('state') || ''),
    ibgeCityCode: String(formData.get('ibgeCityCode') || ''),
    nfceCscId: String(formData.get('nfceCscId') || ''),
    nfceCsc: String(formData.get('nfceCsc') || ''),
    nfceSeries: optionalNumber(formData, 'nfceSeries', 1),
    nfceNextNumber: optionalNumber(formData, 'nfceNextNumber', 1),
    nfeSeries: optionalNumber(formData, 'nfeSeries', 1),
    nfeNextNumber: optionalNumber(formData, 'nfeNextNumber', 1),
    fiscalEnvironment: String(formData.get('fiscalEnvironment') || 'homologacao') as FiscalEnvironment,
    nfceEnabled: true,
    defaultCfop: String(formData.get('defaultCfop') || ''),
    defaultOrigin: Number(formData.get('defaultOrigin') || 0),
    defaultUnit: String(formData.get('defaultUnit') || 'UN'),
    defaultCsosn: String(formData.get('defaultCsosn') || '102'),
    defaultPisCst: String(formData.get('defaultPisCst') || '49'),
    defaultCofinsCst: String(formData.get('defaultCofinsCst') || '49'),
  })

  let saved
  try {
    saved = await upsertFiscalProfile(supabase, organizationId, profile)
  } catch {
    redirect('/portal/admin/dados-empresa/fiscal?error=secret')
  }
  if (!saved.ok) redirect('/portal/admin/dados-empresa/fiscal?error=db')

  const certFileRaw = formData.get('certificateFile')
  const certPassword = String(formData.get('certificatePassword') || '')
  const certFile = certFileRaw && typeof certFileRaw !== 'string' && certFileRaw.size > 0
    ? certFileRaw
    : null

  if (certFile) {
    if (!certPassword.trim()) {
      redirect('/portal/admin/dados-empresa/fiscal?error=cert_password')
    }

    let cert
    try {
      cert = await saveFiscalCertificate({
        organizationId,
        organizationCnpj: profile.cnpj,
        file: certFile,
        password: certPassword,
      })
    } catch {
      redirect('/portal/admin/dados-empresa/fiscal?error=secret')
    }
    if (!cert.ok) {
      redirect(`/portal/admin/dados-empresa/fiscal?error=${encodeURIComponent(cert.error)}`)
    }
  }

  redirect('/portal/admin/dados-empresa/fiscal?ok=1')
}

function dateLabel (value?: string | null) {
  if (!value) return 'Não informado'
  return new Date(value).toLocaleDateString('pt-BR')
}

export default async function FiscalSettingsPage ({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string, error?: string }>
}) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) await redirectToPortalLogin()

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  await ensurePortalOrganizationContext(supabase, user.id)
  const organizationId = await getPortalOrganizationId(supabase, user.id)
  if (!organizationId) redirect('/portal/ordens')

  const allowed = await canEditFiscalData(supabase, user.id, organizationId, me?.role)
  if (!allowed) redirect('/portal/ordens')

  const [{ data: organization }, { data: profile }, certificate] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, cnpj, address, complement, zip_code, city, state')
      .eq('id', organizationId)
      .maybeSingle(),
    supabase
      .from('organization_fiscal_profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    getFiscalCertificatePublic(organizationId),
  ])

  const cnpj = profile?.cnpj || onlyDigits(organization?.cnpj || '')

  return (
    <div className='max-w-5xl space-y-6'>
      <FiscalSettingsToastClient />

      <form action={updateFiscalAction} className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Perfil fiscal</CardTitle>
            <CardDescription>
              Dados do emitente usados no XML da NFC-e. O endereço fiscal precisa ter município IBGE.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='legalName'>Razão social</Label>
                <Input id='legalName' name='legalName' defaultValue={profile?.legal_name || organization?.name || ''} autoComplete='organization' />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='tradeName'>Nome fantasia</Label>
                <Input id='tradeName' name='tradeName' defaultValue={profile?.trade_name || organization?.name || ''} autoComplete='organization' />
              </div>
            </div>

            <div className='grid gap-4 md:grid-cols-4'>
              <div className='space-y-2 md:col-span-2'>
                <Label htmlFor='cnpj'>CNPJ fiscal</Label>
                <CnpjMaskedInput id='cnpj' name='cnpj' defaultValue={cnpj} />
              </div>
              <StateRegistrationField
                defaultValue={profile?.state_registration || ''}
                defaultExempt={profile?.state_registration_exempt === true}
              />
              <div className='space-y-2'>
                <Label htmlFor='municipalRegistration'>IM</Label>
                <Input id='municipalRegistration' name='municipalRegistration' defaultValue={profile?.municipal_registration || ''} autoComplete='off' />
              </div>
            </div>

            <div className='grid gap-4 md:grid-cols-3'>
              <div className='space-y-2'>
                <Label htmlFor='taxRegime'>Código de regime tributário</Label>
                <select
                  id='taxRegime'
                  name='taxRegime'
                  defaultValue={profile?.tax_regime || 'simples_nacional'}
                  className='h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                >
                  <option value='simples_nacional'>1 - Simples Nacional</option>
                  <option value='simples_excesso_sublimite'>2 - Simples com excesso de sublimite</option>
                  <option value='regime_normal'>3 - Regime normal</option>
                </select>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='fiscalEnvironment'>Ambiente</Label>
                <select
                  id='fiscalEnvironment'
                  name='fiscalEnvironment'
                  defaultValue={profile?.fiscal_environment || 'homologacao'}
                  className='h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                >
                  <option value='homologacao'>Homologação</option>
                  <option value='producao'>Produção</option>
                </select>
              </div>
              <div className='flex items-end'>
                <SefazCommunicationTestButton />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endereço fiscal</CardTitle>
            <CardDescription>Use o endereço cadastrado na SEFAZ para evitar rejeição do emitente.</CardDescription>
          </CardHeader>
          <CardContent>
            <FiscalAddressFields
              zipCode={profile?.zip_code || organization?.zip_code || ''}
              street={profile?.street || organization?.address || ''}
              number={profile?.number || ''}
              district={profile?.district || ''}
              city={profile?.city || organization?.city || ''}
              state={profile?.state || organization?.state || ''}
              ibgeCityCode={profile?.ibge_city_code || ''}
              complement={profile?.complement || organization?.complement || ''}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>NFC-e e padrões tributários</CardTitle>
            <CardDescription>CSC e numeração são fornecidos pelo portal da SEFAZ da UF.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-4'>
              <div className='space-y-2'>
                <Label htmlFor='nfceCscId'>ID Token CSC</Label>
                <Input id='nfceCscId' name='nfceCscId' defaultValue={profile?.nfce_csc_id || ''} autoComplete='off' />
              </div>
              <div className='space-y-2 md:col-span-3'>
                <Label htmlFor='nfceCsc'>CSC</Label>
                <Input id='nfceCsc' name='nfceCsc' type='password' autoComplete='new-password' placeholder={profile?.nfce_csc_ciphertext ? 'CSC já salvo; preencha apenas para trocar' : 'Código de Segurança do Contribuinte'} />
              </div>
            </div>
            <div className='grid gap-4 md:grid-cols-4'>
              <div className='space-y-2'>
                <Label htmlFor='nfceSeries'>Série NFC-e</Label>
                <Input id='nfceSeries' name='nfceSeries' type='number' min={1} defaultValue={profile?.nfce_series || 1} autoComplete='off' />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='nfceNextNumber'>Próximo número NFC-e</Label>
                <Input id='nfceNextNumber' name='nfceNextNumber' type='number' min={1} defaultValue={profile?.nfce_next_number || 1} autoComplete='off' />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='nfeSeries'>Série NF-e</Label>
                <Input id='nfeSeries' name='nfeSeries' type='number' min={1} defaultValue={profile?.nfe_series || 1} autoComplete='off' />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='nfeNextNumber'>Próximo número NF-e</Label>
                <Input id='nfeNextNumber' name='nfeNextNumber' type='number' min={1} defaultValue={profile?.nfe_next_number || 1} autoComplete='off' />
              </div>
            </div>

            <Separator />

            <div className='grid gap-4 md:grid-cols-6'>
              <div className='space-y-2'>
                <Label htmlFor='defaultCfop'>CFOP padrão</Label>
                <Input id='defaultCfop' name='defaultCfop' defaultValue={profile?.default_cfop || '5102'} maxLength={4} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='defaultOrigin'>Origem</Label>
                <Input id='defaultOrigin' name='defaultOrigin' type='number' min={0} max={8} defaultValue={profile?.default_origin ?? 0} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='defaultUnit'>Unidade</Label>
                <Input id='defaultUnit' name='defaultUnit' defaultValue={profile?.default_unit || 'UN'} maxLength={6} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='defaultCsosn'>CSOSN</Label>
                <Input id='defaultCsosn' name='defaultCsosn' defaultValue={profile?.default_csosn || '102'} maxLength={3} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='defaultPisCst'>PIS CST</Label>
                <Input id='defaultPisCst' name='defaultPisCst' defaultValue={profile?.default_pis_cst || '49'} maxLength={2} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='defaultCofinsCst'>COFINS CST</Label>
                <Input id='defaultCofinsCst' name='defaultCofinsCst' defaultValue={profile?.default_cofins_cst || '49'} maxLength={2} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Certificado digital A1</CardTitle>
            <CardDescription>O arquivo PFX/P12 e a senha ficam criptografados. O certificado nunca é enviado ao navegador.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='rounded-md border p-4 text-sm'>
              {certificate?.hasCertificate ? (
                <div className='space-y-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='secondary'>Certificado salvo</Badge>
                    <span className='text-muted-foreground'>Válido até {dateLabel(certificate.validUntil)}</span>
                  </div>
                  <p><span className='font-medium'>Titular:</span> {certificate.subjectCommonName || 'Não identificado'}</p>
                  <p><span className='font-medium'>CNPJ:</span> {certificate.subjectCnpj || 'Não identificado'}</p>
                  <p className='break-all text-muted-foreground'>SHA-256: {certificate.fingerprintSha256}</p>
                  <FiscalCertificateActions />
                </div>
              ) : (
                <p className='text-muted-foreground'>Nenhum certificado A1 cadastrado.</p>
              )}
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='certificateFile'>Arquivo .pfx ou .p12</Label>
                <Input id='certificateFile' name='certificateFile' type='file' accept='.pfx,.p12,application/x-pkcs12' />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='certificatePassword'>Senha do certificado</Label>
                <Input id='certificatePassword' name='certificatePassword' type='password' autoComplete='new-password' />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className='flex justify-end'>
          <Button type='submit'>Salvar configurações fiscais</Button>
        </div>
      </form>
    </div>
  )
}
