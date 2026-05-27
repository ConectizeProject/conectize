import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchEvolutionChats } from '@/lib/whatsapp/evolution-chats-client'
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
import { parseEvolutionChatList } from '@/lib/whatsapp/parse-evolution-chats'
import {
	upsertWhatsappConversation,
	whatsappSupportsHubConnectionId,
} from '@/lib/whatsapp/whatsapp-conversation-upsert'

export type SyncEvolutionChatsResult =
	| {
			ok: true
			synced: number
			groups: number
			direct: number
			skipped: number
			legacy_schema?: boolean
	  }
	| {
			ok: false
			error: string
			status?: number
	  }

export async function syncEvolutionChatsForOrganization(opts: {
	supabase: SupabaseClient
	organizationId: string
	hubConnectionId: string
	metadata: WhatsappEvolutionHubMetadata
	accessToken: string | null
	limit?: number
}): Promise<SyncEvolutionChatsResult> {
	const instanceName = String(opts.metadata.instance_name || '').trim()
	const apiKey = resolveEvolutionApiKey(opts.accessToken)
	const baseUrl = resolveEvolutionApiBaseUrl(opts.metadata)
	if (!instanceName || !apiKey || !baseUrl) {
		return { ok: false, error: 'whatsapp_evolution_not_configured' }
	}

	const fetched = await fetchEvolutionChats({
		baseUrl,
		apiKey,
		instanceName,
	})
	if (fetched.ok === false) {
		return { ok: false, error: fetched.error, status: fetched.status }
	}

	let chats = parseEvolutionChatList(fetched.chats)
	const max = Math.min(Math.max(opts.limit ?? 150, 1), 500)
	chats = chats
		.sort((a, b) => {
			const ta = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0
			const tb = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0
			return tb - ta
		})
		.slice(0, max)

	const contactNames = new Map<string, string>()
	const contactsFetched = await fetchEvolutionContacts({
		baseUrl,
		apiKey,
		instanceName,
	})
	if (contactsFetched.ok) {
		for (const [k, v] of parseEvolutionContactNameMap(contactsFetched.contacts)) {
			contactNames.set(k, v)
		}
	} else {
		console.warn(
			'[sync-evolution-chats] findContacts failed',
			contactsFetched.error,
		)
	}

	const supportsHub = await whatsappSupportsHubConnectionId(opts.supabase)

	let synced = 0
	let groups = 0
	let direct = 0
	let skipped = 0
	const now = new Date().toISOString()

	for (const chat of chats) {
		const lastAt = chat.lastMessageAt || now

		let prevState: Record<string, unknown> = {}
		if (supportsHub) {
			const { data: existing } = await opts.supabase
				.from('whatsapp_conversations')
				.select('state')
				.eq('organization_id', opts.organizationId)
				.eq('hub_connection_id', opts.hubConnectionId)
				.eq('wa_from', chat.waKey)
				.maybeSingle()
			prevState = (existing?.state as Record<string, unknown> | null) || {}
		} else {
			const { data: existing } = await opts.supabase
				.from('whatsapp_conversations')
				.select('state')
				.eq('organization_id', opts.organizationId)
				.eq('wa_from', chat.waKey)
				.maybeSingle()
			prevState = (existing?.state as Record<string, unknown> | null) || {}
		}

		const resolvedName =
			chat.displayName ??
			(!chat.isGroup
				? lookupEvolutionContactDisplayName(contactNames, chat.waKey)
				: null) ??
			null

		const state = {
			...prevState,
			display_name: resolvedName ?? prevState.display_name,
			is_group: chat.isGroup,
			evolution_instance: instanceName,
			synced_from_evolution_at: now,
		}

		const upserted = await upsertWhatsappConversation(opts.supabase, {
			organizationId: opts.organizationId,
			hubConnectionId: opts.hubConnectionId,
			waFrom: chat.waKey,
			lastMessageAt: lastAt,
			state,
		})

		if (upserted.ok === false) {
			skipped += 1
			console.error('[sync-evolution-chats] upsert', chat.waKey, upserted.error)
			continue
		}
		synced += 1
		if (chat.isGroup) groups += 1
		else direct += 1
	}

	if (synced === 0 && chats.length > 0 && skipped > 0) {
		return {
			ok: false,
			error: 'db_upsert_failed',
			status: 500,
		}
	}

	return {
		ok: true,
		synced,
		groups,
		direct,
		skipped,
		legacy_schema: !supportsHub,
	}
}
