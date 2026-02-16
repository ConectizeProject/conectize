'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Formik, Form, Field, FieldArray } from 'formik'
import * as Yup from 'yup'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { PatternLockInput } from '@/components/pattern-lock/PatternLockInput'
import { CreateCustomerDialog, EditCustomerDialog, type CustomerHit } from '@/components/customers'
import { NovaOrdemCustomerCard } from './NovaOrdemCustomerCard'
import { portalFetch } from '@/lib/portal/portal-fetch'

type DeviceModel = {
	id: string
	brand: string
	device_type: string
	model: string
}

type ServiceLine = {
	id: string
	description: string
	value: string
	cost: string
}

const statusOptions = [
	{ value: 'orcamento', label: 'Orçamento' },
	{ value: 'aprovado', label: 'Aprovado' },
] as const

function onlyDigits(value: string) {
	return value.replace(/\D/g, '')
}

function makeId() {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	return String(Date.now()) + String(Math.random()).slice(2)
}

function parseMoneyToCents(value: string) {
	const cleaned = String(value || '')
		.trim()
		.replace(/\s/g, '')
		.replace(/\./g, '')
		.replace(',', '.')
		.replace(/[^0-9.-]/g, '')

	const n = Number.parseFloat(cleaned)
	if (!Number.isFinite(n)) return 0
	if (n <= 0) return 0
	return Math.round(n * 100)
}

