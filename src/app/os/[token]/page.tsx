import Link from 'next/link'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OrderStatusBadge } from '@/components/orders'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateTimeBr } from '@/lib/utils/format-date'
import { formatCentsBr } from '@/lib/utils/format-money'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { OsPublicEntryPhotos } from './OsPublicEntryPhotos'
import { OsPublicDeviceChecksSection } from './OsPublicDeviceChecksSection'

export const dynamic = 'force-dynamic'

export const metadata = {
	robots: {
		index: false,
		follow: false,
	},
}

function getCustomerFromOrder(order: { customers?: unknown }) {
	const customer = order?.customers
	if (Array.isArray(customer)) return customer[0] || null
	return customer || null
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
		const result = items.map((item: Record<string, unknown>) => {
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
		.filter((e: Record<string, unknown>) => e?.payment_method_id)
		.map((e: Record<string, unknown>) => {
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
						<CardHeader className="p-5">
							<CardTitle>Link inválido</CardTitle>
							<CardDescription>
								O link da ordem de serviço não é válido. Verifique e tente novamente.
							</CardDescription>
						</CardHeader>
						<CardContent className="p-5 pt-0">
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
						<CardHeader className="p-5">
							<CardTitle>Indisponível</CardTitle>
							<CardDescription>
								Não foi possível carregar a ordem no momento. Tente novamente mais tarde.
							</CardDescription>
						</CardHeader>
						<CardContent className="p-5 pt-0">
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

	const { data: order } = await supabase
		.from('service_orders')
		.select(
			'id, organization_id, display_number, status, title, imei, device_location, is_warranty, estimated_ready_at, customer_description, receiving_notes, warranty_text, services, payment_methods, device_model_id, created_at, updated_at, closed_at, device_entry_checks, device_exit_checks, customers ( cpf, cnpj, is_company, full_name, company_name, trade_name, email, mobile_phone, contact_phone, contact_notes, address_full, birth_date ), device_models ( id, model, device_types ( name, device_brands ( name ) ) ), organizations ( slug, is_host, name, logo_url, phone, email )',
		)
		.eq('share_token', token)
		.maybeSingle()

	const orgRel = order?.organizations
	const orgRow = Array.isArray(orgRel) ? orgRel[0] ?? null : orgRel ?? null
	const isHostOrg = Boolean(orgRow?.is_host)

	const { data: paymentMethodsCatalog } = order?.organization_id
		? await supabase
			.from('payment_methods')
			.select('id, type')
			.eq('organization_id', order.organization_id)
			.order('sort_order', { ascending: true })
		: { data: null as { id: string; type: string }[] | null }

	// Dispositivo: relação device_models (mesma query)
	const orderDeviceModels = order?.device_models ?? null
	const deviceModel = Array.isArray(orderDeviceModels)
		? (orderDeviceModels[0] ?? null)
		: orderDeviceModels

	let entryPhotos: Array<{ id: string; url: string | null; created_at: string }> = []
	let exitPhotos: Array<{ id: string; url: string | null; created_at: string }> = []
	let assistancePhotos: Array<{ id: string; url: string | null; created_at: string }> = []
	if (order?.id) {
		const expiresIn = 60 * 60
		const [entryRowsRes, exitRowsRes, assistanceRowsRes] = await Promise.all([
			supabase
				.from('service_order_entry_photos')
				.select('id, storage_path, created_at')
				.eq('service_order_id', order.id)
				.order('created_at', { ascending: true }),
			supabase
				.from('service_order_exit_photos')
				.select('id, storage_path, created_at')
				.eq('service_order_id', order.id)
				.order('created_at', { ascending: true }),
			supabase
				.from('service_order_assistance_photos')
				.select('id, storage_path, created_at')
				.eq('service_order_id', order.id)
				.order('created_at', { ascending: true }),
		])

		const signRows = async (
			photoRows: Array<{ id: string; storage_path: string; created_at: string }> | null,
			bucket: string,
		) => Promise.all(
			(photoRows || []).map(async (row) => {
				const { data: signed } = await supabase.storage
					.from(bucket)
					.createSignedUrl(row.storage_path, expiresIn)
				return {
					id: row.id,
					url: signed?.signedUrl ?? null,
					created_at: row.created_at,
				}
			}),
		)

		;[entryPhotos, exitPhotos, assistancePhotos] = await Promise.all([
			signRows(entryRowsRes.data, 'order-entry-photos'),
			signRows(exitRowsRes.data, 'order-exit-photos'),
			signRows(assistanceRowsRes.data, 'order-assistance-photos'),
		])
	}

	if (!order) {
		return (
			<div className="min-h-screen flex flex-col">
				<Header />
				<main className="flex-1 flex items-center justify-center p-6">
					<Card className="max-w-md w-full">
						<CardHeader className="p-5">
							<CardTitle>Ordem não encontrada</CardTitle>
							<CardDescription>
								Este link pode ter expirado ou a ordem não existe.
							</CardDescription>
						</CardHeader>
						<CardContent className="p-5 pt-0">
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
			: '-'
	)
	const customerName = customer?.is_company
		? (customer?.company_name || customer?.full_name || '-')
		: (customer?.full_name || '-')

	const servicesData = parseServicesForDisplay(order.services)
	const servicesItems = servicesData.items
	const paymentMethodsDisplay = parsePaymentMethodsForDisplay(order.payment_methods, paymentMethodsCatalog ?? null)
	const hasServices = servicesItems.length > 0
	let assistanceComments: Array<{ content: string; created_at: string; author_display_name: string }> = []
	if (order?.id) {
		const { data: rows } = await supabase
			.from('service_order_assistance_comments')
			.select('content, created_at, author_display_name')
			.eq('service_order_id', order.id)
			.order('created_at', { ascending: true })

		if (Array.isArray(rows)) {
			assistanceComments = rows
		}
	}

	const assistanceInfoTextParts: string[] = []
	if (assistanceComments.length > 0) {
		assistanceInfoTextParts.push(
			...assistanceComments.map((c) => `${formatDateTimeBr(c.created_at)} • ${String(c.author_display_name || '').trim() || '(Sem nome)'}\n${c.content}`),
		)
	}
	const assistanceInfoText = assistanceInfoTextParts.join('\n\n')
	const hasAssistanceInfo = Boolean(assistanceInfoText.trim())
	const hasWarrantyText = Boolean(order.warranty_text?.trim())
	const hasPaymentMethods = paymentMethodsDisplay.length > 0
	const entryChecksData = parseEntryChecks(order.device_entry_checks)
	const exitChecksData = parseEntryChecks(order.device_exit_checks)
	const notTestedEntry = entryChecksData.status !== 'operante'
	const hasEntryChecks =
		notTestedEntry ||
		Object.keys(entryChecksData.checks).length > 0
	const notTestedExit = exitChecksData.status !== 'operante'
	const hasExitChecks =
		notTestedExit ||
		Object.keys(exitChecksData.checks).length > 0
	const hasEntryPhotos = entryPhotos.length > 0
	const hasExitPhotos = exitPhotos.length > 0
	const hasAssistancePhotos = assistancePhotos.length > 0

	const cadastroHref = isHostOrg
		? '/portal/cadastro'
		: `/cadastro-cliente?org=${encodeURIComponent(String(orgRow?.slug || ''))}&ref_os=${encodeURIComponent(token)}`

	const inner = (
			<main className="flex-1">
				<div className={`container max-w-3xl py-8 px-4 pb-20 ${isHostOrg ? 'pt-32' : 'pt-10'}`}>
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
							<CardHeader className="p-5">
								<CardTitle>{order.title}</CardTitle>
								<CardDescription>
									Dispositivo: {deviceDisplay}
									{order.imei ? ` • IMEI/Série: ${order.imei}` : ''}
									{order.device_location?.trim()
										? ` • Localização: ${order.device_location.trim()}`
										: ''}
									{order.is_warranty ? ' • Garantia: Sim' : ''}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4 p-5 pt-0">
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
									<OsPublicDeviceChecksSection
										title="Itens testados no momento da abertura"
										momentShort="abertura"
										parsed={entryChecksData}
									/>
								)}

								{hasExitChecks && (
									<OsPublicDeviceChecksSection
										title="Situação de saída do aparelho"
										momentShort="saída"
										parsed={exitChecksData}
									/>
								)}

								{hasExitPhotos && (
									<OsPublicEntryPhotos
										photos={exitPhotos}
										title="Fotos do aparelho no momento de saída"
									/>
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
											{assistanceInfoText}
										</p>
									</div>
								)}

								{hasAssistancePhotos && (
									<OsPublicEntryPhotos
										photos={assistancePhotos}
										title="Fotos da assistência"
									/>
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

								{hasWarrantyText && (
									<div>
										<h3 className="text-sm font-medium mb-1">Termos de garantia</h3>
										<p className="text-sm text-muted-foreground whitespace-pre-wrap">
											{order.warranty_text}
										</p>
									</div>
								)}
							</CardContent>
						</Card>

						<Card className="border-primary/30 bg-primary/5">
							<CardContent className="p-5">
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
									<p className="text-sm text-muted-foreground sm:mb-0">
										{isHostOrg
											? 'Cadastre-se na plataforma para acompanhar o histórico das suas ordens de serviço.'
											: 'Crie uma conta para acompanhar suas ordens nesta assistência.'}
									</p>
									<Button asChild className="shrink-0">
										<Link href={cadastroHref}>
											{isHostOrg ? 'Cadastre-se' : 'Criar conta'}
										</Link>
									</Button>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</main>
	)

	if (isHostOrg) {
		return (
			<div className="min-h-screen flex flex-col">
				<Header />
				{inner}
				<Footer />
			</div>
		)
	}

	return (
		<div className="min-h-screen flex flex-col bg-muted/20">
			<header className="border-b bg-background py-5 px-4 flex flex-col items-center gap-2">
				{orgRow?.logo_url ? (
					<img
						src={String(orgRow.logo_url)}
						alt={String(orgRow.name || 'Logo')}
						width={220}
						height={40}
						loading="eager"
						decoding="async"
						className="h-10 w-auto max-w-[220px] object-contain"
					/>
				) : null}
				{orgRow?.name ? (
					<span className="text-lg font-semibold text-center">{String(orgRow.name)}</span>
				) : null}
			</header>
			{inner}
		</div>
	)
}
