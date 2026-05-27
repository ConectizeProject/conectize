import type { SupabaseClient } from '@supabase/supabase-js'
import type { EvolutionMessageUpsert } from '@/lib/whatsapp/parse-evolution-webhook-messages'
import {
  buildGerarPixCommand,
  canonicalPixAmount,
  formatPixAmountDisplay,
  getWhatsappPixRelayConfig,
  isPixRelayAllowedSender,
  isPixRelayInstance,
  pixRelayReplyTarget,
  waKeyToDigits,
  type WhatsappPixRelayConfig,
} from '@/lib/whatsapp/whatsapp-pix-relay-config'
import { sendEvolutionTextMessage } from '@/lib/whatsapp/evolution-send-client'
import {
  resolveEvolutionApiBaseUrl,
  resolveEvolutionApiKey,
} from '@/lib/whatsapp/evolution-hub-config'
import { isGroupWaKey } from '@/lib/whatsapp/wa-conversation-key'
import type { SendTextMessageResult } from '@/lib/whatsapp/whatsapp-cloud-client'
import { processWhatsappInboundTurn } from '@/lib/whatsapp/whatsapp-inbound-pipeline'
import {
  completePixRelayPending,
  failPixRelayPending,
  fetchOldestPixRelayPending,
  insertPixRelayPending,
} from '@/lib/whatsapp/whatsapp-pix-relay-pending-store'

const PENDING_MAX_AGE_MS = 15 * 60 * 1000

type PixRelayConn = {
  organization_id: string
  id: string
  metadata: { instance_name?: string; automation_enabled?: boolean }
}

type OutboundSend = (args: {
  toTarget: string
  body: string
}) => Promise<SendTextMessageResult>

/** Ex.: `/pix100,50` → `100,50` (sem espaço; vírgula como decimal). */
export function parsePixCommandText (text: string): string | null {
  const trimmed = text.trim()
  const match = trimmed.match(/^\/pix([0-9]+(?:[.,][0-9]{1,2})?)\s*$/i)
  if (!match) return null
  const raw = match[1].trim()
  const n = Number.parseFloat(raw.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return canonicalPixAmount(raw)
}

function isGerarPixOutbound (text: string): boolean {
  return /^\/gerarPix/i.test(text.trim())
}

/**
 * Copia e cola EMV (000201…6304XXXX) exatamente como veio na mensagem (espaços preservados).
 */
export function extractEmvPixKeyFromGroupMessage (text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed || isGerarPixOutbound(trimmed)) return null
  if (/^\/pix\d/i.test(trimmed)) return null
  if (/pagamento\s+pix\s+confirmado/i.test(trimmed)) return null
  if (/pix\s+prime\s+fox/i.test(trimmed) && !trimmed.includes('000201')) return null

  const start = trimmed.indexOf('000201')
  if (start === -1) return null

  const slice = trimmed.slice(start)
  const emv = slice.match(/000201[\s\S]*?6304[0-9A-Fa-f]{4}/)
  if (!emv || emv[0].length < 40) return null
  return emv[0]
}

function buildPixRelayAmountCaption (amountDisplay: string): string {
  return `💰 Valor: R$ ${amountDisplay}\n📋 Chave Copia e cola`
}

async function ingestInboundOnly (opts: {
  supabase: SupabaseClient
  conn: PixRelayConn
  item: EvolutionMessageUpsert
  outboundSend: OutboundSend
}): Promise<void> {
  const instanceName = String(opts.conn.metadata.instance_name || opts.item.instance).trim()
  const statePatch: Record<string, unknown> = { evolution_instance: instanceName }
  if (opts.item.isGroup) statePatch.is_group = true
  if (opts.item.senderDisplayName) statePatch.display_name = opts.item.senderDisplayName

  await processWhatsappInboundTurn({
    supabase: opts.supabase,
    organizationId: opts.conn.organization_id,
    hubConnectionId: opts.conn.id,
    conversationKey: opts.item.conversationKey,
    statePatch,
    inboundWaMessageId: opts.item.stableWaMessageId,
    inboundText: opts.item.text,
    automationGloballyEnabled: false,
    outboundSend: opts.outboundSend,
  })
}


/**
 * Inbound: só números da allowlist.
 * Outbound (fromMe): comando digitado no próprio WhatsApp conectado — qualquer chat 1:1.
 */
function resolvePixCommandRequester (
  item: EvolutionMessageUpsert,
  config: WhatsappPixRelayConfig,
): string | null {
  if (item.isGroup) return null
  if (!parsePixCommandText(item.text)) return null

  if (item.direction === 'in') {
    if (!isPixRelayAllowedSender(item.conversationKey, config.allowedSenderDigits)) {
      return null
    }
    return pixRelayReplyTarget(item.conversationKey, config)
  }

  if (item.direction === 'out') {
    return pixRelayReplyTarget(item.conversationKey, config)
  }

  return null
}

