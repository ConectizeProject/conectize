'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDateBr } from '@/lib/utils/format-date'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { getLabelWindowFeatures } from '@/lib/ordem-print'
import { toast } from '@/hooks/use-toast'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { BarChart3, Copy, Calculator, ChevronDown, ChevronRight, DollarSign, Eye, EyeOff, MessageCircle, MoreHorizontal, Package, Plus, Receipt, Store, Tag, TrendingUp, Trash2, Undo2, UserRound, Wrench, FileInput } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import type { ResaleDeviceRow, SeminovosFilters, SeminovosStats } from '@/lib/seminovos/fetch-seminovos-data'
import {
	buildCopyClienteText,
	buildCopyLojistaText,
	buildSeminovoLabelHtml,
} from '@/lib/seminovos/seminovos-device-actions'
import { DeviceBadges } from './DeviceBadges'
import { SeminovoDeviceCard } from './SeminovoDeviceCard'
import { SeminovosFilterCollapsible } from './SeminovosFilterCollapsible'
import { ResaleDeviceTermsDialog } from './ResaleDeviceTermsDialog'
import { SeminovosSubmenu } from './SeminovosSubmenu'
import {
	ResaleSellCommissionPanel,
	type ResaleSellCommissionPanelRef,
	type SellCommissionInitial,
} from './ResaleSellCommissionPanel'
import {
	buildCommissionCostDescription,
	isCommissionCostDescription,
	isSaleDerivedCostDescription,
} from '@/lib/resale/resale-sale-costs'
import {
	commissionFromPercentOfGrossCents,
	grossProfitBeforeCommissionCents,
	paymentFeeCentsForSaleEntries,
} from '@/lib/resale/resale-commission'

const EMPTY_SELL_COMMISSION_INITIAL: SellCommissionInitial = {
	enabled: false,
	userId: '',
	kind: 'percent',
	percentRaw: '',
	fixedMasked: '',
}

type CostRow = { id?: string; description: string; value_cents: number }

type CreditInstallmentFee = { installments: number; fee_percent: number }

type PaymentMethod = {
	id: string
	description: string
	type: string
	fee_percent: number
	credit_installment_fees: CreditInstallmentFee[]
	sort_order: number
}

type ResaleDevice = {
	id: string
	device_name: string | null
	model: string | null
	color: string | null
	storage_gb: string | null
	battery: string | null
	condition: string | null
	info: string | null
	imei: string | null
	imei2?: string | null
	serial?: string | null
	purchase_value_cents: number | null
	wholesale_value_cents: number | null
	sale_value_cents: number | null
	sold_for_cents: number | null
	actual_profit_cents?: number | null
	expected_profit_wholesale_cents: number | null
	expected_profit_sale_cents?: number | null
	advertised: boolean
	tested: boolean
	label: string | null
	sold: boolean
	purchase_date: string | null
	sale_date: string | null
	costs: CostRow[]
	payment_method_id?: string | null
	payment_installments?: number | null
	sale_payment_methods?: Array<{ payment_method_id: string; value_cents?: number | null; installments?: number }> | null
	buyer_name?: string | null
	buyer_cpf?: string | null
	sale_details?: string | null
	stock_type?: string | null
	sale_commission_user_id?: string | null
}

type TeamUser = { id: string; email: string | null; full_name: string | null; role: string }

type SalePaymentEntry = { rowKey: string; payment_method_id: string; value_cents: number | null; installments: number }

