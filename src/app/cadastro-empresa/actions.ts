'use server'

import { redirect } from 'next/navigation'
import { registerOrganization } from './register-organization'

export async function registerOrganizationAction (formData: FormData) {
  const result = await registerOrganization({
    companyName: String(formData.get('companyName') || ''),
    cnpj: String(formData.get('cnpj') || ''),
    email: String(formData.get('email') || ''),
    password: String(formData.get('password') || ''),
    fullName: String(formData.get('fullName') || ''),
    logoUrl: String(formData.get('logoUrl') || ''),
  })

  if (!result.ok) {
    redirect(`/cadastro-empresa?error=${encodeURIComponent(result.error)}`)
  }

  redirect('/portal/login?cadastro=empresa')
}
