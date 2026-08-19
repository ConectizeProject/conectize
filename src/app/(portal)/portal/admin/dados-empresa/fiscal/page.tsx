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
import {
  getDefaultFiscalOperationNature,
  normalizeFiscalOperationNatureInput,
  operationNatureFromProfileFallback,
  upsertDefaultFiscalOperationNature,
  type FiscalOperationType,
} from '@/lib/fiscal/operation-nature'
import { decryptFiscalSecretToString } from '@/lib/fiscal/secrets'
import { nfceNumberingForEnvironment } from '@/lib/fiscal/numbering'
import { isFiscalCertificateExpired } from '@/lib/fiscal/certificate-validity'
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

function readSavedCsc (ciphertext: unknown) {
  const raw = String(ciphertext || '')
  if (!raw) return ''
  try {
    return decryptFiscalSecretToString(raw)
  } catch {
    return ''
  }
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

  const fiscalEnvironment = String(formData.get('fiscalEnvironment') || 'homologacao') as FiscalEnvironment
  const nfceSeriesHomologacao = optionalNumber(formData, 'nfceSeriesHomologacao', 1)
  const nfceNextNumberHomologacao = optionalNumber(formData, 'nfceNextNumberHomologacao', 1)
  const nfceSeriesProducao = optionalNumber(formData, 'nfceSeriesProducao', 1)
  const nfceNextNumberProducao = optionalNumber(formData, 'nfceNextNumberProducao', 1)
  const nfceSeries = fiscalEnvironment === 'producao' ? nfceSeriesProducao : nfceSeriesHomologacao

  const operationNature = normalizeFiscalOperationNatureInput({
    documentModel: '65',
    name: String(formData.get('nfceNatureName') || 'Venda de Mercadoria NFC-e'),
    description: String(formData.get('nfceNatureDescription') || 'Venda de Mercadoria'),
    series: nfceSeries,
    operationType: String(formData.get('nfceOperationType') || 'saida') as FiscalOperationType,
    taxRegime: String(formData.get('taxRegime') || 'simples_nacional') as TaxRegime,
    presenceIndicator: Number(formData.get('nfcePresenceIndicator') || 1),
    isBilled: formData.get('nfceIsBilled') === 'on',
    isFinalConsumer: formData.get('nfceIsFinalConsumer') === 'on',
    isReturn: formData.get('nfceIsReturn') === 'on',
    defaultCfop: String(formData.get('defaultCfop') || ''),
    defaultOrigin: Number(formData.get('defaultOrigin') || 0),
    defaultUnit: String(formData.get('defaultUnit') || 'UN'),
    icmsCsosn: String(formData.get('defaultCsosn') || '102'),
    icmsCst: String(formData.get('defaultIcmsCst') || ''),
    pisCst: String(formData.get('defaultPisCst') || '49'),
    cofinsCst: String(formData.get('defaultCofinsCst') || '49'),
  })

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
    nfceCscIdHomologacao: String(formData.get('nfceCscIdHomologacao') || ''),
    nfceCscHomologacao: String(formData.get('nfceCscHomologacao') || ''),
    nfceCscIdProducao: String(formData.get('nfceCscIdProducao') || ''),
    nfceCscProducao: String(formData.get('nfceCscProducao') || ''),
    nfceSeriesHomologacao,
    nfceNextNumberHomologacao,
    nfceSeriesProducao,
    nfceNextNumberProducao,
    nfeSeries: optionalNumber(formData, 'nfeSeries', 1),
    nfeNextNumber: optionalNumber(formData, 'nfeNextNumber', 1),
    fiscalEnvironment,
    nfceEnabled: true,
    defaultCfop: operationNature.defaultCfop,
    defaultOrigin: operationNature.defaultOrigin,
    defaultUnit: operationNature.defaultUnit,
    defaultCsosn: operationNature.icmsCsosn || '102',
    defaultPisCst: operationNature.pisCst,
    defaultCofinsCst: operationNature.cofinsCst,
  })

  let saved
  try {
    saved = await upsertFiscalProfile(supabase, organizationId, profile)
  } catch {
    redirect('/portal/admin/dados-empresa/fiscal?error=secret')
  }
  if (!saved.ok) redirect('/portal/admin/dados-empresa/fiscal?error=db')

  const operationSaved = await upsertDefaultFiscalOperationNature(organizationId, operationNature)
  if (!operationSaved.ok) redirect('/portal/admin/dados-empresa/fiscal?error=db')

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

  const [{ data: organization }, { data: profile }, certificate, nfceOperationNature] = await Promise.all([
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
    getDefaultFiscalOperationNature(organizationId, '65'),
  ])

  const cnpj = profile?.cnpj || onlyDigits(organization?.cnpj || '')
  const nfceCscHomologacao = readSavedCsc(
    profile?.nfce_csc_ciphertext_homologacao || (profile?.fiscal_environment !== 'producao' ? profile?.nfce_csc_ciphertext : null),
  )
  const nfceCscProducao = readSavedCsc(
    profile?.nfce_csc_ciphertext_producao || (profile?.fiscal_environment === 'producao' ? profile?.nfce_csc_ciphertext : null),
  )
  const nfceCscIdHomologacao = profile?.nfce_csc_id_homologacao || (profile?.fiscal_environment !== 'producao' ? profile?.nfce_csc_id : '') || ''
  const nfceCscIdProducao = profile?.nfce_csc_id_producao || (profile?.fiscal_environment === 'producao' ? profile?.nfce_csc_id : '') || ''
  const numberingHomologacao = nfceNumberingForEnvironment(profile || {}, 'homologacao')
  const numberingProducao = nfceNumberingForEnvironment(profile || {}, 'producao')
  const certificateExpired = isFiscalCertificateExpired(certificate?.validUntil)
  const nfceNature = nfceOperationNature
    ? normalizeFiscalOperationNatureInput({
      documentModel: '65',
      name: nfceOperationNature.name,
      description: nfceOperationNature.description,
      series: nfceOperationNature.series,
      operationType: nfceOperationNature.operation_type,
      taxRegime: nfceOperationNature.tax_regime,
      presenceIndicator: nfceOperationNature.presence_indicator,
      isBilled: nfceOperationNature.is_billed,
      isFinalConsumer: nfceOperationNature.is_final_consumer,
      isReturn: nfceOperationNature.is_return,
      defaultCfop: nfceOperationNature.default_cfop,
      defaultOrigin: nfceOperationNature.default_origin,
      defaultUnit: nfceOperationNature.default_unit,
      icmsCsosn: nfceOperationNature.icms_csosn,
      icmsCst: nfceOperationNature.icms_cst,
      pisCst: nfceOperationNature.pis_cst,
      cofinsCst: nfceOperationNature.cofins_cst,
    })
    : operationNatureFromProfileFallback(profile, '65')

  return (
    <div className='max-w-5xl space-y-6'>
      <FiscalSettingsToastClient />

      <form action={updateFiscalAction} className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Perfil fiscal</CardTitle>
            <CardDescription>
              Dados do emitente usados no XML da NFC-e. A IE precisa ser a mesma do CAD-ICMS da UF; homologação exige credenciamento NFC-e separado da produção.
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
            <CardTitle>NFC-e, NF-e e naturezas de operação</CardTitle>
            <CardDescription>
              Homologação e produção têm CSC, série e numeração diferentes. A emissão usa o par do ambiente selecionado no perfil.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-5'>
            <div className='grid gap-4 md:grid-cols-4'>
              <div className='space-y-2'>
                <Label htmlFor='nfceCscIdHomologacao'>ID Token (homologação)</Label>
                <Input
                  id='nfceCscIdHomologacao'
                  name='nfceCscIdHomologacao'
                  defaultValue={nfceCscIdHomologacao}
                  autoComplete='off'
                  spellCheck={false}
                />
              </div>
              <div className='space-y-2 md:col-span-3'>
                <Label htmlFor='nfceCscHomologacao'>CSC (homologação)</Label>
                <Input
                  id='nfceCscHomologacao'
                  name='nfceCscHomologacao'
                  type='text'
                  defaultValue={nfceCscHomologacao}
                  autoComplete='off'
                  spellCheck={false}
                  placeholder='CSC de teste do SIARE'
                />
              </div>
            </div>
            <div className='grid gap-4 md:grid-cols-4'>
              <div className='space-y-2'>
                <Label htmlFor='nfceSeriesHomologacao'>Série NFC-e (homologação)</Label>
                <Input
                  id='nfceSeriesHomologacao'
                  name='nfceSeriesHomologacao'
                  type='number'
                  min={1}
                  defaultValue={numberingHomologacao.series}
                  autoComplete='off'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='nfceNextNumberHomologacao'>Próximo número (homologação)</Label>
                <Input
                  id='nfceNextNumberHomologacao'
                  name='nfceNextNumberHomologacao'
                  type='number'
                  min={1}
                  defaultValue={numberingHomologacao.nextNumber}
                  autoComplete='off'
                />
              </div>
            </div>
            <div className='grid gap-4 md:grid-cols-4'>
              <div className='space-y-2'>
                <Label htmlFor='nfceCscIdProducao'>ID Token (produção)</Label>
                <Input
                  id='nfceCscIdProducao'
                  name='nfceCscIdProducao'
                  defaultValue={nfceCscIdProducao}
                  autoComplete='off'
                  spellCheck={false}
                />
              </div>
              <div className='space-y-2 md:col-span-3'>
                <Label htmlFor='nfceCscProducao'>CSC (produção)</Label>
                <Input
                  id='nfceCscProducao'
                  name='nfceCscProducao'
                  type='text'
                  defaultValue={nfceCscProducao}
                  autoComplete='off'
                  spellCheck={false}
                  placeholder='CSC de produção do SIARE'
                />
                <p className='text-xs text-muted-foreground'>
                  Se o código atual era o de produção e o ambiente está em homologação, mova-o para o par de produção e deixe o de homologação para o CSC de teste do SIARE.
                </p>
              </div>
            </div>
            <div className='grid gap-4 md:grid-cols-4'>
              <div className='space-y-2'>
                <Label htmlFor='nfceSeriesProducao'>Série NFC-e (produção)</Label>
                <Input
                  id='nfceSeriesProducao'
                  name='nfceSeriesProducao'
                  type='number'
                  min={1}
                  defaultValue={numberingProducao.series}
                  autoComplete='off'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='nfceNextNumberProducao'>Próximo número (produção)</Label>
                <Input
                  id='nfceNextNumberProducao'
                  name='nfceNextNumberProducao'
                  type='number'
                  min={1}
                  defaultValue={numberingProducao.nextNumber}
                  autoComplete='off'
                />
              </div>
            </div>
            <div className='grid gap-4 md:grid-cols-4'>
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

            <div className='space-y-4 rounded-md border border-border/70 bg-muted/15 p-4'>
              <div>
                <h3 className='text-sm font-semibold tracking-tight'>Natureza padrão: Venda de Mercadoria NFC-e</h3>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Regras simples para o modelo 65: saída e consumidor final ficam fixos. A série da NFC-e é a do ambiente ativo acima. Devolução entra depois, via cancelamento ou NF-e.
                </p>
              </div>

              <div className='grid gap-4 md:grid-cols-4'>
                <div className='space-y-2 md:col-span-2'>
                  <Label htmlFor='nfceNatureName'>Descrição</Label>
                  <Input id='nfceNatureName' name='nfceNatureName' defaultValue={nfceNature.name} autoComplete='off' />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='nfceOperationType'>Tipo</Label>
                  <input type='hidden' name='nfceOperationType' value='saida' />
                  <p className='flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm'>
                    Saída
                  </p>
                </div>
              </div>

              <div className='grid gap-4 md:grid-cols-4'>
                <div className='space-y-2 md:col-span-2'>
                  <Label htmlFor='nfceNatureDescription'>Natureza da operação no XML</Label>
                  <Input id='nfceNatureDescription' name='nfceNatureDescription' defaultValue={nfceNature.description} autoComplete='off' />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='nfcePresenceIndicator'>Indicador de presença</Label>
                  <select
                    id='nfcePresenceIndicator'
                    name='nfcePresenceIndicator'
                    defaultValue={String(nfceNature.presenceIndicator)}
                    className='h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm'
                  >
                    <option value='1'>1 - Operação presencial</option>
                    <option value='2'>2 - Internet</option>
                    <option value='3'>3 - Teleatendimento</option>
                    <option value='4'>4 - NFC-e entrega em domicílio</option>
                    <option value='9'>9 - Outros</option>
                  </select>
                </div>
                <div className='space-y-2'>
                  <Label>Flags</Label>
                  <div className='flex h-10 items-center gap-3 rounded-md border border-input bg-background px-3 text-sm'>
                    <label className='flex items-center gap-2'>
                      <input type='checkbox' name='nfceIsBilled' defaultChecked={nfceNature.isBilled} />
                      Faturada
                    </label>
                  </div>
                </div>
              </div>

              <div className='flex flex-wrap gap-4 text-sm text-muted-foreground'>
                <input type='hidden' name='nfceIsFinalConsumer' value='on' />
                <p>NFC-e é sempre venda a consumidor final.</p>
                <p>
                  Devolução não usa esta natureza: cancele a NFC-e em até 24h ou emita uma NF-e de devolução (modelo 55) referenciando a chave.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className='text-sm font-medium'>Regras de tributação</h4>
                <p className='mt-1 text-xs text-muted-foreground'>Versão simples: destino e produto “Qualquer”.</p>
              </div>

              <div className='grid gap-4 md:grid-cols-7'>
              <div className='space-y-2'>
                <Label htmlFor='defaultCfop'>CFOP padrão NFC-e/NF-e</Label>
                <Input id='defaultCfop' name='defaultCfop' defaultValue={nfceNature.defaultCfop} maxLength={4} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='defaultOrigin'>Origem</Label>
                <Input id='defaultOrigin' name='defaultOrigin' type='number' min={0} max={8} defaultValue={nfceNature.defaultOrigin} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='defaultUnit'>Unidade</Label>
                <Input id='defaultUnit' name='defaultUnit' defaultValue={nfceNature.defaultUnit} maxLength={6} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='defaultCsosn'>CSOSN</Label>
                <Input id='defaultCsosn' name='defaultCsosn' defaultValue={nfceNature.icmsCsosn || '102'} maxLength={3} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='defaultIcmsCst'>ICMS CST</Label>
                <Input id='defaultIcmsCst' name='defaultIcmsCst' defaultValue={nfceNature.icmsCst || ''} maxLength={3} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='defaultPisCst'>PIS CST</Label>
                <Input id='defaultPisCst' name='defaultPisCst' defaultValue={nfceNature.pisCst} maxLength={2} />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='defaultCofinsCst'>COFINS CST</Label>
                <Input id='defaultCofinsCst' name='defaultCofinsCst' defaultValue={nfceNature.cofinsCst} maxLength={2} />
              </div>
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
                    {certificateExpired ? (
                      <Badge variant='destructive'>Certificado vencido</Badge>
                    ) : (
                      <Badge variant='secondary'>Certificado salvo</Badge>
                    )}
                    <span className={certificateExpired ? 'text-destructive' : 'text-muted-foreground'}>
                      {certificateExpired ? 'Venceu em' : 'Válido até'} {dateLabel(certificate.validUntil)}
                    </span>
                  </div>
                  {certificateExpired ? (
                    <p className='text-sm text-destructive'>
                      Envie um certificado A1 válido para emitir ou cancelar NFC-e.
                    </p>
                  ) : null}
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
