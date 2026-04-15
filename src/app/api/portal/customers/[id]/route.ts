import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { parseOptionalUuid } from '@/lib/utils/optional-uuid'

const CUSTOMER_FIELDS =
  'id, cpf, cnpj, is_company, full_name, company_name, trade_name, email, phone, mobile_phone, contact_phone, contact_notes, address_full, zip_code, state, city, neighborhood, street, street_number, street_complement, birth_date, referral_source, referral_source_other'

export async function GET (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id: rawId } = await params
  const id = parseOptionalUuid(rawId)
  if (!id) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 })
  }

  const { data: row, error } = await auth.supabase
    .from('customers')
    .select(CUSTOMER_FIELDS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
  }

  if (!row?.id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, customer: row })
}
