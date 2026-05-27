import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchEvolutionContacts } from '@/lib/whatsapp/evolution-contacts-client'
import {
	resolveEvolutionApiBaseUrl,
	resolveEvolutionApiKey,
	type WhatsappEvolutionHubMetadata,
} from '@/lib/whatsapp/evolution-hub-config'
import {
	lookupEvolutionContactDisplayName,
	parseEvolutionContactNameMap,
} from '@/lib/whatsapp/parse-evolution-contacts'
import { isGroupWaKey } from '@/lib/whatsapp/wa-conversation-key'

type ConversationRow = {
	id: string
	wa_from: string
	hub_connection_id: string | null
	state: unknown
}

export async function enrichWhatsappConversationsWithContactNames (opts: {
	supabase: SupabaseClient
	conversations: ConversationRow[]
	hubConnections: Array<{
		id: string
		access_token: string | null
		metadata: WhatsappEvolutionHubMetadata
	}>
}): Promise<{ enriched: number; persisted: number }> {
	const hubById = new Map(
		opts.hubConnections.map((h) => [h.id, h]),
	)

	const byHub = new Map<string, ConversationRow[]>()
	for (const conv of opts.conversations) {
		if (!conv.hub_connection_id) continue
		if (!hubById.has(conv.hub_connection_id)) continue
		const st = (conv.state as { display_name?: string } | null) || {}
		if (String(st.display_name || '').trim()) continue
		if (isGroupWaKey(conv.wa_from)) continue

		const list = byHub.get(conv.hub_connection_id) || []
		list.push(conv)
		byHub.set(conv.hub_connection_id, list)
	}

	let enriched = 0
	let persisted = 0

	for (const [hubId, convs] of byHub) {
		const hub = hubById.get(hubId)
		if (!hub) continue

		const instanceName = String(hub.metadata.instance_name || '').trim()
		const apiKey = resolveEvolutionApiKey(hub.access_token)
		const baseUrl = resolveEvolutionApiBaseUrl(hub.metadata)
		if (!instanceName || !apiKey || !baseUrl) continue

		const fetched = await fetchEvolutionContacts({
			baseUrl,
			apiKey,
			instanceName,
		})
		if (fetched.ok === false) continue

		const nameMap = parseEvolutionContactNameMap(fetched.contacts)
		if (nameMap.size === 0) continue

		for (const conv of convs) {
			const name = lookupEvolutionContactDisplayName(nameMap, conv.wa_from)
			if (!name) continue

			const prev = (conv.state as Record<string, unknown> | null) || {}
			conv.state = {
				...prev,
				display_name: name,
				contact_name_enriched_at: new Date().toISOString(),
			}
			enriched += 1

			const { error } = await opts.supabase
				.from('whatsapp_conversations')
				.update({ state: conv.state })
				.eq('id', conv.id)

			if (!error) persisted += 1
		}
	}

	return { enriched, persisted }
}
