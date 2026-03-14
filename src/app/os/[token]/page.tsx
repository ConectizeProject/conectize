import Link from 'next/link'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OrderStatusBadge } from '@/components/orders'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { formatPhoneBr as formatPhoneBrUtil } from '@/lib/utils/format-phone'
import { formatCentsBr } from '@/lib/utils/format-money'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { OsPublicEntryPhotos } from './OsPublicEntryPhotos'
import { ENTRY_CHECK_ITEMS } from '@/lib/orders/entry-check-items'
import { Check, Minus, X } from 'lucide-react'

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

function formatPhoneBr(value: string | null | undefined) {
	return formatPhoneBrUtil(value) ?? '-'
}

function parseServicesForDisplay(raw: unknown): {
	items: Array<{ description: string; quantity: number; valueCents: number }>
	totalCents: number
} {
	const empty = { items: [], totalCents: 0 }
	if (!raw) return empty
	try {
		const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
		const data = parsed as Record<string, unknown>
		let items = Array.isArray(data?.items) ? data.items : Array.isArray(raw) ? raw : []
		items = items.slice(0, 100)
		const result = items.map((item: any) => {
			const kind = item?.kind === 'product' ? 'product' : 'service'
			const description = String(item?.description ?? '').trim().slice(0, 240)
			const quantity =
				kind === 'product'
					? Math.min(9999, Math.max(1, Number(item?.quantity) || 1))
					: 1
			const unitCents = Math.max(0, Number(item?.unitValueCents ?? item?.valueCents ?? 0) || 0)
			const valueCents = unitCents * quantity
			return { description, quantity, valueCents }
		}).filter((s: { description: string; valueCents: number }) => s.description || s.valueCents > 0)
		const totalCents = result.reduce((acc, s) => acc + s.valueCents, 0)
		return { items: result, totalCents }
	} catch {
		return empty
	}
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
	pix_direto: 'PIX',
	pix_maquina: 'PIX',
	credito: 'Cartão de crédito',
	debito: 'Cartão de débito',
	dinheiro: 'Dinheiro',
}

function parseEntryChecks (raw: unknown): { status: string; checks: Record<string, 'ok' | 'fail' | 'na'> } {
	const out = { status: 'operante', checks: {} as Record<string, 'ok' | 'fail' | 'na'> }
	if (!raw || typeof raw !== 'object') return out
	const o = raw as { status?: string; checks?: Record<string, unknown> }
	if (typeof o.status === 'string') out.status = o.status
	if (o.checks && typeof o.checks === 'object') {
		Object.entries(o.checks).forEach(([k, v]) => {
			if (v === true || v === 'ok') out.checks[k] = 'ok'
			else if (v === false || v === 'fail') out.checks[k] = 'fail'
			else if (v === 'na') out.checks[k] = 'na'
		})
	}
	return out
}

const DEVICE_HIDDEN_WORDS = ['apple', 'smartfone', 'smartphone']

function formatDeviceDisplay (raw: string): string {
	if (!raw || raw === '-') return raw
	const parts = raw.trim().split(/\s+/).filter(
		(p) => !DEVICE_HIDDEN_WORDS.includes(p.toLowerCase())
	)
	const result = parts.join(' ').trim()
	return result || '-'
}

