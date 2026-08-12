import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { fetchDeviceModelsForSelector } from '@/lib/portal/device-models-server'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { OrdemDetalhePageContent } from './OrdemDetalhePageContent'
import type { ServiceOrderDetail } from './service-order-detail-types'
import {
	getCustomerFromOrder,
	getDeviceModelFromOrder,
} from './order-detail-helpers'
import {
	getOrdemPortalPath,
	parseOrdemRouteParam,
} from '@/lib/orders/ordem-portal-path'

export const dynamic = 'force-dynamic'

const ORDER_SELECT =
	'id, display_number, status, title, imei, color, device_location, is_warranty, estimated_ready_at, passcode_type, passcode_text, passcode_pattern, payment_methods, customer_description, receiving_notes, warranty_template_id, warranty_text, device_model_id, services, services_total_cents, services_cost_total_cents, discount_cents, discount_mode, discount_percent, commission_user_id, commission_kind, commission_fixed_cents, commission_percent, created_at, updated_at, closed_at, share_token, seller_user_id, device_entry_checks, device_exit_checks, customers ( id, cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone, contact_phone, contact_notes, address_full, birth_date, zip_code, state, city, neighborhood, street, street_number, street_complement, referral_source, referral_source_other ), device_models ( id, model, device_types ( name, device_brands ( name ) ) )'

type PageProps = {
	params: Promise<{ numero: string }>
	searchParams: Promise<{
		ok?: string
		error?: string
		servicesModal?: string
	}>
}

export default async function OrdemDetalhePage ({
	params,
	searchParams,
}: PageProps) {
	const { numero } = await params
	const search = await searchParams
	const { servicesModal } = search
	const resolved = parseOrdemRouteParam(numero)

	const { user, role } = await getPortalAuth()
	if (!user) await redirectToPortalLogin()

	const normalizedRole = role === 'customer' ? 'user' : role
	if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

	const isPortalReadOnly = normalizedRole === 'retailer'

	if (!resolved) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Ordem não encontrada</CardTitle>
					<CardDescription>Verifique o número da OS ou o link.</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline">
						<Link href={isPortalReadOnly ? '/portal/minhas-ordens' : '/portal/ordens'}>Voltar</Link>
					</Button>
				</CardContent>
			</Card>
		)
	}

	const supabase = await createSupabaseServerClient()
	const orderRowPromise =
		resolved.kind === 'id'
			? supabase.from('service_orders').select(ORDER_SELECT).eq('id', resolved.value).maybeSingle()
			: supabase.from('service_orders').select(ORDER_SELECT).eq('display_number', resolved.value).maybeSingle()

	const [
		{ data: order },
		deviceModels,
		{ data: warrantyTemplates },
	] = await Promise.all([
		orderRowPromise,
		fetchDeviceModelsForSelector(supabase),
		supabase
			.from('warranty_templates')
			.select('id, name, body, is_active, is_default')
			.order('is_default', { ascending: false })
			.order('sort_order', { ascending: true })
			.order('created_at', { ascending: true }),
	])

	if (!order) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Ordem não encontrada</CardTitle>
					<CardDescription>Verifique o número da OS ou o link.</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline">
						<Link href={isPortalReadOnly ? '/portal/minhas-ordens' : '/portal/ordens'}>Voltar</Link>
					</Button>
				</CardContent>
			</Card>
		)
	}

	const orderForPath = order as { id: string; display_number?: number | null }
	if (resolved.kind === 'id' && orderForPath.display_number != null) {
		const target = getOrdemPortalPath(orderForPath)
		const qs = new URLSearchParams()
		if (search.ok) qs.set('ok', String(search.ok))
		if (search.error) qs.set('error', String(search.error))
		if (search.servicesModal) qs.set('servicesModal', String(search.servicesModal))
		const tail = qs.toString()
		redirect(tail ? `${target}?${tail}` : target)
	}

	const sellerUserId =
		(order as { seller_user_id?: string | null }).seller_user_id ?? null
	const isAdmin = role === 'admin' || role === 'platform_admin'

	const [sellerUser, staffAdminUsers, entryPhotoCountRes, exitPhotoCountRes, assistancePhotoCountRes] = await Promise.all([
		sellerUserId
			? supabase
				.from('users')
				.select('id, full_name, email')
				.eq('id', sellerUserId)
				.maybeSingle()
			: Promise.resolve({ data: null }),
		supabase
			.from('users')
			.select('id, full_name, email')
			.in('role', ['admin', 'staff'])
			.order('email'),
		supabase
			.from('service_order_entry_photos')
			.select('*', { count: 'exact', head: true })
			.eq('service_order_id', order.id),
		supabase
			.from('service_order_exit_photos')
			.select('*', { count: 'exact', head: true })
			.eq('service_order_id', order.id),
		supabase
			.from('service_order_assistance_photos')
			.select('*', { count: 'exact', head: true })
			.eq('service_order_id', order.id),
	])
	const entryPhotoCount = entryPhotoCountRes?.count ?? 0
	const exitPhotoCount = exitPhotoCountRes?.count ?? 0
	const assistancePhotoCount = assistancePhotoCountRes?.count ?? 0

	const seller = sellerUser.data
	const sellerDisplayName = seller
		? String(seller.full_name || '').trim() ||
			String(seller.email || '').trim() ||
			'(Sem nome)'
		: ''
	const sellerOptions = (staffAdminUsers.data ?? []) as Array<{
		id: string
		full_name: string | null
		email: string | null
	}>

	const customer = getCustomerFromOrder(order)
	const deviceModel = getDeviceModelFromOrder(order)
	const dt = (deviceModel as { device_types?: { name?: string; device_brands?: { name?: string } } } | null)?.device_types || null
	const brandRow = dt?.device_brands || null
	const brandName = (brandRow?.name as string | undefined) ?? ''
	const deviceTypeName = (dt?.name as string | undefined) ?? ''
	const deviceString = deviceModel
		? [
			brandName,
			deviceTypeName,
			(deviceModel as { model?: string })?.model as string | undefined,
		]
			.filter(Boolean)
			.join(' • ') || ''
		: ''

	const openServicesModalInitially = String(servicesModal || '').trim() === '1'

	return (
		<OrdemDetalhePageContent
			order={order as ServiceOrderDetail}
			customer={customer as Record<string, unknown> | null}
			deviceModel={deviceModel as Record<string, unknown> | null}
			deviceString={deviceString}
			brandName={brandName}
			deviceTypeName={deviceTypeName}
			deviceModels={deviceModels}
			warrantyTemplates={
				warrantyTemplates as Array<{
					id: string
					name: string
					body: string
					is_active?: boolean
					is_default?: boolean
				}> | null
			}
			sellerUserId={sellerUserId}
			sellerDisplayName={sellerDisplayName}
			sellerOptions={sellerOptions}
			entryPhotoCount={entryPhotoCount}
			exitPhotoCount={exitPhotoCount}
			assistancePhotoCount={assistancePhotoCount}
			role={role}
			isAdmin={isAdmin}
			openServicesModalInitially={openServicesModalInitially}
			readOnly={isPortalReadOnly}
		/>
	)
}
