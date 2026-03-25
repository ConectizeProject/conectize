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
import { OrdemDetalhePageContent } from './OrdemDetalhePageContent'
import {
	getCustomerFromOrder,
	getDeviceModelFromOrder,
} from './order-detail-helpers'

export const dynamic = 'force-dynamic'

type PageProps = {
	params: Promise<{ id: string }>
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
	const { id } = await params
	const { servicesModal } = await searchParams

	const { user, role } = await getPortalAuth()
	if (!user) redirect('/portal/login')

	const normalizedRole = role === 'customer' ? 'user' : role
	if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

	const supabase = await createSupabaseServerClient()
	const [
		{ data: order },
		deviceModels,
		{ data: warrantyTemplates },
	] = await Promise.all([
		supabase
			.from('service_orders')
			.select(
				'id, display_number, status, title, imei, color, is_warranty, estimated_ready_at, passcode_type, passcode_text, passcode_pattern, payment_methods, customer_description, receiving_notes, warranty_template_id, warranty_text, device_model_id, brand, model, services, services_total_cents, services_cost_total_cents, created_at, updated_at, closed_at, share_token, seller_user_id, device_entry_checks, customers ( id, cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone, contact_phone, contact_notes, address_full, birth_date, zip_code, state, city, neighborhood, street, street_number, street_complement, referral_source, referral_source_other ), device_models ( id, model, device_types ( name, device_brands ( name ) ) )',
			)
			.eq('id', id)
			.maybeSingle(),
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
					<CardDescription>Verifique o ID e tente novamente.</CardDescription>
				</CardHeader>
				<CardContent>
					<Button asChild variant="outline">
						<Link href="/portal/ordens">Voltar</Link>
					</Button>
				</CardContent>
			</Card>
		)
	}

	const sellerUserId =
		(order as { seller_user_id?: string | null }).seller_user_id ?? null
	const isAdmin = role === 'admin'

	const [sellerUser, staffAdminUsers, entryPhotoCountRes] = await Promise.all([
		sellerUserId
			? supabase
				.from('users')
				.select('id, full_name, email')
				.eq('id', sellerUserId)
				.maybeSingle()
			: Promise.resolve({ data: null }),
		isAdmin
			? supabase
				.from('users')
				.select('id, full_name, email')
				.in('role', ['admin', 'staff'])
				.order('email')
			: Promise.resolve({ data: [] }),
		supabase
			.from('service_order_entry_photos')
			.select('*', { count: 'exact', head: true })
			.eq('service_order_id', order.id),
	])
	const entryPhotoCount = entryPhotoCountRes?.count ?? 0

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
	const brandName =
		(brandRow?.name as string | undefined) ??
		(order.brand as string | null) ??
		''
	const deviceTypeName = (dt?.name as string | undefined) ?? ''
	const deviceString = deviceModel
		? [
			brandName,
			deviceTypeName,
			(deviceModel as { model?: string })?.model as string | undefined,
		]
			.filter(Boolean)
			.join(' • ') || ''
		: order.brand || order.model
			? [order.brand, order.model].filter(Boolean).join(' • ')
			: ''

	const openServicesModalInitially = String(servicesModal || '').trim() === '1'

	return (
		<OrdemDetalhePageContent
			order={order as Record<string, unknown> & { id: string; display_number?: number | null; status: string; title: string }}
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
			role={role}
			isAdmin={isAdmin}
			openServicesModalInitially={openServicesModalInitially}
		/>
	)
}
