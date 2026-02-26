'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Formik, Form, Field, FieldArray } from 'formik'
import * as Yup from 'yup'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { PatternLockInput } from '@/components/pattern-lock/PatternLockInput'
import { CreateCustomerDialog, EditCustomerDialog, type CustomerHit } from '@/components/customers'
import { OrderDeviceSelector, OrderPaymentMethodFields, OrderServicesCard, OsAssistAiIconButton, type ServiceLine } from '@/components/orders'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NovaOrdemCustomerCard } from './NovaOrdemCustomerCard'
import { parseMoneyToCents } from '@/lib/utils/format-money'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { getDefaultPrevisao, getMinPrevisaoNow } from '@/lib/utils/previsao-ordem'
import { PrevisaoInput } from '@/components/previsao-input'
import { formatCpf, formatCnpj, formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import { onlyDigits } from '@/lib/utils/strings'

const statusOptions = [
	{ value: 'orcamento', label: 'Orçamento' },
	{ value: 'aguardando_aprovacao', label: 'Aguardando aprovação' },
	{ value: 'aprovado', label: 'Aprovado' },
] as const

function makeId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	return String(Date.now()) + String(Math.random()).slice(2)
}

function getCustomerDocumentDigits(customer: CustomerHit) {
	return onlyDigits(String(customer.cnpj || customer.cpf || '')).slice(0, 14)
}

type SellerOption = { id: string; full_name: string | null; email: string | null }

type Props = {
	action: (formData: FormData) => Promise<{ redirectTo: string } | void>
	initialError?: string
	sellerName: string
	isAdmin: boolean
	sellerOptions: SellerOption[]
	currentUserId: string
	duplicateOrderId?: string
}

type FormValues = {
	customerId: string
	document: string
	title: string
	status: string
	sellerUserId: string
	deviceModelId: string
	brand: string
	model: string
	deviceType: string
	imei: string
	color: string
	isWarranty: boolean
	estimatedReadyAt: string
	passcodeType: string
	passcodeText: string
	passcodePattern: string
	paymentMethods: Array<{ payment_method_id: string; installments?: number; value_cents?: number | null }>
	customerDescription: string
	internalDescription: string
	receivingNotes: string
	services: ServiceLine[]
}

const initialFormValues: FormValues = {
	customerId: '',
	document: '',
	title: '',
	status: 'orcamento',
	sellerUserId: '',
	deviceModelId: '',
	brand: '',
	model: '',
	deviceType: '',
	imei: '',
	color: '',
	isWarranty: false,
	estimatedReadyAt: '',
	passcodeType: 'none',
	passcodeText: '',
	passcodePattern: '',
	paymentMethods: [],
	customerDescription: '',
	internalDescription: '',
	receivingNotes: '',
	services: [],
}

const orderFormSchema = Yup.object().shape({
	customerId: Yup.string().required('Selecione um cliente (CPF/CNPJ)'),
	title: Yup.string().trim().required('Título é obrigatório').min(2, 'Título deve ter pelo menos 2 caracteres'),
	status: Yup.string().oneOf(['orcamento', 'aguardando_aprovacao', 'aprovado'], 'Status inválido').required('Status é obrigatório'),
	estimatedReadyAt: Yup.string().test(
		'min-date',
		'A previsão deve ser igual ou posterior à data de abertura.',
		(value) => !value || new Date(value).getTime() >= Date.now() - 60_000
	),
})