function parsePaymentMethodsForDisplay(
	raw: unknown,
	catalog: Array<{ id: string; type: string }> | null
): Array<{ typeLabel: string; installments?: number; valueCents: number | null }> {
	if (!raw) return []
	const list = Array.isArray(raw) ? raw : []
	const byId = new Map((catalog ?? []).map((p) => [p.id, p.type]))
	return list
		.filter((e: any) => e?.payment_method_id)
		.map((e: any) => {
			const type = byId.get(String(e.payment_method_id)) || ''
			const typeLabel = PAYMENT_TYPE_LABELS[type] || type || 'Forma de pagamento'
			return {
				typeLabel,
				installments: e.installments != null ? Number(e.installments) : undefined,
				valueCents: e.value_cents != null ? Math.max(0, Number(e.value_cents) || 0) : null,
			}
		})
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

	const [{ data: order }, { data: company }, { data: paymentMethodsCatalog }] = await Promise.all([
		supabase
			.from('service_orders')
			.select('id, display_number, status, title, imei, is_warranty, estimated_ready_at, customer_description, receiving_notes, assistance_info, services, payment_methods, brand, model, device_model_id, created_at, updated_at, closed_at, device_entry_checks, customers ( cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone, contact_phone, contact_notes, address_full, birth_date ), device_models ( id, model, device_types ( name, device_brands ( name ) ) )')
			.eq('share_token', token)
			.maybeSingle(),
		supabase
			.from('company_settings')
			.select('name, cnpj, address, complement, zip_code, city, state, phone, email, logo_url')
			.eq('id', 1)
			.maybeSingle(),
		supabase
			.from('payment_methods')
			.select('id, type')
			.order('sort_order', { ascending: true }),
	])

	// Dispositivo: vir da relação device_models (mesma query) ou dos campos brand/model
	const orderDeviceModels = order?.device_models ?? null
	const deviceModel = Array.isArray(orderDeviceModels)
		? (orderDeviceModels[0] ?? null)
		: orderDeviceModels

	let entryPhotos: Array<{ id: string; url: string | null; created_at: string }> = []
	if (order?.id) {
		const { data: photoRows } = await supabase
			.from('service_order_entry_photos')
			.select('id, storage_path, created_at')
			.eq('service_order_id', order.id)
			.order('created_at', { ascending: true })
		const expiresIn = 60 * 60
		entryPhotos = await Promise.all(
			(photoRows || []).map(async (row: { id: string; storage_path: string; created_at: string }) => {
				const { data: signed } = await supabase.storage
					.from('order-entry-photos')
					.createSignedUrl(row.storage_path, expiresIn)
				return {
					id: row.id,
					url: signed?.signedUrl ?? null,
					created_at: row.created_at,
				}
			})
		)
	}

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
	const dtRaw = deviceModel?.device_types ?? null
	const dt = Array.isArray(dtRaw) ? dtRaw[0] ?? null : dtRaw
	const brandRaw = dt?.device_brands ?? null
	const brandRow = Array.isArray(brandRaw) ? brandRaw[0] ?? null : brandRaw
	const brandName = (brandRow as { name?: string } | null)?.name ?? ''
	const deviceTypeName = (dt as { name?: string } | null)?.name ?? ''
	const deviceDisplay = formatDeviceDisplay(
		deviceModel
			? `${brandName || ''} ${deviceTypeName || ''} ${String(deviceModel.model ?? '')}`.trim() || '-'
			: (order.brand || order.model)
				? `${String(order.brand || '').trim()} ${String(order.model || '').trim()}`.trim() || '-'
				: '-'
	)
	const customerName = customer?.is_company
		? (customer?.company_name || customer?.full_name || '-')
		: (customer?.full_name || '-')

	const servicesData = parseServicesForDisplay(order.services)
	const servicesItems = servicesData.items
	const paymentMethodsDisplay = parsePaymentMethodsForDisplay(order.payment_methods, paymentMethodsCatalog ?? null)
	const hasServices = servicesItems.length > 0
	const hasAssistanceInfo = Boolean(order.assistance_info?.trim())
	const hasPaymentMethods = paymentMethodsDisplay.length > 0
	const entryChecksData = parseEntryChecks(order.device_entry_checks)
	const notTested = entryChecksData.status !== 'operante'
	const hasEntryChecks =
		notTested ||
		Object.keys(entryChecksData.checks).length > 0
	const hasEntryPhotos = entryPhotos.length > 0

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

								{hasEntryPhotos && (
									<OsPublicEntryPhotos photos={entryPhotos} />
								)}

								{hasEntryChecks && (
									<div className="space-y-3">
										<h3 className="text-sm font-medium">Itens testados no momento da abertura</h3>
										{notTested ? (
											<p className="text-sm text-amber-600 dark:text-amber-400">
												Não foi possível testar o aparelho (estava desligado ou com display apagado/danificado).
											</p>
										) : (
											<>
												{Object.keys(entryChecksData.checks).length === 0 ? (
													<p className="text-sm text-muted-foreground">Nenhum teste registrado.</p>
												) : (
													<ul className="space-y-1.5">
														{ENTRY_CHECK_ITEMS.map((item) => {
															const value = entryChecksData.checks[item.key]
															if (value === undefined) return null
															return (
																<li
																	key={item.key}
																	className="flex items-center justify-between gap-2 text-sm rounded-md border border-border px-3 py-2 bg-muted/20"
																>
																	<span className="text-foreground">{item.label}</span>
																	<span className="shrink-0 flex items-center gap-1">
																		{value === 'ok' && (
																			<>
																				<Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
																				<span className="text-emerald-600 dark:text-emerald-400">OK</span>
																			</>
																		)}
																		{value === 'fail' && (
																			<>
																				<X className="h-4 w-4 text-destructive" aria-hidden />
																				<span className="text-destructive">Não OK</span>
																			</>
																		)}
																		{value === 'na' && (
																			<>
																				<Minus className="h-4 w-4 text-muted-foreground" aria-hidden />
																				<span className="text-muted-foreground">Não se aplica</span>
																			</>
																		)}
																	</span>
																</li>
															)
														})}
													</ul>
												)}
											</>
										)}
									</div>
								)}

								{hasServices && (
									<div>
										<h3 className="text-sm font-medium mb-2">Serviços a serem realizados</h3>
										<ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
											{servicesItems.map((s, i) => (
												<li key={i}>
													{s.description}
													{s.quantity > 1 && ` (${s.quantity}x)`}
													{s.valueCents > 0 && ` — ${formatCentsBr(s.valueCents)}`}
												</li>
											))}
										</ul>
									</div>
								)}

								{hasAssistanceInfo && (
									<div>
										<h3 className="text-sm font-medium mb-1">Informações sobre a assistência</h3>
										<p className="text-sm text-muted-foreground whitespace-pre-wrap">
											{order.assistance_info}
										</p>
									</div>
								)}

								{hasPaymentMethods && (
									<div>
										<h3 className="text-sm font-medium mb-2">Formas de pagamento</h3>
										<ul className="text-sm text-muted-foreground space-y-1">
											{paymentMethodsDisplay.map((pm, i) => (
												<li key={i}>
													{pm.typeLabel}
													{pm.installments != null && pm.installments > 1 && ` (${pm.installments}x)`}
													{pm.valueCents != null && pm.valueCents > 0 && ` — ${formatCentsBr(pm.valueCents)}`}
												</li>
											))}
										</ul>
									</div>
								)}
							</CardContent>
						</Card>

						<Card className="border-primary/30 bg-primary/5">
							<CardContent className="pt-6">
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
									<p className="text-sm text-muted-foreground sm:mb-0">
										Cadastre-se na plataforma para acompanhar o histórico das suas ordens de serviço.
									</p>
									<Button asChild className="shrink-0">
										<Link href="/portal/cadastro">Cadastre-se</Link>
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</main>
			<Footer />
		</div>
	)
}
