import type { SupabaseClient } from '@supabase/supabase-js'

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

export async function getWhatsappHubConnection (
  supabase: SupabaseClient,
): Promise<WhatsappHubConnection> {
  const { data } = await supabase
    .from('hub_connections')
    .select('access_token, metadata')
    .eq('platform_id', PLATFORM)
    .maybeSingle()
  if (!data) return null
  return {
    access_token: data.access_token as string | null,
    metadata: (data.metadata as WhatsappHubMetadata) || {},
  }
}

export function isGlobalAutomationEnabled (meta: WhatsappHubMetadata): boolean {
  return meta.automation_enabled === true
}
