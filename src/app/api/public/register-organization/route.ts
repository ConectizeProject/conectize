import { NextResponse } from 'next/server'
import { registerOrganization } from '@/app/cadastro-empresa/register-organization'

export async function POST (request: Request) {
  const body = await request.json().catch(() => null)

  const result = await registerOrganization({
    companyName: String(body?.companyName || ''),
    cnpj: String(body?.cnpj || ''),
    email: String(body?.email || ''),
    password: String(body?.password || ''),
    passwordConfirm: String(body?.passwordConfirm || ''),
    fullName: String(body?.fullName || ''),
    logoUrl: String(body?.logoUrl || ''),
  })

  if (!result.ok) {
    const error = 'error' in result ? result.error : 'dados_invalidos'
    const status = error === 'config' ? 500 : 400
    return NextResponse.json(result, { status })
  }

  return NextResponse.json({ ok: true })
}