async function handlePixCommand (opts: {
  supabase: SupabaseClient
  conn: PixRelayConn
  item: EvolutionMessageUpsert
  config: WhatsappPixRelayConfig
  outboundSend: OutboundSend
}): Promise<boolean> {
  const amountRaw = parsePixCommandText(opts.item.text)
  if (!amountRaw) return false

  const requester = resolvePixCommandRequester(opts.item, opts.config)
  if (!requester) return false

  const instanceName = String(opts.conn.metadata.instance_name || opts.item.instance).trim()
  const amountDisplay = formatPixAmountDisplay(amountRaw)
  const gerarCommand = buildGerarPixCommand(amountRaw)

  const pending = await insertPixRelayPending(opts.supabase, {
    organization_id: opts.conn.organization_id,
    hub_connection_id: opts.conn.id,
    instance_name: instanceName,
    requester_wa_from: requester,
    amount_display: amountDisplay,
    gerar_command: gerarCommand,
    pix_group_jid: opts.config.pixGroupJid,
  })

  if (!pending.ok) {
    console.error('[whatsapp-pix-relay] insert pending', pending.reason)
    await opts.outboundSend({
      toTarget: requester,
      body: 'Não foi possível iniciar a geração do PIX. Rode a migration 20260521140000 no Supabase (db push).',
    })
    return true
  }

  const sent = await opts.outboundSend({
    toTarget: opts.config.pixGroupJid,
    body: gerarCommand,
  })

  if (sent.ok === false) {
    await failPixRelayPending(opts.supabase, pending.id)
    await opts.outboundSend({
      toTarget: requester,
      body: 'Falha ao enviar o pedido ao grupo gerador de PIX. Verifique a conexão Evolution.',
    })
    return true
  }

  if (opts.item.direction === 'in') {
    void ingestInboundOnly({
      supabase: opts.supabase,
      conn: opts.conn,
      item: opts.item,
      outboundSend: opts.outboundSend,
    })
  }

  console.info('[whatsapp-pix-relay] command', {
    from: waKeyToDigits(requester),
    amount: amountDisplay,
    group: opts.config.pixGroupJid,
  })

  return true
}

async function handlePixGroupResponse (opts: {
  supabase: SupabaseClient
  conn: PixRelayConn
  item: EvolutionMessageUpsert
  config: WhatsappPixRelayConfig
  outboundSend: OutboundSend
}): Promise<boolean> {
  if (opts.item.direction !== 'in') return false
  if (!isGroupWaKey(opts.item.conversationKey)) return false
  if (opts.item.conversationKey !== opts.config.pixGroupJid) return false

  const pixKey = extractEmvPixKeyFromGroupMessage(opts.item.text)
  if (!pixKey) return false

  const instanceName = String(opts.conn.metadata.instance_name || opts.item.instance).trim()
  const pending = await fetchOldestPixRelayPending(opts.supabase, {
    organizationId: opts.conn.organization_id,
    instanceName,
    pixGroupJid: opts.config.pixGroupJid,
    maxAgeMs: PENDING_MAX_AGE_MS,
  })

  if (!pending) return false

  await completePixRelayPending(opts.supabase, pending.id)

  const keySent = await opts.outboundSend({
    toTarget: pending.requester_wa_from,
    body: pixKey,
  })

  if (keySent.ok === false) {
    console.error('[whatsapp-pix-relay] forward key', keySent.error)
    return true
  }

  const captionSent = await opts.outboundSend({
    toTarget: pending.requester_wa_from,
    body: buildPixRelayAmountCaption(pending.amount_display),
  })

  if (captionSent.ok === false) {
    console.error('[whatsapp-pix-relay] forward caption', captionSent.error)
  }

  console.info('[whatsapp-pix-relay] completed', {
    to: waKeyToDigits(pending.requester_wa_from),
    amount: pending.amount_display,
  })

  return true
}

/**
 * Relay /pix autorizado → grupo gerador → devolve chave ao solicitante.
 * Retorna true se o evento foi tratado (não deve rodar automação IA em seguida).
 */
async function tryWhatsappPixRelayCore (opts: {
  supabase: SupabaseClient
  conn: PixRelayConn
  item: EvolutionMessageUpsert
  outboundSend: OutboundSend
}): Promise<boolean> {
  const config = getWhatsappPixRelayConfig()
  if (!config.enabled) return false
  if (!isPixRelayInstance(opts.item.instance, config)) return false

  if (await handlePixCommand({ ...opts, config })) return true
  if (await handlePixGroupResponse({ ...opts, config })) return true

  return false
}

export async function tryWhatsappPixRelayInbound (opts: {
  supabase: SupabaseClient
  conn: PixRelayConn
  item: EvolutionMessageUpsert
  outboundSend: OutboundSend
}): Promise<boolean> {
  if (opts.item.direction !== 'in') return false
  return tryWhatsappPixRelayCore(opts)
}

export async function tryWhatsappPixRelayOutbound (
  supabase: SupabaseClient,
  item: EvolutionMessageUpsert,
  conn: PixRelayConn,
): Promise<boolean> {
  if (item.direction !== 'out') return false

  const meta = conn.metadata
  const baseUrl = resolveEvolutionApiBaseUrl(meta)
  const apiKey = resolveEvolutionApiKey(conn.access_token)
  const instanceName = String(meta.instance_name || '').trim()
  const canSend = !!(apiKey && baseUrl && instanceName)

  const outboundSend = async ({ toTarget, body }: { toTarget: string; body: string }) => {
    if (!canSend) {
      return { ok: false as const, error: 'evolution_send_not_configured' }
    }
    return sendEvolutionTextMessage({
      baseUrl: baseUrl!,
      apiKey: apiKey!,
      instanceName,
      toTarget,
      body,
    })
  }

  return tryWhatsappPixRelayCore({
    supabase,
    conn,
    item,
    outboundSend,
  })
}
