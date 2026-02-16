import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function formatCpfPrefix(digits: string) {
  const d = onlyDigits(digits).slice(0, 11)
  const p1 = d.slice(0, 3)
  const p2 = d.slice(3, 6)
  const p3 = d.slice(6, 9)
  const p4 = d.slice(9, 11)

  const parts = []
  if (p1) parts.push(p1)
  if (p2) parts.push(p2)
  if (p3) parts.push(p3)

  const head = parts.join('.')
  if (!head) return ''
  if (p4) return `${head}-${p4}`
  return head
}

function formatCnpjPrefix(digits: string) {
  const d = onlyDigits(digits).slice(0, 14)
  const p1 = d.slice(0, 2)
  const p2 = d.slice(2, 5)
  const p3 = d.slice(5, 8)
  const p4 = d.slice(8, 12)
  const p5 = d.slice(12, 14)

  const headParts = []
  if (p1) headParts.push(p1)
  if (p2) headParts.push(p2)
  if (p3) headParts.push(p3)
  const head = headParts.join('.')

  if (!head) return ''
  if (p4) {
    if (p5) return `${head}/${p4}-${p5}`
    return `${head}/${p4}`
  }
  return head
}

async function requireStaffOrAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getUser()
  const user = data?.user
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

  const cpfPrefixMasked = formatCpfPrefix(prefix)
  const cnpjPrefixMasked = formatCnpjPrefix(prefix)

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

