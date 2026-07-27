import { NextResponse } from 'next/server'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

function normalizeCpf (value: string) {
  return value.replace(/\D/g, '').trim()
}

function getRpcErrorCode (error: { message?: string; details?: string; hint?: string; code?: string } | null | undefined) {
  const message = String(error?.message || '')
  const details = String(error?.details || '')
  const hint = String(error?.hint || '')
  const code = String(error?.code || '')

  const combined = `${code} ${message} ${details} ${hint}`.toLowerCase()

  if (combined.includes('cpf_already_claimed')) return 'cpf_already_claimed'
  if (combined.includes('cpf_mismatch')) return 'cpf_mismatch'
  if (combined.includes('not_authenticated')) return 'not_authenticated'

  if (combined.includes('function') && combined.includes('claim_customer_by_cpf') && combined.includes('does not exist')) {
    return 'rpc_missing'
  }

  if (combined.includes('column') && combined.includes('does not exist')) {
    return 'db_schema_outdated'
  }

  if (combined.includes('duplicate key') && combined.includes('customers_cpf')) {
    return 'cpf_already_claimed'
  }

  if (combined.includes('duplicate key') && combined.includes('users_cpf')) {
    return 'cpf_already_claimed'
  }

  if (combined.includes('organization_required') || combined.includes('organization_id')) {
    return 'organization_required'
  }

  if (combined.includes('permission denied')) {
    return 'permission_denied'
  }

  return 'unknown'
}

export async function POST (request: Request) {
  const body = await request.json().catch(() => null)
  const cpf = normalizeCpf(String(body?.cpf || ''))
  const fullName = String(body?.fullName || '').trim()

  if (!cpf || cpf.length !== 11) {
    return NextResponse.json({ ok: false, error: 'cpf_invalido' }, { status: 400 })
  }


  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }

  const { error } = await supabase.rpc('claim_customer_by_cpf', {
    cpf_input: cpf,
    name_input: fullName || null,
  })

  if (error) {
    const code = getRpcErrorCode(error)
    const payload: {
      ok: false
      error: string
      debug?: { code: string | null; message: string | null; details: string | null; hint: string | null }
    } = { ok: false, error: code }

    if (process.env.NODE_ENV !== 'production') {
      payload.debug = {
        code: error?.code != null ? String(error.code) : null,
        message: error?.message != null ? String(error.message) : null,
        details: error?.details != null ? String(error.details) : null,
        hint: error?.hint != null ? String(error.hint) : null,
      }
    }

    return NextResponse.json(payload, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}


