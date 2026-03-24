import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { formatCpf, formatCnpj } from '@/lib/utils/format-cpf-cnpj'
import { onlyDigits } from '@/lib/utils/strings'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'

export async function GET(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const nameQuery = String(url.searchParams.get('name') || url.searchParams.get('q') || '').trim()
  const prefixRaw = String(
    url.searchParams.get('documentPrefix') ||
    url.searchParams.get('docPrefix') ||
    url.searchParams.get('cpfPrefix') ||
    ''
  )
  const digits = onlyDigits(prefixRaw).slice(0, 14)
  const prefix = digits.slice(0, 5)

  if (nameQuery.length >= 2) {
    const escaped = nameQuery.replace(/%/g, '\\%').replace(/_/g, '\\_')
    const { data: customers, error } = await auth.supabase
      .from('customers')
      .select('id, cpf, cnpj, is_company, full_name, company_name, trade_name, email, phone, mobile_phone, contact_phone, contact_notes, address_full, zip_code, state, city, neighborhood, street, street_number, street_complement, birth_date, referral_source, referral_source_other')
      .or(`full_name.ilike.%${escaped}%,company_name.ilike.%${escaped}%,trade_name.ilike.%${escaped}%`)
      .order('full_name', { ascending: true, nullsFirst: false })
      .order('company_name', { ascending: true, nullsFirst: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, customers: customers || [] })
  }

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

