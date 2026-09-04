import { isAuthNetworkError } from '@/lib/utils/error-messages'

export type PortalAuthUser = {
	id: string
	email: string
}

type AuthClaimsLike = {
	sub?: string
	email?: string
}

/** Extrai usuário de claims JWT já validados localmente (sem rede). */
export function userFromAuthClaims(
	claims: AuthClaimsLike | null | undefined,
): PortalAuthUser | null {
	const sub = claims?.sub
	if (!sub) return null
	return {
		id: sub,
		email: claims?.email ?? '',
	}
}

/** Falha de rede/infra ao falar com Supabase Auth ou PostgREST (não é credencial inválida). */
export function isSupabaseInfraError(error: unknown): boolean {
	return isAuthNetworkError(error)
}
