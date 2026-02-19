import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { formatCpf, formatCnpj } from '@/lib/utils/format-cpf-cnpj'
import { onlyDigits } from '@/lib/utils/strings'

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) {
    return { ok: false as const, status: 401, error: 'not_authenticated' as const }
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  if (role !== 'admin' && role !== 'staff') {
    return { ok: false as const, status: 403, error: 'forbidden' as const }
  }

  return { ok: true as const, supabase }
}

export async function GET(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const prefixRaw = String(
    url.searchParams.get('documentPrefix') ||
    url.searchParams.get('docPrefix') ||
    url.searchParams.get('cpfPrefix') ||
    ''
  )
  const digits = onlyDigits(prefixRaw).slice(0, 14)
  const prefix = digits.slice(0, 5)

  if (prefix.length < 5) {
    return NextResponse.json({ ok: false, error: 'document_prefix_too_short' }, { status: 400 })
  }

  const cpfPrefixMasked = formatCpf(prefix)
  const cnpjPrefixMasked = formatCnpj(prefix)

  const { data: customers, error } = await auth.supabase
    .from('customers')
    .select('id, cpf, cnpj, is_company, full_name, company_name, trade_name, email, phone, mobile_phone, contact_phone, contact_notes, address_full, zip_code, state, city, neighborhood, street, street_number, street_complement, birth_date, referral_source, referral_source_other')
    .or([
      `cpf.like.${prefix}%`,
      cpfPrefixMasked ? `cpf.like.${cpfPrefixMasked}%` : null,
      `cnpj.like.${prefix}%`,
      cnpjPrefixMasked ? `cnpj.like.${cnpjPrefixMasked}%` : null,
    ].filter(Boolean).join(','))
    .order('cpf', { ascending: true, nullsFirst: false })
    .order('cnpj', { ascending: true, nullsFirst: false })
    .limit(10)

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, customers: customers || [] })
}

