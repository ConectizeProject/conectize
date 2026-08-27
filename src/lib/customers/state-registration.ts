import { fiscalIeOrNull } from '@/lib/fiscal/ie'

function isTruthyFlag (value: unknown) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1'
}

export function customerStateRegistrationPatch (input: {
  isCompany: boolean
  stateRegistration?: unknown
  stateRegistrationExempt?: unknown
  uf?: string | null
}) {
  if (!input.isCompany) {
    return { state_registration: null as string | null, state_registration_exempt: false }
  }

  const exempt = isTruthyFlag(input.stateRegistrationExempt)
  if (exempt) {
    return { state_registration: null as string | null, state_registration_exempt: true }
  }

  return {
    state_registration: fiscalIeOrNull(input.stateRegistration, input.uf),
    state_registration_exempt: false,
  }
}
