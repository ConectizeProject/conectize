import { NextResponse } from 'next/server'
import { onlyDigits } from '@/lib/utils/strings'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { customerStateRegistrationPatch } from '@/lib/customers/state-registration'

function buildAddressFull(addr: {
  zipCode?: string
  state?: string
  city?: string
  neighborhood?: string
  street?: string
  streetNumber?: string
  streetComplement?: string
}) {
  const zip = String(addr.zipCode || '').trim()
  const state = String(addr.state || '').trim()
  const city = String(addr.city || '').trim()
  const neighborhood = String(addr.neighborhood || '').trim()
  const street = String(addr.street || '').trim()
  const number = String(addr.streetNumber || '').trim()
  const complement = String(addr.streetComplement || '').trim()

  const parts: string[] = []
  if (street) {
    parts.push(number ? `${street}, ${number}` : street)
  }
  if (complement) parts.push(complement)
  if (neighborhood) parts.push(neighborhood)
  if (city || state) parts.push([city, state].filter(Boolean).join(' / '))
  if (zip) parts.push(`CEP ${zip}`)
  return parts.join('\n').trim()
}

type DbErrLike = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

function logCustomerDbError (op: 'insert' | 'update' | 'fetch', error: DbErrLike) {
  console.error(`[api/portal/customers] ${op} failed`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  })
}

