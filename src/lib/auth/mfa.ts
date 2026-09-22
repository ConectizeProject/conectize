import type { SupabaseClient } from '@supabase/supabase-js'
import { assertSafePortalPath } from '@/lib/auth/safe-redirect'

export const MFA_SETUP_PROMPT_ROLES = [
	'admin',
	'staff',
	'platform_admin',
] as const

export type MfaSetupPromptRole = (typeof MFA_SETUP_PROMPT_ROLES)[number]

export function isMfaSetupPromptRole (
	role: string | null | undefined,
): role is MfaSetupPromptRole {
	return MFA_SETUP_PROMPT_ROLES.includes(role as MfaSetupPromptRole)
}

export function mfaSetupDismissStorageKey (userId: string) {
	return `conectize:mfa-setup-dismiss:v1:${userId}`
}

export function shouldPromptMfaSetup (
	realRole: string | null | undefined,
	hasVerifiedMfa: boolean,
) {
	return isMfaSetupPromptRole(realRole) && !hasVerifiedMfa
}

/** Sessão AAL1 com fator verificado pendente de desafio. */
export async function userNeedsMfaChallenge (
	supabase: SupabaseClient,
): Promise<boolean> {
	const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
	if (error || !data) return false
	return data.currentLevel === 'aal1' && data.nextLevel === 'aal2'
}

export async function userHasVerifiedTotp (
	supabase: SupabaseClient,
): Promise<boolean> {
	const { data, error } = await supabase.auth.mfa.listFactors()
	if (error || !data) return false
	return (data.totp ?? []).some((factor) => factor.status === 'verified')
}

export function buildMfaVerifyPath (redirectTo?: string | null) {
	const safe = assertSafePortalPath(redirectTo)
	const target =
		safe === '/portal/verify-mfa' || safe.startsWith('/portal/verify-mfa?')
			? '/portal'
			: safe
	return `/portal/verify-mfa?redirectTo=${encodeURIComponent(target)}`
}

export function isPortalSegurancaPath (pathname: string) {
	return (
		pathname === '/portal/seguranca' ||
		pathname.startsWith('/portal/seguranca/')
	)
}

export function isPortalVerifyMfaPath (pathname: string) {
	return (
		pathname === '/portal/verify-mfa' ||
		pathname.startsWith('/portal/verify-mfa/')
	)
}
