import type { SupabaseClient } from '@supabase/supabase-js'
import { runWhatsappAiReply } from '@/lib/whatsapp/whatsapp-ai-orchestrator'
import { sendWhatsAppTextMessage } from '@/lib/whatsapp/whatsapp-cloud-client'
import { isGlobalAutomationEnabled, type WhatsappHubMetadata } from '@/lib/whatsapp/whatsapp-hub-config'

function normalizeWaFrom (raw: string): string {
  const d = String(raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.length >= 10 && d.length <= 13) return d.startsWith('55') ? `+${d}` : `+55${d}`
  return `+${d}`
}

function parseInboundMessages (payload: unknown): Array<{
  phoneNumberId: string
  from: string
  messageId: string
  text: string
}> {
  const out: Array<{ phoneNumberId: string; from: string; messageId: string; text: string }> = []
  const p = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string }
          messages?: Array<{
            from?: string
            id?: string
            type?: string
            text?: { body?: string }
          }>
        }
      }>
    }>
  }
  const entries = p?.entry || []
  for (const ent of entries) {
    for (const ch of ent.changes || []) {
      const phoneNumberId = String(ch.value?.metadata?.phone_number_id || '').trim()
      const messages = ch.value?.messages || []
      for (const m of messages) {
        if (m.type !== 'text' || !m.text?.body) continue
        const from = String(m.from || '').trim()
        const id = String(m.id || '').trim()
        if (!phoneNumberId || !from || !id) continue
        out.push({
          phoneNumberId,
          from,
          messageId: id,
          text: String(m.text.body).trim(),
        })
      }
    }
  }
  return out
}

async function findWhatsappConnectionByPhoneNumberId (
  supabase: SupabaseClient,
  phoneNumberId: string,
): Promise<{ access_token: string; metadata: WhatsappHubMetadata } | null> {
  const { data: rows } = await supabase
    .from('hub_connections')
    .select('access_token, metadata')
    .eq('platform_id', 'whatsapp_business')
  const list = rows || []
  for (const r of list) {
    const meta = (r.metadata as WhatsappHubMetadata) || {}
    if (String(meta.phone_number_id || '') === phoneNumberId && r.access_token) {
      return { access_token: r.access_token as string, metadata: meta }
    }
  }
  return null
}

async function getChatgptForWhatsapp (supabase: SupabaseClient): Promise<{
  apiKey: string
  model: string
} | null> {
  const { data } = await supabase
    .from('hub_connections')
    .select('api_key, metadata')
    .eq('platform_id', 'chatgpt')
    .not('api_key', 'is', null)
    .maybeSingle()
  if (!data?.api_key) return null
  const meta = (data.metadata as { model?: string } | null) || {}
  return { apiKey: data.api_key as string, model: meta.model || 'gpt-5-mini' }
}

async function loadRecentHistory (
  supabase: SupabaseClient,
  conversationId: string,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const { data: msgs } = await supabase
    .from('whatsapp_messages')
    .select('direction, body')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(24)
  const rows = msgs || []
  const hist: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const m of rows) {
    const body = String(m.body || '').trim()
    if (!body) continue
    if (m.direction === 'in') hist.push({ role: 'user', content: body })
    else if (m.direction === 'out') hist.push({ role: 'assistant', content: body })
  }
  return hist
}

export async function processWhatsappWebhookPayload (
  supabase: SupabaseClient,
  payload: unknown,
): Promise<void> {
  const items = parseInboundMessages(payload)
  for (const item of items) {
    await processOneInboundMessage(supabase, item)
  }
}

async function processOneInboundMessage (
  supabase: SupabaseClient,
  item: { phoneNumberId: string; from: string; messageId: string; text: string },
): Promise<void> {
  const conn = await findWhatsappConnectionByPhoneNumberId(supabase, item.phoneNumberId)
  if (!conn) {
    console.warn('[whatsapp] no hub connection for phone_number_id', item.phoneNumberId)
    return
  }

  const { data: existingInbound } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('wa_message_id', item.messageId)
    .maybeSingle()
  if (existingInbound) return

  const waFrom = normalizeWaFrom(item.from)
  if (!waFrom) return

  const globalAuto = isGlobalAutomationEnabled(conn.metadata)

  const { data: convRow, error: convErr } = await supabase
    .from('whatsapp_conversations')
    .upsert(
      {
        wa_from: waFrom,
        last_message_at: new Date().toISOString(),
        needs_staff_attention: true,
      },
      { onConflict: 'wa_from' },
    )
    .select('id, automation_override, state, draft_os')
    .single()

  if (convErr || !convRow?.id) {
    console.error('[whatsapp] conversation upsert', convErr)
    return
  }

  const conversationId = convRow.id as string
  const automationOverride = convRow.automation_override as boolean | null

  const lower = item.text.trim().toLowerCase()
  if (lower === 'sair' || lower === 'parar' || lower === 'stop') {
    await supabase
      .from('whatsapp_conversations')
      .update({ automation_override: false })
      .eq('id', conversationId)
    await supabase.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      direction: 'in',
      wa_message_id: item.messageId,
      body: item.text,
      payload: {},
      status: 'pending',
      resolved_by: null,
      needs_human: true,
    })
    await sendWhatsAppTextMessage({
      phoneNumberId: item.phoneNumberId,
      accessToken: conn.access_token,
      toE164Digits: waFrom.replace(/\D/g, ''),
      body:
        'Atendimento automático desativado para este número. Um atendente responderá em breve.',
    })
    return
  }

  const historyBefore = await loadRecentHistory(supabase, conversationId)

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    direction: 'in',
    wa_message_id: item.messageId,
    body: item.text,
    payload: {},
    status: 'pending',
    resolved_by: null,
    needs_human: false,
  })

  const allowAi = globalAuto && automationOverride !== false && (await getChatgptForWhatsapp(supabase)) != null

  if (!allowAi) {
    return
  }

  const gpt = await getChatgptForWhatsapp(supabase)
  if (!gpt) return

  const ai = await runWhatsappAiReply({
    supabase,
    openaiApiKey: gpt.apiKey,
    model: gpt.model,
    userMessage: item.text,
    history: historyBefore,
  })
  if ('error' in ai) {
    console.error('[whatsapp][ai]', ai.error)
    return
  }

  const send = await sendWhatsAppTextMessage({
    phoneNumberId: item.phoneNumberId,
    accessToken: conn.access_token,
    toE164Digits: waFrom.replace(/\D/g, ''),
    body: ai.replyText,
  })
  if (send.ok === false) {
    console.error('[whatsapp][send]', send.error)
    return
  }

  const prevDraft = (convRow.draft_os as Record<string, unknown> | null) || {}
  const nextDraft =
    ai.draftPatch != null
      ? {
          ...prevDraft,
          ...ai.draftPatch,
        }
      : prevDraft

  const nextState = {
    ...((convRow.state as Record<string, unknown>) || {}),
    last_ai_at: new Date().toISOString(),
  }

  await supabase
    .from('whatsapp_conversations')
    .update({
      last_message_at: new Date().toISOString(),
      needs_staff_attention: true,
      draft_os: nextDraft,
      state: nextState,
    })
    .eq('id', conversationId)

  await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    direction: 'out',
    wa_message_id: send.messageId ?? null,
    body: ai.replyText,
    payload: { source: 'ai' },
    status: 'pending',
    resolved_by: 'ai',
    needs_human: true,
  })
}
