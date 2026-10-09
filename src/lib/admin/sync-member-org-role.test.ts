import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { syncMemberRoleInOrganization } from '@/lib/admin/sync-member-org-role'

type MemberRow = {
	user_id: string
	organization_id: string
	role_in_org: string
}
type ContextRow = { user_id: string; active_organization_id: string | null }

function createClient(opts: { members: MemberRow[]; contexts?: ContextRow[] }) {
	const members = opts.members.map((row) => ({ ...row }))
	const contexts = (opts.contexts ?? []).map((row) => ({ ...row }))
	const updates: Array<{
		table: string
		payload: Record<string, unknown>
		filters: Record<string, unknown>
	}> = []

	function chain(table: string) {
		const filters: Record<string, unknown> = {}
		const api = {
			select() {
				return api
			},
			eq(column: string, value: unknown) {
				filters[column] = value
				return api
			},
			maybeSingle() {
				if (table === 'organization_members') {
					const match = members.find((row) => {
						if (filters.user_id && row.user_id !== filters.user_id) return false
						if (
							filters.organization_id &&
							row.organization_id !== filters.organization_id
						) {
							return false
						}
						return true
					})
					return Promise.resolve({ data: match ?? null, error: null })
				}
				if (table === 'user_portal_context') {
					const match = contexts.find((row) => row.user_id === filters.user_id)
					return Promise.resolve({ data: match ?? null, error: null })
				}
				return Promise.resolve({ data: null, error: null })
			},
			update(payload: Record<string, unknown>) {
				const apply = () => {
					updates.push({ table, payload, filters: { ...filters } })
					if (table === 'organization_members') {
						for (const row of members) {
							if (filters.user_id && row.user_id !== filters.user_id) continue
							if (
								filters.organization_id &&
								row.organization_id !== filters.organization_id
							) {
								continue
							}
							row.role_in_org = String(payload.role_in_org)
						}
					}
					return { error: null }
				}
				const thenable = {
					eq(column: string, value: unknown) {
						filters[column] = value
						return thenable
					},
					then(
						resolve: (value: { error: null }) => unknown,
						reject?: (reason: unknown) => unknown,
					) {
						return Promise.resolve(apply()).then(resolve, reject)
					},
				}
				return thenable
			},
			upsert(payload: Record<string, unknown>) {
				updates.push({ table, payload, filters: { ...filters } })
				return Promise.resolve({ error: null })
			},
		}
		return api
	}

	return {
		supabase: { from: chain } as unknown as SupabaseClient,
		members,
		updates,
	}
}

describe('syncMemberRoleInOrganization', () => {
	it('atualiza só a membership da organização informada', async () => {
		const { supabase, members, updates } = createClient({
			members: [
				{ user_id: 'user-1', organization_id: 'org-a', role_in_org: 'staff' },
				{ user_id: 'user-1', organization_id: 'org-b', role_in_org: 'admin' },
			],
		})

		const result = await syncMemberRoleInOrganization(supabase, {
			userId: 'user-1',
			organizationId: 'org-a',
			roleInOrg: 'user',
			ensurePortalContext: false,
		})

		expect(result).toEqual({ ok: true })
		expect(members).toEqual([
			{ user_id: 'user-1', organization_id: 'org-a', role_in_org: 'user' },
			{ user_id: 'user-1', organization_id: 'org-b', role_in_org: 'admin' },
		])
		expect(
			updates.some(
				(u) =>
					u.table === 'organization_members' &&
					u.filters.organization_id === 'org-a',
			),
		).toBe(true)
		expect(updates.some((u) => u.filters.organization_id === 'org-b')).toBe(
			false,
		)
	})

	it('não cria membership se o usuário não pertence à org', async () => {
		const { supabase, members, updates } = createClient({
			members: [
				{ user_id: 'user-1', organization_id: 'org-b', role_in_org: 'admin' },
			],
		})

		const result = await syncMemberRoleInOrganization(supabase, {
			userId: 'user-1',
			organizationId: 'org-a',
			roleInOrg: 'user',
			ensurePortalContext: true,
		})

		expect(result).toEqual({ ok: true })
		expect(members[0].role_in_org).toBe('admin')
		expect(updates).toEqual([])
	})
})
