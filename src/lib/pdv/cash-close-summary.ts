import type { SupabaseClient } from '@supabase/supabase-js'

export const PAYMENT_METHOD_TYPES = [
	'dinheiro',
	'pix',
	'credito',
	'debito',
	'outro',
] as const

export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
	dinheiro: 'Dinheiro',
	pix: 'PIX',
	credito: 'Crédito',
	debito: 'Débito',
	outro: 'Outro',
}

export type CashCloseSummary = {
	session_id: string
	opening_amount_cents: number
	sangrias_cents: number
	suprimentos_cents: number
	total_change_cents: number
	cash_from_orders_cents: number
	expected_cash_cents: number
	paid_orders_count: number
	by_method: Record<PaymentMethodType, number>
	methods_used: PaymentMethodType[]
}

type AuthCtx = {
	organizationId: string
	supabase: SupabaseClient
}

function emptyByMethod(): Record<PaymentMethodType, number> {
	return { dinheiro: 0, pix: 0, credito: 0, debito: 0, outro: 0 }
}

export async function buildCashCloseSummary(
	auth: AuthCtx,
	session: { id: string; opening_amount_cents?: number | null },
): Promise<
	{ ok: true; summary: CashCloseSummary } | { ok: false; error: 'db_error' }
> {
	const sessionId = session.id
	const opening = Math.max(0, Number(session.opening_amount_cents) || 0)

	const { data: paidOrders, error: ordersError } = await auth.supabase
		.from('sales_orders')
		.select('id, change_cents')
		.eq('organization_id', auth.organizationId)
		.eq('cash_session_id', sessionId)
		.eq('status', 'paid')

	if (ordersError) return { ok: false, error: 'db_error' }

	const orderIds = (paidOrders ?? []).map((row) => String(row.id))
	const byMethod = emptyByMethod()

	if (orderIds.length > 0) {
		const { data: payments, error: paymentsError } = await auth.supabase
			.from('sales_order_payments')
			.select('payment_method_type, amount_cents, status')
			.eq('organization_id', auth.organizationId)
			.in('sales_order_id', orderIds)

		if (paymentsError) return { ok: false, error: 'db_error' }

		for (const row of payments ?? []) {
			if ((row.status ?? 'paid') === 'canceled') continue
			const type = String(
				row.payment_method_type || 'outro',
			) as PaymentMethodType
			const key = PAYMENT_METHOD_TYPES.includes(type) ? type : 'outro'
			byMethod[key] += Math.max(0, Number(row.amount_cents) || 0)
		}
	}

	const totalChange = (paidOrders ?? []).reduce(
		(acc, row) => acc + Math.max(0, Number(row.change_cents) || 0),
		0,
	)

	const { data: movements, error: movementsError } = await auth.supabase
		.from('pos_cash_movements')
		.select('type, amount_cents')
		.eq('organization_id', auth.organizationId)
		.eq('cash_session_id', sessionId)

	if (movementsError) return { ok: false, error: 'db_error' }

	let sangriasCents = 0
	let suprimentosCents = 0
	for (const mov of movements ?? []) {
		const amount = Math.max(0, Number(mov.amount_cents) || 0)
		if (mov.type === 'sangria') sangriasCents += amount
		if (mov.type === 'suprimento') suprimentosCents += amount
	}

	// Dinheiro das vendas = valor da parcela em dinheiro (não o "recebido" do cliente).
	// Troco é só auxiliar na tela do PDV e não sai do caixa — o produto já entrou pelo valor da venda.
	const cashFromOrders = byMethod.dinheiro
	const expectedCashCents =
		opening + cashFromOrders - sangriasCents + suprimentosCents

	const methodsUsed = PAYMENT_METHOD_TYPES.filter((type) => byMethod[type] > 0)

	return {
		ok: true,
		summary: {
			session_id: sessionId,
			opening_amount_cents: opening,
			sangrias_cents: sangriasCents,
			suprimentos_cents: suprimentosCents,
			total_change_cents: totalChange,
			cash_from_orders_cents: cashFromOrders,
			expected_cash_cents: expectedCashCents,
			paid_orders_count: orderIds.length,
			by_method: byMethod,
			methods_used: methodsUsed,
		},
	}
}

export function parseCountedByMethod(
	raw: unknown,
): Partial<Record<PaymentMethodType, number>> {
	if (!raw || typeof raw !== 'object') return {}
	const out: Partial<Record<PaymentMethodType, number>> = {}
	for (const type of PAYMENT_METHOD_TYPES) {
		const value = (raw as Record<string, unknown>)[type]
		if (value == null) continue
		out[type] = Math.max(0, Number(value) || 0)
	}
	return out
}

export function buildClosingNotes(
	summary: CashCloseSummary,
	countedCashCents: number,
	countedByMethod: Partial<Record<PaymentMethodType, number>>,
) {
	const differencesByMethod: Partial<Record<PaymentMethodType, number>> = {}
	for (const type of PAYMENT_METHOD_TYPES) {
		if (countedByMethod[type] == null) continue
		differencesByMethod[type] = countedByMethod[type]! - summary.by_method[type]
	}
	return JSON.stringify({
		closing: {
			system_by_method: summary.by_method,
			counted_by_method: countedByMethod,
			differences_by_method: differencesByMethod,
			counted_cash_cents: countedCashCents,
			expected_cash_cents: summary.expected_cash_cents,
			cash_difference_cents: countedCashCents - summary.expected_cash_cents,
			sangrias_cents: summary.sangrias_cents,
			suprimentos_cents: summary.suprimentos_cents,
			opening_amount_cents: summary.opening_amount_cents,
			paid_orders_count: summary.paid_orders_count,
		},
	})
}
