import { describe, expect, it, vi } from 'vitest'
import { markEvolutionMessageDeleted } from '@/lib/whatsapp/whatsapp-evolution-message-sync'
import { applyWhatsappMessageDeliveryStatus } from '@/lib/whatsapp/apply-whatsapp-message-delivery-status'

function mockSupabase (handlers: {
	selectWaId?: (id: string) => { id: string, deleted_at?: string | null, direction?: string, payload?: Record<string, unknown> } | null
	updates?: Array<{ id: string, patch: Record<string, unknown> }>
}) {
	const updates = handlers.updates ?? []
	return {
		from (table: string) {
			expect(table).toBe('whatsapp_messages')
			return {
				select () {
					return {
						eq (_col: string, value: string) {
							return {
								maybeSingle: async () => ({
									data: handlers.selectWaId?.(value) ?? null,
									error: null,
								}),
							}
						},
					}
				},
				update (patch: Record<string, unknown>) {
					return {
						eq (_col: string, id: string) {
							updates.push({ id, patch })
							return Promise.resolve({ error: null })
						},
					}
				},
			}
		},
	}
}

describe('markEvolutionMessageDeleted', () => {
	it('só apaga pelo stableWaMessageId (instance:keyId)', async () => {
		const updates: Array<{ id: string, patch: Record<string, unknown> }> = []
		const supabase = mockSupabase({
			selectWaId: (id) =>
				id === 'OrgB:ABC123' ? { id: 'msg-b', deleted_at: null } : null,
			updates,
		})

		const ok = await markEvolutionMessageDeleted({
			supabase: supabase as never,
			message: {
				instance: 'OrgB',
				waMessageId: 'ABC123',
				stableWaMessageId: 'OrgB:ABC123',
				conversationKey: '+5511999999999',
			},
		})

		expect(ok).toBe(true)
		expect(updates).toHaveLength(1)
		expect(updates[0].id).toBe('msg-b')
		expect(updates[0].patch.deleted_at).toEqual(expect.any(String))
	})

	it('não cai no id cru que pode existir em outro tenant', async () => {
		const updates: Array<{ id: string, patch: Record<string, unknown> }> = []
		const supabase = mockSupabase({
			selectWaId: (id) =>
				id === 'ABC123' ? { id: 'msg-other-org', deleted_at: null } : null,
			updates,
		})

		const ok = await markEvolutionMessageDeleted({
			supabase: supabase as never,
			message: {
				instance: 'OrgB',
				waMessageId: 'ABC123',
				stableWaMessageId: 'OrgB:ABC123',
				conversationKey: '+5511999999999',
			},
		})

		expect(ok).toBe(false)
		expect(updates).toHaveLength(0)
	})
})

describe('applyWhatsappMessageDeliveryStatus', () => {
	it('ignora waMessageId cru e exige stable com prefixo', async () => {
		const updates: Array<{ id: string, patch: Record<string, unknown> }> = []
		const supabase = mockSupabase({
			selectWaId: (id) => {
				if (id === 'ABC123') {
					return {
						id: 'msg-other',
						direction: 'out',
						payload: { delivery_status: 'sent' },
					}
				}
				if (id === 'OrgB:ABC123') {
					return {
						id: 'msg-b',
						direction: 'out',
						payload: { delivery_status: 'sent' },
					}
				}
				return null
			},
			updates,
		})

		const ok = await applyWhatsappMessageDeliveryStatus({
			supabase: supabase as never,
			stableWaMessageId: 'OrgB:ABC123',
			waMessageId: 'ABC123',
			deliveryStatus: 'read',
		})

		expect(ok).toBe(true)
		expect(updates).toHaveLength(1)
		expect(updates[0].id).toBe('msg-b')
	})

	it('recusa stable sem prefixo de instância', async () => {
		const selectWaId = vi.fn()
		const supabase = mockSupabase({ selectWaId })
		const ok = await applyWhatsappMessageDeliveryStatus({
			supabase: supabase as never,
			stableWaMessageId: 'ABC123',
			deliveryStatus: 'read',
		})
		expect(ok).toBe(false)
		expect(selectWaId).not.toHaveBeenCalled()
	})
})
