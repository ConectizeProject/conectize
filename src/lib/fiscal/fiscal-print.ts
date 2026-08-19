import { fiscalIeOrNull } from '@/lib/fiscal/ie'
import { onlyDigits } from '@/lib/utils/strings'

export type FiscalEmitentePrintRow = {
  legal_name?: string | null
  trade_name?: string | null
  cnpj?: string | null
  state_registration?: string | null
  state_registration_exempt?: boolean | null
  street?: string | null
  number?: string | null
  complement?: string | null
  district?: string | null
  zip_code?: string | null
  city?: string | null
  state?: string | null
}

function text (value: unknown) {
  return String(value ?? '').trim()
}

export function formatFiscalCep (value: unknown) {
  const digits = onlyDigits(String(value ?? ''))
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return text(value)
}

export function formatFiscalEmitenteAddress (profile: FiscalEmitentePrintRow | null | undefined) {
  if (!profile) return ''
  const street = [text(profile.street), text(profile.number)].filter(Boolean).join(', ')
  const parts: string[] = []
  if (street) parts.push(street)
  if (text(profile.complement)) parts.push(text(profile.complement))
  if (text(profile.district)) parts.push(text(profile.district))
  const cityState = [text(profile.city), text(profile.state).toUpperCase()].filter(Boolean).join(' - ')
  if (cityState) parts.push(cityState)
  const cep = formatFiscalCep(profile.zip_code)
  if (cep) parts.push(`CEP ${cep}`)
  return parts.join(', ')
}

export function fiscalIePrintLabel (profile: FiscalEmitentePrintRow | null | undefined) {
  if (!profile) return null
  if (profile.state_registration_exempt) return 'ISENTO'
  return fiscalIeOrNull(profile.state_registration, profile.state)
}