export function NovaOrdemClient(props: Props) {
	const router = useRouter()
	const [customerSearchInput, setCustomerSearchInput] = useState('')
	const documentDigits = useMemo(() => onlyDigits(customerSearchInput).slice(0, 14), [customerSearchInput])
	const documentPrefix = useMemo(() => documentDigits.slice(0, 5), [documentDigits])
	const nameQuery = useMemo(() => customerSearchInput.trim(), [customerSearchInput])
	const isDocumentMode = documentDigits.length >= 5
	const isNameMode = nameQuery.length >= 2 && /[a-zA-Z\u00C0-\u024F]/.test(nameQuery)

	const [duplicateFormValues, setDuplicateFormValues] = useState<FormValues | null>(null)
	const [duplicateLoaded, setDuplicateLoaded] = useState(false)

	const [customersBase, setCustomersBase] = useState<CustomerHit[]>([])
	const [isSearchingDocument, setIsSearchingDocument] = useState(false)
	const [documentSearchError, setDocumentSearchError] = useState<string | null>(null)
	const [lastPrefixFetched, setLastPrefixFetched] = useState<string | null>(null)
	const [lastNameQueryFetched, setLastNameQueryFetched] = useState<string | null>(null)
	const cpfSearchAbortRef = useRef<AbortController | null>(null)
	const cpfSearchInFlightPrefixRef = useRef<string | null>(null)
	const nameSearchInFlightRef = useRef<string | null>(null)
	const cpfSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const nameSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(null)

	type CustomerDevice = {
		id: string
		device_model_id: string | null
		brand: string | null
		model: string | null
		device_type: string | null
		imei: string | null
		color: string | null
	}

	const [customerDevices, setCustomerDevices] = useState<CustomerDevice[]>([])
	const [isLoadingCustomerDevices, setIsLoadingCustomerDevices] = useState(false)
	const [isDevicesDialogOpen, setIsDevicesDialogOpen] = useState(false)

	const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false)
	const [createCustomerInitialDocumentDigits, setCreateCustomerInitialDocumentDigits] = useState('')
	const [customerToEdit, setCustomerToEdit] = useState<CustomerHit | null>(null)

	const [isCpfPopoverOpen, setIsCpfPopoverOpen] = useState(false)

	const defaultPrevisao = useMemo(() => getDefaultPrevisao(), [])
	const minPrevisao = useMemo(() => getMinPrevisaoNow(), [])
	const initialFormValuesWithPrevisao = useMemo(
		() => ({
			...initialFormValues,
			estimatedReadyAt: defaultPrevisao,
			sellerUserId: props.isAdmin ? props.currentUserId : '',
		}),
		[defaultPrevisao, props.isAdmin, props.currentUserId]
	)

	useEffect(() => {
		if (!props.duplicateOrderId) {
			setDuplicateLoaded(true)
			return
		}
		let cancelled = false
		portalFetch(`/api/portal/ordens/${props.duplicateOrderId}/duplicate`)
			.then((res) => res.json())
			.then((data) => {
				if (cancelled || !data?.ok || !data?.order) return
				const o = data.order
				setDuplicateFormValues({
					customerId: o.customerId ?? '',
					document: o.documentDigits ?? '',
					title: o.title ?? '',
					status: o.status ?? 'orcamento',
					sellerUserId: props.isAdmin ? props.currentUserId : '',
					deviceModelId: o.deviceModelId ?? '',
					brand: o.brand ?? '',
					model: o.model ?? '',
					deviceType: o.deviceType ?? '',
					imei: o.imei ?? '',
					color: o.color ?? '',
					isWarranty: Boolean(o.isWarranty),
					estimatedReadyAt: o.estimatedReadyAt ?? '',
					passcodeType: o.passcodeType ?? 'none',
					passcodeText: o.passcodeText ?? '',
					passcodePattern: o.passcodePattern ?? '',
					paymentMethods: Array.isArray(o.paymentMethods) && o.paymentMethods.length > 0
						? o.paymentMethods
						: (o.paymentMethodId ? [{ payment_method_id: o.paymentMethodId, installments: o.installments ?? 1, value_cents: null }] : []),
					customerDescription: o.customerDescription ?? '',
					internalDescription: o.internalDescription ?? '',
					receivingNotes: o.receivingNotes ?? '',
					services: o.services ?? [],
				})
				if (o.customer) {
					setSelectedCustomer(o.customer as CustomerHit)
					setCustomersBase((prev) => {
						const exists = prev.some((c) => getCustomerDocumentDigits(c) === (o.documentDigits ?? ''))
						if (exists) return prev
						return [o.customer, ...prev].filter(Boolean) as CustomerHit[]
					})
				}
				if (o.documentDigits) {
					setCustomerSearchInput(formatCpfCnpj(o.documentDigits))
					setLastPrefixFetched(String(o.documentDigits).slice(0, 5))
				}
				setDuplicateLoaded(true)
			})
			.catch(() => {
				if (!cancelled) setDuplicateLoaded(true)
			})
		return () => { cancelled = true }
	}, [props.duplicateOrderId])

	useEffect(() => {
		if (!selectedCustomer) return
		const doc = getCustomerDocumentDigits(selectedCustomer)
		if (doc && doc !== documentDigits) {
			setCustomerSearchInput(formatCpfCnpj(doc))
		}
	}, [documentDigits, selectedCustomer])

	useEffect(() => {
		if (!selectedCustomer?.id) {
			setCustomerDevices([])
			setIsDevicesDialogOpen(false)
			return
		}
		let cancelled = false
		async function loadCustomerDevices() {
			setIsLoadingCustomerDevices(true)
			try {
				const res = await portalFetch(`/api/portal/customers/${selectedCustomer.id}/devices`)
				const data = await res.json().catch(() => null)
				if (!cancelled && data?.ok && Array.isArray(data.devices)) {
					setCustomerDevices(data.devices as CustomerDevice[])
				}
				if (!cancelled && (!data?.ok || !Array.isArray(data.devices))) {
					setCustomerDevices([])
				}
			} catch {
				if (!cancelled) setCustomerDevices([])
			} finally {
				if (!cancelled) setIsLoadingCustomerDevices(false)
			}
		}
		loadCustomerDevices()
		return () => { cancelled = true }
	}, [selectedCustomer])

	useEffect(() => {
		if (!isDocumentMode && !isNameMode) {
			setDocumentSearchError(null)
			setCustomersBase([])
			setLastPrefixFetched(null)
			setLastNameQueryFetched(null)
			cpfSearchAbortRef.current?.abort()
			cpfSearchAbortRef.current = null
			cpfSearchInFlightPrefixRef.current = null
			nameSearchInFlightRef.current = null
			if (cpfSearchDebounceRef.current) clearTimeout(cpfSearchDebounceRef.current)
			if (nameSearchDebounceRef.current) clearTimeout(nameSearchDebounceRef.current)
			cpfSearchDebounceRef.current = null
			nameSearchDebounceRef.current = null
			setIsSearchingDocument(false)
			return
		}

		let cancelled = false

		if (isDocumentMode) {
			if (documentPrefix === lastPrefixFetched || cpfSearchInFlightPrefixRef.current === documentPrefix) return
			if (cpfSearchDebounceRef.current) clearTimeout(cpfSearchDebounceRef.current)
			cpfSearchDebounceRef.current = setTimeout(() => {
				if (cancelled) return
				cpfSearchAbortRef.current?.abort()
				const controller = new AbortController()
				cpfSearchAbortRef.current = controller
				cpfSearchInFlightPrefixRef.current = documentPrefix
				setIsSearchingDocument(true)
				setDocumentSearchError(null)
				portalFetch(`/api/portal/customers/search?documentPrefix=${documentPrefix}`, { signal: controller.signal })
					.then((res) => res.json())
					.then((data) => {
						if (cancelled) return
						if (!data?.ok) {
							setDocumentSearchError('Não foi possível buscar clientes agora.')
							setCustomersBase([])
							setLastPrefixFetched(documentPrefix)
							return
						}
						setCustomersBase(data.customers || [])
						setLastPrefixFetched(documentPrefix)
					})
					.catch((err: any) => {
						if (err?.name === 'AbortError') return
						if (!cancelled) {
							setDocumentSearchError('Não foi possível buscar clientes agora.')
							setCustomersBase([])
							setLastPrefixFetched(documentPrefix)
						}
					})
					.finally(() => {
						if (!cancelled) setIsSearchingDocument(false)
						if (cpfSearchInFlightPrefixRef.current === documentPrefix) cpfSearchInFlightPrefixRef.current = null
					})
			}, 350)
		} else if (isNameMode) {
			if (nameQuery === lastNameQueryFetched || nameSearchInFlightRef.current === nameQuery) return
			if (nameSearchDebounceRef.current) clearTimeout(nameSearchDebounceRef.current)
			nameSearchDebounceRef.current = setTimeout(() => {
				if (cancelled) return
				cpfSearchAbortRef.current?.abort()
				const controller = new AbortController()
				cpfSearchAbortRef.current = controller
				nameSearchInFlightRef.current = nameQuery
				setIsSearchingDocument(true)
				setDocumentSearchError(null)
				portalFetch(`/api/portal/customers/search?name=${encodeURIComponent(nameQuery)}`, { signal: controller.signal })
					.then((res) => res.json())
					.then((data) => {
						if (cancelled) return
						if (!data?.ok) {
							setDocumentSearchError('Não foi possível buscar clientes agora.')
							setCustomersBase([])
							setLastNameQueryFetched(nameQuery)
							return
						}
						setCustomersBase(data.customers || [])
						setLastNameQueryFetched(nameQuery)
					})
					.catch((err: any) => {
						if (err?.name === 'AbortError') return
						if (!cancelled) {
							setDocumentSearchError('Não foi possível buscar clientes agora.')
							setCustomersBase([])
							setLastNameQueryFetched(nameQuery)
						}
					})
					.finally(() => {
						if (!cancelled) setIsSearchingDocument(false)
						if (nameSearchInFlightRef.current === nameQuery) nameSearchInFlightRef.current = null
					})
			}, 350)
		}

		return () => {
			cancelled = true
			if (cpfSearchDebounceRef.current) clearTimeout(cpfSearchDebounceRef.current)
			if (nameSearchDebounceRef.current) clearTimeout(nameSearchDebounceRef.current)
		}
	}, [isDocumentMode, isNameMode, documentPrefix, lastPrefixFetched, nameQuery, lastNameQueryFetched])

	const hasFetchedDocPrefix = isDocumentMode && lastPrefixFetched === documentPrefix
	const hasFetchedName = isNameMode && lastNameQueryFetched === nameQuery
	const hasFetched = hasFetchedDocPrefix || hasFetchedName

	const customersFiltered = useMemo(() => {
		if (!hasFetched) return []
		if (isDocumentMode) {
			return customersBase.filter(c => getCustomerDocumentDigits(c).startsWith(documentDigits))
		}
		return customersBase
	}, [customersBase, hasFetched, isDocumentMode, documentDigits])

	function buildFormDataFromValues(values: FormValues, documentDigits: string): FormData {
		const servicesNormalized = (values.services || [])
			.map((s) => ({
				description: String(s.description || '').trim(),
				valueCents: parseMoneyToCents(s.value),
				costCents: parseMoneyToCents(s.cost),
			}))
			.filter((s) => s.description || s.valueCents > 0 || s.costCents > 0)
		const totalValueCents = servicesNormalized.reduce((acc, s) => acc + s.valueCents, 0)
		const totalCostCents = servicesNormalized.reduce((acc, s) => acc + s.costCents, 0)
		const servicesJson = JSON.stringify({ items: servicesNormalized, totals: { totalValueCents, totalCostCents } })

		const fd = new FormData()
		fd.append('customerId', values.customerId)
		fd.append('document', documentDigits)
		fd.append('deviceModelId', values.deviceModelId)
		fd.append('brand', values.brand)
		fd.append('deviceType', values.deviceType)
		fd.append('model', values.model)
		fd.append('isWarranty', values.isWarranty ? '1' : '')
		fd.append('passcodeType', values.passcodeType)
		fd.append('passcodeText', values.passcodeText)
		fd.append('passcodePattern', values.passcodePattern)
		fd.append('paymentMethodsJson', JSON.stringify((values.paymentMethods || []).filter((e) => e.payment_method_id)))
		fd.append('title', values.title)
		fd.append('status', values.status)
		fd.append('imei', values.imei)
		fd.append('color', values.color)
		fd.append('estimatedReadyAt', values.estimatedReadyAt)
		fd.append('customerDescription', values.customerDescription)
		fd.append('internalDescription', values.internalDescription)
		fd.append('receivingNotes', values.receivingNotes)
		fd.append('servicesJson', servicesJson)
		fd.append('seller_user_id', props.isAdmin ? (values.sellerUserId || props.currentUserId) : props.currentUserId)
		return fd
	}

	if (props.duplicateOrderId && !duplicateLoaded) {
		return (
			<div className="max-w-4xl space-y-6">
				<div>
					<h1 className="text-2xl font-bold">Nova ordem de serviço</h1>
					<p className="text-sm text-muted-foreground">
						Carregando dados da ordem para duplicar…
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="max-w-4xl space-y-6">

			<div>
				<h1 className="text-2xl font-bold">Nova ordem de serviço</h1>
				<p className="text-sm text-muted-foreground">
					{duplicateFormValues ? 'Revise os dados e salve para criar a cópia.' : 'Busque o cliente por nome ou CPF/CNPJ e preencha os dados da OS.'}
				</p>
			</div>

			<Formik
				initialValues={duplicateFormValues ?? initialFormValuesWithPrevisao}
				validationSchema={orderFormSchema}
				enableReinitialize={!!duplicateFormValues}
				onSubmit={async (values) => {
					const fd = buildFormDataFromValues(values, documentDigits)
					const result = await props.action(fd)
					if (result && 'redirectTo' in result && result.redirectTo) router.push(result.redirectTo)
				}}
			>
				{(formik) => (
					<>
						<Form className="relative space-y-6">
							<NovaOrdemCustomerCard
								selectedCustomer={selectedCustomer}
								searchInput={customerSearchInput}
								documentDigits={documentDigits}
								onSearchInputChange={setCustomerSearchInput}
								isCpfPopoverOpen={isCpfPopoverOpen}
								onCpfPopoverOpenChange={setIsCpfPopoverOpen}
								customersFiltered={customersFiltered}
								isSearchingDocument={isSearchingDocument}
								documentSearchError={documentSearchError}
								hasFetched={hasFetched}
								isDocumentMode={isDocumentMode}
								isNameMode={isNameMode}
								onSelectCustomer={(c) => {
									setSelectedCustomer(c)
									setIsCpfPopoverOpen(false)
									formik.setFieldValue('customerId', c.id)
									formik.setFieldValue('document', getCustomerDocumentDigits(c))
								}}
								onClearCustomer={() => {
									setSelectedCustomer(null)
									setIsCpfPopoverOpen(true)
									formik.setFieldValue('customerId', '')
									formik.setFieldValue('document', documentDigits)
								}}
								onEditCustomer={() => {
									setCustomerToEdit(selectedCustomer!)
									setIsCreateCustomerOpen(true)
								}}
								onCreateCustomer={() => {
									setCreateCustomerInitialDocumentDigits(documentDigits)
									setCustomerToEdit(null)
									setIsCpfPopoverOpen(false)
									setIsCreateCustomerOpen(true)
								}}
							/>

							<Card>
								<CardHeader>
									<CardTitle>Informações do Aparelho</CardTitle>
								</CardHeader>
								<CardContent className="space-y-6">
									<OrderDeviceSelector
										formik={{
											values: {
												brand: formik.values.brand,
												deviceType: formik.values.deviceType,
												deviceModelId: formik.values.deviceModelId,
												model: formik.values.model,
											},
											setFieldValue: formik.setFieldValue,
										}}
										hasExistingDevices={customerDevices.length > 0}
										onOpenExistingDevices={() => setIsDevicesDialogOpen(true)}
									/>

									<Dialog open={isDevicesDialogOpen} onOpenChange={setIsDevicesDialogOpen}>
										<DialogContent className="max-w-md">
											<DialogHeader>
												<DialogTitle>Selecionar aparelho do cliente</DialogTitle>
												<DialogDescription>
													Escolha um aparelho já cadastrado para preencher os dados da OS.
												</DialogDescription>
											</DialogHeader>
											<div className="mt-2 space-y-2 max-h-80 overflow-y-auto">
												{isLoadingCustomerDevices ? (
													<p className="text-sm text-muted-foreground">Carregando aparelhos…</p>
												) : customerDevices.length === 0 ? (
													<p className="text-sm text-muted-foreground">
														Este cliente ainda não possui aparelhos cadastrados.
													</p>
												) : (
													customerDevices.map((d) => {
														const labelParts = [d.device_type, d.brand, d.model].filter(Boolean)
														const label = labelParts.length ? labelParts.join(' • ') : 'Aparelho'
														const secondaryParts = [d.imei, d.color].filter(Boolean)
														const secondary = secondaryParts.length ? secondaryParts.join(' • ') : null
														return (
															<button
																key={d.id}
																type="button"
																className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
																onClick={() => {
																	formik.setFieldValue('brand', d.brand ?? '')
																	formik.setFieldValue('deviceType', d.device_type ?? '')
																	formik.setFieldValue('deviceModelId', d.device_model_id ?? '')
																	formik.setFieldValue('model', d.model ?? '')
																	formik.setFieldValue('imei', d.imei ?? '')
																	formik.setFieldValue('color', d.color ?? '')
																	setIsDevicesDialogOpen(false)
																}}
															>
																<div className="font-medium truncate">{label}</div>
																{secondary ? (
																	<div className="text-xs text-muted-foreground truncate">
																		{secondary}
																	</div>
																) : null}
															</button>
														)
													})
												)}
											</div>
											<DialogFooter>
												<Button type="button" variant="outline" onClick={() => setIsDevicesDialogOpen(false)}>
													Fechar
												</Button>
											</DialogFooter>
										</DialogContent>
									</Dialog>

									<div className="rounded-md border p-4 space-y-3">
										<div className="flex items-center justify-between gap-3 flex-wrap">
											<div>
												<div className="text-sm font-medium">Senha do aparelho</div>
											</div>
										</div>
										<RadioGroup
											value={formik.values.passcodeType}
											onValueChange={(v) => {
												const next = v === 'pattern' ? 'pattern' : (v === 'text' ? 'text' : 'none')
												formik.setFieldValue('passcodeType', next)
												if (next === 'none') {
													formik.setFieldValue('passcodeText', '')
													formik.setFieldValue('passcodePattern', '')
												}
											}}
											className="flex flex-wrap items-center gap-4"
										>
											<div className="flex items-center gap-2">
												<RadioGroupItem value="text" id="passcode-text" />
												<Label htmlFor="passcode-text" className="cursor-pointer">Texto</Label>
											</div>
											<div className="flex items-center gap-2">
												<RadioGroupItem value="pattern" id="passcode-pattern" />
												<Label htmlFor="passcode-pattern" className="cursor-pointer">Padrão</Label>
											</div>
											<div className="flex items-center gap-2">
												<RadioGroupItem value="none" id="passcode-none" />
												<Label htmlFor="passcode-none" className="cursor-pointer">Não informar</Label>
											</div>
										</RadioGroup>
										{formik.values.passcodeType === 'text' ? (
											<div className="space-y-2">
												<Label htmlFor="passcodeText">Senha (texto)</Label>
												<Field as={Input} id="passcodeText" name="passcodeText" placeholder="Ex: 1234, senha do iCloud, etc." />
											</div>
										) : formik.values.passcodeType === 'pattern' ? (
											<div className="space-y-2">
												<Label htmlFor="passcodePattern">Senha (padrão)</Label>
												<PatternLockInput
													id="passcodePattern"
													value={formik.values.passcodePattern}
													onChange={(v: string) => formik.setFieldValue('passcodePattern', v)}
												/>
											</div>
										) : (
											<div className="text-sm text-muted-foreground">
												O cliente optou por não informar a senha.
											</div>
										)}
									</div>

									<div className="grid md:grid-cols-2 gap-4">
										<div className="space-y-2">
											<Label htmlFor="imei">Número de série / IMEI</Label>
											<Field as={Input} id="imei" name="imei" placeholder="Digite o número" />
										</div>
										<div className="space-y-2">
											<Label htmlFor="color">Cor</Label>
											<Field as={Input} id="color" name="color" placeholder="Ex: Preto, Prateado" />
										</div>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Dados da ordem</CardTitle>
									<CardDescription>Dispositivo, status, serviços e demais informações.</CardDescription>
								</CardHeader>
								<CardContent className="relative space-y-6">
									<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
										<div className="space-y-2 md:col-span-2">
											<Label htmlFor="title">Título<span className="text-destructive"> *</span></Label>
											<Field
												as={Input}
												id="title"
												name="title"
												placeholder="Ex: Troca de tela iPhone 13"
												className={formik.touched.title && formik.errors.title ? 'border-destructive' : ''}
											/>
											{formik.touched.title && formik.errors.title ? (
												<p className="text-sm text-destructive">{formik.errors.title}</p>
											) : null}
										</div>
										<div className="space-y-2">
											<Label htmlFor={props.isAdmin ? 'sellerUserId' : 'sellerName'}>Vendedor</Label>
											{props.isAdmin ? (
												<Select
													value={formik.values.sellerUserId || props.currentUserId}
													onValueChange={(v) => formik.setFieldValue('sellerUserId', v)}
												>
													<SelectTrigger id="sellerUserId">
														<SelectValue placeholder="Selecione o vendedor" />
													</SelectTrigger>
													<SelectContent>
														{props.sellerOptions.map((u) => (
															<SelectItem key={u.id} value={u.id}>
																{String(u.full_name || u.email || u.id).trim() || '(Sem nome)'}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											) : (
												<Input id="sellerName" value={props.sellerName} readOnly />
											)}
										</div>
										<div className="space-y-2">
											<Label htmlFor="estimatedReadyAt">Previsão (data e hora)</Label>
											<PrevisaoInput
												id="estimatedReadyAt"
												name="estimatedReadyAt"
												min={minPrevisao}
												value={formik.values.estimatedReadyAt}
												onChange={formik.handleChange}
											/>
										</div>
									</div>

									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-2">
											<Label htmlFor="status">Status</Label>
											<Field
												as="select"
												id="status"
												name="status"
												className="w-full h-10 rounded-md border border-input px-3 text-sm"
											>
												{statusOptions.map(s => (
													<option key={s.value} value={s.value}>{s.label}</option>
												))}
											</Field>
										</div>
										<div className="flex items-center gap-2 rounded-md border p-3">
											<Checkbox
												id="isWarranty"
												checked={formik.values.isWarranty}
												onCheckedChange={(v) => formik.setFieldValue('isWarranty', !!v)}
											/>
											<Label htmlFor="isWarranty" className="cursor-pointer">Serviço em garantia</Label>
										</div>
									</div>

									<div className="space-y-2">
										<div className="flex items-center justify-between gap-2">
											<Label htmlFor="customerDescription">Descrição</Label>
											<OsAssistAiIconButton
												value={formik.values.customerDescription}
												onImproved={(text) => formik.setFieldValue('customerDescription', text)}
												device={[formik.values.brand, formik.values.deviceType, formik.values.model].filter(Boolean).join(' ')}
											/>
										</div>
										<Field as={Textarea} id="customerDescription" name="customerDescription" placeholder="Texto que o cliente vê" />
									</div>

									<div className="space-y-2">
										<div className="flex items-center justify-between gap-2">
											<Label htmlFor="receivingNotes">Observações do recebimento</Label>
											<OsAssistAiIconButton
												value={formik.values.receivingNotes}
												onImproved={(text) => formik.setFieldValue('receivingNotes', text)}
												device={[formik.values.brand, formik.values.deviceType, formik.values.model].filter(Boolean).join(' ')}
											/>
										</div>
										<Field as={Textarea} id="receivingNotes" name="receivingNotes" placeholder="Checklist, avarias, acessórios, etc." />
									</div>

									<FieldArray name="services">
										{({ push, remove }) => (
											<OrderServicesCard
												formik={{
													services: formik.values.services ?? [],
													onAdd: (item) => push(item),
													onRemove: remove,
													onUpdate: (idx, field, value) => formik.setFieldValue(`services.${idx}.${field}`, value),
												}}
											/>
										)}
									</FieldArray>

									<div className="space-y-2">
										<div className="flex items-center justify-between gap-2">
											<Label htmlFor="internalDescription">Descrição interna</Label>
											<OsAssistAiIconButton
												value={formik.values.internalDescription}
												onImproved={(text) => formik.setFieldValue('internalDescription', text)}
												device={[formik.values.brand, formik.values.deviceType, formik.values.model].filter(Boolean).join(' ')}
											/>
										</div>
										<Field as={Textarea} id="internalDescription" name="internalDescription" placeholder="Anotações internas" />
									</div>

									<OrderPaymentMethodFields
										formik={{
											values: { paymentMethods: formik.values.paymentMethods ?? [] },
											setFieldValue: formik.setFieldValue,
										}}
										totalValueCents={(formik.values.services ?? []).reduce((acc, s) => acc + parseMoneyToCents(s.value), 0)}
									/>

									{formik.status && typeof formik.status === 'string' ? (
										<p className="text-sm text-destructive">{formik.status}</p>
									) : props.initialError ? (
										<p className="text-sm text-destructive">{props.initialError}</p>
									) : null}

									{formik.errors.customerId ? (
										<p className="text-sm text-destructive">{formik.errors.customerId}</p>
									) : null}

									<Button
										type="submit"
										className="w-full"
										disabled={formik.isSubmitting || !selectedCustomer}
									>
										{formik.isSubmitting ? (
											<span className="inline-flex items-center gap-2">
												<Loader2 className="h-4 w-4 animate-spin" />
												Carregando
											</span>
										) : (
											'Criar ordem'
										)}
									</Button>
								</CardContent>
							</Card>
						</Form>

						{customerToEdit ? (
							<EditCustomerDialog
								open={isCreateCustomerOpen}
								onOpenChange={setIsCreateCustomerOpen}
								customer={customerToEdit}
								onSaved={(customer) => {
									setSelectedCustomer(customer)
									setIsCpfPopoverOpen(false)
									formik.setFieldValue('customerId', customer.id)
									formik.setFieldValue('document', getCustomerDocumentDigits(customer))
								}}
							/>
						) : (
							<CreateCustomerDialog
								open={isCreateCustomerOpen}
								onOpenChange={setIsCreateCustomerOpen}
								initialDocumentDigits={createCustomerInitialDocumentDigits}
								mode="create"
								onCreated={(customer) => {
									setSelectedCustomer(customer)
									setIsCpfPopoverOpen(false)
									formik.setFieldValue('customerId', customer.id)
									formik.setFieldValue('document', getCustomerDocumentDigits(customer))
								}}
							/>
						)}

					</>
				)}
			</Formik>
		</div>
	)
}