function customerDbErrorResponse (error: DbErrLike) {
  const code = String(error.code || '').trim()
  const message = String(error.message || '').trim()
  const details = String(error.details || '').trim()
  const hint = String(error.hint || '').trim()

  if (code === '23505') {
    return NextResponse.json(
      {
        ok: false,
        error: 'already_exists',
        code,
        message: message || 'Documento já cadastrado.',
        details: details || undefined,
        hint: hint || undefined,
      },
      { status: 409 },
    )
  }

  if (code === '42501') {
    return NextResponse.json(
      {
        ok: false,
        error: 'rls_forbidden',
        code,
        message: message || 'Sem permissão para gravar este cliente.',
        details: details || undefined,
        hint: hint || undefined,
      },
      { status: 403 },
    )
  }

  if (code === '23502') {
    return NextResponse.json(
      {
        ok: false,
        error: 'missing_required',
        code,
        message: message || 'Campo obrigatório ausente.',
        details: details || undefined,
        hint: hint || undefined,
      },
      { status: 400 },
    )
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'db_error',
      code: code || undefined,
      message: message || 'Erro ao gravar no banco.',
      details: details || undefined,
      hint: hint || undefined,
    },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const isCompany = Boolean(body?.isCompany)
  const documentDigits = onlyDigits(String(body?.document || body?.cpf || body?.cnpj || '')).slice(0, 14)

  const fullName = String(body?.fullName || '').trim()
  const companyName = String(body?.companyName || '').trim()
  const tradeName = String(body?.tradeName || '').trim()

  const email = String(body?.email || '').trim()
  const mobilePhone = String(body?.mobilePhone || body?.phone || '').trim()
  const contactPhone = String(body?.contactPhone || '').trim()
  const contactNotes = String(body?.contactNotes || '').trim()
  const addressFullRaw = String(body?.addressFull || '').trim()
  const zipCode = onlyDigits(String(body?.zipCode || body?.cep || '')).slice(0, 8)
  const state = String(body?.state || body?.uf || '').trim()
  const city = String(body?.city || '').trim()
  const neighborhood = String(body?.neighborhood || '').trim()
  const street = String(body?.street || '').trim()
  const streetNumber = String(body?.streetNumber || body?.number || '').trim()
  const streetComplement = String(body?.streetComplement || body?.complement || '').trim()

  const addressFull = addressFullRaw || buildAddressFull({
    zipCode,
    state,
    city,
    neighborhood,
    street,
    streetNumber,
    streetComplement
  })
  const birthDate = String(body?.birthDate || '').trim()
  const referralSource = String(body?.referralSource || '').trim()
  const referralSourceOther = String(body?.referralSourceOther || '').trim()
  const iePatch = customerStateRegistrationPatch({
    isCompany,
    stateRegistration: body?.stateRegistration,
    stateRegistrationExempt: body?.stateRegistrationExempt,
    uf: state,
  })

  if (isCompany) {
    if (documentDigits.length !== 14) {
      return NextResponse.json({ ok: false, error: 'cnpj_invalido' }, { status: 400 })
    }
    if (!companyName) {
      return NextResponse.json({ ok: false, error: 'company_name_obrigatorio' }, { status: 400 })
    }
  } else {
    if (documentDigits.length !== 11) {
      return NextResponse.json({ ok: false, error: 'cpf_invalido' }, { status: 400 })
    }
    if (!fullName) {
      return NextResponse.json({ ok: false, error: 'full_name_obrigatorio' }, { status: 400 })
    }
  }

  const cpf = isCompany ? null : documentDigits
  const cnpj = isCompany ? documentDigits : null

  const { data: existing } = await auth.supabase
    .from('customers')
    .select('id')
    .eq('organization_id', auth.organizationId)
    .or(isCompany ? `cnpj.eq.${cnpj}` : `cpf.eq.${cpf}`)
    .maybeSingle()

  if (existing?.id) {
    return NextResponse.json(
      { ok: false, error: 'already_exists', existingCustomerId: existing.id },
      { status: 409 }
    )
  }

  // Parse birth_date: deve ser null se vazio ou invÃ¡lido
  let parsedBirthDate: string | null = null
  if (birthDate) {
    const date = new Date(birthDate)
    if (!Number.isNaN(date.getTime())) {
      // Formato ISO para PostgreSQL: YYYY-MM-DD
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      parsedBirthDate = `${year}-${month}-${day}`
    }
  }

  const { data: inserted, error } = await auth.supabase
    .from('customers')
    .insert({
      organization_id: auth.organizationId,
      cpf,
      cnpj,
      is_company: isCompany,
      full_name: fullName || null,
      company_name: companyName || null,
      trade_name: tradeName || null,
      email: email || null,
      phone: mobilePhone || contactPhone || null,
      mobile_phone: mobilePhone || null,
      contact_phone: contactPhone || null,
      contact_notes: contactNotes || null,
      address_full: addressFull || null,
      zip_code: zipCode || null,
      state: state || null,
      city: city || null,
      neighborhood: neighborhood || null,
      street: street || null,
      street_number: streetNumber || null,
      street_complement: streetComplement || null,
      birth_date: parsedBirthDate,
      referral_source: referralSource || null,
      referral_source_other: referralSource === 'outros' ? (referralSourceOther || null) : null,
      state_registration: iePatch.state_registration,
      state_registration_exempt: iePatch.state_registration_exempt,
      auth_user_id: null,
    })
    .select('id')
    .single()

  if (error) {
    logCustomerDbError('insert', error)
    const { data: after } = await auth.supabase
      .from('customers')
      .select('id')
      .eq('organization_id', auth.organizationId)
      .or(isCompany ? `cnpj.eq.${cnpj}` : `cpf.eq.${cpf}`)
      .maybeSingle()

    if (after?.id) {
      return NextResponse.json(
        { ok: false, error: 'already_exists', existingCustomerId: after.id },
        { status: 409 }
      )
    }

    return customerDbErrorResponse(error)
  }

  return NextResponse.json({ ok: true, id: inserted.id, existed: false })
}

