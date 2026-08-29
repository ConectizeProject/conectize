import { MELI_PLATFORM_ID } from '@/lib/integrations/mercado-livre/constants'
import { syncMeliOrderById } from '@/lib/integrations/mercado-livre/order-sync'
import {
	isMeliOrdersTopic,
	parseMeliWebhook,
} from '@/lib/integrations/mercado-livre/webhooks'
import { createSupabaseServiceClient } from '@/lib/supabase/service'

function formatUnknownError(err: unknown): string {
	if (err instanceof Error && err.message) return err.message
	if (typeof err === 'string' && err.trim()) return err
	return 'unknown_error'
}

export async function processMeliWebhook(
	id: string,
): Promise<
	| { ok: true; status: 'processed' }
	| { ok: false; status: 'error'; error_message: string }
> {
	const supabase = createSupabaseServiceClient()

	const { data: row, error: fetchError } = await supabase
		.from('integration_webhooks')
		.select('id, platform_id, payload, retry_count, organization_id')
		.eq('id', id)
		.maybeSingle()

	if (
		fetchError ||
		!row ||
		String((row as { platform_id: string }).platform_id) !== MELI_PLATFORM_ID
	) {
		const msg = fetchError?.message || 'webhook_not_found'
		await supabase
			.from('integration_webhooks')
			.update({
				status: 'error',
				error_message: msg,
				processed_at: new Date().toISOString(),
				retry_count: ((row as { retry_count?: number })?.retry_count ?? 0) + 1,
			})
			.eq('id', id)
		return { ok: false, status: 'error', error_message: msg }
	}

	const payload = (row as { payload: unknown }).payload
	const retryCount = ((row as { retry_count?: number }).retry_count ?? 0) + 1
	const organizationId = String(
		(row as { organization_id?: string | null }).organization_id || '',
	).trim()

	async function markError(message: string) {
		await supabase
			.from('integration_webhooks')
			.update({
				status: 'error',
				error_message: message,
				processed_at: new Date().toISOString(),
				retry_count: retryCount,
			})
			.eq('id', id)
		return {
			ok: false as const,
			status: 'error' as const,
			error_message: message,
		}
	}

	async function markProcessed() {
		await supabase
			.from('integration_webhooks')
			.update({
				status: 'processed',
				processed_at: new Date().toISOString(),
				retry_count: retryCount,
				error_message: null,
			})
			.eq('id', id)
		return { ok: true as const, status: 'processed' as const }
	}

	if (!organizationId) {
		return markError('organization_context_missing')
	}

	const parsed = parseMeliWebhook(payload)
	if (!isMeliOrdersTopic(parsed.topic)) {
		return markProcessed()
	}

	const orderId = parsed.orderId
	if (!orderId) {
		return markError('meli_order_id_missing_in_resource')
	}

	try {
		await syncMeliOrderById({
			supabase,
			organizationId,
			orderId,
		})
		return markProcessed()
	} catch (err) {
		return markError(formatUnknownError(err).slice(0, 500))
	}
}
