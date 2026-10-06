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

export function isMfaStepUpPending (
	currentLevel: string | null | undefined,
	nextLevel: string | null | undefined,
): boolean {
	return currentLevel === 'aal1' && nextLevel === 'aal2'
}

/**
 * Sessão AAL1 com fator verificado pendente de desafio.
 * O access token é validado no Auth server antes de decidir o desafio.
 */
export async function userNeedsMfaChallenge (
	supabase: SupabaseClient,
): Promise<boolean> {
	const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
	const accessToken = sessionData.session?.access_token
	if (sessionError || !accessToken) return false

	const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(
		accessToken,
	)
	if (error || !data) return false
	return isMfaStepUpPending(data.currentLevel, data.nextLevel)
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
