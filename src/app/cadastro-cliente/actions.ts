'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { consumeSignupIp, signupIpFromHeaders } from '@/lib/auth/signup-ip-limit'
import { stripAutoHostOrganizationMembership } from '@/lib/organizations/strip-auto-host-membership'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { onlyDigits } from '@/lib/utils/strings'

export async function registerCustomerFromOsLinkAction (formData: FormData) {
  const orgSlug = String(formData.get('orgSlug') || '').trim().toLowerCase()
  const refOs = String(formData.get('refOs') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const passwordConfirm = String(formData.get('passwordConfirm') || '')
  const fullName = String(formData.get('fullName') || '').trim()
  const document = onlyDigits(String(formData.get('document') || '')).slice(0, 14)

  if (!orgSlug || !refOs || !email || password.length < 8 || !fullName) {
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=dados_invalidos`)
  }
  if (password !== passwordConfirm) {
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=senhas_nao_conferem`)
  }
  if (document.length !== 11 && document.length !== 14) {
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=documento_invalido`)
  }

  let svc
  try {
    svc = createSupabaseServiceClient()
  } catch {
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=config`)
  }

  const { data: orderRow, error: orderErr } = await svc
    .from('service_orders')
    .select('id, organization_id')
    .eq('share_token', refOs)
    .maybeSingle()

  if (orderErr || !orderRow?.organization_id) {
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=os_invalida`)
  }

  const { data: orgRow } = await svc
    .from('organizations')
    .select('slug')
    .eq('id', orderRow.organization_id)
    .maybeSingle()

  if (String(orgRow?.slug || '').toLowerCase() !== orgSlug) {
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=os_invalida`)
  }

  const organizationId = String(orderRow.organization_id)
  const headerList = await headers()
  const signupAllowed = await consumeSignupIp(svc, signupIpFromHeaders(headerList))
  if (!signupAllowed) {
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=limite_ip`)
  }

  const { data: createdUser, error: authErr } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (authErr || !createdUser.user) {
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=email_em_uso`)
  }

  const userId = createdUser.user.id

  await svc
    .from('users')
    .update({
      email,
      role: 'user',
      full_name: fullName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  const { error: memberErr } = await svc.from('organization_members').upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      role_in_org: 'user',
    },
    { onConflict: 'organization_id,user_id' },
  )

  if (memberErr) {
    await svc.auth.admin.deleteUser(userId)
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=cadastro_falhou`)
  }

  const stripErr = await stripAutoHostOrganizationMembership(svc, userId)
  if (stripErr) {
    await svc.auth.admin.deleteUser(userId)
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=cadastro_falhou`)
  }

  const { error: portalErr } = await svc.from('user_portal_context').upsert({
    user_id: userId,
    active_organization_id: organizationId,
  })

  if (portalErr) {
    await svc.auth.admin.deleteUser(userId)
    redirect(`/cadastro-cliente?org=${encodeURIComponent(orgSlug)}&ref_os=${encodeURIComponent(refOs)}&error=cadastro_falhou`)
  }

  const cpf = document.length === 11 ? document : null
  const cnpj = document.length === 14 ? document : null

  const docFilter = cpf ? `cpf.eq.${cpf}` : `cnpj.eq.${cnpj}`
  const { data: customerMatch } = await svc
    .from('customers')
    .select('id, auth_user_id')
    .eq('organization_id', organizationId)
    .or(docFilter)
    .maybeSingle()

  const currentAuth = customerMatch?.auth_user_id ? String(customerMatch.auth_user_id) : ''
  if (customerMatch?.id && !currentAuth) {
    await svc
      .from('customers')
      .update({ auth_user_id: userId })
      .eq('id', customerMatch.id)
      .is('auth_user_id', null)
  }

  redirect(`/portal/login?cadastro=cliente&redirectTo=${encodeURIComponent('/portal/complete-profile')}`)
}
