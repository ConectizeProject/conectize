'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { History, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EditCustomerDialog, type CustomerHit } from '@/components/customers'
import { CustomerOrderHistoryModal } from '@/components/orders'
import { formatCepBr } from '@/lib/utils/format-cep'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateBr } from '@/lib/utils/format-date'
import { formatPhoneBr } from '@/lib/utils/format-phone'
import { onlyDigits } from '@/lib/utils/strings'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { cn } from '@/lib/utils'

function getCustomerDisplayName(c: {
	is_company?: boolean
	company_name?: string
	full_name?: string
}) {
	if (c.is_company) return String(c.company_name || c.full_name || 'Empresa')
	return String(c.full_name || 'Cliente')
}

function getCustomerDocumentMasked(c: { cpf?: string | null; cnpj?: string | null }) {
	return formatCpfCnpj(onlyDigits(String(c.cnpj || c.cpf || '')).slice(0, 14))
}

function buildAddressColumn(c: OrderCustomer) {
	const hasStructured = Boolean(c.street || c.city || c.zip_code)
	if (hasStructured) {
		const cep =
			c.zip_code && String(c.zip_code).trim()
				? `CEP ${formatCepBr(c.zip_code)}`
				: null
		const cityLine = [c.neighborhood, c.city, c.state].filter(Boolean).join(' / ')
		const streetLine = [c.street, c.street_number, c.street_complement]
			.filter(Boolean)
			.join(', ')
		const lines = [cep, cityLine || null, streetLine || null].filter(Boolean)
		if (lines.length > 0) {
			return lines
		}
	}
	const full = c.address_full?.trim()
	return full ? [full] : []
}

type OrderCustomer = {
	id?: string
	cpf?: string | null
	cnpj?: string | null
	is_company?: boolean | null
	full_name?: string | null
	company_name?: string | null
	trade_name?: string | null
	email?: string | null
	mobile_phone?: string | null
	contact_phone?: string | null
	contact_notes?: string | null
	address_full?: string | null
	birth_date?: string | null
	zip_code?: string | null
	state?: string | null
	city?: string | null
	neighborhood?: string | null
	street?: string | null
	street_number?: string | null
	street_complement?: string | null
	referral_source?: string | null
	referral_source_other?: string | null
}

type Props = {
	customer: OrderCustomer
}

