import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

type MethodRow = {
  id: string
  description: string | null
  type: string | null
  fee_percent: number | null
  credit_installment_fees: unknown
  sort_order: number | null
  conta_id: string | null
}

function readMethodRow (row: unknown): MethodRow | null {
  if (!row || typeof row !== 'object') return null
  const record = row as Record<string, unknown>
  if (typeof record.id !== 'string') return null
  return {
    id: record.id,
    description: typeof record.description === 'string' ? record.description : '',
    type: typeof record.type === 'string' ? record.type : 'dinheiro',
    fee_percent: record.fee_percent != null ? Number(record.fee_percent) : 0,
    credit_installment_fees: record.credit_installment_fees,
    sort_order: record.sort_order != null ? Number(record.sort_order) : 0,
    conta_id: typeof record.conta_id === 'string' ? record.conta_id : null,
  }
}

async function loadContaNames (organizationId: string, contaIds: string[]) {
  const names = new Map<string, string>()
  if (contaIds.length === 0) return names

  try {
    const service = createSupabaseServiceClient()
    const { data, error } = await service
      .from('contas')
      .select('id, name')
      .eq('organization_id', organizationId)
      .in('id', contaIds)
      .is('deleted_at', null)

    if (error) {
      console.error('[payment-methods] falha ao ler nomes das contas', error)
      return names
    }

    for (const conta of data ?? []) {
      if (typeof conta.id === 'string' && typeof conta.name === 'string' && conta.name.trim()) {
        names.set(conta.id, conta.name.trim())
      }
    }
  } catch (err) {
    console.error('[payment-methods] falha ao ler nomes das contas', err)
  }

  return names
}

export async function GET() {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('payment_methods')
    .select('id, description, type, fee_percent, credit_installment_fees, sort_order, conta_id')
    .eq('organization_id', auth.organizationId)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  const methods = (data ?? []).map(readMethodRow).filter((row): row is MethodRow => row !== null)
  const contaIds = [...new Set(methods.map((method) => method.conta_id).filter((id): id is string => Boolean(id)))]
  const contaNames = await loadContaNames(auth.organizationId, contaIds)

  return NextResponse.json({
    ok: true,
    paymentMethods: methods.map((method) => ({
      ...method,
      conta_name: method.conta_id ? (contaNames.get(method.conta_id) ?? null) : null,
    })),
  })
}
