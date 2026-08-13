'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
	ArrowLeftRight,
	Check,
	ChevronsUpDown,
	History,
	Loader2,
	Pencil,
	Plus,
	X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover'
import {
	CreateCustomerDialog,
	EditCustomerDialog,
	type CustomerHit,
} from '@/components/customers'
import { CustomerOrderHistoryModal } from '@/components/orders'
import { toast } from '@/hooks/use-toast'
import { formatCepBr } from '@/lib/utils/format-cep'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { formatDateBr } from '@/lib/utils/format-date'
import { formatPhoneBr } from '@/lib/utils/format-phone'
import { onlyDigits } from '@/lib/utils/strings'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { cn } from '@/lib/utils'
import {
	getCustomerDocumentDigits,
	useNovaOrdemCustomerSearch,
} from '../nova/use-nova-ordem-customer-search'

function getCustomerDisplayName (c: {
	is_company?: boolean | null
	company_name?: string | null
	trade_name?: string | null
	full_name?: string | null
}) {
	if (c.is_company) {
		return String(c.company_name || c.trade_name || c.full_name || 'Empresa')
	}
	return String(c.full_name || 'Cliente')
}

function getCustomerDocumentMasked (c: { cpf?: string | null; cnpj?: string | null }) {
	return formatCpfCnpj(onlyDigits(String(c.cnpj || c.cpf || '')).slice(0, 14))
}

