import { NextResponse } from 'next/server'
import { requireFiscalAdmin } from '@/lib/fiscal/portal-access'
import { testSefazStatus } from '@/lib/fiscal/sefaz-status'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { getFiscalCertificateSecret } from '@/lib/fiscal/profile'

export const runtime = 'nodejs'
export const maxDuration = 30

type SefazStatusBody = {
  state?: unknown
  fiscalEnvironment?: unknown
}

function normalizeEnvironment (value: unknown) {
  return value === 'producao' ? 'producao' : 'homologacao'
}

export async function POST (request: Request) {
  const auth = await requireFiscalAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null) as SefazStatusBody | null
  const bodyState = typeof body?.state === 'string' ? body.state.trim().toUpperCase().slice(0, 2) : ''
  const bodyEnvironment = normalizeEnvironment(body?.fiscalEnvironment)

  const supabase = createSupabaseServiceClient()
  const { data: profile, error } = await supabase
    .from('organization_fiscal_profiles')
    .select('state, fiscal_environment')
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (error) {
    console.error('[sefaz status] failed to load fiscal profile', error)
    return NextResponse.json({ ok: false, error: 'db_error', message: 'Não foi possível carregar o perfil fiscal.' }, { status: 500 })
  }

  const state = bodyState || String(profile?.state || '').trim().toUpperCase().slice(0, 2)
  const environment = body?.fiscalEnvironment
    ? bodyEnvironment
    : normalizeEnvironment(profile?.fiscal_environment)

  if (!state) {
    return NextResponse.json({ ok: false, error: 'missing_state', message: 'Informe a UF no endereço fiscal antes de testar.' }, { status: 400 })
  }

  const certificateResult = await getFiscalCertificateSecret(auth.organizationId)
  if (certificateResult.ok === false) {
    const message = certificateResult.error === 'not_found'
      ? 'Cadastre o certificado digital A1 antes de testar a comunicação com a SEFAZ.'
      : 'Não foi possível abrir o certificado salvo para testar a comunicação com a SEFAZ.'
    const status = certificateResult.error === 'not_found' ? 400 : 500
    return NextResponse.json({ ok: false, error: certificateResult.error, message }, { status })
  }

  const result = await testSefazStatus(state, environment, {
    pfxBuffer: certificateResult.certificate.pfxBuffer,
    password: certificateResult.certificate.password,
  })
  if (result.ok === false) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json(result)
}
