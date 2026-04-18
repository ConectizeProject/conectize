import { SignupClient } from './SignupClient'

/**
 * Sem getAuthUser no servidor — evita rajadas de fetch ao Supabase quando rede/DNS falha.
 */
export default function PortalSignupPage () {
  return <SignupClient />
}
