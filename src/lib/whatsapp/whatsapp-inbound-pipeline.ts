import type { SupabaseClient } from '@supabase/supabase-js'
import { runWhatsappAiReply } from '@/lib/whatsapp/whatsapp-ai-orchestrator'
import type { SendTextMessageResult } from '@/lib/whatsapp/whatsapp-cloud-client'
import { normalizeWaConversationKey } from '@/lib/whatsapp/wa-conversation-key'
import { upsertWhatsappConversation } from '@/lib/whatsapp/whatsapp-conversation-upsert'

export {
	normalizeWaFrom,
	normalizeWaConversationKey,
} from '@/lib/whatsapp/wa-conversation-key'

async function getChatgptForWhatsapp(
	supabase: SupabaseClient,
): Promise<{ apiKey: string; model: string } | null> {
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

async function loadRecentHistory(
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
		else if (m.direction === 'out')
			hist.push({ role: 'assistant', content: body })
	}
	return hist
}

/**
 * Núcleo compartilhado: ingressa mensagem inbound, opcional IA e outbound com qualquer canal.
 */
export async function processWhatsappInboundTurn(opts: {
	supabase: SupabaseClient
	organizationId: string
	hubConnectionId?: string | null
	conversationKey: string
	statePatch?: Record<string, unknown>
	inboundWaMessageId: string
	inboundText: string
	automationGloballyEnabled: boolean
	outboundSend: (args: {
		toTarget: string
		body: string
	}) => Promise<SendTextMessageResult>
}): Promise<void> {
	const {
		supabase,
		organizationId,
		hubConnectionId,
		conversationKey,
		statePatch,
		inboundWaMessageId,
		inboundText,
		automationGloballyEnabled,
		outboundSend,
	} = opts

	const { data: existingInbound } = await supabase
		.from('whatsapp_messages')
		.select('id')
		.eq('wa_message_id', inboundWaMessageId)
		.maybeSingle()
	if (existingInbound) return

	const waFrom = normalizeWaConversationKey(conversationKey)
	if (!waFrom) return

	const upserted = await upsertWhatsappConversation(supabase, {
		organizationId,
		hubConnectionId,
		waFrom,
		lastMessageAt: new Date().toISOString(),
		needsStaffAttention: true,
	})

	if (upserted.ok === false || !upserted.id) {
		console.error('[whatsapp] conversation upsert', upserted.ok === false ? upserted.error : null)
		return
	}

	const conversationId = upserted.id

	const { data: convRow, error: convLoadErr } = await supabase
		.from('whatsapp_conversations')
		.select('id, automation_override, state, draft_os')
		.eq('id', conversationId)
		.single()

	if (convLoadErr || !convRow?.id) {
		console.error('[whatsapp] conversation load', convLoadErr)
		return
	}

	if (statePatch && Object.keys(statePatch).length > 0) {
		const prevState = (convRow.state as Record<string, unknown> | null) || {}
		await supabase
			.from('whatsapp_conversations')
			.update({ state: { ...prevState, ...statePatch } })
			.eq('id', conversationId)
	}
	const automationOverride = convRow.automation_override as boolean | null

	const lower = inboundText.trim().toLowerCase()
	if (lower === 'sair' || lower === 'parar' || lower === 'stop') {
		await supabase
			.from('whatsapp_conversations')
			.update({ automation_override: false })
			.eq('id', conversationId)
		await supabase.from('whatsapp_messages').insert({
			conversation_id: conversationId,
			direction: 'in',
			wa_message_id: inboundWaMessageId,
			body: inboundText,
			payload: {},
			status: 'pending',
			resolved_by: null,
			needs_human: true,
		})
		await outboundSend({
			toTarget: waFrom,
			body: 'Atendimento automático desativado para este número. Um atendente responderá em breve.',
		})
		return
	}

	const historyBefore = await loadRecentHistory(supabase, conversationId)

	await supabase.from('whatsapp_messages').insert({
		conversation_id: conversationId,
		direction: 'in',
		wa_message_id: inboundWaMessageId,
		body: inboundText,
		payload: {},
		status: 'pending',
		resolved_by: null,
		needs_human: false,
	})

	const allowAi =
		automationGloballyEnabled &&
		automationOverride !== false &&
		(await getChatgptForWhatsapp(supabase)) != null

	if (!allowAi) {
		return
	}

	const gpt = await getChatgptForWhatsapp(supabase)
	if (!gpt) return

	const { data: orgRow } = await supabase
		.from('organizations')
		.select('name')
		.eq('id', organizationId)
		.maybeSingle()

	const ai = await runWhatsappAiReply({
		supabase,
		openaiApiKey: gpt.apiKey,
		model: gpt.model,
		userMessage: inboundText,
		history: historyBefore,
		organizationName: orgRow?.name ?? null,
	})
	if ('error' in ai) {
		console.error('[whatsapp][ai]', ai.error)
		return
	}

	const send = await outboundSend({
		toTarget: waFrom,
		body: ai.replyText,
	})
	if (send.ok === false) {
		console.error('[whatsapp][send]', send.error)
		return
	}

	const prevDraft = (convRow.draft_os as Record<string, unknown> | null) || {}
	const nextDraft =
		ai.draftPatch != null ? { ...prevDraft, ...ai.draftPatch } : prevDraft

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
		payload: { source: 'ai', delivery_status: 'sent' },
		status: 'pending',
		resolved_by: 'ai',
		needs_human: true,
	})
}