function buildAddressColumn (c: OrderCustomer) {
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

export type { OrderCustomer }

function toCustomerHit (customer: OrderCustomer): CustomerHit {
	return {
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
}

type Props = {
	orderId: string
	customer: OrderCustomer | null
	disabled?: boolean
}

export function OrderCustomerCard ({ orderId, customer, disabled = false }: Props) {
	const router = useRouter()
	const [isEditOpen, setIsEditOpen] = useState(false)
	const [isHistoryOpen, setIsHistoryOpen] = useState(false)
	const [isChanging, setIsChanging] = useState(false)
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [createInitialDigits, setCreateInitialDigits] = useState('')
	const [isSavingCustomer, setIsSavingCustomer] = useState(false)
	const [orderCount, setOrderCount] = useState<number | null>(null)
	const customerId = customer?.id ?? ''

	const {
		customerSearchInput,
		setCustomerSearchInput,
		documentDigits,
		isDocumentMode,
		isNameMode,
		isSearchingDocument,
		documentSearchError,
		hasFetched,
		customersFiltered,
		isCpfPopoverOpen,
		setIsCpfPopoverOpen,
	} = useNovaOrdemCustomerSearch({ selectedCustomer: null })

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

	const showHistoryButton = Boolean(customerId) && orderCount !== null && orderCount > 1
	const asCustomerHit = customer ? toCustomerHit(customer) : null

	async function attachCustomer (next: CustomerHit) {
		if (!next?.id || isSavingCustomer) return
		if (next.id === customerId) {
			setIsChanging(false)
			setCustomerSearchInput('')
			return
		}
		setIsSavingCustomer(true)
		try {
			const res = await portalFetch(`/api/portal/ordens/${orderId}/customer`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ customerId: next.id }),
			})
			const data = await res?.json().catch(() => null)
			if (!res?.ok || data?.ok !== true) {
				const code = String(data?.error || '')
				throw new Error(
					code === 'order_finalized'
						? 'Ordem finalizada: apenas admin pode trocar o cliente.'
						: code === 'invalid_customer'
							? 'Cliente inválido.'
							: 'Não foi possível trocar o cliente.',
				)
			}
			toast({
				variant: 'success',
				title: 'Cliente atualizado',
				description: `${getCustomerDisplayName(next)} vinculado à OS.`,
			})
			setIsChanging(false)
			setCustomerSearchInput('')
			setIsCpfPopoverOpen(false)
			router.refresh()
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Erro ao trocar cliente.'
			toast({ variant: 'destructive', title: 'Erro', description: message })
		} finally {
			setIsSavingCustomer(false)
		}
	}

	function startChanging () {
		if (disabled) return
		setIsChanging(true)
		setCustomerSearchInput('')
		setIsCpfPopoverOpen(true)
	}

	function cancelChanging () {
		if (isSavingCustomer) return
		setIsChanging(false)
		setCustomerSearchInput('')
		setIsCpfPopoverOpen(false)
	}

	if (isChanging || !customer) {
		return (
			<>
				<Card>
					<CardContent className="space-y-3 p-5">
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="text-sm font-medium">
									{customer ? 'Trocar cliente da OS' : 'Selecionar cliente'}
								</div>
								<p className="text-xs text-muted-foreground mt-0.5">
									Busque por nome ou CPF/CNPJ e escolha o novo cliente.
								</p>
							</div>
							{customer ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={cancelChanging}
									disabled={isSavingCustomer}
									aria-label="Cancelar troca de cliente"
								>
									<X className="h-4 w-4 mr-1" />
									Cancelar
								</Button>
							) : null}
						</div>

						<div className="space-y-2">
							<Label htmlFor="orderCustomerSearchTrigger">Buscar cliente</Label>
							<Popover open={isCpfPopoverOpen} onOpenChange={setIsCpfPopoverOpen}>
								<PopoverTrigger asChild>
									<button
										id="orderCustomerSearchTrigger"
										type="button"
										disabled={isSavingCustomer}
										className={cn(
											'w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2.5 text-sm',
											'hover:bg-accent/30 transition-colors',
											isSavingCustomer && 'opacity-60 pointer-events-none',
										)}
									>
										<span className={cn(!customerSearchInput ? 'text-muted-foreground' : '')}>
											{isSavingCustomer
												? 'Salvando…'
												: customerSearchInput
													? (isDocumentMode
														? formatCpfCnpj(documentDigits)
														: customerSearchInput)
													: 'Digite o nome ou CPF/CNPJ (mín. 2 letras ou 5 números)'}
										</span>
										{isSavingCustomer ? (
											<Loader2 className="h-4 w-4 animate-spin opacity-70 shrink-0" />
										) : (
											<ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
										)}
									</button>
								</PopoverTrigger>
								<PopoverContent
									className="p-0 w-[min(520px,calc(100vw-2rem))]"
									align="start"
								>
									<Command shouldFilter={false}>
										<CommandInput
											placeholder="Nome ou CPF/CNPJ…"
											value={customerSearchInput}
											onValueChange={(v) => {
												if (/[a-zA-Z\u00C0-\u024F]/.test(v)) {
													setCustomerSearchInput(v)
												} else {
													setCustomerSearchInput(formatCpfCnpj(v.replace(/\D/g, '')))
												}
											}}
										/>
										<CommandList>
											{customersFiltered.length === 0 ? (
												<CommandEmpty>
													{!isDocumentMode && !isNameMode
														? 'Digite pelo menos 2 letras (nome) ou 5 números (CPF/CNPJ).'
														: documentSearchError
															? documentSearchError
															: hasFetched
																? 'Nenhum cliente encontrado.'
																: isSearchingDocument
																	? 'Buscando…'
																	: 'Aguarde…'}
												</CommandEmpty>
											) : null}
											{customersFiltered.length > 0 ? (
												<CommandGroup heading="Clientes">
													{customersFiltered.map((c) => (
														<CommandItem
															key={c.id}
															value={`${getCustomerDisplayName(c)} ${getCustomerDocumentDigits(c)}`}
															disabled={isSavingCustomer}
															onSelect={() => {
																void attachCustomer(c)
															}}
														>
															<Check
																className={cn(
																	'mr-2 h-4 w-4',
																	c.id === customerId ? 'opacity-100' : 'opacity-0',
																)}
															/>
															<div className="flex flex-col">
																<span className="font-medium">
																	{getCustomerDisplayName(c)}
																</span>
																<span className="text-xs text-muted-foreground">
																	{formatCpfCnpj(getCustomerDocumentDigits(c))}
																</span>
															</div>
														</CommandItem>
													))}
												</CommandGroup>
											) : null}
										</CommandList>
										<div className="border-t p-2 flex items-center justify-between gap-2">
											<div className="text-xs text-muted-foreground">
												{isDocumentMode
													? (documentDigits.length === 14
														? 'CNPJ completo'
														: documentDigits.length === 11
															? 'CPF completo'
															: 'Digite até completar 11 (CPF) ou 14 (CNPJ) números')
													: 'Busca por nome, razão social ou nome fantasia'}
											</div>
											<Button
												type="button"
												size="sm"
												disabled={isSavingCustomer}
												onClick={() => {
													setCreateInitialDigits(documentDigits)
													setIsCpfPopoverOpen(false)
													setIsCreateOpen(true)
												}}
											>
												<Plus className="h-4 w-4 mr-2" />
												Cadastrar cliente
											</Button>
										</div>
									</Command>
								</PopoverContent>
							</Popover>
						</div>
					</CardContent>
				</Card>

				<CreateCustomerDialog
					open={isCreateOpen}
					onOpenChange={setIsCreateOpen}
					initialDocumentDigits={createInitialDigits}
					mode="create"
					onCreated={(created) => {
						void attachCustomer(created)
					}}
				/>
			</>
		)
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
				{!disabled ? (
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
							aria-label="Editar dados do cliente"
						>
							<Pencil className="h-3.5 w-3.5" aria-hidden />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={startChanging}
							aria-label="Trocar cliente da OS"
							title="Trocar cliente"
						>
							<ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
						</Button>
					</div>
				) : null}
				<CardContent className="p-5">
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

			{asCustomerHit ? (
				<EditCustomerDialog
					open={isEditOpen}
					onOpenChange={setIsEditOpen}
					customer={asCustomerHit}
					onSaved={() => router.refresh()}
				/>
			) : null}

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
