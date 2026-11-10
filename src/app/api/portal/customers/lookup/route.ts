import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { onlyDigits } from '@/lib/utils/strings'

const BRASIL_API_BASE_URL = 'https://brasilapi.com.br/api'
const REQUEST_HEADERS = {
  accept: 'application/json',
  'user-agent': 'Conectize/1.0 (contato@conectize.com.br)',
}

async function fetchBrasilApi (path: string) {
  return fetch(`${BRASIL_API_BASE_URL}${path}`, {
    cache: 'no-store',
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(8000),
  })
}

export async function GET (request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const cnpj = onlyDigits(url.searchParams.get('cnpj') || '').slice(0, 14)
  const cep = onlyDigits(url.searchParams.get('cep') || '').slice(0, 8)

  try {
    if (cnpj) {
      if (cnpj.length !== 14) {
        return NextResponse.json({ ok: false, error: 'invalid_cnpj' }, { status: 400 })
      }
      const response = await fetchBrasilApi(`/cnpj/v1/${cnpj}`)
      const data = await response.json().catch(() => null)
      if (!response.ok || !data) {
        return NextResponse.json(
          { ok: false, error: response.status === 404 ? 'not_found' : 'provider_error' },
          { status: response.status === 404 ? 404 : 502 },
        )
      }
      return NextResponse.json({
        ok: true,
        company: {
          companyName: String(data.razao_social || ''),
          tradeName: String(data.nome_fantasia || ''),
          email: String(data.email || ''),
          phone: String(data.ddd_telefone_1 || data.ddd_telefone_2 || ''),
          zipCode: onlyDigits(String(data.cep || '')).slice(0, 8),
          state: String(data.uf || ''),
          city: String(data.municipio || ''),
          neighborhood: String(data.bairro || ''),
          street: String(data.logradouro || ''),
          streetNumber: String(data.numero || ''),
          streetComplement: String(data.complemento || ''),
        },
      })
    }

    if (cep) {
      if (cep.length !== 8) {
        return NextResponse.json({ ok: false, error: 'invalid_cep' }, { status: 400 })
      }
      const response = await fetchBrasilApi(`/cep/v2/${cep}`)
      const data = await response.json().catch(() => null)
      if (!response.ok || !data) {
        return NextResponse.json(
          { ok: false, error: response.status === 404 ? 'not_found' : 'provider_error' },
          { status: response.status === 404 ? 404 : 502 },
        )
      }
      return NextResponse.json({
        ok: true,
        address: {
          state: String(data.state || ''),
          city: String(data.city || ''),
          neighborhood: String(data.neighborhood || ''),
          street: String(data.street || ''),
        },
      })
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'provider_unavailable' }, { status: 502 })
  }

  return NextResponse.json({ ok: false, error: 'missing_document' }, { status: 400 })
}
