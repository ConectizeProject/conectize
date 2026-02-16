import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidCpf, onlyDigits } from '@/lib/utils/strings'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function POST(request: Request) {
  const supabase = getServiceClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'missing_service_role' }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const cpfDigits = onlyDigits(String(body?.cpf || '')).slice(0, 11)
  const birthDate = String(body?.birthDate || body?.birth_date || '').trim()

  if (!isValidCpf(cpfDigits)) {
    return NextResponse.json({ ok: false, error: 'cpf_invalido' }, { status: 400 })
  }

  if (!birthDate) {
    return NextResponse.json({ ok: false, error: 'nascimento_obrigatorio' }, { status: 400 })
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return NextResponse.json({ ok: false, error: 'nascimento_invalido' }, { status: 400 })
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('cpf', cpfDigits)
    .eq('birth_date', birthDate)
    .maybeSingle()

  if (customerError) {
    console.error('[os-search] customer query error:', customerError)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  if (!customer) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const { data: orders, error: ordersError } = await supabase
    .from('service_orders')
    .select('id, display_number, status, title, created_at, updated_at, estimated_ready_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })

  if (ordersError) {
    console.error('[os-search] service_orders query error:', ordersError)
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, orders: orders || [] })
}
