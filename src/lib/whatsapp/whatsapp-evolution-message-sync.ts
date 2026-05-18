import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeWaConversationKey } from '@/lib/whatsapp/wa-conversation-key'
import type { EvolutionMessageDelete, EvolutionMessageUpsert } from '@/lib/whatsapp/parse-evolution-webhook-messages'
import { upsertWhatsappConversation } from '@/lib/whatsapp/whatsapp-conversation-upsert'

export async function recordEvolutionOutboundMirror (opts: {
	supabase: SupabaseClient
	organizationId: string
	hubConnectionId: string
	instanceName: string
	message: EvolutionMessageUpsert
}): Promise<void> {
	const { supabase, organizationId, hubConnectionId, instanceName, message } =
		opts

	const waFrom = normalizeWaConversationKey(message.conversationKey)
	if (!waFrom) return

	const lastAt = message.messageTimestamp ?? new Date().toISOString()

	const upserted = await upsertWhatsappConversation(supabase, {
		organizationId,
		hubConnectionId,
		waFrom,
		lastMessageAt: lastAt,
		needsStaffAttention: false,
		state: {
			evolution_instance: instanceName,
			is_group: message.isGroup,
		},
	})

	if (upserted.ok === false || !upserted.id) {
		console.error('[whatsapp-evolution] outbound mirror conv', upserted)
		return
	}

	const conversationId = upserted.id

	const { data: existing } = await supabase
		.from('whatsapp_messages')
		.select('id, deleted_at')
		.eq('wa_message_id', message.stableWaMessageId)
		.maybeSingle()

	if (existing?.id) {
		if (existing.deleted_at) {
			await supabase
				.from('whatsapp_messages')
				.update({
					deleted_at: null,
					body: message.text,
					payload: { source: 'whatsapp_device', channel: 'evolution' },
				})
				.eq('id', existing.id)
		}
		return
	}

	const { data: legacy } = await supabase
		.from('whatsapp_messages')
		.select('id')
		.eq('conversation_id', conversationId)
		.eq('wa_message_id', message.waMessageId)
		.maybeSingle()

	if (legacy?.id) {
		await supabase
			.from('whatsapp_messages')
			.update({ wa_message_id: message.stableWaMessageId })
			.eq('id', legacy.id)
		return
	}

	await supabase.from('whatsapp_messages').insert({
		conversation_id: conversationId,
		direction: 'out',
		wa_message_id: message.stableWaMessageId,
		body: message.text,
		payload: { source: 'whatsapp_device', channel: 'evolution' },
		status: 'attended',
		resolved_by: 'human',
		needs_human: false,
	})
}

export async function markEvolutionMessageDeleted (opts: {
	supabase: SupabaseClient
	message: EvolutionMessageDelete
}): Promise<boolean> {
	const { supabase, message } = opts
	const now = new Date().toISOString()

	const tryIds = [message.stableWaMessageId, message.waMessageId]

	for (const waMessageId of tryIds) {
		const { data: row } = await supabase
			.from('whatsapp_messages')
			.select('id, deleted_at')
			.eq('wa_message_id', waMessageId)
			.maybeSingle()

		if (!row?.id) continue

		if (row.deleted_at) return true

		await supabase
			.from('whatsapp_messages')
			.update({ deleted_at: now })
			.eq('id', row.id)

		return true
	}

	return false
}
