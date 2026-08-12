import type { SupabaseClient } from '@supabase/supabase-js'
import type { SendTextMessageResult } from '@/lib/whatsapp/whatsapp-cloud-client'
import { sendEvolutionTextMessage } from '@/lib/whatsapp/evolution-send-client'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp/whatsapp-cloud-client'
import {
  evolutionHubDisplayLabel,
  findEvolutionHubByConnectionId,
  findEvolutionHubByInstance,
  listEvolutionHubsForOrganization,
  resolveEvolutionApiBaseUrl,
  resolveEvolutionApiKey,
  type EvolutionHubRow,
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

function hubInstanceName (hub: EvolutionHubRow): string {
  return String(hub.metadata.instance_name || '').trim().toLowerCase()
}

function outboundFromEvolutionHub (hub: EvolutionHubRow): ResolvedWhatsappOutbound | null {
  return evolutionOutboundFromHub(hub.metadata, hub.access_token)
}

/**
 * Instância que recebeu a conversa (webhook/sync) tem prioridade sobre hub_connection_id
 * desatualizado — evita enviar grupo pela instância errada (ex. Conectize fechada).
 */
async function resolveEvolutionOutboundForConversation (
  supabase: SupabaseClient,
  conv: {
    organization_id: string
    hub_connection_id: string | null
    state: unknown
  },
): Promise<ResolvedWhatsappOutbound | null> {
  const state = (conv.state as Record<string, unknown> | null) || {}
  const instanceFromState = String(state.evolution_instance || '').trim()

  let hubFromLink: EvolutionHubRow | null = null
  if (conv.hub_connection_id) {
    hubFromLink = await findEvolutionHubByConnectionId(
      supabase,
      conv.hub_connection_id,
      conv.organization_id,
    )
  }

  if (instanceFromState) {
    const hubFromState = await findEvolutionHubByInstance(supabase, instanceFromState)
    if (
      hubFromState &&
      hubFromState.organization_id === conv.organization_id
    ) {
      const linkName = hubFromLink ? hubInstanceName(hubFromLink) : ''
      const stateName = instanceFromState.toLowerCase()
      if (!hubFromLink || (linkName && linkName !== stateName)) {
        return outboundFromEvolutionHub(hubFromState)
      }
    }
  }

  if (hubFromLink) return outboundFromEvolutionHub(hubFromLink)
  return null
}

/** Envio alinhado à conversa (instância Evolution / Cloud da conexão hub). */
export async function resolveWhatsappOutboundForConversation (
  supabase: SupabaseClient,
  conversationId: string,
): Promise<ResolvedWhatsappOutbound | null> {
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('organization_id, hub_connection_id, state')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conv?.organization_id) return null

  const evoResolved = await resolveEvolutionOutboundForConversation(supabase, {
    organization_id: conv.organization_id,
    hub_connection_id: conv.hub_connection_id,
    state: conv.state,
  })
  if (evoResolved) return evoResolved

  if (conv.hub_connection_id) {
    const { data: hub } = await supabase
      .from('hub_connections')
      .select('platform_id, access_token, metadata')
      .eq('id', conv.hub_connection_id)
      .maybeSingle()

    if (hub?.platform_id === WHATSAPP_EVOLUTION_PLATFORM_ID) {
      return outboundFromEvolutionHub({
        id: conv.hub_connection_id,
        access_token: hub.access_token as string | null,
        metadata: (hub.metadata as WhatsappEvolutionHubMetadata) || {},
        organization_id: conv.organization_id,
      })
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
