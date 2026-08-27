import { onlyDigits } from '@/lib/utils/strings'

/** Tamanho usual da IE (só dígitos). UFs com mais de um tamanho ficam de fora. */
const IE_DIGIT_LENGTH: Record<string, number> = {
  AC: 13,
  AL: 9,
  AM: 9,
  AP: 9,
  CE: 9,
  DF: 13,
  ES: 9,
  GO: 9,
  MA: 9,
  MG: 13,
  MS: 9,
  MT: 11,
  PA: 9,
  PB: 9,
  PI: 9,
  PR: 10,
  RJ: 8,
  RN: 9,
  RR: 9,
  RS: 10,
  SC: 9,
  SE: 9,
  SP: 12,
  TO: 11,
}

export function fiscalIeOrNull (value: unknown, uf?: string | null) {
  const digits = onlyDigits(String(value || ''))
  if (!digits) return null
  const length = IE_DIGIT_LENGTH[String(uf || '').trim().toUpperCase()]
  if (!length || digits.length >= length) return digits
  return digits.padStart(length, '0')
}

export type NfeDestinatarioIe = {
  indicadorIE: 1 | 2 | 9
  inscricaoEstadual?: string
}

export function resolveNfeDestinatarioIe (input: {
  documentDigits: string
  stateRegistration?: string | null
  stateRegistrationExempt?: boolean | null
  destUf?: string | null
}):
  | { ok: true, value: NfeDestinatarioIe }
  | { ok: false, error: 'nfe_customer_ie_required', message: string } {
  const document = onlyDigits(input.documentDigits)
  if (document.length !== 14) {
    return { ok: true, value: { indicadorIE: 9 } }
  }

  if (input.stateRegistrationExempt === true) {
    return { ok: true, value: { indicadorIE: 2 } }
  }

  const ie = fiscalIeOrNull(input.stateRegistration, input.destUf)
  if (!ie) {
    return {
      ok: false,
      error: 'nfe_customer_ie_required',
      message: 'Informe a inscrição estadual do destinatário ou marque como isento.',
    }
  }

  return { ok: true, value: { indicadorIE: 1, inscricaoEstadual: ie } }
}
