import 'server-only'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { CONECTIZE_HOST_ORGANIZATION_ID } from '@/lib/organizations/constants'
import { stripAutoHostOrganizationMembership } from '@/lib/organizations/strip-auto-host-membership'
import { onlyDigits } from '@/lib/utils/strings'

export type RegisterOrganizationPayload = {
  companyName: string
  cnpj: string
  email: string
  password: string
  passwordConfirm: string
  fullName: string
  logoUrl?: string | null
}

export type RegisterOrganizationErrorCode =
  | 'dados_invalidos'
  | 'config'
  | 'cnpj_em_uso'
  | 'email_em_uso'
  | 'senhas_nao_conferem'
  | 'org_falhou'

export type RegisterOrganizationResult =
  | { ok: true }
  | { ok: false, error: RegisterOrganizationErrorCode }

function slugify (value: string) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return normalized || 'empresa'
}

function normalizePayload (payload: RegisterOrganizationPayload) {
  const companyName = String(payload.companyName || '').trim()
  const cnpj = onlyDigits(String(payload.cnpj || '')).slice(0, 14)
  const email = String(payload.email || '').trim().toLowerCase()
  const password = String(payload.password || '')
  const passwordConfirm = String(payload.passwordConfirm || '')
  const fullName = String(payload.fullName || '').trim()
  const rawLogoUrl = String(payload.logoUrl || '').trim()
  const logoUrl = rawLogoUrl || null

  return {
    companyName,
    cnpj,
    email,
    password,
    passwordConfirm,
    fullName,
    logoUrl,
  }
}

function hasInvalidPayload (payload: ReturnType<typeof normalizePayload>) {
  if (!payload.companyName) return true
  if (!payload.fullName) return true
  if (!payload.email) return true
  if (payload.password.length < 8) return true
  if (!payload.passwordConfirm) return true
  if (payload.cnpj.length !== 14) return true

  if (payload.logoUrl) {
    try {
      const parsed = new URL(payload.logoUrl)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true
    } catch {
      return true
    }
  }

  return false
}

async function uniqueOrganizationSlug (svc: ReturnType<typeof createSupabaseServiceClient>, base: string) {
  let slug = base
  for (let i = 0; i < 12; i++) {
    const { data } = await svc
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!data?.id) return slug

    const randomSuffix = Math.random().toString(36).slice(2, 8)
    slug = `${base}-${randomSuffix}`
  }

  return `${base}-${Date.now()}`
}

export async function registerOrganization (payload: RegisterOrganizationPayload): Promise<RegisterOrganizationResult> {
  const normalized = normalizePayload(payload)

  if (hasInvalidPayload(normalized)) {
    return { ok: false, error: 'dados_invalidos' }
  }
  if (normalized.password !== normalized.passwordConfirm) {
    return { ok: false, error: 'senhas_nao_conferem' }
  }

  let svc
  try {
    svc = createSupabaseServiceClient()
  } catch {
    return { ok: false, error: 'config' }
  }

  const { data: cnpjTaken } = await svc
    .from('organizations')
    .select('id')
    .eq('cnpj', normalized.cnpj)
    .maybeSingle()

  if (cnpjTaken?.id) {
    return { ok: false, error: 'cnpj_em_uso' }
  }

  const { data: createdUser, error: authErr } = await svc.auth.admin.createUser({
    email: normalized.email,
    password: normalized.password,
    email_confirm: true,
    user_metadata: { full_name: normalized.fullName },
  })

  if (authErr || !createdUser.user) {
    return { ok: false, error: 'email_em_uso' }
  }

  const userId = createdUser.user.id

  await svc
    .from('users')
    .update({
      email: normalized.email,
      role: 'admin',
      full_name: normalized.fullName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  const baseSlug = slugify(normalized.companyName)
  const slug = await uniqueOrganizationSlug(svc, baseSlug)

  const { data: orgRow, error: orgErr } = await svc
    .from('organizations')
    .insert({
      slug,
      is_host: false,
      name: normalized.companyName,
      cnpj: normalized.cnpj,
      logo_url: normalized.logoUrl,
    })
    .select('id')
    .single()

  if (orgErr || !orgRow?.id) {
    await svc.auth.admin.deleteUser(userId)
    return { ok: false, error: 'org_falhou' }
  }

  const organizationId = String(orgRow.id)

  const { error: memberErr } = await svc.from('organization_members').insert({
    organization_id: organizationId,
    user_id: userId,
    role_in_org: 'admin',
  })

  if (memberErr) {
    await svc.from('organizations').delete().eq('id', organizationId)
    await svc.auth.admin.deleteUser(userId)
    return { ok: false, error: 'org_falhou' }
  }

  const stripErr = await stripAutoHostOrganizationMembership(svc, userId)
  if (stripErr) {
    await svc.from('organization_members').delete().eq('organization_id', organizationId).eq('user_id', userId)
    await svc.from('organizations').delete().eq('id', organizationId)
    await svc.auth.admin.deleteUser(userId)
    return { ok: false, error: 'org_falhou' }
  }

  const { error: portalErr } = await svc.from('user_portal_context').upsert({
    user_id: userId,
    active_organization_id: organizationId,
  })

  if (portalErr) {
    await svc.from('organization_members').delete().eq('organization_id', organizationId).eq('user_id', userId)
    await svc.from('organizations').delete().eq('id', organizationId)
    await svc.auth.admin.deleteUser(userId)
    return { ok: false, error: 'org_falhou' }
  }

  const { data: templatePayments } = await svc
    .from('payment_methods')
    .select('description, type, fee_percent, credit_installment_fees, sort_order')
    .eq('organization_id', CONECTIZE_HOST_ORGANIZATION_ID)

  if (templatePayments && templatePayments.length > 0) {
    const rows = templatePayments.map((row) => ({
      description: row.description,
      type: row.type,
      fee_percent: row.fee_percent,
      credit_installment_fees: row.credit_installment_fees,
      sort_order: row.sort_order,
      organization_id: organizationId,
      conta_id: null,
    }))

    await svc.from('payment_methods').insert(rows)
  }

  return { ok: true }
}