function makeSalePaymentRowKey (): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `row-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function newEmptySalePaymentRow (): SalePaymentEntry {
	return { rowKey: makeSalePaymentRowKey(), payment_method_id: '', value_cents: null, installments: 1 }
}

function centsToReais(cents: number | null | undefined): string {
	if (cents === null || cents === undefined) return ''
	return maskedFromCents(cents)
}

function getModelSortKey(deviceName: string | null): number {
	if (!deviceName || !deviceName.trim()) return 0
	const name = deviceName.trim()
	const numMatch = name.match(/(\d+)/)
	const num = numMatch ? Number.parseInt(numMatch[1], 10) : 0
	let variant = 1
	if (/\bpro\s+max\b/i.test(name)) variant = 3
	else if (/\bpro\b/i.test(name)) variant = 2
	return num * 10 + variant
}

function parseStorageGb(storage: string | null): number {
	if (!storage || !storage.trim()) return 0
	const num = Number.parseInt(String(storage).replace(/\D/g, ''), 10)
	return Number.isNaN(num) ? 0 : num
}

/** Agrupa dispositivos disponíveis por modelo e ordena: mais recente primeiro, depois mais GB. */
function groupDevicesByModel(list: ResaleDevice[]): Array<{ modelKey: string; devices: ResaleDevice[] }> {
	const byModel = new Map<string, ResaleDevice[]>()
	for (const d of list) {
		const key = (d.device_name || '').trim() || 'Outros'
		if (!byModel.has(key)) byModel.set(key, [])
		byModel.get(key)!.push(d)
	}
	for (const arr of byModel.values()) {
		arr.sort((a, b) => {
			const storageA = parseStorageGb(a.storage_gb)
			const storageB = parseStorageGb(b.storage_gb)
			if (storageA !== storageB) return storageB - storageA
			return (a.device_name || '').localeCompare(b.device_name || '')
		})
	}
	const groups = Array.from(byModel.entries()).map(([modelKey, devices]) => ({ modelKey, devices }))
	groups.sort((a, b) => {
		const keyA = getModelSortKey(a.modelKey)
		const keyB = getModelSortKey(b.modelKey)
		if (keyA !== keyB) return keyB - keyA
		const maxStorageA = Math.max(...a.devices.map((d) => parseStorageGb(d.storage_gb)))
		const maxStorageB = Math.max(...b.devices.map((d) => parseStorageGb(d.storage_gb)))
		if (maxStorageA !== maxStorageB) return maxStorageB - maxStorageA
		return a.modelKey.localeCompare(b.modelKey)
	})
	return groups
}

function sortSoldDevices(list: ResaleDevice[]): ResaleDevice[] {
	return [...list].sort((a, b) => {
		const dateA = a.sale_date || ''
		const dateB = b.sale_date || ''
		if (dateA !== dateB) return dateB.localeCompare(dateA)
		return (a.id || '').localeCompare(b.id || '')
	})
}
type SeminovosListClientProps = {
	initialDevices: ResaleDeviceRow[]
	initialStats: SeminovosStats
	filterInitialValues: SeminovosFilters
	role: string
}

export function SeminovosListClient({
	initialDevices,
	initialStats,
	filterInitialValues,
	role,
}: SeminovosListClientProps) {
	const isAdmin = role === 'admin'
	const router = useRouter()
	const searchParams = useSearchParams()
	const novaDeviceHref =
		searchParams.get('tipo') === 'lacrados'
			? '/portal/seminovos/nova?tipo=lacrados'
			: '/portal/seminovos/nova'
	const hasFilters = Boolean(
		filterInitialValues.q ||
		filterInitialValues.condition ||
		filterInitialValues.storageGb ||
		filterInitialValues.color ||
		filterInitialValues.purchaseDateFrom ||
		filterInitialValues.purchaseDateTo
	)

	const [devices, setDevices] = useState<ResaleDevice[]>(initialDevices as ResaleDevice[])
	const [isLoading] = useState(false)
	const [deleteTarget, setDeleteTarget] = useState<ResaleDevice | null>(null)
	const [isDeleting, setIsDeleting] = useState(false)
	const [isBulkEdit, setIsBulkEdit] = useState(false)
	const [isSavingBulk, setIsSavingBulk] = useState(false)
	const [editedDevices, setEditedDevices] = useState<ResaleDevice[]>([])
	const [sellModalTarget, setSellModalTarget] = useState<ResaleDevice | null>(null)
	const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
	const sellCommissionPanelRef = useRef<ResaleSellCommissionPanelRef>(null)
	const [commissionBoot, setCommissionBoot] = useState<{ seq: number; initial: SellCommissionInitial }>({
		seq: 0,
		initial: EMPTY_SELL_COMMISSION_INITIAL,
	})
	const [sellDate, setSellDate] = useState('')
	const [isSavingSell, setIsSavingSell] = useState(false)
	const [sellPaymentMethods, setSellPaymentMethods] = useState<SalePaymentEntry[]>([])
	const [sellGenerateWarrantyTerm, setSellGenerateWarrantyTerm] = useState(false)
	const [sellBuyerName, setSellBuyerName] = useState('')
	const [sellBuyerCpf, setSellBuyerCpf] = useState('')
	const [sellSaleDetails, setSellSaleDetails] = useState('')
	const [costModalTarget, setCostModalTarget] = useState<ResaleDevice | null>(null)
	const [costDescription, setCostDescription] = useState('')
	const [costValue, setCostValue] = useState('')
	const [isSavingCost, setIsSavingCost] = useState(false)
	const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
	const [whatsAppText, setWhatsAppText] = useState('')
	const [showPurchaseValue, setShowPurchaseValue] = useState(true)
	const [showWholesaleValue, setShowWholesaleValue] = useState(true)
	const [simulateModalTarget, setSimulateModalTarget] = useState<ResaleDevice | null>(null)
	const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
	const [simulatePaymentMethodId, setSimulatePaymentMethodId] = useState<string>('')
	const [simulateInstallments, setSimulateInstallments] = useState<number>(1)
	const [simulateValueSource, setSimulateValueSource] = useState<'varejo' | 'atacado' | 'custom'>('varejo')
	const [simulateValue, setSimulateValue] = useState('')
	const [soldDevices, setSoldDevices] = useState<ResaleDevice[]>([])
	const [soldCollapsibleOpen, setSoldCollapsibleOpen] = useState(false)
	const [overviewCollapsibleOpen, setOverviewCollapsibleOpen] = useState(false)
	const [isLoadingSold, setIsLoadingSold] = useState(false)
	const [stats, setStats] = useState<SeminovosStats | null>(initialStats)
	const [termsDevice, setTermsDevice] = useState<ResaleDevice | null>(null)
	const [showTermsDialog, setShowTermsDialog] = useState(false)
	const [filterNotTested, setFilterNotTested] = useState(false)
	const [filterNotAdvertised, setFilterNotAdvertised] = useState(false)
	const [filterNoLabel, setFilterNoLabel] = useState(false)
	const [filterWithInfo, setFilterWithInfo] = useState(false)

	useEffect(() => {
		setDevices(initialDevices as ResaleDevice[])
		setStats(initialStats)
	}, [initialDevices, initialStats])

	const loadSoldDevices = useCallback(async () => {
		setIsLoadingSold(true)
		try {
			const res = await portalFetch('/api/portal/resale-devices?sold=true')
			const data = await res?.json().catch(() => null)
			if (data?.ok && Array.isArray(data.devices)) {
				setSoldDevices(data.devices)
			}
		} catch {
			setSoldDevices([])
		} finally {
			setIsLoadingSold(false)
		}
	}, [])

	useEffect(() => {
		if (soldCollapsibleOpen && soldDevices.length === 0 && !isLoadingSold) {
			loadSoldDevices()
		}
	}, [soldCollapsibleOpen, soldDevices.length, isLoadingSold, loadSoldDevices])

	useEffect(() => {
		if (isBulkEdit) {
			const grouped = groupDevicesByModel(devices)
			setEditedDevices(grouped.flatMap((g) => g.devices))
		}
	}, [devices, isBulkEdit])

	async function handleDelete() {
		if (!deleteTarget || isDeleting) return
		setIsDeleting(true)
		try {
			const res = await portalFetch(`/api/portal/resale-devices/${deleteTarget.id}`, { method: 'DELETE' })
			const data = await res?.json().catch(() => null)
			if (data?.ok) {
				router.refresh()
				setDeleteTarget(null)
			}
		} finally {
			setIsDeleting(false)
		}
	}

	const groupedAvailableAll = groupDevicesByModel(devices)
	const flatAvailableAll = groupedAvailableAll.flatMap((g) => g.devices)

	const filteredDevices = devices.filter((d) => {
		if (filterNotTested && d.tested) return false
		if (filterNotAdvertised && d.advertised) return false
		if (filterNoLabel && d.label) return false
		if (filterWithInfo && !d.info) return false
		return true
	})

	const groupedAvailable = groupDevicesByModel(filteredDevices)
	const flatAvailable = groupedAvailable.flatMap((g) => g.devices)
	const rows = isBulkEdit ? editedDevices : flatAvailable

	function updateRow<K extends keyof ResaleDevice>(id: string, field: K, value: ResaleDevice[K]) {
		setEditedDevices((prev) =>
			prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
		)
	}

	function updateMoney<K extends keyof ResaleDevice>(id: string, field: K, raw: string) {
		const masked = formatMoneyInput(raw)
		const cents = moneyToCentsFromMasked(masked)
		setEditedDevices((prev) =>
			prev.map((d) =>
				d.id === id ? { ...d, [field]: (cents ?? null) as ResaleDevice[K] } : d
			)
		)
	}

	async function handleStartBulkEdit() {
		setEditedDevices(groupDevicesByModel(devices).flatMap((g) => g.devices))
		setIsBulkEdit(true)
	}

	function handleCancelBulkEdit() {
		setIsBulkEdit(false)
		setEditedDevices(groupDevicesByModel(devices).flatMap((g) => g.devices))
	}

	function getChangedUpdates(): Array<{ id: string } & Record<string, unknown>> {
		const originalMap = new Map(flatAvailableAll.map((d) => [d.id, d]))
		const updates: Array<{ id: string } & Record<string, unknown>> = []
		for (const edited of editedDevices) {
			const orig = originalMap.get(edited.id)
			if (!orig) continue
			const changed: Record<string, unknown> = {}
			const fields: (keyof ResaleDevice)[] = [
				'device_name', 'color', 'storage_gb', 'battery', 'condition', 'info', 'imei',
				'purchase_date', 'sale_date', 'purchase_value_cents', 'wholesale_value_cents', 'sale_value_cents', 'sold_for_cents',
			]
			for (const k of fields) {
				const v = edited[k]
				const o = orig[k]
				if (v !== o && (v != null || o != null) && String(v ?? '') !== String(o ?? '')) {
					changed[k] = v
				}
			}
			if (Object.keys(changed).length > 0) {
				updates.push({ id: edited.id, ...changed })
			}
		}
		return updates
	}

	async function handleSaveBulkEdit() {
		if (!isBulkEdit || isSavingBulk) return
		const updates = getChangedUpdates()
		if (updates.length === 0) {
			setIsBulkEdit(false)
			return
		}
		setIsSavingBulk(true)
		try {
			const res = await portalFetch('/api/portal/resale-devices/bulk', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ updates }),
			})
			const data = await res?.json().catch(() => null)
			if (data?.ok) {
				router.refresh()
				setIsBulkEdit(false)
			} else if (data?.error === 'partial_failure' && data?.results) {
				const failed = (data.results as { id: string; ok: boolean }[]).filter((r: { ok: boolean }) => !r.ok)
				if (failed.length > 0) {
					console.error('Erro ao salvar alguns itens:', failed)
				}
				router.refresh()
				setIsBulkEdit(false)
			}
		} finally {
			setIsSavingBulk(false)
		}
	}

	function openSellModal(d: ResaleDevice) {
		const pms = Array.isArray(d.sale_payment_methods) && d.sale_payment_methods.length > 0
			? d.sale_payment_methods.map((e) => ({
				rowKey: makeSalePaymentRowKey(),
				payment_method_id: String(e.payment_method_id ?? ''),
				value_cents: e.value_cents != null ? Number(e.value_cents) : null,
				installments: e.installments != null ? Math.max(1, Number(e.installments)) : 1,
			}))
			: (d.payment_method_id
				? [{ rowKey: makeSalePaymentRowKey(), payment_method_id: d.payment_method_id, value_cents: null, installments: d.payment_installments ?? 1 }]
				: [newEmptySalePaymentRow()])
		setSellPaymentMethods(pms.length > 0 ? pms : [newEmptySalePaymentRow()])
		setSellDate(new Date().toISOString().slice(0, 10))
		setSellGenerateWarrantyTerm(false)
		setSellBuyerName('')
		setSellBuyerCpf('')
		setSellSaleDetails('')
		setCommissionBoot((b) => ({ seq: b.seq + 1, initial: EMPTY_SELL_COMMISSION_INITIAL }))
		loadPaymentMethods()
		loadTeamUsers()
		setSellModalTarget(d)
	}

	function openEditSellModal(d: ResaleDevice) {
		const soldCents = d.sold_for_cents ?? null
		const pms = Array.isArray(d.sale_payment_methods) && d.sale_payment_methods.length > 0
			? d.sale_payment_methods.map((e) => ({
				rowKey: makeSalePaymentRowKey(),
				payment_method_id: String(e.payment_method_id ?? ''),
				value_cents: e.value_cents != null ? Number(e.value_cents) : null,
				installments: e.installments != null ? Math.max(1, Number(e.installments)) : 1,
			}))
			: (d.payment_method_id
				? [{ rowKey: makeSalePaymentRowKey(), payment_method_id: d.payment_method_id, value_cents: soldCents, installments: d.payment_installments ?? 1 }]
				: [newEmptySalePaymentRow()])
		setSellPaymentMethods(pms.length > 0 ? pms : [newEmptySalePaymentRow()])
		setSellDate(d.sale_date || new Date().toISOString().slice(0, 10))
		const hasTermData =
			Boolean((d.buyer_name && d.buyer_name.trim()) ||
				(d.buyer_cpf && d.buyer_cpf.trim()) ||
				(d.sale_details && d.sale_details.trim()))
		setSellGenerateWarrantyTerm(hasTermData)
		setSellBuyerName(d.buyer_name ?? '')
		setSellBuyerCpf(formatCpfCnpj(d.buyer_cpf ?? ''))
		setSellSaleDetails(d.sale_details ?? (hasTermData ? (d.info ?? '') : ''))
		const commLine = (d.costs || []).find((c) => isCommissionCostDescription(c.description))
		const commUserId = d.sale_commission_user_id ?? ''
		const commissionInitial: SellCommissionInitial =
			commLine && commUserId
				? {
					enabled: true,
					userId: commUserId,
					kind: 'fixed',
					percentRaw: '',
					fixedMasked: maskedFromCents(commLine.value_cents ?? 0),
				}
				: EMPTY_SELL_COMMISSION_INITIAL
		setCommissionBoot((b) => ({ seq: b.seq + 1, initial: commissionInitial }))
		loadPaymentMethods()
		loadTeamUsers()
		setSellModalTarget(d)
	}

	function setSellPaymentMethodAt(i: number, upd: Partial<SalePaymentEntry>) {
		setSellPaymentMethods((prev) => {
			const next = [...prev]
			next[i] = { ...next[i], ...upd }
			return next
		})
	}

	function addSellPaymentMethod() {
		setSellPaymentMethods((prev) => [...prev, newEmptySalePaymentRow()])
	}

	function removeSellPaymentMethod(i: number) {
		setSellPaymentMethods((prev) => prev.filter((_, idx) => idx !== i))
	}

	function getSellPaymentsTotalCents (): number | null {
		const valid = sellPaymentMethods.filter((e) => e.payment_method_id?.trim())
		if (valid.length === 0) return null
		let sum = 0
		for (const e of valid) {
			const v = e.value_cents
			if (v == null || v <= 0) return null
			sum += v
		}
		if (sum <= 0) return null
		return sum
	}

	function openCostModal(d: ResaleDevice) {
		setCostDescription('')
		setCostValue('')
		setCostModalTarget(d)
	}

	const loadPaymentMethods = useCallback(async () => {
		const res = await portalFetch('/api/portal/payment-methods')
		const data = await res?.json().catch(() => null)
		if (data?.ok && Array.isArray(data.paymentMethods)) {
			setPaymentMethods(data.paymentMethods)
		}
	}, [])

	const loadTeamUsers = useCallback(async () => {
		const res = await portalFetch('/api/portal/team-users')
		const data = await res?.json().catch(() => null)
		if (data?.ok && Array.isArray(data.users)) {
			setTeamUsers(data.users as TeamUser[])
		}
	}, [])

	function openSimulateModal(d: ResaleDevice) {
		setSimulateModalTarget(d)
		setSimulatePaymentMethodId('')
		setSimulateInstallments(1)
		const varejo = d.sale_value_cents ?? null
		const atacado = d.wholesale_value_cents ?? null
		const source = varejo != null ? 'varejo' : atacado != null ? 'atacado' : 'custom'
		setSimulateValueSource(source)
		setSimulateValue(varejo != null ? centsToReais(varejo) : atacado != null ? centsToReais(atacado) : '')
		loadPaymentMethods()
	}

	function getSimulateBaseValueCents(): number | null {
		const d = simulateModalTarget
		if (!d) return null
		if (simulateValueSource === 'varejo' && d.sale_value_cents != null) return d.sale_value_cents
		if (simulateValueSource === 'atacado' && d.wholesale_value_cents != null) return d.wholesale_value_cents
		return moneyToCentsFromMasked(simulateValue)
	}

	function getSimulateResult(): {
		receiveCents: number
		feePercent: number
		feeCents: number
		chargeCents: number
		installments?: number
		valuePerInstallmentCents?: number
	} | null {
		const receiveCents = getSimulateBaseValueCents()
		if (receiveCents == null || receiveCents <= 0) return null
		const pm = paymentMethods.find((p) => p.id === simulatePaymentMethodId)
		if (!pm) return null

		if (pm.type === 'dinheiro') {
			return { receiveCents, feePercent: 0, feeCents: 0, chargeCents: receiveCents }
		}

		const feePercent = pm.type === 'credito'
			? (() => {
				const fees = Array.isArray(pm.credit_installment_fees) ? pm.credit_installment_fees : []
				const sorted = [...fees].sort((a, b) => a.installments - b.installments)
				const exact = sorted.find((f) => f.installments === simulateInstallments)
				const match = exact ?? sorted.filter((f) => f.installments <= simulateInstallments).pop() ?? sorted[0]
				return match ? match.fee_percent : 0
			})()
			: (pm.fee_percent ?? 0)

		if (feePercent >= 100) return { receiveCents, feePercent, feeCents: 0, chargeCents: receiveCents }

		const chargeCents = Math.round(receiveCents / (1 - feePercent / 100))
		const feeCents = chargeCents - receiveCents

		if (pm.type === 'credito') {
			const valuePerInstallmentCents = Math.round(chargeCents / simulateInstallments)
			return {
				receiveCents,
				feePercent,
				feeCents,
				chargeCents,
				installments: simulateInstallments,
				valuePerInstallmentCents,
			}
		}

		return { receiveCents, feePercent, feeCents, chargeCents }
	}

	function openWhatsAppModal() {
		const today = new Date()
		const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`
		const available = devices.filter((d) => !d.sold)
		const byModelStorage = new Map<string, { name: string; storage: string; minCents: number; maxCents: number }>()
		for (const d of available) {
			const name = (d.device_name || '').trim() || 'Aparelho'
			const storage = d.storage_gb ? `${d.storage_gb}gb` : ''
			const key = `${name}|${storage}`
			const price = d.wholesale_value_cents ?? 0
			if (price > 0) {
				const current = byModelStorage.get(key)
				if (current === undefined) {
					byModelStorage.set(key, { name, storage, minCents: price, maxCents: price })
				} else {
					byModelStorage.set(key, {
						name,
						storage,
						minCents: Math.min(current.minCents, price),
						maxCents: Math.max(current.maxCents, price),
					})
				}
			}
		}
		const entries = Array.from(byModelStorage.values())
			.sort((a, b) => {
				const keyA = getModelSortKey(a.name)
				const keyB = getModelSortKey(b.name)
				if (keyA !== keyB) return keyA - keyB
				const storageA = parseInt(a.storage.replace(/\D/g, ''), 10) || 0
				const storageB = parseInt(b.storage.replace(/\D/g, ''), 10) || 0
				if (storageA !== storageB) return storageA - storageB
				return a.name.localeCompare(b.name)
			})
		const devicesBlock = entries.length > 0
			? entries.map((e) => {
				const linha1 = e.storage ? `${e.name} \`${e.storage}\`` : e.name
				const preco = e.minCents === e.maxCents
					? `R$ ${maskedFromCents(e.minCents)}`
					: `R$ ${maskedFromCents(e.minCents)} ~ R$ ${maskedFromCents(e.maxCents)}`
				return `${linha1}\n${preco}`
			}).join('\n\n')
			: '(Nenhum aparelho disponível)'
		const text = `🟢 CONECTIZE ATACADO 🟢
📅 Estoque atualizado – ${dateStr}

🚨 LIBERADO HOJE

📦 MODELOS DISPONÍVEIS:

${devicesBlock}

🔒 Seminovos revisados
✅ Garantia 90 dias
🔋 Saúde de bateria mínima 80%
⚠️ Reservas por ordem de confirmação

🚨 PROMOÇÃO ESPECIAL
Comprando 3 iPhones
💰 R$100 OFF no total

📲 Garanta o seu no privado`
		setWhatsAppText(text)
		setShowWhatsAppModal(true)
	}

	async function handleConfirmCost() {
		const d = costModalTarget
		if (!d || isSavingCost) return
		const valueCents = moneyToCentsFromMasked(costValue)
		if (valueCents === null) return
		setIsSavingCost(true)
		try {
			const res = await portalFetch(`/api/portal/resale-devices/${d.id}/costs`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: costDescription.trim() || null, value_cents: valueCents }),
			})
			const data = await res?.json().catch(() => null)
			if (data?.ok && data?.cost) {
				const newCost: CostRow = {
					id: data.cost.id,
					description: data.cost.description ?? '',
					value_cents: data.cost.value_cents ?? 0,
				}
				const updateDevice = (dev: ResaleDevice) =>
					dev.id === d.id ? { ...dev, costs: [...(dev.costs || []), newCost] } : dev
				setDevices((prev) => prev.map(updateDevice))
				setEditedDevices((prev) => prev.map(updateDevice))
				setCostModalTarget(null)
				toast({ description: 'Custo adicionado', duration: 2000 })
			}
		} finally {
			setIsSavingCost(false)
		}
	}

	async function handleConfirmSell() {
		const d = sellModalTarget
		if (!d || isSavingSell) return
		const valueCents = getSellPaymentsTotalCents()
		if (valueCents === null) {
			toast({
				title: 'Valores de pagamento',
				description: 'Informe o valor (R$) em cada forma de pagamento usada. O total da venda é a soma desses valores.',
				variant: 'destructive',
			})
			return
		}

		const validMethods = sellPaymentMethods.filter((e) => e.payment_method_id?.trim())
		if (validMethods.length === 0) {
			toast({ title: 'Forma de pagamento', description: 'Selecione ao menos uma forma de pagamento.', variant: 'destructive' })
			return
		}
		if (sellPaymentMethods.length > 1) {
			const anyEmpty = sellPaymentMethods.some((e) => !e.payment_method_id?.trim())
			if (anyEmpty) {
				toast({ title: 'Forma de pagamento', description: 'Selecione a forma de pagamento em todas as linhas.', variant: 'destructive' })
				return
			}
		}

		const paymentFeeCents = paymentFeeCentsForSaleEntries(validMethods, paymentMethods)

		const baseCosts = (d.costs || []).map((c) => ({
			description: (c.description ?? '') || null,
			value_cents: c.value_cents ?? 0,
		}))

		const costsWithoutDerived = baseCosts.filter((c) => !isSaleDerivedCostDescription(c.description))
		const baseOperationalTotal = costsWithoutDerived.reduce((acc, c) => acc + (c.value_cents ?? 0), 0)
		const purchaseCents = d.purchase_value_cents ?? 0

		const comm = sellCommissionPanelRef.current?.getValues()
		const sellCommissionEnabled = comm?.enabled ?? false
		const sellCommissionUserId = comm?.userId ?? ''
		const sellCommissionKind = comm?.kind ?? 'percent'
		const sellCommissionPercent = comm?.percentRaw ?? ''
		const sellCommissionFixed = comm?.fixedMasked ?? ''

		let costsPayload =
			paymentFeeCents > 0
				? [
					...costsWithoutDerived,
					{
						description: 'Taxa forma de pagamento',
						value_cents: paymentFeeCents,
					},
				]
				: [...costsWithoutDerived]

		let commissionUserIdForDb: string | null = null
		let commissionCents = 0
		if (sellCommissionEnabled) {
			const uid = sellCommissionUserId.trim()
			if (!uid) {
				toast({ title: 'Comissão', description: 'Selecione o colaborador.', variant: 'destructive' })
				return
			}
			const selectedUser = teamUsers.find((u) => u.id === uid)
			if (!selectedUser) {
				toast({ title: 'Comissão', description: 'Colaborador inválido.', variant: 'destructive' })
				return
			}
			if (sellCommissionKind === 'percent') {
				const p = Number.parseFloat(sellCommissionPercent.replace(',', '.'))
				if (!Number.isFinite(p) || p <= 0) {
					toast({ title: 'Comissão', description: 'Informe um percentual válido.', variant: 'destructive' })
					return
				}
				const gross = grossProfitBeforeCommissionCents(
					valueCents,
					purchaseCents,
					baseOperationalTotal,
					paymentFeeCents
				)
				commissionCents = commissionFromPercentOfGrossCents(gross, p)
			} else {
				const fc = moneyToCentsFromMasked(sellCommissionFixed)
				if (fc === null || fc <= 0) {
					toast({ title: 'Comissão', description: 'Informe um valor fixo válido.', variant: 'destructive' })
					return
				}
				commissionCents = fc
			}
			if (commissionCents <= 0) {
				toast({
					title: 'Comissão',
					description:
						sellCommissionKind === 'percent'
							? 'Com percentual sobre o lucro bruto, o lucro precisa ser positivo e o percentual deve gerar comissão maior que zero.'
							: 'O valor da comissão deve ser maior que zero.',
					variant: 'destructive',
				})
				return
			}
			commissionUserIdForDb = uid
			const label = (selectedUser.full_name || '').trim() || selectedUser.email || 'Colaborador'
			costsPayload = [
				...costsPayload,
				{
					description: buildCommissionCostDescription(label),
					value_cents: commissionCents,
				},
			]
		}

		const salePaymentMethodsPayload = validMethods.map((e) => ({
			payment_method_id: e.payment_method_id,
			value_cents: e.value_cents ?? 0,
			installments: e.installments ?? 1,
		}))

		const payload: Record<string, unknown> = {
			sold: true,
			sold_for_cents: valueCents,
			sale_date: sellDate || null,
			sale_payment_methods: salePaymentMethodsPayload,
			sale_commission_user_id: sellCommissionEnabled ? commissionUserIdForDb : null,
			buyer_name: sellGenerateWarrantyTerm ? sellBuyerName.trim() || null : null,
			buyer_cpf: sellGenerateWarrantyTerm ? sellBuyerCpf.trim() || null : null,
			sale_details: sellGenerateWarrantyTerm ? sellSaleDetails.trim() || null : null,
			costs: costsPayload,
		}

		setIsSavingSell(true)
		try {
			const res = await portalFetch(`/api/portal/resale-devices/${d.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})
			const data = await res?.json().catch(() => null)
			if (data?.ok) {
				const updated = data.device as ResaleDevice
				setSellModalTarget(null)
				if (sellGenerateWarrantyTerm) {
					setTermsDevice(updated)
					setShowTermsDialog(true)
				}
				router.refresh()
				if (soldCollapsibleOpen) loadSoldDevices()
				toast({ description: 'Aparelho marcado como vendido', duration: 2000 })
			}
		} finally {
			setIsSavingSell(false)
		}
	}

	async function handleCancelSell(d: ResaleDevice) {
		if (isSavingSell) return
		if (!confirm('Cancelar a venda deste aparelho? O valor e a data de venda serão removidos.')) return
		setIsSavingSell(true)
		try {
			const res = await portalFetch(`/api/portal/resale-devices/${d.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sold: false,
					sold_for_cents: null,
					sale_date: null,
					payment_method_id: null,
					payment_installments: null,
					sale_payment_methods: [],
					buyer_name: null,
					buyer_cpf: null,
					sale_details: null,
				}),
			})
			const data = await res?.json().catch(() => null)
			if (data?.ok) {
				router.refresh()
				if (soldCollapsibleOpen) loadSoldDevices()
				toast({ description: 'Venda cancelada', duration: 2000 })
			}
		} finally {
			setIsSavingSell(false)
		}
	}

	async function handleCopyDeviceLojista(d: ResaleDevice) {
		const text = buildCopyLojistaText(d)
		if (!text) return

		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(text)
				toast({ description: 'Copiado para a área de transferência', duration: 2000 })
			}
		} catch {
			// ignore clipboard errors
		}
	}

	async function handleCopyDeviceCliente(d: ResaleDevice) {
		const text = buildCopyClienteText(d)
		if (!text) return

		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(text)
				toast({ description: 'Copiado para a área de transferência', duration: 2000 })
			}
		} catch {
			// ignore clipboard errors
		}
	}

	function handlePrintLabel(d: ResaleDevice) {
		if (typeof window === 'undefined') return
		const win = window.open('', '_blank', getLabelWindowFeatures())
		if (!win) return

		const html = buildSeminovoLabelHtml(d)
		win.document.open()
		win.document.write(html)
		win.document.close()
	}

	return (
		<>
			<div className="space-y-4 px-1 sm:px-0">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0">
						<h1 className="text-xl font-bold sm:text-2xl">Aparelhos para venda</h1>
						<p className="text-sm text-muted-foreground mt-0.5">
							Estoque para revenda. Acesso exclusivo para staff e administrador.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						{!isBulkEdit ? (
							<>
								<Button asChild>
									<Link href={novaDeviceHref}>
										<Plus className="h-4 w-4 mr-2" />
										Cadastrar aparelho
									</Link>
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={openWhatsAppModal}
								>
									<MessageCircle className="h-4 w-4 mr-2" />
									Texto WhatsApp
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={handleStartBulkEdit}
								>
									Edição em massa
								</Button>
							</>
						) : (
							<>
								<Button
									type="button"
									variant="outline"
									onClick={handleCancelBulkEdit}
									disabled={isSavingBulk}
								>
									Cancelar
								</Button>
								<Button
									type="button"
									onClick={handleSaveBulkEdit}
									disabled={isSavingBulk}
								>
									{isSavingBulk ? 'Salvando…' : 'Salvar alterações'}
								</Button>
							</>
						)}
					</div>
				</div>

				<SeminovosSubmenu />

				<SeminovosFilterCollapsible
					defaultOpen={hasFilters}
					initialValues={filterInitialValues}
					quickFilters={{
						notTested: filterNotTested,
						notAdvertised: filterNotAdvertised,
						noLabel: filterNoLabel,
						withInfo: filterWithInfo,
						onToggleNotTested: () => setFilterNotTested((v) => !v),
						onToggleNotAdvertised: () => setFilterNotAdvertised((v) => !v),
						onToggleNoLabel: () => setFilterNoLabel((v) => !v),
						onToggleWithInfo: () => setFilterWithInfo((v) => !v),
					}}
				/>

				{isAdmin && (
					<Collapsible open={overviewCollapsibleOpen} onOpenChange={setOverviewCollapsibleOpen}>
						<CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-card px-3 py-3 sm:py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors touch-manipulation min-h-[2.75rem]">
							<span className="flex items-center gap-2">
								<ChevronDown className={`h-4 w-4 transition-transform ${overviewCollapsibleOpen ? '' : '-rotate-90'}`} />
								Visão geral da operação
							</span>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<div className="mt-3 rounded-md border bg-card p-3 sm:p-4">
								<ResumoFinanceiro devices={devices} stats={stats} showValues />
							</div>
						</CollapsibleContent>
					</Collapsible>
				)}

				<Card>
					<CardHeader className="pb-3 sm:pb-6">
						<CardTitle className="text-lg sm:text-xl">Lista de aparelhos</CardTitle>
					</CardHeader>
					<CardContent className="px-3 sm:px-6">
						{isLoading ? (
							<p className="text-sm text-muted-foreground">Carregando…</p>
						) : (
							<>
								{groupedAvailable.length === 0 ? (
									<p className="text-sm text-muted-foreground mb-4">
										Nenhum aparelho disponível.{' '}
										<Link href={novaDeviceHref} className="text-primary underline">
											Cadastrar aparelho
										</Link>
									</p>
								) : (
									<>
										{!isBulkEdit && (
											<div className="space-y-5">
												{groupedAvailable.map((g) => (
													<div key={g.modelKey}>
														<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">{g.modelKey}</p>
														<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
															{g.devices.map((d) => (
																<SeminovoDeviceCard
																	key={d.id}
																	device={d}
																	variant="available"
																	showPurchaseValue={showPurchaseValue}
																	showWholesaleValue={showWholesaleValue}
																	renderMenu={(device) => (
																		<>
																			{!device.sold ? (
																				<DropdownMenuItem onClick={() => openSellModal(device as ResaleDevice)}>
																					<DollarSign className="h-3.5 w-3.5 mr-1.5" />
																					Vendido
																				</DropdownMenuItem>
																			) : (
																				<DropdownMenuItem onClick={() => handleCancelSell(device as ResaleDevice)} disabled={isSavingSell}>
																					<Undo2 className="h-3.5 w-3.5 mr-1.5" />
																					Cancelar venda
																				</DropdownMenuItem>
																			)}
																			<DropdownMenuItem onClick={() => openCostModal(device as ResaleDevice)}>
																				<Receipt className="h-3.5 w-3.5 mr-1.5" />
																				Adicionar custo
																			</DropdownMenuItem>
																			<DropdownMenuItem onClick={() => openSimulateModal(device as ResaleDevice)}>
																				<Calculator className="h-3.5 w-3.5 mr-1.5" />
																				Simular
																			</DropdownMenuItem>
																			<DropdownMenuItem onClick={() => handlePrintLabel(device as ResaleDevice)}>
																				<Tag className="h-3.5 w-3.5 mr-1.5" />
																				Imprimir etiqueta
																			</DropdownMenuItem>
																			<DropdownMenuItem onClick={() => handleCopyDeviceLojista(device as ResaleDevice)}>
																				<Store className="h-3.5 w-3.5 mr-1.5" />
																				Copiar dados para lojista
																			</DropdownMenuItem>
																			<DropdownMenuItem onClick={() => handleCopyDeviceCliente(device as ResaleDevice)}>
																				<UserRound className="h-3.5 w-3.5 mr-1.5" />
																				Copiar dados para cliente
																			</DropdownMenuItem>
																			<DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(device as ResaleDevice)}>
																				<Trash2 className="h-3.5 w-3.5 mr-1.5" />
																				Excluir
																			</DropdownMenuItem>
																		</>
																	)}
																/>
															))}
														</div>
													</div>
												))}
											</div>
										)}
										{isBulkEdit && (
											<div className="overflow-x-auto">
												<Table>
													<colgroup>
														<col className="w-[22%]" />
														<col className="w-[11%]" />
														<col className="w-[14%]" />
														<col className="w-[9%]" />
														<col className="w-[8%]" />
														<col className="w-[12%]" />
														<col className="w-[10%]" />
														<col className="w-[4%]" />
													</colgroup>
													<TableHeader>
														<TableRow>
															<TableHead>Aparelho</TableHead>
															<TableHead>IMEI</TableHead>
															<TableHead>Informações</TableHead>
															<TableHead>
																<span className="inline-flex items-center gap-1.5">
																	Valor compra
																	<Button
																		type="button"
																		variant="ghost"
																		size="icon"
																		className="h-7 w-7"
																		onClick={(e) => { e.stopPropagation(); setShowPurchaseValue((v) => !v) }}
																		title={showPurchaseValue ? 'Ocultar valor de compra' : 'Exibir valor de compra'}
																		aria-label={showPurchaseValue ? 'Ocultar valor de compra' : 'Exibir valor de compra'}
																	>
																		{showPurchaseValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
																	</Button>
																</span>
															</TableHead>
															<TableHead>Custos</TableHead>
															<TableHead>
																<span className="inline-flex items-center gap-1.5">
																	Valores
																	<Button
																		type="button"
																		variant="ghost"
																		size="icon"
																		className="h-7 w-7"
																		onClick={(e) => { e.stopPropagation(); setShowWholesaleValue((v) => !v) }}
																		title={showWholesaleValue ? 'Ocultar valor de atacado' : 'Exibir valor de atacado'}
																		aria-label={showWholesaleValue ? 'Ocultar valor de atacado' : 'Exibir valor de atacado'}
																	>
																		{showWholesaleValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
																	</Button>
																</span>
															</TableHead>
															<TableHead>Data</TableHead>
															<TableHead className="text-right">Ações</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{(!isBulkEdit
															? groupedAvailable.flatMap((g) => [
																{ type: 'group' as const, key: `group-${g.modelKey}`, modelKey: g.modelKey },
																...g.devices.map((d) => ({ type: 'device' as const, key: d.id, d })),
															])
															: rows.map((d) => ({ type: 'device' as const, key: d.id, d }))
														).map((item) =>
															item.type === 'group' ? (
																<TableRow key={item.key} className="bg-muted/40 hover:bg-muted/40">
																	<TableCell colSpan={8} className="font-semibold py-2 text-sm">
																		{item.modelKey}
																	</TableCell>
																</TableRow>
															) : (
																(() => {
																	const d = item.d
																	const totalCostsCents = (d.costs || []).reduce(
																		(acc, c) => acc + (c.value_cents ?? 0),
																		0
																	)
																	const aparelhoTitle = [d.device_name, d.storage_gb, d.color, d.battery, d.condition].filter(Boolean).join(' | ')
																	return (
																		<TableRow
																			key={d.id}
																			className={`${!isBulkEdit ? 'cursor-pointer' : ''} ${d.sold ? 'bg-muted/60' : ''}`}
																		>
																			{!isBulkEdit ? (
																				<TableCell colSpan={7} className="relative p-0 align-middle">
																					<Link
																						href={`/portal/seminovos/${d.id}`}
																						className="absolute inset-0 z-0"
																						aria-label={`Abrir aparelho ${aparelhoTitle || d.device_name || d.id}`}
																					/>
																					<div className="relative z-10 grid items-center py-2 px-4 pointer-events-none [&_button]:pointer-events-auto min-w-0" style={{ gridTemplateColumns: '22fr 11fr 14fr 9fr 8fr 12fr 10fr' }}>
																						<DeviceBadges deviceName={d.device_name} storageGb={d.storage_gb} color={d.color} battery={d.battery} condition={d.condition} />
																						<span>
																							{d.imei ? (
																								<button
																									type="button"
																									onClick={(e) => {
																										e.stopPropagation()
																										e.preventDefault()
																										navigator?.clipboard?.writeText(d.imei || '').then(() => {
																											toast({ description: 'Copiado para a área de transferência', duration: 2000 })
																										}).catch(() => { })
																									}}
																									className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-muted/70 hover:bg-muted border border-border/60 cursor-pointer transition-colors"
																									title="Clique para copiar"
																								>
																									<span className="truncate max-w-[115px]">{d.imei}</span>
																									<Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
																								</button>
																							) : '-'}
																						</span>
																						<span className="max-w-[220px] truncate min-w-0" title={d.info || ''}>{d.info || '-'}</span>
																						<span className="min-w-0">
																							{showPurchaseValue ? (d.purchase_value_cents != null ? `R$ ${centsToReais(d.purchase_value_cents)}` : '-') : <Skeleton className="h-4 w-16" />}
																						</span>
																						<span className="min-w-0">{totalCostsCents > 0 ? `R$ ${centsToReais(totalCostsCents)}` : '-'}</span>
																						<span className="whitespace-nowrap min-w-0">
																							{d.sold ? (
																								<span className="block text-xs leading-tight">{d.sold_for_cents != null ? `R$ ${centsToReais(d.sold_for_cents)}` : '-'}</span>
																							) : (
																								<>
																									<span className="block text-xs leading-tight">{d.sale_value_cents != null ? `R$ ${centsToReais(d.sale_value_cents)}` : '-'}</span>
																									{showWholesaleValue && (
																										<span className="block text-xs leading-tight text-muted-foreground">{d.wholesale_value_cents != null ? `R$ ${centsToReais(d.wholesale_value_cents)}` : '-'}</span>
																									)}
																								</>
																							)}
																						</span>
																						<span className="whitespace-nowrap min-w-0">
																							{d.sale_date ? (
																								<>
																									<span className="block text-xs leading-tight">{d.purchase_date ? formatDateBr(d.purchase_date) : '-'}</span>
																									<span className="block text-xs leading-tight text-muted-foreground">{formatDateBr(d.sale_date)}</span>
																								</>
																							) : (
																								<span className="block text-xs leading-tight">{d.purchase_date ? formatDateBr(d.purchase_date) : '-'}</span>
																							)}
																						</span>
																					</div>
																				</TableCell>
																			) : (
																				<>
																					<TableCell className="font-medium" title={aparelhoTitle || d.device_name || ''}>
																						{isBulkEdit ? (
																							<div className="space-y-1">
																								<div className="flex items-center gap-1">
																									<Input
																										value={d.device_name || ''}
																										onChange={(e) => updateRow(d.id, 'device_name', e.target.value)}
																										placeholder="Nome"
																										className="h-8 text-sm"
																									/>
																									<span className="text-muted-foreground shrink-0">-</span>
																									<Input
																										value={d.storage_gb || ''}
																										onChange={(e) => updateRow(d.id, 'storage_gb', e.target.value || '')}
																										placeholder="GB"
																										className="h-8 w-14 text-sm"
																									/>
																								</div>
																								<div className="flex items-center gap-1">
																									<Input
																										value={d.color || ''}
																										onChange={(e) => updateRow(d.id, 'color', e.target.value || '')}
																										placeholder="Cor"
																										className="h-8 text-xs"
																									/>
																									<span className="text-muted-foreground shrink-0">-</span>
																									<Input
																										inputMode="numeric"
																										value={d.battery || ''}
																										onChange={(e) => {
																											const digits = e.target.value.replace(/\D/g, '')
																											if (!digits) { updateRow(d.id, 'battery', ''); return }
																											let n = Number.parseInt(digits, 10)
																											if (Number.isNaN(n)) { updateRow(d.id, 'battery', ''); return }
																											if (n > 100) n = 100
																											updateRow(d.id, 'battery', `${n}%`)
																										}}
																										placeholder="Bateria"
																										className="h-8 w-16 text-xs"
																									/>
																									<span className="text-muted-foreground shrink-0">-</span>
																									<select
																										className="h-8 rounded-md border border-input bg-background px-2 text-xs w-16"
																										value={d.condition || ''}
																										onChange={(e) => updateRow(d.id, 'condition', e.target.value || '')}
																									>
																										<option value="">Estado</option>
																										<option value="A+">A+</option>
																										<option value="A">A</option>
																										<option value="A-">A-</option>
																										<option value="B+">B+</option>
																										<option value="B">B</option>
																										<option value="B-">B-</option>
																									</select>
																								</div>
																							</div>
																						) : (
																							<DeviceBadges deviceName={d.device_name} storageGb={d.storage_gb} color={d.color} battery={d.battery} condition={d.condition} />
																						)}
																					</TableCell>
																					<TableCell>
																						{isBulkEdit ? (
																							<Input
																								value={d.imei || ''}
																								onChange={(e) => updateRow(d.id, 'imei', e.target.value)}
																								placeholder="IMEI"
																							/>
																						) : d.imei ? (
																							<button
																								type="button"
																								onClick={(e) => {
																									e.stopPropagation()
																									navigator?.clipboard?.writeText(d.imei || '').then(() => {
																										toast({ description: 'Copiado para a área de transferência', duration: 2000 })
																									}).catch(() => { })
																								}}
																								className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-muted/70 hover:bg-muted border border-border/60 cursor-pointer transition-colors"
																								title="Clique para copiar"
																							>
																								<span className="truncate max-w-[115px]">{d.imei}</span>
																								<Copy className="h-3 w-3 shrink-0 text-muted-foreground" />
																							</button>
																						) : (
																							'-'
																						)}
																					</TableCell>
																					<TableCell className="max-w-[220px] truncate" title={d.info || ''}>
																						{isBulkEdit ? (
																							<Input
																								value={d.info || ''}
																								onChange={(e) => updateRow(d.id, 'info', e.target.value)}
																								placeholder="Informações"
																							/>
																						) : (
																							d.info || '-'
																						)}
																					</TableCell>
																					<TableCell>
																						{showPurchaseValue ? (
																							isBulkEdit ? (
																								<Input
																									value={d.purchase_value_cents != null ? centsToReais(d.purchase_value_cents) : ''}
																									onChange={(e) => updateMoney(d.id, 'purchase_value_cents', e.target.value)}
																									placeholder="0,00"
																								/>
																							) : (
																								d.purchase_value_cents != null ? `R$ ${centsToReais(d.purchase_value_cents)}` : '-'
																							)
																						) : (
																							<Skeleton className="h-8 w-20" />
																						)}
																					</TableCell>
																					<TableCell>
																						{totalCostsCents > 0 ? `R$ ${centsToReais(totalCostsCents)}` : '-'}
																					</TableCell>
																					<TableCell className="whitespace-nowrap">
																						{isBulkEdit ? (
																							<div className="flex flex-col gap-1">
																								{d.sold ? (
																									<Input
																										value={d.sold_for_cents != null ? centsToReais(d.sold_for_cents) : ''}
																										onChange={(e) => updateMoney(d.id, 'sold_for_cents', e.target.value)}
																										placeholder="Valor da venda"
																										className="h-8 text-xs"
																									/>
																								) : (
																									<>
																										<Input
																											value={d.sale_value_cents != null ? centsToReais(d.sale_value_cents) : ''}
																											onChange={(e) => updateMoney(d.id, 'sale_value_cents', e.target.value)}
																											placeholder="Varejo"
																											className="h-8 text-xs"
																										/>
																										{showWholesaleValue && (
																											<Input
																												value={d.wholesale_value_cents != null ? centsToReais(d.wholesale_value_cents) : ''}
																												onChange={(e) => updateMoney(d.id, 'wholesale_value_cents', e.target.value)}
																												placeholder="Atacado"
																												className="h-8 text-xs"
																											/>
																										)}
																									</>
																								)}
																							</div>
																						) : (
																							<div className="flex flex-col text-xs leading-tight">
																								{d.sold ? (
																									<span>{d.sold_for_cents != null ? `R$ ${centsToReais(d.sold_for_cents)}` : '-'}</span>
																								) : (
																									<>
																										<span>{d.sale_value_cents != null ? `R$ ${centsToReais(d.sale_value_cents)}` : '-'}</span>
																										{showWholesaleValue && (
																											<span className="text-muted-foreground">{d.wholesale_value_cents != null ? `R$ ${centsToReais(d.wholesale_value_cents)}` : '-'}</span>
																										)}
																									</>
																								)}
																							</div>
																						)}
																					</TableCell>
																					<TableCell className="whitespace-nowrap">
																						{isBulkEdit ? (
																							<div className="flex flex-col gap-1">
																								<Input
																									type="date"
																									value={d.purchase_date || ''}
																									onChange={(e) => updateRow(d.id, 'purchase_date', e.target.value)}
																									className="h-8 text-xs"
																								/>
																								<Input
																									type="date"
																									value={d.sale_date || ''}
																									onChange={(e) => updateRow(d.id, 'sale_date', e.target.value)}
																									className="h-8 text-xs"
																								/>
																							</div>
																						) : (
																							<div className="flex flex-col text-xs leading-tight">
																								{d.sale_date ? (
																									<>
																										<span>{d.purchase_date ? formatDateBr(d.purchase_date) : '-'}</span>
																										<span className="text-muted-foreground">{formatDateBr(d.sale_date)}</span>
																									</>
																								) : (
																									<span>{d.purchase_date ? formatDateBr(d.purchase_date) : '-'}</span>
																								)}
																							</div>
																						)}
																					</TableCell>
																				</>
																			)}
																			<TableCell
																				className="text-right relative z-10"
																				onClick={(e) => e.stopPropagation()}
																			>
																				<DropdownMenu>
																					<DropdownMenuTrigger asChild>
																						<Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações">
																							<MoreHorizontal className="h-4 w-4" />
																						</Button>
																					</DropdownMenuTrigger>
																					<DropdownMenuContent align="end">
																						{!d.sold ? (
																							<DropdownMenuItem onClick={() => openSellModal(d)}>
																								<DollarSign className="h-3.5 w-3.5 mr-1.5" />
																								Vendido
																							</DropdownMenuItem>
																						) : (
																							<>
																								<DropdownMenuItem onClick={() => openEditSellModal(d)} disabled={isSavingSell}>
																									<DollarSign className="h-3.5 w-3.5 mr-1.5" />
																									Editar venda
																								</DropdownMenuItem>
																								<DropdownMenuItem onClick={() => handleCancelSell(d)} disabled={isSavingSell}>
																									<Undo2 className="h-3.5 w-3.5 mr-1.5" />
																									Cancelar venda
																								</DropdownMenuItem>
																							</>
																						)}
																						{d.sold && ((d.buyer_name && d.buyer_name.trim()) || (d.buyer_cpf && d.buyer_cpf.trim()) || (d.sale_details && d.sale_details.trim())) && (
																							<DropdownMenuItem
																								onClick={() => {
																									setTermsDevice(d)
																									setShowTermsDialog(true)
																								}}
																							>
																								<FileInput className="h-3.5 w-3.5 mr-1.5" />
																								Ver termos de compra
																							</DropdownMenuItem>
																						)}
																						<DropdownMenuItem onClick={() => openCostModal(d)}>
																							<Receipt className="h-3.5 w-3.5 mr-1.5" />
																							Adicionar custo
																						</DropdownMenuItem>
																						<DropdownMenuItem onClick={() => openSimulateModal(d)}>
																							<Calculator className="h-3.5 w-3.5 mr-1.5" />
																							Simular
																						</DropdownMenuItem>
																						<DropdownMenuItem onClick={() => handlePrintLabel(d)}>
																							<Tag className="h-3.5 w-3.5 mr-1.5" />
																							Imprimir etiqueta
																						</DropdownMenuItem>
																						<DropdownMenuItem onClick={() => handleCopyDeviceLojista(d)}>
																							<Store className="h-3.5 w-3.5 mr-1.5" />
																							Copiar dados para lojista
																						</DropdownMenuItem>
																						<DropdownMenuItem onClick={() => handleCopyDeviceCliente(d)}>
																							<UserRound className="h-3.5 w-3.5 mr-1.5" />
																							Copiar dados para cliente
																						</DropdownMenuItem>
																						<DropdownMenuItem
																							className="text-destructive focus:text-destructive"
																							onClick={() => setDeleteTarget(d)}
																						>
																							<Trash2 className="h-3.5 w-3.5 mr-1.5" />
																							Excluir
																						</DropdownMenuItem>
																					</DropdownMenuContent>
																				</DropdownMenu>
																			</TableCell>
																		</TableRow>
																	)
																})()
															)
														)}
													</TableBody>
												</Table>
											</div>
										)}
									</>
								)}
							</>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<Collapsible
							open={soldCollapsibleOpen}
							onOpenChange={(open) => {
								setSoldCollapsibleOpen(open)
								if (open && soldDevices.length === 0 && !isLoadingSold) loadSoldDevices()
							}}
						>
							<CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left py-2 min-h-[3rem] touch-manipulation">
								<div className="min-w-0">
									<CardTitle className="text-base sm:text-lg">Aparelhos vendidos</CardTitle>
									<CardDescription className="text-xs sm:text-sm">
										Clique para expandir e carregar a lista.
									</CardDescription>
								</div>
								<span className="flex items-center gap-2 shrink-0">
									{isLoadingSold ? (
										<span className="text-muted-foreground">Carregando…</span>
									) : soldCollapsibleOpen ? (
										<ChevronDown className="h-4 w-4" />
									) : (
										<ChevronRight className="h-4 w-4" />
									)}
								</span>
							</CollapsibleTrigger>
							<CollapsibleContent>
								{soldCollapsibleOpen && (
									<CardContent className="pt-0">
										{isLoadingSold ? (
											<p className="text-sm text-muted-foreground py-4">Carregando vendidos…</p>
										) : soldDevices.length === 0 ? (
											<p className="text-sm text-muted-foreground py-4">Nenhum aparelho vendido.</p>
										) : (
											<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
												{sortSoldDevices(soldDevices).map((d) => (
													<SeminovoDeviceCard
														key={d.id}
														device={d}
														variant="sold"
														showPurchaseValue={showPurchaseValue}
														showWholesaleValue={showWholesaleValue}
														renderMenu={(device) => (
															<>
																<DropdownMenuItem onClick={() => openEditSellModal(device as ResaleDevice)} disabled={isSavingSell}>
																	<DollarSign className="h-3.5 w-3.5 mr-1.5" />
																	Editar venda
																</DropdownMenuItem>
																<DropdownMenuItem onClick={() => handleCancelSell(device as ResaleDevice)} disabled={isSavingSell}>
																	<Undo2 className="h-3.5 w-3.5 mr-1.5" />
																	Cancelar venda
																</DropdownMenuItem>
																{((device.buyer_name && device.buyer_name.trim()) || (device.buyer_cpf && device.buyer_cpf.trim()) || (device.sale_details && device.sale_details.trim())) && (
																	<DropdownMenuItem
																		onClick={() => {
																			setTermsDevice(device as ResaleDevice)
																			setShowTermsDialog(true)
																		}}
																	>
																		<FileInput className="h-3.5 w-3.5 mr-1.5" />
																		Ver termos de compra
																	</DropdownMenuItem>
																)}
																<DropdownMenuItem onClick={() => openCostModal(device as ResaleDevice)}>
																	<Receipt className="h-3.5 w-3.5 mr-1.5" />
																	Adicionar custo
																</DropdownMenuItem>
																<DropdownMenuItem onClick={() => handlePrintLabel(device as ResaleDevice)}>
																	<Tag className="h-3.5 w-3.5 mr-1.5" />
																	Imprimir etiqueta
																</DropdownMenuItem>
																<DropdownMenuItem onClick={() => handleCopyDeviceLojista(device as ResaleDevice)}>
																	<Store className="h-3.5 w-3.5 mr-1.5" />
																	Copiar dados para lojista
																</DropdownMenuItem>
																<DropdownMenuItem onClick={() => handleCopyDeviceCliente(device as ResaleDevice)}>
																	<UserRound className="h-3.5 w-3.5 mr-1.5" />
																	Copiar dados para cliente
																</DropdownMenuItem>
																<DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(device as ResaleDevice)}>
																	<Trash2 className="h-3.5 w-3.5 mr-1.5" />
																	Excluir
																</DropdownMenuItem>
															</>
														)}
													/>
												))}
											</div>
										)}
									</CardContent>
								)}
							</CollapsibleContent>
						</Collapsible>
					</CardHeader>
				</Card>
			</div>

			<Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
				<DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
					<DialogHeader>
						<DialogTitle>Texto WhatsApp</DialogTitle>
						<DialogDescription>
							Texto formatado para divulgação. Edite conforme necessário e copie para o WhatsApp.
						</DialogDescription>
					</DialogHeader>
					<Textarea
						value={whatsAppText}
						onChange={(e) => setWhatsAppText(e.target.value)}
						placeholder="Texto para WhatsApp..."
						className="min-h-[320px] resize-y font-mono text-sm"
						dir="ltr"
					/>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								navigator?.clipboard?.writeText(whatsAppText).then(() => {
									toast({ description: 'Copiado para a área de transferência', duration: 2000 })
								}).catch(() => { })
							}}
						>
							<Copy className="h-4 w-4 mr-2" />
							Copiar
						</Button>
						<Button type="button" onClick={() => setShowWhatsAppModal(false)}>
							Fechar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={!!simulateModalTarget} onOpenChange={(open) => !open && setSimulateModalTarget(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Simular pagamento</DialogTitle>
						<DialogDescription>
							Informe o valor que deseja receber e a forma de pagamento. A taxa é descontada do valor cobrado ao cliente.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						{simulateModalTarget && (
							<>
								<div className="space-y-3">
									<Label>Valor a receber</Label>
									<RadioGroup
										value={simulateValueSource}
										onValueChange={(v: 'varejo' | 'atacado' | 'custom') => {
											setSimulateValueSource(v)
											const d = simulateModalTarget
											if (!d) return
											if (v === 'varejo' && d.sale_value_cents != null) setSimulateValue(centsToReais(d.sale_value_cents))
											else if (v === 'atacado' && d.wholesale_value_cents != null) setSimulateValue(centsToReais(d.wholesale_value_cents))
											else if (v === 'custom') setSimulateValue('')
										}}
										className="flex flex-col gap-2"
									>
										{simulateModalTarget.sale_value_cents != null && (
											<div className="flex items-center space-x-2">
												<RadioGroupItem value="varejo" id="sim-varejo" />
												<Label htmlFor="sim-varejo" className="font-normal cursor-pointer">
													Varejo – R$ {centsToReais(simulateModalTarget.sale_value_cents)}
												</Label>
											</div>
										)}
										{simulateModalTarget.wholesale_value_cents != null && (
											<div className="flex items-center space-x-2">
												<RadioGroupItem value="atacado" id="sim-atacado" />
												<Label htmlFor="sim-atacado" className="font-normal cursor-pointer">
													Atacado – R$ {centsToReais(simulateModalTarget.wholesale_value_cents)}
												</Label>
											</div>
										)}
										<div className="flex items-center space-x-2">
											<RadioGroupItem value="custom" id="sim-custom" />
											<Label htmlFor="sim-custom" className="font-normal cursor-pointer">
												Outro valor
											</Label>
										</div>
									</RadioGroup>
									{(simulateValueSource === 'custom' || (simulateValueSource === 'varejo' && simulateModalTarget.sale_value_cents == null) || (simulateValueSource === 'atacado' && simulateModalTarget.wholesale_value_cents == null)) && (
										<Input
											value={simulateValue}
											onChange={(e) => setSimulateValue(formatMoneyInput(e.target.value))}
											placeholder="0,00"
											className="mt-1"
										/>
									)}
								</div>
								<div className="space-y-2">
									<Label>Forma de pagamento</Label>
									<Select
										value={simulatePaymentMethodId}
										onValueChange={(v) => {
											setSimulatePaymentMethodId(v)
											setSimulateInstallments(1)
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Selecione..." />
										</SelectTrigger>
										<SelectContent>
											{paymentMethods.map((pm) => (
												<SelectItem key={pm.id} value={pm.id}>
													{pm.description}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								{simulatePaymentMethodId && (() => {
									const pm = paymentMethods.find((p) => p.id === simulatePaymentMethodId)
									if (pm?.type === 'credito') {
										const fees = Array.isArray(pm.credit_installment_fees) ? pm.credit_installment_fees : []
										const maxInstallments = fees.length > 0
											? Math.max(...fees.map((f) => f.installments))
											: 12
										return (
											<div className="space-y-2">
												<Label>Parcelas</Label>
												<Select
													value={String(simulateInstallments)}
													onValueChange={(v) => setSimulateInstallments(parseInt(v, 10) || 1)}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => (
															<SelectItem key={n} value={String(n)}>
																{n}x
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										)
									}
									return null
								})()}
								{getSimulateResult() && (
									<div className="rounded-lg border bg-muted/50 px-4 py-3 space-y-2">
										<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resultado</p>
										{(() => {
											const r = getSimulateResult()!
											return (
												<>
													<p className="text-sm">
														Valor a receber: R$ {centsToReais(r.receiveCents)}
													</p>
													<p className="text-sm">
														Valor que preciso cobrar: R$ {centsToReais(r.chargeCents)}
													</p>
													{r.installments != null && r.valuePerInstallmentCents != null && (
														<p className="text-sm">
															Valor da parcela: R$ {centsToReais(r.valuePerInstallmentCents)}
														</p>
													)}
													{r.feePercent > 0 && (
														<>
															<p className="text-sm">
																Valor do juros: R$ {centsToReais(r.feeCents)}
															</p>
															<p className="text-sm">
																Percentual: {r.feePercent.toFixed(2)}%
															</p>
														</>
													)}
												</>
											)
										})()}
									</div>
								)}
							</>
						)}
					</div>
					<DialogFooter>
						<Button type="button" onClick={() => setSimulateModalTarget(null)}>
							Fechar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<ResaleDeviceTermsDialog
				open={showTermsDialog}
				onOpenChange={setShowTermsDialog}
				device={
					termsDevice
						? {
							id: termsDevice.id,
							device_name: termsDevice.device_name,
							model: termsDevice.model,
							color: termsDevice.color,
							storage_gb: termsDevice.storage_gb,
							battery: termsDevice.battery,
							imei: termsDevice.imei,
							serial: termsDevice.serial,
							sold_for_cents: termsDevice.sold_for_cents,
							sale_date: termsDevice.sale_date,
							buyer_name: termsDevice.buyer_name ?? null,
							buyer_cpf: termsDevice.buyer_cpf ?? null,
							sale_details: termsDevice.sale_details ?? null,
							payment_method_id: termsDevice.payment_method_id ?? null,
							payment_installments: termsDevice.payment_installments ?? null,
							sale_payment_methods: termsDevice.sale_payment_methods ?? null,
						}
						: null
				}
			/>

			<Dialog open={!!costModalTarget} onOpenChange={(open) => !open && setCostModalTarget(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Adicionar custo</DialogTitle>
						<DialogDescription>
							Informe a descrição e o valor do custo adicional para este aparelho.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">Descrição</label>
							<Input
								value={costDescription}
								onChange={(e) => setCostDescription(e.target.value)}
								placeholder="Ex: Troca de tela, frete..."
							/>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Valor (R$)</label>
							<Input
								value={costValue}
								onChange={(e) => setCostValue(formatMoneyInput(e.target.value))}
								placeholder="0,00"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setCostModalTarget(null)} disabled={isSavingCost}>
							Cancelar
						</Button>
						<Button type="button" onClick={handleConfirmCost} disabled={isSavingCost || !costValue.trim()}>
							{isSavingCost ? 'Salvando…' : 'Adicionar'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={!!sellModalTarget} onOpenChange={(open) => !open && setSellModalTarget(null)}>
				<DialogContent className="max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Marcar como vendido</DialogTitle>
						<DialogDescription>
							O valor total da venda é a soma dos valores informados em cada forma de pagamento. A data da venda será registrada.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						{sellModalTarget ? (
							<div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground space-y-1">
								<p className="font-medium text-foreground">Valores sugeridos (referência)</p>
								{sellModalTarget.sale_value_cents != null && (
									<p>Varejo cadastrado: R$ {centsToReais(sellModalTarget.sale_value_cents)}</p>
								)}
								{sellModalTarget.wholesale_value_cents != null && (
									<p>Atacado cadastrado: R$ {centsToReais(sellModalTarget.wholesale_value_cents)}</p>
								)}
								{sellModalTarget.sale_value_cents == null && sellModalTarget.wholesale_value_cents == null && (
									<p>Não há preços de varejo ou atacado cadastrados neste aparelho; use apenas as formas de pagamento abaixo.</p>
								)}
							</div>
						) : null}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label>Formas de pagamento</Label>
								<Button type="button" variant="outline" size="sm" onClick={addSellPaymentMethod} className="gap-1">
									<Plus className="h-3.5 w-3.5" />
									Adicionar
								</Button>
							</div>
							<div className="space-y-3">
								{sellPaymentMethods.map((entry, i) => (
									<div key={entry.rowKey} className="flex flex-wrap items-end gap-2 rounded border p-2 bg-muted/30">
										<div className="flex-1 min-w-[140px] space-y-1">
											<Label className="text-xs">Forma</Label>
											<Select
												value={entry.payment_method_id || '__none__'}
												onValueChange={(v) => {
													if (v === '__none__') {
														setSellPaymentMethodAt(i, { payment_method_id: '', value_cents: null, installments: 1 })
														return
													}
													setSellPaymentMethodAt(i, { payment_method_id: v, installments: 1 })
												}}
											>
												<SelectTrigger className="h-9">
													<SelectValue placeholder="Selecione..." />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="__none__">Nenhum</SelectItem>
													{paymentMethods.map((pm) => (
														<SelectItem key={pm.id} value={pm.id}>
															{pm.description}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<div className="w-28 space-y-1">
											<Label className="text-xs">Valor (R$)</Label>
											<Input
												value={entry.value_cents != null ? maskedFromCents(entry.value_cents) : ''}
												onChange={(e) => {
													const raw = moneyToCentsFromMasked(formatMoneyInput(e.target.value))
													setSellPaymentMethodAt(i, { value_cents: raw })
												}}
												placeholder="0,00"
												className="h-9"
											/>
										</div>
										{entry.payment_method_id && (() => {
											const pm = paymentMethods.find((p) => p.id === entry.payment_method_id)
											const isCredit = pm?.type === 'credito'
											if (!isCredit) return null
											const maxInstallments = pm?.credit_installment_fees?.length
												? Math.max(...pm.credit_installment_fees.map((f) => f.installments))
												: 12
											return (
												<div className="w-20 space-y-1">
													<Label className="text-xs">Parcelas</Label>
													<Select
														value={String(entry.installments || 1)}
														onValueChange={(v) => setSellPaymentMethodAt(i, { installments: Number(v) || 1 })}
													>
														<SelectTrigger className="h-9">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{Array.from({ length: maxInstallments }, (_, n) => n + 1).map((n) => (
																<SelectItem key={n} value={String(n)}>
																	{n}x
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
											)
										})()}
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
											onClick={() => removeSellPaymentMethod(i)}
											disabled={sellPaymentMethods.length <= 1}
											aria-label="Remover forma de pagamento"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
						</div>
						{sellModalTarget ? (
							<ResaleSellCommissionPanel
								key={commissionBoot.seq}
								ref={sellCommissionPanelRef}
								device={sellModalTarget}
								sellPaymentMethods={sellPaymentMethods}
								paymentMethods={paymentMethods}
								teamUsers={teamUsers}
								initial={commissionBoot.initial}
							/>
						) : null}
						<div className="space-y-3 rounded-md border p-3">
							<div className="flex items-start space-x-2">
								<Checkbox
									id="sell-generate-term"
									className="mt-0.5"
									checked={sellGenerateWarrantyTerm}
									onCheckedChange={(v) => {
										const on = v === true
										setSellGenerateWarrantyTerm(on)
										if (on && !sellSaleDetails.trim() && sellModalTarget?.info?.trim()) {
											setSellSaleDetails(sellModalTarget.info.trim())
										}
									}}
								/>
								<div className="space-y-0.5 leading-snug">
									<Label htmlFor="sell-generate-term" className="font-normal cursor-pointer">
										Gerar termo de garantia
									</Label>
									<p className="text-xs text-muted-foreground">
										Só é necessário preencher nome, documento e detalhes quando for imprimir o termo.
									</p>
								</div>
							</div>
							{sellGenerateWarrantyTerm ? (
								<div className="space-y-3 border-t pt-3 pl-1">
									<div className="space-y-2">
										<Label>Nome completo do comprador</Label>
										<Input
											value={sellBuyerName}
											onChange={(e) => setSellBuyerName(e.target.value)}
											placeholder="Nome completo"
										/>
									</div>
									<div className="space-y-2">
										<Label>CPF/CNPJ do comprador</Label>
										<Input
											value={sellBuyerCpf}
											onChange={(e) => setSellBuyerCpf(formatCpfCnpj(e.target.value))}
											placeholder="CPF ou CNPJ"
											inputMode="numeric"
										/>
									</div>
									<div className="space-y-2">
										<Label>Detalhes do aparelho no termo</Label>
										<Textarea
											value={sellSaleDetails}
											onChange={(e) => setSellSaleDetails(e.target.value)}
											placeholder="Texto exibido no termo de compra."
											rows={3}
										/>
									</div>
								</div>
							) : null}
						</div>
						<div className="space-y-2">
							<Label htmlFor="sell-date">Data da venda</Label>
							<Input
								id="sell-date"
								type="date"
								value={sellDate}
								onChange={(e) => setSellDate(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setSellModalTarget(null)} disabled={isSavingSell}>
							Cancelar
						</Button>
						<Button
							type="button"
							onClick={handleConfirmSell}
							disabled={isSavingSell || getSellPaymentsTotalCents() === null}
						>
							{isSavingSell ? 'Salvando…' : 'Confirmar venda'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir aparelho</AlertDialogTitle>
						<AlertDialogDescription>
							Tem certeza que deseja excluir este aparelho? Os custos vinculados também serão removidos.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
							{isDeleting ? 'Excluindo…' : 'Excluir'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

type ResumoProps = {
	devices: ResaleDevice[]
	stats: SeminovosStats | null
	showValues: boolean
}

function formatVariacao(atual: number, anterior: number): { text: string; positive: boolean } | null {
	if (anterior === 0) return null
	const variacao = ((atual - anterior) / anterior) * 100
	const positive = variacao >= 0
	const text = `${positive ? '+' : ''}${variacao.toFixed(1)}%`
	return { text, positive }
}

function ResumoFinanceiro({ devices, stats, showValues }: ResumoProps) {
	const qtd = devices.length
	const estoqueCents = devices.reduce((acc, d) => acc + (d.purchase_value_cents ?? 0), 0)
	const margemPrevistaAtacadoCents = devices.reduce((acc, d) => acc + (d.expected_profit_wholesale_cents ?? 0), 0)
	const valorPotencialVarejoCents = devices.reduce((acc, d) => acc + (d.sale_value_cents ?? 0), 0)
	const margemPrevistaVarejoCents = devices.reduce((acc, d) => acc + (d.expected_profit_sale_cents ?? 0), 0)
	const custoReparosCents = devices.reduce((acc, d) => {
		const costs = (d.costs || []).reduce((c, x) => c + (x.value_cents ?? 0), 0)
		return acc + costs
	}, 0)
	const ticketMedioCents = qtd > 0 ? Math.round(estoqueCents / qtd) : 0

	const vendasMesCents = stats?.soldThisMonthCents ?? 0
	const vendasMesQty = stats?.soldThisMonthCount ?? 0
	const lucroRealMesCents = stats?.profitThisMonthCents ?? 0
	const ticketMedioVendaCents = vendasMesQty > 0 ? Math.round(vendasMesCents / vendasMesQty) : 0

	const vendasMesAntCents = stats?.soldLastMonthCents ?? 0
	const lucroMesAntCents = stats?.profitLastMonthCents ?? 0
	const variacaoVendas = formatVariacao(vendasMesCents, vendasMesAntCents)
	const variacaoLucro = formatVariacao(lucroRealMesCents, lucroMesAntCents)

	const totalComVendas = qtd + vendasMesQty
	const taxaConversao = totalComVendas > 0 ? (vendasMesQty / totalComVendas) * 100 : 0

	const hoje = new Date()
	const diasEmEstoque = devices
		.filter((d) => d.purchase_date && /^\d{4}-\d{2}-\d{2}/.test(String(d.purchase_date)))
		.map((d) => {
			const dateStr = String(d.purchase_date).slice(0, 10)
			const compra = new Date(dateStr + 'T12:00:00')
			const dias = Math.floor((hoje.getTime() - compra.getTime()) / (1000 * 60 * 60 * 24))
			return dias >= 0 ? dias : 0
		})
	const tempoMedioEstoqueDias = diasEmEstoque.length > 0 ? Math.round(diasEmEstoque.reduce((a, b) => a + b, 0) / diasEmEstoque.length) : 0

	const blocks = [
		{ title: 'Disponíveis', value: String(qtd), sub: undefined as string | undefined, icon: Package, color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-800 dark:text-emerald-300', hideValue: false },
		{ title: 'Valor em estoque', value: `R$ ${centsToReais(estoqueCents)}`, sub: undefined, icon: DollarSign, color: 'bg-blue-500/20 border-blue-500/40 text-blue-800 dark:text-blue-300', hideValue: true },
		{ title: 'Ticket médio (compra)', value: `R$ ${centsToReais(ticketMedioCents)}`, sub: undefined, icon: BarChart3, color: 'bg-slate-500/20 border-slate-500/40 text-slate-800 dark:text-slate-300', hideValue: true },
		{ title: 'Tempo médio em estoque', value: tempoMedioEstoqueDias > 0 ? `${tempoMedioEstoqueDias} dias` : '-', sub: diasEmEstoque.length > 0 ? `${diasEmEstoque.length} com data` : undefined, icon: BarChart3, color: 'bg-sky-500/20 border-sky-500/40 text-sky-800 dark:text-sky-300', hideValue: false },
		{ title: 'Valor potencial (varejo)', value: `R$ ${centsToReais(valorPotencialVarejoCents)}`, sub: undefined, icon: TrendingUp, color: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-800 dark:text-cyan-300', hideValue: true },
		{ title: 'Margem prevista (atacado)', value: `R$ ${centsToReais(margemPrevistaAtacadoCents)}`, sub: undefined, icon: Calculator, color: 'bg-violet-500/20 border-violet-500/40 text-violet-800 dark:text-violet-300', hideValue: true },
		{ title: 'Margem prevista (varejo)', value: `R$ ${centsToReais(margemPrevistaVarejoCents)}`, sub: undefined, icon: Calculator, color: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-800 dark:text-indigo-300', hideValue: true },
		{ title: 'Custo em reparos', value: `R$ ${centsToReais(custoReparosCents)}`, sub: undefined, icon: Wrench, color: 'bg-orange-500/20 border-orange-500/40 text-orange-800 dark:text-orange-300', hideValue: true },
		{ title: 'Taxa de conversão (mês)', value: `${taxaConversao.toFixed(1)}%`, sub: totalComVendas > 0 ? `${vendasMesQty}/${totalComVendas} vendidos` : undefined, icon: TrendingUp, color: 'bg-teal-500/20 border-teal-500/40 text-teal-800 dark:text-teal-300', hideValue: false },
		{ title: 'Vendas no mês', value: `R$ ${centsToReais(vendasMesCents)}`, sub: variacaoVendas ? `${variacaoVendas.text} vs mês ant` : `${vendasMesQty} venda(s)`, icon: DollarSign, color: 'bg-amber-500/20 border-amber-500/40 text-amber-800 dark:text-amber-300', hideValue: true },
		{ title: 'Ticket médio (venda)', value: `R$ ${centsToReais(ticketMedioVendaCents)}`, sub: vendasMesQty > 0 ? `mês atual` : undefined, icon: BarChart3, color: 'bg-amber-600/20 border-amber-600/40 text-amber-900 dark:text-amber-200', hideValue: true },
		{ title: 'Lucro real (mês)', value: `R$ ${centsToReais(lucroRealMesCents)}`, sub: variacaoLucro ? `${variacaoLucro.text} vs mês ant` : undefined, icon: TrendingUp, color: 'bg-green-600/25 border-green-600/50 text-green-900 dark:text-green-200', hideValue: true },
	]

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
				{blocks.map((b) => {
					const Icon = b.icon
					return (
						<div
							key={b.title}
							className={`rounded-xl border-2 px-3 py-2.5 sm:px-4 sm:py-3.5 min-h-[72px] sm:min-h-[88px] flex flex-col justify-center transition-colors ${b.color}`}
						>
							<div className="flex items-center gap-2 mb-1">
								<Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 opacity-90" />
								<p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider opacity-90 truncate">{b.title}</p>
							</div>
							{showValues || !b.hideValue ? (
								<>
									<p className="text-base sm:text-lg font-bold leading-tight break-words">{b.value}</p>
									{b.sub != null && <p className="text-[11px] mt-0.5 opacity-85">{b.sub}</p>}
								</>
							) : (
								<Skeleton className="h-7 w-24 mt-1" />
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