export function OrderCustomerCard({ customer }: Props) {
	const router = useRouter()
	const [isEditOpen, setIsEditOpen] = useState(false)
	const [isHistoryOpen, setIsHistoryOpen] = useState(false)
	const [orderCount, setOrderCount] = useState<number | null>(null)
	const customerId = customer.id ?? ''

	useEffect(() => {
		if (!customerId) {
			queueMicrotask(() => {
				setOrderCount(null)
			})
			return
		}
		let cancelled = false
		portalFetch(
			`/api/portal/ordens?customerId=${encodeURIComponent(customerId)}&countOnly=1`,
		)
			.then((res) => res?.json())
			.then((data) => {
				if (cancelled) return
				if (data?.ok && typeof data.count === 'number') {
					setOrderCount(data.count)
				} else {
					setOrderCount(0)
				}
			})
			.catch(() => {
				if (!cancelled) setOrderCount(0)
			})
		return () => {
			cancelled = true
		}
	}, [customerId])

	const showHistoryButton = customerId && orderCount !== null && orderCount > 1

	const asCustomerHit: CustomerHit = {
		id: customer.id || '',
		cpf: customer.cpf ?? null,
		cnpj: customer.cnpj ?? null,
		is_company: customer.is_company ?? false,
		full_name: customer.full_name ?? null,
		company_name: customer.company_name ?? null,
		trade_name: customer.trade_name ?? null,
		email: customer.email ?? null,
		mobile_phone: customer.mobile_phone ?? null,
		contact_phone: customer.contact_phone ?? null,
		contact_notes: customer.contact_notes ?? null,
		address_full: customer.address_full ?? null,
		birth_date: customer.birth_date ?? null,
		zip_code: customer.zip_code ?? null,
		state: customer.state ?? null,
		city: customer.city ?? null,
		neighborhood: customer.neighborhood ?? null,
		street: customer.street ?? null,
		street_number: customer.street_number ?? null,
		street_complement: customer.street_complement ?? null,
		referral_source: customer.referral_source ?? null,
		referral_source_other: customer.referral_source_other ?? null,
	}

	const mobileFmt = formatPhoneBr(customer.mobile_phone)
	const contactFmt = formatPhoneBr(customer.contact_phone)
	const addressLines = buildAddressColumn(customer)
	const docLine = getCustomerDocumentMasked(customer)
	const tradeLine = customer.is_company
		? String(customer.trade_name || '').trim()
		: ''

	return (
		<>
			<Card className="relative">
				<div
					className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border bg-background/95 p-0.5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-background/80"
					role="toolbar"
					aria-label="Ações do cliente"
				>
					{showHistoryButton ? (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={() => setIsHistoryOpen(true)}
							aria-label="Ver histórico de ordens do cliente"
						>
							<History className="h-3.5 w-3.5" aria-hidden />
						</Button>
					) : null}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => setIsEditOpen(true)}
						aria-label="Editar cliente"
					>
						<Pencil className="h-3.5 w-3.5" aria-hidden />
					</Button>
				</div>
				<CardContent className={'p-5'}>
					<div className="grid min-w-0 grid-cols-1 gap-6 text-sm sm:grid-cols-2 sm:gap-4">
						<div className="min-w-0 space-y-4">
							<div className="space-y-1">
								<div className="font-medium text-foreground break-words">
									{getCustomerDisplayName(customer)}
								</div>
								{tradeLine ? (
									<div className="text-muted-foreground break-words">{tradeLine}</div>
								) : null}
								<div className="text-muted-foreground break-words">{docLine || '—'}</div>
								{customer.birth_date ? (
									<div className="text-muted-foreground text-xs">
										Nasc. {formatDateBr(customer.birth_date)}
									</div>
								) : null}
							</div>
							<div className="min-w-0 space-y-1">
								<div className="text-muted-foreground">Contato</div>
								<div className="space-y-1.5 text-foreground">
									{mobileFmt ? (
										<div className="break-words">{mobileFmt}</div>
									) : null}
									{contactFmt ? (
										<div className="break-words">
											<span>{contactFmt}</span>
											<span className="text-muted-foreground">
												{' '}
												(contato alternativo)
											</span>
											{customer.contact_notes?.trim() ? (
												<span className="text-muted-foreground">
													{' '}
													({customer.contact_notes.trim()})
												</span>
											) : null}
										</div>
									) : null}
									{customer.email?.trim() ? (
										<div className="break-all font-medium">{customer.email.trim()}</div>
									) : null}
									{!mobileFmt && !contactFmt && !customer.email?.trim() ? (
										<div className="text-muted-foreground">—</div>
									) : null}
								</div>
							</div>
						</div>
						<div className="min-w-0 space-y-1">
							<div className="text-muted-foreground">Endereço</div>
							{addressLines.length > 0 ? (
								<div className="space-y-1 text-foreground">
									{addressLines.map((line, i) => (
										<div key={i} className="break-words">
											{line}
										</div>
									))}
								</div>
							) : (
								<div className="text-muted-foreground">—</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			<EditCustomerDialog
				open={isEditOpen}
				onOpenChange={setIsEditOpen}
				customer={asCustomerHit}
				onSaved={() => router.refresh()}
			/>

			{showHistoryButton ? (
				<CustomerOrderHistoryModal
					open={isHistoryOpen}
					onOpenChange={setIsHistoryOpen}
					customerId={customerId}
					isCreationPage={false}
				/>
			) : null}
		</>
	)
}
