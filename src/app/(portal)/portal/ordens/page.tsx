import Link from 'next/link'
import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { OrdensFilterCollapsible } from './OrdensFilterCollapsible'
import { OrdensListClient } from './OrdensListClient'
import { OrdensToastClient } from './OrdensToastClient'
import {
	OPEN_ORDER_STATUSES,
	isOpenOrderStatus,
} from '@/lib/orders/order-status'
import type {
	PortalOrdensCustomerSummary,
	PortalOrdensDeviceModelSummary,
	PortalOrdensListRow,
	PortalServiceOrderListQueryRow,
} from '@/lib/orders/portal-ordens-list-types'
import { mapDeviceModelJoinToSummary } from '@/lib/portal/list-final-orders-with-relations'
import { PORTAL_OPEN_ORDERS_LIST_LIMIT } from '@/lib/portal/ordens-list-limits'
import {
	buildServiceOrdersMacroQOrClause,
	fetchCustomerIdsForOrdensMacroSearch,
} from '@/lib/portal/portal-ordens-macro-search'

function normalizeCpf(value: string) {
	return value.replace(/\D/g, '').trim()
}

function isValidOpenStatus(value: string): value is (typeof OPEN_ORDER_STATUSES)[number] {
	return isOpenOrderStatus(value)
}

