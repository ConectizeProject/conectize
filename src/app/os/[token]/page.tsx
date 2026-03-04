import Link from 'next/link'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OrderStatusBadge } from '@/components/orders'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { formatPhoneBr as formatPhoneBrUtil } from '@/lib/utils/format-phone'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const dynamic = 'force-dynamic'

export const metadata = {
	robots: {
		index: false,
		follow: false,
	},
}

function getCustomerFromOrder(order: any) {
	const customer = order?.customers
	if (Array.isArray(customer)) return customer[0] || null
	return customer || null
}

function getDeviceModelFromOrder(order: any) {
	const dm = order?.device_models
	if (Array.isArray(dm)) return dm[0] || null
	return dm || null
}

function formatPhoneBr(value: string | null | undefined) {
	return formatPhoneBrUtil(value) ?? '-'
}

export default async function OrdemPublicaPage({
	params,
}: {
	params: Promise<{ token: string }>
}) {
	const { token } = await params
	if (!token) {
		return (
			<div className="min-h-screen flex flex-col">
				<Header />
				<main className="flex-1 flex items-center justify-center p-6">
					<Card className="max-w-md w-full">
						<CardHeader>
							<CardTitle>Link inválido</CardTitle>
							<CardDescription>
								O link da ordem de serviço não é válido. Verifique e tente novamente.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild variant="outline">
								<Link href="/">Ir para o início</Link>
							</Button>
						</CardContent>
					</Card>
				</main>
				<Footer />
			</div>
		)
	}

	let supabase
	try {
		supabase = createSupabaseServiceClient()
	} catch {
		return (
			<div className="min-h-screen flex flex-col">
				<Header />
				<main className="flex-1 flex items-center justify-center p-6">
					<Card className="max-w-md w-full">
						<CardHeader>
							<CardTitle>Indisponível</CardTitle>
							<CardDescription>
								Não foi possível carregar a ordem no momento. Tente novamente mais tarde.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild variant="outline">
								<Link href="/">Ir para o início</Link>
							</Button>
						</CardContent>
					</Card>
				</main>
				<Footer />
			</div>
		)
	}

	const [{ data: order }, { data: company }] = await Promise.all([
		supabase
			.from('service_orders')
			.select('id, display_number, status, title, imei, is_warranty, estimated_ready_at, customer_description, receiving_notes, assistance_info, brand, model, created_at, updated_at, closed_at, customers ( cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone, contact_phone, contact_notes, address_full, birth_date ), device_models ( model, device_types ( name, device_brands ( name ) ) )')
			.eq('share_token', token)
			.maybeSingle(),
		supabase
			.from('company_settings')
			.select('name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url')
			.eq('id', 1)
			.maybeSingle(),
	])

	if (!order) {
		return (
			<div className="min-h-screen flex flex-col">
				<Header />
				<main className="flex-1 flex items-center justify-center p-6">
					<Card className="max-w-md w-full">
						<CardHeader>
							<CardTitle>Ordem não encontrada</CardTitle>
							<CardDescription>
								Este link pode ter expirado ou a ordem não existe.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button asChild variant="outline">
								<Link href="/">Ir para o início</Link>
							</Button>
						</CardContent>
					</Card>
				</main>
				<Footer />
			</div>
		)
	}

	const customer = getCustomerFromOrder(order)
	const deviceModel = getDeviceModelFromOrder(order)
	const dt = deviceModel?.device_types || null
	const brandRow = dt?.device_brands || null
	const brandName = brandRow?.name ?? ''
	const deviceTypeName = dt?.name ?? ''
	const deviceDisplay = deviceModel
		? `${brandName || ''} ${deviceTypeName || ''} ${deviceModel.model || ''}`.trim()
		: order.brand || order.model
			? `${order.brand || ''} ${order.model || ''}`.trim()
			: '-'
	const customerName = customer?.is_company
		? (customer?.company_name || customer?.full_name || '-')
		: (customer?.full_name || '-')

	return (
		<div className="min-h-screen flex flex-col">
			<Header />
			<main className="flex-1">
				<div className="container max-w-3xl py-8 px-4 pt-32 pb-20">
					<div className="space-y-6">
						<div>
							<h1 className="text-2xl font-bold">
								Ordem de Serviço #{order.display_number ?? order.id}
							</h1>
							<p className="text-sm text-muted-foreground mt-1">
								{customerName} • {customer?.cnpj ? 'CNPJ' : 'CPF'}{' '}
								{formatCpfCnpj(String(customer?.cnpj || customer?.cpf || ''))}
							</p>
						</div>

						<div className="flex flex-wrap gap-2">
							<OrderStatusBadge status={order.status} />
							<span className="text-sm text-muted-foreground">
								Criada em {formatDateTimeBr(order.created_at)} •{' '}
								{order.closed_at
									? `Finalizada em ${formatDateTimeBr(order.closed_at)}`
									: `Atualizada em ${formatDateTimeBr(order.updated_at)}`}
							</span>
						</div>

						<Card>
							<CardHeader>
								<CardTitle>{order.title}</CardTitle>
								<CardDescription>
									Dispositivo: {deviceDisplay}
									{order.imei ? ` • IMEI/Série: ${order.imei}` : ''}
									{order.is_warranty ? ' • Garantia: Sim' : ''}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{order.estimated_ready_at && (
									<div>
										<span className="text-sm font-medium">Previsão de conclusão: </span>
										<span className="text-sm text-muted-foreground">
											{formatDateTimeBr(order.estimated_ready_at)}
										</span>
									</div>
								)}

								{order.customer_description && (
									<div>
										<h3 className="text-sm font-medium mb-1">Descrição</h3>
										<p className="text-sm text-muted-foreground whitespace-pre-wrap">
											{order.customer_description}
										</p>
									</div>
								)}

								{order.receiving_notes && (
									<div>
										<h3 className="text-sm font-medium mb-1">Observações do recebimento</h3>
										<p className="text-sm text-muted-foreground whitespace-pre-wrap">
											{order.receiving_notes}
										</p>
									</div>
								)}

								{order.assistance_info && (
									<div>
										<h3 className="text-sm font-medium mb-1">Informações sobre a assistência</h3>
										<p className="text-sm text-muted-foreground whitespace-pre-wrap">
											{order.assistance_info}
										</p>
									</div>
								)}
							</CardContent>
						</Card>

						<Card className="border-primary/30 bg-primary/5">
							<CardContent className="pt-6">
								<p className="text-sm text-muted-foreground mb-4">
									Cadastre-se na plataforma para acompanhar o histórico das suas ordens de serviço.
								</p>
								<Button asChild>
									<Link href="/portal/cadastro">Cadastre-se</Link>
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</main>
			<Footer />
		</div>
	)
}
