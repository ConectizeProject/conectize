'use server'

import { redirect } from 'next/navigation'
import { registerOrganization } from './register-organization'

export async function registerOrganizationAction (formData: FormData) {
  const logoFileRaw = formData.get('logoFile')
  const logoFile =
    logoFileRaw && typeof logoFileRaw !== 'string' && logoFileRaw.size > 0
      ? logoFileRaw
      : null

  const result = await registerOrganization({
    companyName: String(formData.get('companyName') || ''),
    cnpj: String(formData.get('cnpj') || ''),
    email: String(formData.get('email') || ''),
    password: String(formData.get('password') || ''),
    passwordConfirm: String(formData.get('passwordConfirm') || ''),
    fullName: String(formData.get('fullName') || ''),
    logoUrl: String(formData.get('logoUrl') || ''),
    logoFile,
  })

  if (!result.ok) {
    const error = 'error' in result ? result.error : 'dados_invalidos'
    redirect(`/cadastro-empresa?error=${encodeURIComponent(error)}`)
  }

  redirect('/portal/login?cadastro=empresa')
}