function formatCentsBr(cents: number) {
	const n = Number(cents || 0) / 100
	return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatMoneyInputBr(value: string) {
	const digits = String(value || '').replace(/\D/g, '').slice(0, 12) // até 9999999999,99
	if (!digits) return ''

	const cents = Number.parseInt(digits, 10)
	if (!Number.isFinite(cents) || cents <= 0) return '0,00'

	const n = cents / 100
	return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCpf(value: string) {
	const digits = onlyDigits(value).slice(0, 11)
	const p1 = digits.slice(0, 3)
	const p2 = digits.slice(3, 6)
	const p3 = digits.slice(6, 9)
	const p4 = digits.slice(9, 11)
	const head = [p1, p2, p3].filter(Boolean).join('.')
	if (p4) return `${head}-${p4}`
	return head
}

function formatCnpj(value: string) {
	const digits = onlyDigits(value).slice(0, 14)
	const p1 = digits.slice(0, 2)
	const p2 = digits.slice(2, 5)
	const p3 = digits.slice(5, 8)
	const p4 = digits.slice(8, 12)
	const p5 = digits.slice(12, 14)

	const head = [p1, p2, p3].filter(Boolean).join('.')
	if (!head) return ''

	if (p4) {
		if (p5) return `${head}/${p4}-${p5}`
		return `${head}/${p4}`
	}
	return head
}

function formatCpfCnpj(value: string) {
	const digits = onlyDigits(value).slice(0, 14)
	if (digits.length <= 11) return formatCpf(digits)
	return formatCnpj(digits)
}

function getCustomerDocumentDigits(customer: CustomerHit) {
	return onlyDigits(String(customer.cnpj || customer.cpf || '')).slice(0, 14)
}

function uniqueSorted(values: string[]) {
	return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

type Props = {
	action: (formData: FormData) => void
	initialError?: string
	sellerName: string
}

type FormValues = {
	customerId: string
	document: string
	title: string
	status: string
	deviceModelId: string
	brand: string
	model: string
	deviceType: string
	imei: string
	isWarranty: boolean
	estimatedReadyAt: string
	passcodeType: string
	passcodeText: string
	passcodePattern: string
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
	deviceModelId: '',
	brand: '',
	model: '',
	deviceType: '',
	imei: '',
	isWarranty: false,
	estimatedReadyAt: '',
	passcodeType: 'none',
	passcodeText: '',
	passcodePattern: '',
	customerDescription: '',
	internalDescription: '',
	receivingNotes: '',
	services: [],
}

const orderFormSchema = Yup.object().shape({
	customerId: Yup.string().required('Selecione um cliente (CPF/CNPJ)'),
	title: Yup.string().trim().required('Título é obrigatório').min(2, 'Título deve ter pelo menos 2 caracteres'),
	status: Yup.string().oneOf(['orcamento', 'aprovado'], 'Status inválido').required('Status é obrigatório'),
})

export function NovaOrdemClient(props: Props) {
	const [documentInput, setDocumentInput] = useState('')
	const documentDigits = useMemo(() => onlyDigits(documentInput).slice(0, 14), [documentInput])
	const documentPrefix = useMemo(() => documentDigits.slice(0, 5), [documentDigits])

	const [customersBase, setCustomersBase] = useState<CustomerHit[]>([])
	const [isSearchingDocument, setIsSearchingDocument] = useState(false)
	const [documentSearchError, setDocumentSearchError] = useState<string | null>(null)
	const [lastPrefixFetched, setLastPrefixFetched] = useState<string | null>(null)
	const cpfSearchAbortRef = useRef<AbortController | null>(null)
	const cpfSearchInFlightPrefixRef = useRef<string | null>(null)
	const cpfSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(null)

	const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false)
	const [createCustomerInitialDocumentDigits, setCreateCustomerInitialDocumentDigits] = useState('')
	const [customerToEdit, setCustomerToEdit] = useState<CustomerHit | null>(null)

	const [isCpfPopoverOpen, setIsCpfPopoverOpen] = useState(false)

	const [deviceModels, setDeviceModels] = useState<DeviceModel[]>([])
	const [deviceModelsError, setDeviceModelsError] = useState<string | null>(null)
	const [isLoadingDeviceModels, setIsLoadingDeviceModels] = useState(false)


	const brands = useMemo(() => uniqueSorted(deviceModels.map(d => d.brand)), [deviceModels])

	const [isCreateDeviceOpen, setIsCreateDeviceOpen] = useState(false)
	const [isCreatingDevice, setIsCreatingDevice] = useState(false)
	const [newDeviceBrand, setNewDeviceBrand] = useState('')
	const [newDeviceType, setNewDeviceType] = useState('')
	const [newDeviceModel, setNewDeviceModel] = useState('')
	const [createDeviceError, setCreateDeviceError] = useState<string | null>(null)

	useEffect(() => {
		if (!selectedCustomer) return
		const doc = getCustomerDocumentDigits(selectedCustomer)
		if (doc && doc !== documentDigits) {
			setDocumentInput(formatCpfCnpj(doc))
		}
	}, [documentDigits, selectedCustomer])

	useEffect(() => {
		let cancelled = false

		async function run() {
			setDeviceModelsError(null)
			setIsLoadingDeviceModels(true)

			try {
				const res = await portalFetch('/api/portal/device-models?limit=2000')
				const data = await res.json().catch(() => null)
				if (!res.ok || !data?.ok) {
					if (!cancelled) setDeviceModelsError('Não foi possível carregar o catálogo de dispositivos.')
					return
				}
				if (!cancelled) setDeviceModels(data.deviceModels || [])
			} catch (err) {
				if (!cancelled) setDeviceModelsError('Não foi possível carregar o catálogo de dispositivos.')
			} finally {
				if (!cancelled) setIsLoadingDeviceModels(false)
			}
		}

		run()
		return () => {
			cancelled = true
		}
	}, [])

	useEffect(() => {
		if (documentDigits.length < 5) {
			setDocumentSearchError(null)
			setCustomersBase([])
			setLastPrefixFetched(null)
			cpfSearchAbortRef.current?.abort()
			cpfSearchAbortRef.current = null
			cpfSearchInFlightPrefixRef.current = null
			if (cpfSearchDebounceRef.current) {
				clearTimeout(cpfSearchDebounceRef.current)
				cpfSearchDebounceRef.current = null
			}
			setIsSearchingDocument(false)
			return
		}

		if (documentPrefix.length < 5) return
		if (documentPrefix === lastPrefixFetched) return
		if (cpfSearchInFlightPrefixRef.current === documentPrefix) return

		let cancelled = false

		async function run() {
			cpfSearchAbortRef.current?.abort()
			const controller = new AbortController()
			cpfSearchAbortRef.current = controller
			cpfSearchInFlightPrefixRef.current = documentPrefix

			setIsSearchingDocument(true)
			setDocumentSearchError(null)

			try {
				const res = await portalFetch(`/api/portal/customers/search?documentPrefix=${documentPrefix}`, {
					signal: controller.signal
				})
				const data = await res.json().catch(() => null)
				if (!res.ok || !data?.ok) {
					if (!cancelled) {
						setDocumentSearchError('Não foi possível buscar clientes agora.')
						setCustomersBase([])
						setLastPrefixFetched(documentPrefix)
					}
					return
				}

				if (!cancelled) {
					setCustomersBase(data.customers || [])
					setLastPrefixFetched(documentPrefix)
				}
			} catch (err: any) {
				if (err?.name === 'AbortError') return
				if (!cancelled) {
					setDocumentSearchError('Não foi possível buscar clientes agora.')
					setCustomersBase([])
					setLastPrefixFetched(documentPrefix)
				}
			} finally {
				if (!cancelled) setIsSearchingDocument(false)
				if (cpfSearchInFlightPrefixRef.current === documentPrefix) {
					cpfSearchInFlightPrefixRef.current = null
				}
			}
		}

		if (cpfSearchDebounceRef.current) {
			clearTimeout(cpfSearchDebounceRef.current)
			cpfSearchDebounceRef.current = null
		}

		setIsSearchingDocument(false)
		cpfSearchDebounceRef.current = setTimeout(() => {
			if (cancelled) return
			run()
		}, 350)

		return () => {
			cancelled = true
			if (cpfSearchDebounceRef.current) {
				clearTimeout(cpfSearchDebounceRef.current)
				cpfSearchDebounceRef.current = null
			}
		}
	}, [documentDigits.length, documentPrefix, lastPrefixFetched])

	const hasFetchedDocPrefix = documentDigits.length >= 5 && lastPrefixFetched === documentPrefix

	const customersFiltered = useMemo(() => {
		if (documentDigits.length < 5) return []
		if (!hasFetchedDocPrefix) return []
		return customersBase.filter(c => getCustomerDocumentDigits(c).startsWith(documentDigits))
	}, [documentDigits, customersBase, hasFetchedDocPrefix])

	async function handleCreateDeviceModel(setFieldValue: (field: string, value: unknown) => void) {
		setIsCreatingDevice(true)
		setCreateDeviceError(null)

		try {
			const res = await portalFetch('/api/portal/device-models', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					brand: newDeviceBrand.trim(),
					deviceType: newDeviceType.trim(),
					model: newDeviceModel.trim(),
				}),
			})
			const data = await res.json().catch(() => null)
			if (!res.ok || !data?.ok || !data?.deviceModel?.id) {
				setCreateDeviceError('Não foi possível cadastrar o dispositivo.')
				return
			}

			const dm = data.deviceModel as DeviceModel
			setDeviceModels((prev) => {
				const exists = prev.some(p => p.id === dm.id)
				if (exists) return prev
				return prev.concat(dm)
			})

			setFieldValue('brand', dm.brand)
			setFieldValue('deviceType', dm.device_type)
			setFieldValue('deviceModelId', dm.id)
			setFieldValue('model', dm.model)
			setIsCreateDeviceOpen(false)
		} catch (err) {
			setCreateDeviceError('Não foi possível cadastrar o dispositivo.')
		} finally {
			setIsCreatingDevice(false)
		}
	}

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
		fd.append('title', values.title)
		fd.append('status', values.status)
		fd.append('imei', values.imei)
		fd.append('estimatedReadyAt', values.estimatedReadyAt)
		fd.append('customerDescription', values.customerDescription)
		fd.append('internalDescription', values.internalDescription)
		fd.append('receivingNotes', values.receivingNotes)
		fd.append('servicesJson', servicesJson)
		return fd
	}

	return (
		<div className="max-w-4xl space-y-6">

			<div>
				<h1 className="text-2xl font-bold">Nova ordem de serviço</h1>
				<p className="text-sm text-muted-foreground">
					Busque o cliente por CPF/CNPJ e preencha os dados da OS.
				</p>
			</div>

			<Formik
				initialValues={initialFormValues}
				validationSchema={orderFormSchema}
				onSubmit={async (values) => {
					const fd = buildFormDataFromValues(values, documentDigits)
					await props.action(fd)
				}}
			>
				{(formik) => {
					const deviceTypes = !formik.values.brand ? [] : uniqueSorted(deviceModels.filter(d => d.brand === formik.values.brand).map(d => d.device_type))
					const models = !formik.values.brand || !formik.values.deviceType ? [] : deviceModels.filter(d => d.brand === formik.values.brand && d.device_type === formik.values.deviceType)
					const servicesNormalized = (formik.values.services || [])
						.map((s) => ({
							description: String(s.description || '').trim(),
							valueCents: parseMoneyToCents(s.value),
							costCents: parseMoneyToCents(s.cost),
						}))
						.filter((s) => s.description || s.valueCents > 0 || s.costCents > 0)
					const servicesTotals = servicesNormalized.reduce(
						(acc, s) => ({ totalValueCents: acc.totalValueCents + s.valueCents, totalCostCents: acc.totalCostCents + s.costCents }),
						{ totalValueCents: 0, totalCostCents: 0 }
					)

					return (
						<>
						<Form className="relative space-y-6">
							<NovaOrdemCustomerCard
								selectedCustomer={selectedCustomer}
								documentInput={documentInput}
								documentDigits={documentDigits}
								onDocumentInputChange={setDocumentInput}
								isCpfPopoverOpen={isCpfPopoverOpen}
								onCpfPopoverOpenChange={setIsCpfPopoverOpen}
								customersFiltered={customersFiltered}
								isSearchingDocument={isSearchingDocument}
								documentSearchError={documentSearchError}
								hasFetchedDocPrefix={hasFetchedDocPrefix}
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
									<CardTitle>Dados da ordem</CardTitle>
									<CardDescription>Dispositivo, status, serviços e demais informações.</CardDescription>
								</CardHeader>
								<CardContent className="relative space-y-6">
									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-2">
											<Label>Vendedor</Label>
											<Input value={props.sellerName} readOnly />
										</div>
										<div className="space-y-2">
											<Label htmlFor="status">Status</Label>
											<Field
												as="select"
												id="status"
												name="status"
												className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
											>
												{statusOptions.map(s => (
													<option key={s.value} value={s.value}>{s.label}</option>
												))}
											</Field>
										</div>
									</div>

									<div className="grid gap-4 md:grid-cols-2">
										<div className="space-y-2">
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
											<Label htmlFor="estimatedReadyAt">Previsão (data e hora)</Label>
											<Field as={Input} id="estimatedReadyAt" name="estimatedReadyAt" type="datetime-local" />
										</div>
									</div>

									<div className="grid gap-4 md:grid-cols-2">
										<div className="flex items-center gap-2 rounded-md border p-3">
											<Checkbox
												id="isWarranty"
												checked={formik.values.isWarranty}
												onCheckedChange={(v) => formik.setFieldValue('isWarranty', !!v)}
											/>
											<Label htmlFor="isWarranty" className="cursor-pointer">Serviço em garantia</Label>
										</div>
									</div>

									<div className="grid gap-4 md:grid-cols-3">
										<div className="space-y-2">
											<Label>Marca</Label>
											<Field
												as="select"
												className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
												name="brand"
												disabled={isLoadingDeviceModels}
												onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
													formik.setFieldValue('brand', e.target.value)
													formik.setFieldValue('deviceType', '')
													formik.setFieldValue('deviceModelId', '')
													formik.setFieldValue('model', '')
												}}
											>
												<option value="">Selecione…</option>
												{brands.map(b => (
													<option key={b} value={b}>{b}</option>
												))}
											</Field>
										</div>
										<div className="space-y-2">
											<Label>Dispositivo</Label>
											<Field
												as="select"
												className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
												name="deviceType"
												disabled={!formik.values.brand || isLoadingDeviceModels}
												onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
													formik.setFieldValue('deviceType', e.target.value)
													formik.setFieldValue('deviceModelId', '')
													formik.setFieldValue('model', '')
												}}
											>
												<option value="">Selecione…</option>
												{deviceTypes.map(t => (
													<option key={t} value={t}>{t}</option>
												))}
											</Field>
										</div>
										<div className="space-y-2">
											<Label>Modelo</Label>
											<Field
												as="select"
												className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
												name="deviceModelId"
												disabled={!formik.values.brand || !formik.values.deviceType || isLoadingDeviceModels}
												onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
													const id = e.target.value
													const m = deviceModels.find(d => d.id === id)
													formik.setFieldValue('deviceModelId', id)
													if (m) {
														formik.setFieldValue('model', m.model)
													}
												}}
											>
												<option value="">Selecione…</option>
												{models.map(m => (
													<option key={m.id} value={m.id}>{m.model}</option>
												))}
											</Field>
										</div>
									</div>

									{deviceModelsError ? (
										<p className="text-sm text-destructive">{deviceModelsError}</p>
									) : null}

									<div className="flex items-center justify-end">
										<Button
											type="button"
											variant="outline"
											onClick={() => {
												setCreateDeviceError(null)
												setNewDeviceBrand(formik.values.brand)
												setNewDeviceType(formik.values.deviceType)
												setNewDeviceModel('')
												setIsCreateDeviceOpen(true)
											}}
										>
											<Plus className="h-4 w-4 mr-2" />
											Cadastrar novo dispositivo
										</Button>
									</div>

									<div className="rounded-md border p-4 space-y-3">
										<div className="flex items-center justify-between gap-3 flex-wrap">
											<div>
												<div className="text-sm font-medium">Senha do aparelho</div>
												<div className="text-xs text-muted-foreground">Texto ou padrão (desenho)</div>
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
												<Label>Senha (padrão)</Label>
												<PatternLockInput
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

									<div className="space-y-2">
										<Label htmlFor="imei">Número de série / IMEI</Label>
										<Field as={Input} id="imei" name="imei" placeholder="Digite o número" />
									</div>

									<div className="space-y-2">
										<Label htmlFor="customerDescription">Descrição</Label>
										<Field as={Textarea} id="customerDescription" name="customerDescription" placeholder="Texto que o cliente vê" />
									</div>

									<div className="rounded-md border p-4 space-y-3">
										<div className="flex items-center justify-between gap-3 flex-wrap">
											<div>
												<div className="text-sm font-medium">Serviços a realizar</div>
												<div className="text-xs text-muted-foreground">Adicione 1 ou mais serviços com valores.</div>
											</div>
											<FieldArray name="services">
												{({ push, remove }) => (
													<>
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={() => push({ id: makeId(), description: '', value: '', cost: '' })}
														>
															<Plus className="h-4 w-4 mr-2" />
															Adicionar serviço
														</Button>
														{formik.values.services && formik.values.services.length > 0 ? (
															<div className="space-y-3 mt-3">
																{formik.values.services.map((s, idx) => (
																	<div key={s.id} className="grid gap-3 md:grid-cols-12 items-end">
																		<div className="md:col-span-6 space-y-1">
																			<Label>Descrição</Label>
																			<Field as={Input} name={`services.${idx}.description`} placeholder="Ex: Troca de tela, diagnóstico, limpeza..." />
																		</div>
																		<div className="md:col-span-2 space-y-1">
																			<Label>Valor</Label>
																			<Input
																				value={formik.values.services?.[idx]?.value ?? ''}
																				onChange={(e) => formik.setFieldValue(`services.${idx}.value`, formatMoneyInputBr(e.target.value))}
																				inputMode="numeric"
																				placeholder="0,00"
																			/>
																		</div>
																		<div className="md:col-span-2 space-y-1">
																			<Label>Valor de custo</Label>
																			<Input
																				value={formik.values.services?.[idx]?.cost ?? ''}
																				onChange={(e) => formik.setFieldValue(`services.${idx}.cost`, formatMoneyInputBr(e.target.value))}
																				inputMode="numeric"
																				placeholder="0,00"
																			/>
																		</div>
																		<div className="md:col-span-2 flex justify-end">
																			<Button type="button" variant="outline" size="sm" onClick={() => remove(idx)}>
																				Remover
																			</Button>
																		</div>
																		{idx !== formik.values.services!.length - 1 ? <div className="md:col-span-12 border-t" /> : null}
																	</div>
																))}
															</div>
														) : null}
													</>
												)}
											</FieldArray>
										</div>
										{formik.values.services && formik.values.services.length > 0 ? (
											<div className="flex items-center justify-end gap-6 flex-wrap pt-2 border-t">
												<div className="text-sm">
													<span className="text-muted-foreground">Total serviços: </span>
													<span className="font-medium">{formatCentsBr(servicesTotals.totalValueCents)}</span>
												</div>
												<div className="text-sm">
													<span className="text-muted-foreground">Total custo: </span>
													<span className="font-medium">{formatCentsBr(servicesTotals.totalCostCents)}</span>
												</div>
												<div className="text-sm">
													<span className="text-muted-foreground">Resultado: </span>
													<span className="font-medium">{formatCentsBr(servicesTotals.totalValueCents - servicesTotals.totalCostCents)}</span>
												</div>
											</div>
										) : (
											<div className="text-sm text-muted-foreground">
												Nenhum serviço adicionado ainda.
											</div>
										)}
									</div>

									<div className="space-y-2">
										<Label htmlFor="receivingNotes">Observações do recebimento</Label>
										<Field as={Textarea} id="receivingNotes" name="receivingNotes" placeholder="Checklist, avarias, acessórios, etc." />
									</div>

									<div className="space-y-2">
										<Label htmlFor="internalDescription">Descrição interna</Label>
										<Field as={Textarea} id="internalDescription" name="internalDescription" placeholder="Anotações internas" />
									</div>

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
								}}
							/>
						)}

						<Dialog open={isCreateDeviceOpen} onOpenChange={setIsCreateDeviceOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Cadastrar dispositivo</DialogTitle>
						<DialogDescription>
							Adicione um novo modelo ao catálogo.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4">
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label>Marca</Label>
								<Input value={newDeviceBrand} onChange={(e) => setNewDeviceBrand(e.target.value)} placeholder="Ex: Apple" />
							</div>
							<div className="space-y-2">
								<Label>Dispositivo</Label>
								<Input value={newDeviceType} onChange={(e) => setNewDeviceType(e.target.value)} placeholder="Ex: smartphone" />
							</div>
						</div>
						<div className="space-y-2">
							<Label>Modelo</Label>
							<Input value={newDeviceModel} onChange={(e) => setNewDeviceModel(e.target.value)} placeholder="Ex: iPhone 13" />
						</div>
						{createDeviceError ? (
							<p className="text-sm text-destructive">{createDeviceError}</p>
						) : null}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setIsCreateDeviceOpen(false)}>
							Cancelar
						</Button>
						<Button type="button" onClick={() => handleCreateDeviceModel(formik.setFieldValue)} disabled={isCreatingDevice}>
							{isCreatingDevice ? 'Salvando…' : 'Salvar dispositivo'}
						</Button>
					</DialogFooter>
				</DialogContent>
						</Dialog>
					</>
					)
				}}
			</Formik>
		</div>
	)
}