function isValidDate(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

type SearchParams = Promise<{
	q?: string
	cpf?: string
	osNumber?: string
	status?: string
	customerId?: string
	customerName?: string
	deviceModelId?: string
	createdFrom?: string
	createdTo?: string
	readyFrom?: string
	readyTo?: string
	noServices?: string
	noCost?: string
	noPayment?: string
	toast?: string
	id?: string
	error?: string
}>

export default async function OrdensPage({
	searchParams,
}: {
	searchParams: SearchParams
}) {
	const {
		q,
		cpf,
		osNumber,
		status,
		customerId,
		customerName,
		deviceModelId,
		createdFrom,
		createdTo,
		readyFrom,
		readyTo,
		noServices,
		noCost,
		noPayment,
	} = await searchParams
	const query = String(q || '').trim()
	const cpfDigits = normalizeCpf(String(cpf || ''))
	const statusValue = String(status || '').trim()
	const osNumberValue = String(osNumber || '').trim()
	const customerIdValue = String(customerId || '').trim()
	const deviceModelIdValue = String(deviceModelId || '').trim()
	const createdFromValue = isValidDate(createdFrom) ? createdFrom! : ''
	const createdToValue = isValidDate(createdTo) ? createdTo! : ''
	const readyFromValue = isValidDate(readyFrom) ? readyFrom! : ''
	const readyToValue = isValidDate(readyTo) ? readyTo! : ''
	const quickNoServices = String(noServices || '').trim() === '1'
	const quickNoCost = String(noCost || '').trim() === '1'
	const quickNoPayment = String(noPayment || '').trim() === '1'

	const { user, role } = await getPortalAuth()
	if (!user) await redirectToPortalLogin()

	const normalizedRole = role === 'customer' ? 'user' : role
	if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

	const supabase = await createSupabaseServerClient()

	let customerIdsFilter: string[] | null = null
	if (customerIdValue) {
		customerIdsFilter = [customerIdValue]
	} else if (customerName && customerName.trim().length >= 2) {
		const escaped = String(customerName).trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
		const { data: custList } = await supabase
			.from('customers')
			.select('id')
			.or(`full_name.ilike.%${escaped}%,company_name.ilike.%${escaped}%,trade_name.ilike.%${escaped}%`)
			.limit(100)
		customerIdsFilter = custList && custList.length > 0 ? custList.map((c: { id: string }) => c.id) : []
	} else if (cpfDigits) {
		const { data: custList } = await supabase
			.from('customers')
			.select('id')
			.or(`cpf.eq.${cpfDigits},cnpj.eq.${cpfDigits}`)
		customerIdsFilter = (custList || []).map((c: { id: string }) => c.id)
		if (customerIdsFilter.length === 0) {
			customerIdsFilter = []
		}
	}

	const needsQuickFilterColumns = quickNoServices || quickNoCost || quickNoPayment
	const baseQuery = supabase
		.from('service_orders')
		.select(
			needsQuickFilterColumns
				? 'id, display_number, status, title, created_at, updated_at, closed_at, estimated_ready_at, share_token, customer_id, device_model_id, services, services_total_cents, services_cost_total_cents, payment_methods'
				: 'id, display_number, status, title, created_at, updated_at, closed_at, estimated_ready_at, share_token, customer_id, device_model_id, services, services_total_cents, services_cost_total_cents'
		)
		.in('status', [...OPEN_ORDER_STATUSES])
		.order('created_at', { ascending: false })
		.limit(PORTAL_OPEN_ORDERS_LIST_LIMIT)

	if (query) {
		const macroCustomerIds =
			query.trim().length >= 2
				? await fetchCustomerIdsForOrdensMacroSearch(supabase, query)
				: []
		const orClause = buildServiceOrdersMacroQOrClause(query, macroCustomerIds)
		if (orClause) {
			baseQuery.or(orClause)
		}
	}

	if (customerIdsFilter !== null) {
		if (customerIdsFilter.length === 0) {
			baseQuery.eq('customer_id', '00000000-0000-0000-0000-000000000000')
		} else {
			baseQuery.in('customer_id', customerIdsFilter)
		}
	}

	if (statusValue && isValidOpenStatus(statusValue)) {
		baseQuery.eq('status', statusValue)
	}

	if (osNumberValue) {
		const displayNum = Number.parseInt(osNumberValue, 10)
		if (!Number.isNaN(displayNum)) {
			baseQuery.eq('display_number', displayNum)
		}
	}

	if (deviceModelIdValue) {
		baseQuery.eq('device_model_id', deviceModelIdValue)
	}

	if (createdFromValue) {
		baseQuery.gte('created_at', `${createdFromValue}T00:00:00.000Z`)
	}
	if (createdToValue) {
		baseQuery.lte('created_at', `${createdToValue}T23:59:59.999Z`)
	}
	if (readyFromValue) {
		baseQuery.gte('estimated_ready_at', `${readyFromValue}T00:00:00.000Z`)
	}
	if (readyToValue) {
		baseQuery.lte('estimated_ready_at', `${readyToValue}T23:59:59.999Z`)
	}

	const { data: rawOrders, error: openOrdersError } = await baseQuery
	if (openOrdersError) {
		console.error('[portal/ordens] open list query failed', {
			message: openOrdersError.message,
			code: openOrdersError.code,
			details: openOrdersError.details,
			hint: openOrdersError.hint,
			q: query,
			osNumber: osNumberValue,
		})
	}

	let ordersList: PortalServiceOrderListQueryRow[] = (rawOrders ?? []) as unknown as PortalServiceOrderListQueryRow[]
	if (needsQuickFilterColumns && ordersList.length > 0) {
		ordersList = ordersList.filter((o) => {
			if (quickNoServices) {
				const svc = o.services
				const hasServices = Array.isArray(svc) && svc.length > 0
				if (hasServices) return false
			}
			if (quickNoCost) {
				const cost = o.services_cost_total_cents
				if (cost != null && Number(cost) > 0) return false
			}
			if (quickNoPayment) {
				const pm = o.payment_methods
				const hasPayment = Array.isArray(pm) && pm.length > 0
				if (hasPayment) return false
			}
			return true
		})
	}
	const customerIds = [...new Set(ordersList.map((o) => o.customer_id).filter(Boolean))]
	const deviceModelIds = [...new Set(ordersList.map((o) => o.device_model_id).filter(Boolean))]

	let customersMap: Record<string, PortalOrdensCustomerSummary> = {}
	let deviceModelsMap: Record<string, PortalOrdensDeviceModelSummary> = {}

	if (customerIds.length > 0) {
		const { data: customers } = await supabase
			.from('customers')
			.select('id, cpf, cnpj, is_company, full_name, company_name, email, mobile_phone')
			.in('id', customerIds)
		customersMap = (customers ?? []).reduce<Record<string, PortalOrdensCustomerSummary>>((acc, c) => {
			acc[c.id] = c as PortalOrdensCustomerSummary
			return acc
		}, {})
	}

	if (deviceModelIds.length > 0) {
		const { data: deviceModelsJoined } = await supabase
			.from('device_models')
			.select('id, model, device_types ( name, device_brands ( name ) )')
			.in('id', deviceModelIds)
		deviceModelsMap = (deviceModelsJoined ?? []).reduce<Record<string, PortalOrdensDeviceModelSummary>>(
			(acc, d) => {
				const s = mapDeviceModelJoinToSummary(d)
				acc[d.id] = s
				return acc
			},
			{},
		)
	}

	const ordersWithRelations: PortalOrdensListRow[] = ordersList.map((o) => ({
		...o,
		customers: o.customer_id ? customersMap[o.customer_id] ?? null : null,
		device_models: o.device_model_id ? deviceModelsMap[o.device_model_id] ?? null : null,
	}))

	const openOrdersByStatus: Record<string, PortalOrdensListRow[]> = {}
	for (const s of OPEN_ORDER_STATUSES) {
		openOrdersByStatus[s] = ordersWithRelations.filter((o) => o.status === s)
	}

	const { data: deviceModelsRaw } = await supabase
		.from('device_models')
		.select('id, model, device_types ( name, device_brands ( name ) )')
		.order('model', { ascending: true })
		.limit(500)

	const deviceModels = (deviceModelsRaw ?? []).map((d) => mapDeviceModelJoinToSummary(d))

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 sm:gap-6">
			<OrdensToastClient />
			<div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					<h1 className="text-xl font-bold sm:text-2xl">Ordens de serviço</h1>
				</div>
				<Button asChild className="w-full shrink-0 sm:w-auto">
					<Link href="/portal/ordens/nova" transitionTypes={['nav-forward']}>Nova ordem</Link>
				</Button>
			</div>

			<div className="shrink-0">
				<OrdensFilterCollapsible
					key={`${query}|${osNumberValue}|${statusValue}|${customerIdValue}|${String(customerName || '').trim()}|${deviceModelIdValue}|${createdFromValue}|${createdToValue}|${readyFromValue}|${readyToValue}|${quickNoServices ? '1' : ''}|${quickNoCost ? '1' : ''}|${quickNoPayment ? '1' : ''}`}
					initialValues={{
						q: query,
						cpf: cpfDigits,
						osNumber: osNumberValue,
						status: statusValue,
						customerName: String(customerName || '').trim(),
						customerId: customerIdValue,
						deviceModelId: deviceModelIdValue,
						createdFrom: createdFromValue,
						createdTo: createdToValue,
						readyFrom: readyFromValue,
						readyTo: readyToValue,
						noServices: quickNoServices ? '1' : '',
						noCost: quickNoCost ? '1' : '',
						noPayment: quickNoPayment ? '1' : '',
					}}
					deviceModels={deviceModels}
				/>
			</div>

			<OrdensListClient
				openOrdersByStatus={openOrdersByStatus}
				filterQ={query}
				filterCpf={cpfDigits}
				filterOsNumber={osNumberValue}
				filterStatus={statusValue}
				filterCustomerId={customerIdValue}
				filterCustomerName={String(customerName || '').trim()}
				filterDeviceModelId={deviceModelIdValue}
				filterCreatedFrom={createdFromValue}
				filterCreatedTo={createdToValue}
				filterReadyFrom={readyFromValue}
				filterReadyTo={readyToValue}
				canDelete={role === 'admin' || role === 'platform_admin'}
			/>
		</div>
	)
}