export async function PATCH(request: Request) {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const id = String(body?.id || '').trim()
  if (!id) {
    return NextResponse.json({ ok: false, error: 'id_obrigatorio' }, { status: 400 })
  }

  const isCompany = Boolean(body?.isCompany)
  const documentDigits = onlyDigits(String(body?.document || body?.cpf || body?.cnpj || '')).slice(0, 14)

  const { data: existingCustomer, error: existingError } = await auth.supabase
    .from('customers')
    .select('id, cpf, cnpj, is_company')
    .eq('id', id)
    .maybeSingle()

  if (existingError) {
    logCustomerDbError('fetch', existingError)
    return customerDbErrorResponse(existingError)
  }

  if (!existingCustomer?.id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const lockedCpf = String(existingCustomer.cpf || '').trim()
  const lockedCnpj = String(existingCustomer.cnpj || '').trim()

  const lockedDocument = lockedCnpj || lockedCpf
  if (lockedDocument && lockedDocument !== documentDigits) {
    return NextResponse.json({ ok: false, error: 'document_locked' }, { status: 400 })
  }

  const lockedIsCompany = Boolean(existingCustomer.is_company)
  if (lockedIsCompany !== isCompany) {
    return NextResponse.json({ ok: false, error: 'document_locked' }, { status: 400 })
  }

  const fullName = String(body?.fullName || '').trim()
  const companyName = String(body?.companyName || '').trim()
  const tradeName = String(body?.tradeName || '').trim()

  const email = String(body?.email || '').trim()
  const mobilePhone = String(body?.mobilePhone || body?.phone || '').trim()
  const contactPhone = String(body?.contactPhone || '').trim()
  const contactNotes = String(body?.contactNotes || '').trim()

  const addressFullRaw = String(body?.addressFull || '').trim()
  const zipCode = onlyDigits(String(body?.zipCode || body?.cep || '')).slice(0, 8)
  const state = String(body?.state || body?.uf || '').trim()
  const city = String(body?.city || '').trim()
  const neighborhood = String(body?.neighborhood || '').trim()
  const street = String(body?.street || '').trim()
  const streetNumber = String(body?.streetNumber || body?.number || '').trim()
  const streetComplement = String(body?.streetComplement || body?.complement || '').trim()

  const addressFull = addressFullRaw || buildAddressFull({
    zipCode,
    state,
    city,
    neighborhood,
    street,
    streetNumber,
    streetComplement
  })

  const birthDate = String(body?.birthDate || '').trim()
  const referralSource = String(body?.referralSource || '').trim()
  const referralSourceOther = String(body?.referralSourceOther || '').trim()
  const iePatch = customerStateRegistrationPatch({
    isCompany,
    stateRegistration: body?.stateRegistration,
    stateRegistrationExempt: body?.stateRegistrationExempt,
    uf: state,
  })

  if (isCompany) {
    if (documentDigits.length !== 14) {
      return NextResponse.json({ ok: false, error: 'cnpj_invalido' }, { status: 400 })
    }
    if (!companyName) {
      return NextResponse.json({ ok: false, error: 'company_name_obrigatorio' }, { status: 400 })
    }
  } else {
    if (documentDigits.length !== 11) {
      return NextResponse.json({ ok: false, error: 'cpf_invalido' }, { status: 400 })
    }
    if (!fullName) {
      return NextResponse.json({ ok: false, error: 'full_name_obrigatorio' }, { status: 400 })
    }
  }

  const cpf = isCompany ? null : documentDigits
  const cnpj = isCompany ? documentDigits : null

  // Parse birth_date: deve ser null se vazio ou invÃ¡lido
  let parsedBirthDate: string | null = null
  if (birthDate) {
    const date = new Date(birthDate)
    if (!Number.isNaN(date.getTime())) {
      // Formato ISO para PostgreSQL: YYYY-MM-DD
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      parsedBirthDate = `${year}-${month}-${day}`
    }
  }

  const { error } = await auth.supabase
    .from('customers')
    .update({
      cpf,
      cnpj,
      is_company: isCompany,
      full_name: fullName || null,
      company_name: companyName || null,
      trade_name: tradeName || null,
      email: email || null,
      phone: mobilePhone || contactPhone || null,
      mobile_phone: mobilePhone || null,
      contact_phone: contactPhone || null,
      contact_notes: contactNotes || null,
      address_full: addressFull || null,
      zip_code: zipCode || null,
      state: state || null,
      city: city || null,
      neighborhood: neighborhood || null,
      street: street || null,
      street_number: streetNumber || null,
      street_complement: streetComplement || null,
      birth_date: parsedBirthDate,
      referral_source: referralSource || null,
      referral_source_other: referralSource === 'outros' ? (referralSourceOther || null) : null,
      state_registration: iePatch.state_registration,
      state_registration_exempt: iePatch.state_registration_exempt,
    })
    .eq('id', id)

  if (error) {
    logCustomerDbError('update', error)
    return customerDbErrorResponse(error)
  }

  return NextResponse.json({ ok: true, id })
}

