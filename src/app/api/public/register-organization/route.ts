import { NextResponse } from 'next/server'
import { registerOrganization } from '@/app/cadastro-empresa/register-organization'

function pickLogoFile (value: FormDataEntryValue | null) {
  if (!value || typeof value === 'string') return null
  if (!(value instanceof Blob) || value.size <= 0) return null
  return value
}

export async function POST (request: Request) {
  const contentType = request.headers.get('content-type') || ''

  let companyName = ''
  let cnpj = ''
  let email = ''
  let password = ''
  let passwordConfirm = ''
  let fullName = ''
  let logoUrl = ''
  let logoFile: Blob | null = null

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json({ ok: false, error: 'dados_invalidos' }, { status: 400 })
    }

    companyName = String(formData.get('companyName') || '')
    cnpj = String(formData.get('cnpj') || '')
    email = String(formData.get('email') || '')
    password = String(formData.get('password') || '')
    passwordConfirm = String(formData.get('passwordConfirm') || '')
    fullName = String(formData.get('fullName') || '')
    logoUrl = String(formData.get('logoUrl') || '')
    logoFile = pickLogoFile(formData.get('logoFile'))
  } else {
    const body = await request.json().catch(() => null)
    companyName = String(body?.companyName || '')
    cnpj = String(body?.cnpj || '')
    email = String(body?.email || '')
    password = String(body?.password || '')
    passwordConfirm = String(body?.passwordConfirm || '')
    fullName = String(body?.fullName || '')
    logoUrl = String(body?.logoUrl || '')
  }

  const result = await registerOrganization({
    companyName,
    cnpj,
    email,
    password,
    passwordConfirm,
    fullName,
    logoUrl,
    logoFile,
  })

  if (!result.ok) {
    const error = 'error' in result ? result.error : 'dados_invalidos'
    const status = error === 'config' ? 500 : 400
    return NextResponse.json(result, { status })
  }

  return NextResponse.json({ ok: true })
}
