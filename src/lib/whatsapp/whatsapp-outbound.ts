import type { SupabaseClient } from '@supabase/supabase-js'
import type { SendTextMessageResult } from '@/lib/whatsapp/whatsapp-cloud-client'
import { sendEvolutionTextMessage } from '@/lib/whatsapp/evolution-send-client'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp/whatsapp-cloud-client'
import {
  evolutionHubDisplayLabel,
  listEvolutionHubsForOrganization,
  resolveEvolutionApiBaseUrl,
  resolveEvolutionApiKey,
  type WhatsappEvolutionHubMetadata,
  WHATSAPP_EVOLUTION_PLATFORM_ID,
} from '@/lib/whatsapp/evolution-hub-config'

import type { WhatsappHubMetadata } from '@/lib/whatsapp/whatsapp-hub-config'

export type ResolvedWhatsappOutbound =
  | {
      provider: 'cloud'
      automationMeta: WhatsappHubMetadata
      send: (opts: { toTarget: string; body: string }) => Promise<SendTextMessageResult>
    }
  | {
      provider: 'evolution'
      automationMeta: WhatsappEvolutionHubMetadata & { automation_enabled?: boolean }
      evolutionInstanceName: string
      send: (opts: { toTarget: string; body: string }) => Promise<SendTextMessageResult>
    }

function evolutionOutboundFromHub (
  meta: WhatsappEvolutionHubMetadata,
  accessToken: string | null,
): ResolvedWhatsappOutbound | null {
  const evoInstance = String(meta.instance_name || '').trim()
  const evoKey = resolveEvolutionApiKey(accessToken)
  const evoBase = resolveEvolutionApiBaseUrl(meta)
  if (!evoInstance || !evoKey || !evoBase) return null
  return {
    provider: 'evolution',
    automationMeta: meta,
    evolutionInstanceName: evoInstance,
    send: async ({ toTarget, body }) =>
      sendEvolutionTextMessage({
        baseUrl: evoBase,
        apiKey: evoKey,
        instanceName: evoInstance,
        toTarget,
        body,
      }),
  }
}

/** Envio alinhado à conversa (instância Evolution / Cloud da conexão hub). */
export async function resolveWhatsappOutboundForConversation (
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ResolvedWhatsappOutbound | null> {
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('organization_id, hub_connection_id')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conv?.organization_id) return null

  if (conv.hub_connection_id) {
    const { data: hub } = await supabase
      .from('hub_connections')
      .select('platform_id, access_token, metadata')
      .eq('id', conv.hub_connection_id)
      .maybeSingle()

    if (hub?.platform_id === WHATSAPP_EVOLUTION_PLATFORM_ID) {
      return evolutionOutboundFromHub(
        (hub.metadata as WhatsappEvolutionHubMetadata) || {},
        hub.access_token as string | null,
      )
    }

    if (hub?.platform_id === 'whatsapp_business') {
      const meta = (hub.metadata as WhatsappHubMetadata) || {}
      const phoneNumberId = String(meta.phone_number_id || '').trim()
      const cloudToken = hub.access_token as string | null
      if (!phoneNumberId || !cloudToken?.trim()) return null
      return {
        provider: 'cloud',
        automationMeta: meta,
        send: async ({ toTarget, body }) =>
          sendWhatsAppTextMessage({
            phoneNumberId,
            accessToken: cloudToken,
            toE164Digits: toTarget.replace(/\D/g, ''),
            body,
          }),
      }
    }
  }

  return resolveOrganizationWhatsappOutbound(supabase, String(conv.organization_id))
}

/**
 * Fallback quando a conversa não tem hub_connection_id (legado).
 */
export async function resolveOrganizationWhatsappOutbound (
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ResolvedWhatsappOutbound | null> {
  const evoHubs = await listEvolutionHubsForOrganization(supabase, organizationId)
  const preferred =
    evoHubs.find((h) => h.metadata.preferred_for_messages === true) ?? evoHubs[0]

  const { data: cloudRow } = await supabase
    .from('hub_connections')
    .select('access_token, metadata')
    .eq('organization_id', organizationId)
    .eq('platform_id', 'whatsapp_business')
    .maybeSingle()

  const cloudMeta = (cloudRow?.metadata as WhatsappHubMetadata) || {}
  const phoneNumberId = String(cloudMeta.phone_number_id || '').trim()
  const cloudToken = cloudRow?.access_token as string | null
  const cloudReady = Boolean(phoneNumberId && cloudToken?.trim())

  const evoResolved = preferred
    ? evolutionOutboundFromHub(preferred.metadata, preferred.access_token)
    : null

  if (preferred?.metadata.preferred_for_messages === true && evoResolved) {
    return evoResolved
  }

  if (cloudReady) {
    return {
      provider: 'cloud',
      automationMeta: cloudMeta,
      send: async ({ toTarget, body }) =>
        sendWhatsAppTextMessage({
          phoneNumberId,
          accessToken: cloudToken!,
          toE164Digits: toTarget.replace(/\D/g, ''),
          body,
        }),
    }
  }

  return evoResolved
}

export { evolutionHubDisplayLabel }
