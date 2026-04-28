'use server'

import { redirect } from 'next/navigation'
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

  await svc.from('organization_members').upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      role_in_org: 'user',
    },
    { onConflict: 'organization_id,user_id' },
  )

  await svc.from('user_portal_context').upsert({
    user_id: userId,
    active_organization_id: organizationId,
  })

  const cpf = document.length === 11 ? document : null
  const cnpj = document.length === 14 ? document : null

  const docFilter = cpf ? `cpf.eq.${cpf}` : `cnpj.eq.${cnpj}`
  const { data: customerMatch } = await svc
    .from('customers')
    .select('id')
    .eq('organization_id', organizationId)
    .or(docFilter)
    .maybeSingle()

  if (customerMatch?.id) {
    await svc
      .from('customers')
      .update({ auth_user_id: userId })
      .eq('id', customerMatch.id)
  }

  redirect('/portal/login?cadastro=cliente')
}
