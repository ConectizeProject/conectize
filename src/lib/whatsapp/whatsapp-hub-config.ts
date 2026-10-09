import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveHubSecretsReader } from '@/lib/supabase/hub-secrets'

export type WhatsappHubMetadata = {
	phone_number_id?: string
	waba_id?: string
	verify_token?: string
	/** Atendimento automático por IA (respostas + orçamento). */
	automation_enabled?: boolean
}

export type WhatsappHubConnection = {
	access_token: string | null
	metadata: WhatsappHubMetadata
} | null

const PLATFORM = 'whatsapp_business'

export async function getWhatsappHubConnection(
	supabase: SupabaseClient,
	organizationId: string,
): Promise<WhatsappHubConnection> {
	const orgId = String(organizationId || '').trim()
	if (!orgId) return null
	const { data } = await resolveHubSecretsReader(supabase)
		.from('hub_connections')
		.select('access_token, metadata')
		.eq('platform_id', PLATFORM)
		.eq('organization_id', orgId)
		.maybeSingle()
	if (!data) return null
	return {
		access_token: data.access_token as string | null,
		metadata: (data.metadata as WhatsappHubMetadata) || {},
	}
}

export function isGlobalAutomationEnabled(meta: WhatsappHubMetadata): boolean {
	return meta.automation_enabled === true
}
