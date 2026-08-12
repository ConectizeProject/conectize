'use client'

import Link from 'next/link'
import { compressImageForEntry } from '@/lib/image/compress-image'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatMoneyInput, maskedFromCents, moneyToCentsFromMasked } from '@/lib/utils/money'
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { appConfirm } from '@/lib/ui/app-dialogs'
import { parse3utoolsText } from '@/lib/resale/parse-3utools'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getLabelWindowFeatures } from '@/lib/ordem-print'
import {
  buildCopyClienteText,
  buildCopyLojistaText,
  buildSeminovoLabelHtml,
  type SeminovoActionDevice,
} from '@/lib/seminovos/seminovos-device-actions'
import {
  ResaleMarkSoldDialog,
  type ResaleMarkSoldDevice,
} from '@/components/resale/ResaleMarkSoldDialog'
import { ArrowLeft, DollarSign, Eye, FileInput, Loader2, MoreHorizontal, Plus, Smartphone, Store, Tag, Trash2, Undo2, UserRound } from 'lucide-react'
import { ResaleDeviceTermsDialog } from './ResaleDeviceTermsDialog'
import { isSaleDerivedCostDescription } from '@/lib/resale/resale-sale-costs'
import { revendaPath } from '@/lib/revenda/revenda-paths'

type CostRow = { id?: string; description: string; value_cents: number }

type ResaleDevice = {
  id: string
  device_model_id: string | null
  device_name: string | null
  model: string | null
  color: string | null
  storage_gb: string | null
  battery: string | null
  condition: string | null
  /** Observações / detalhes gerais (API pode expor como info). */
  info: string | null
  imei: string | null
  imei2: string | null
  serial: string | null
  purchase_value_cents: number | null
  wholesale_value_cents: number | null
  expected_profit_wholesale_cents: number | null
  sale_value_cents: number | null
  expected_profit_sale_cents: number | null
  sold_for_cents: number | null
  advertised: boolean
  tested: boolean
  label: string | null
  sold: boolean
  actual_profit_cents: number | null
  purchase_date: string | null
  sale_date: string | null
  created_at: string
  costs: CostRow[]
  payment_method_id: string | null
  payment_installments: number | null
  sale_payment_methods?: Array<{ payment_method_id: string; value_cents?: number | null; installments?: number }> | null
  buyer_name: string | null
  buyer_cpf: string | null
  sale_details: string | null
  stock_type?: string | null
  sale_commission_user_id?: string | null
  image_url?: string | null
  image_storage_path?: string | null
  image_gallery_paths?: string[] | null
  display_image_url?: string | null
}

function centsToReais(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}

const emptyCost = (): CostRow => ({ description: '', value_cents: 0 })

function getInitialFromDevice(d: ResaleDevice | null | undefined) {
  if (!d) return null
  const costs = (d.costs && d.costs.length > 0)
    ? d.costs.map((c) => ({ id: c.id, description: c.description ?? '', value_cents: c.value_cents ?? 0 }))
    : [emptyCost()]
  return {
    deviceName: d.device_name ?? d.model ?? '',
    model: d.model ?? '',
    color: d.color ?? '',
    storageGb: d.storage_gb ?? '',
    battery: d.battery ?? '',
    condition: d.condition ?? '',
    info: d.info ?? '',
    imei: d.imei ?? '',
    imei2: d.imei2 ?? '',
    serial: d.serial ?? '',
    purchaseValue: centsToReais(d.purchase_value_cents),
    wholesaleValue: centsToReais(d.wholesale_value_cents),
    expectedProfitWholesale: centsToReais(d.expected_profit_wholesale_cents),
    saleValue: centsToReais(d.sale_value_cents),
    expectedProfitSale: centsToReais(d.expected_profit_sale_cents),
    soldFor: centsToReais((d as { sold_for_cents?: number | null }).sold_for_cents),
    advertised: Boolean(d.advertised),
    tested: Boolean(d.tested),
    label: Boolean(d.label),
    sold: Boolean(d.sold),
    purchaseDate: d.purchase_date ?? '',
    saleDate: d.sale_date ?? '',
    costs,
    stockType: d.stock_type === 'lacrado' ? 'lacrado' as const : 'seminovo' as const,
    imageUrl: d.image_url ?? '',
    galleryPaths: Array.isArray(d.image_gallery_paths)
      ? d.image_gallery_paths.filter((p): p is string => Boolean(p && String(p).trim()))
      : [],
  }
}

type Props = {
  deviceId?: string
  isCreate: boolean
  initialDevice?: ResaleDevice | null
  initialDisplayImageUrl?: string | null
  defaultStockType?: 'seminovo' | 'lacrado'
  backHref?: string
  role?: string
}

export function SeminovosFormClient ({
  deviceId,
  isCreate,
  initialDevice,
  initialDisplayImageUrl = null,
  defaultStockType = 'seminovo',
  backHref = revendaPath.listagem,
  role = 'staff',
}: Props) {
  const router = useRouter()
  const isAdmin = role === 'admin' || role === 'platform_admin'
  const init = getInitialFromDevice(initialDevice)
  const hasInitial = Boolean(init)
  const isNewLacradoFlow = isCreate && defaultStockType === 'lacrado'

  const [isLoadingDevice, setIsLoadingDevice] = useState(Boolean(deviceId) && !hasInitial)
  const [isSaving, setIsSaving] = useState(false)
  const [postCreateLabelOfferOpen, setPostCreateLabelOfferOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [threeUtoolsRaw, setThreeUtoolsRaw] = useState('')

  const [formDeviceName, setFormDeviceName] = useState(init?.deviceName ?? '')
  const [formModel, setFormModel] = useState(init?.model ?? '')
  const [formColor, setFormColor] = useState(init?.color ?? '')
  const [formStorageGb, setFormStorageGb] = useState(init?.storageGb ?? '')
  const [formBattery, setFormBattery] = useState(init?.battery ?? '')
  const [formCondition, setFormCondition] = useState(init?.condition ?? '')
  const [formInfo, setFormInfo] = useState(init?.info ?? '')
  const [formImageUrl, setFormImageUrl] = useState(init?.imageUrl ?? '')
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(() => initialDisplayImageUrl ?? null)
  const [hasStorageImage, setHasStorageImage] = useState(() => Boolean(initialDevice?.image_storage_path))
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const photoFileInputRef = useRef<HTMLInputElement>(null)
  const galleryFileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingGallery, setIsUploadingGallery] = useState(false)
  const [formImei, setFormImei] = useState(init?.imei ?? '')
  const [formImei2, setFormImei2] = useState(init?.imei2 ?? '')
  const [formSerial, setFormSerial] = useState(init?.serial ?? '')
  const [formPurchaseValue, setFormPurchaseValue] = useState(init?.purchaseValue ?? '')
  const [formWholesaleValue, setFormWholesaleValue] = useState(init?.wholesaleValue ?? '')
  const [formExpectedProfitWholesale, setFormExpectedProfitWholesale] = useState(init?.expectedProfitWholesale ?? '')
  const [formSaleValue, setFormSaleValue] = useState(init?.saleValue ?? '')
  const [formExpectedProfitSale, setFormExpectedProfitSale] = useState(init?.expectedProfitSale ?? '')
  const [formSoldFor, setFormSoldFor] = useState(init?.soldFor ?? '')
  const [formAdvertised, setFormAdvertised] = useState(init?.advertised ?? false)
  const [formTested, setFormTested] = useState(init?.tested ?? false)
  const [formLabel, setFormLabel] = useState(init?.label ?? false)
  const [formSold, setFormSold] = useState(init?.sold ?? false)
  const [formPurchaseDate, setFormPurchaseDate] = useState(() => {
    if (init) return init.purchaseDate
    if (isCreate) {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    return ''
  })
  const [formSaleDate, setFormSaleDate] = useState(init?.saleDate ?? '')
  const [formCosts, setFormCosts] = useState<CostRow[]>(init?.costs ?? [emptyCost()])
  const [formStockType, setFormStockType] = useState<'seminovo' | 'lacrado'>(init?.stockType ?? defaultStockType)
  const [formGalleryPaths, setFormGalleryPaths] = useState<string[]>(() => init?.galleryPaths ?? [])
  const [galleryPreviewByPath, setGalleryPreviewByPath] = useState<Record<string, string>>({})
  const [sellDialogOpen, setSellDialogOpen] = useState(false)
  const [sellDialogMode, setSellDialogMode] = useState<'create' | 'edit'>('create')
  const [sellDeviceSnapshot, setSellDeviceSnapshot] = useState<ResaleMarkSoldDevice | null>(null)
  const [isSavingSell, setIsSavingSell] = useState(false)
  const [showTermsDialog, setShowTermsDialog] = useState(false)
  const [termsDevice, setTermsDevice] = useState<ResaleDevice | null>(null)

  const loadDevice = useCallback(async () => {
    if (!deviceId || hasInitial) return
    setIsLoadingDevice(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}`)
      const data = await res?.json().catch(() => null)
      if (data?.ok && data.device) {
        const inited = getInitialFromDevice(data.device as ResaleDevice)
        if (inited) {
          setFormDeviceName(inited.deviceName)
          setFormModel(inited.model)
          setFormColor(inited.color)
          setFormStorageGb(inited.storageGb)
          setFormBattery(inited.battery)
          setFormCondition(inited.condition)
          setFormInfo(inited.info)
          setFormImageUrl(inited.imageUrl)
          const loaded = data.device as ResaleDevice & { display_image_url?: string | null }
          setPhotoPreviewUrl(loaded.display_image_url ?? null)
          setHasStorageImage(Boolean(loaded.image_storage_path))
          setFormImei(inited.imei)
          setFormImei2(inited.imei2)
          setFormSerial(inited.serial)
          setFormPurchaseValue(inited.purchaseValue)
          setFormWholesaleValue(inited.wholesaleValue)
          setFormExpectedProfitWholesale(inited.expectedProfitWholesale)
          setFormSaleValue(inited.saleValue)
          setFormExpectedProfitSale(inited.expectedProfitSale)
          setFormSoldFor(inited.soldFor)
          setFormAdvertised(inited.advertised)
          setFormTested(inited.tested)
          setFormLabel(inited.label)
          setFormSold(inited.sold)
          setFormPurchaseDate(inited.purchaseDate)
          setFormSaleDate(inited.saleDate)
          setFormCosts(inited.costs)
          setFormStockType(inited.stockType)
          setFormGalleryPaths(inited.galleryPaths ?? [])
        }
      }
    } finally {
      setIsLoadingDevice(false)
    }
  }, [deviceId, hasInitial])

  useEffect(() => {
    loadDevice()
  }, [loadDevice])

  useEffect(() => {
    setPhotoPreviewUrl(initialDisplayImageUrl ?? null)
    setHasStorageImage(Boolean(initialDevice?.image_storage_path))
  }, [initialDisplayImageUrl, initialDevice?.image_storage_path, initialDevice?.id])

  useEffect(() => {
    if (hasStorageImage) return
    const u = formImageUrl.trim()
    if (!u) {
      setPhotoPreviewUrl(null)
      return
    }
    try {
      const parsed = new URL(u)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        setPhotoPreviewUrl(u)
      }
    } catch {
      // ignore
    }
  }, [formImageUrl, hasStorageImage])

  useEffect(() => {
    if (isNewLacradoFlow) setFormStockType('lacrado')
  }, [isNewLacradoFlow])

  useEffect(() => {
    if (formStockType === 'lacrado') {
      setFormBattery('')
      setFormCondition('')
    }
  }, [formStockType])

  useEffect(() => {
    if (!isCreate || formStockType === 'lacrado') return
    const dn = formDeviceName.trim()
    if (dn.length < 2) return
    const t = window.setTimeout(() => {
      void (async () => {
        const params = new URLSearchParams()
        params.set('deviceName', dn)
        if (formStorageGb.trim()) params.set('storageGb', formStorageGb.trim())
        if (formCondition.trim()) params.set('condition', formCondition.trim())
        const res = await portalFetch(`/api/portal/resale-pricing-hint?${params}`)
        const data = await res.json().catch(() => null)
        const hint = data?.hint as {
          purchase_value_cents?: number | null
          wholesale_value_cents?: number | null
          sale_value_cents?: number | null
        } | null
        if (!hint) return
        const isEmptyMoney = (s: string) => !String(s || '').trim()
        if (isEmptyMoney(formPurchaseValue) && hint.purchase_value_cents != null && hint.purchase_value_cents > 0) {
          setFormPurchaseValue(maskedFromCents(hint.purchase_value_cents))
        }
        if (isEmptyMoney(formWholesaleValue) && hint.wholesale_value_cents != null && hint.wholesale_value_cents > 0) {
          setFormWholesaleValue(maskedFromCents(hint.wholesale_value_cents))
        }
        if (isEmptyMoney(formSaleValue) && hint.sale_value_cents != null && hint.sale_value_cents > 0) {
          setFormSaleValue(maskedFromCents(hint.sale_value_cents))
        }
      })()
    }, 500)
    return () => window.clearTimeout(t)
  }, [isCreate, formStockType, formDeviceName, formStorageGb, formCondition])

  function handleParse3utools() {
    const parsed = parse3utoolsText(threeUtoolsRaw)
    if (parsed.model) setFormDeviceName(parsed.model)
    if (parsed.modelNumber) setFormModel(parsed.modelNumber)
    if (parsed.color) setFormColor(parsed.color)
    if (parsed.storage_gb) setFormStorageGb(parsed.storage_gb)
    if (parsed.imei) setFormImei(parsed.imei)
    if (parsed.imei2) setFormImei2(parsed.imei2)
    if (parsed.serial) setFormSerial(parsed.serial)
  }

  function addCost() {
    setFormCosts((prev) => [...prev, emptyCost()])
  }

  function removeCost(index: number) {
    setFormCosts((prev) => prev.filter((_, i) => i !== index))
  }

  async function handlePhotoFileChange (e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !deviceId) return
    if (!file.type.startsWith('image/') || file.size === 0) return
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', description: 'Imagem deve ter no máximo 10 MB.', duration: 3000 })
      return
    }
    setIsUploadingPhoto(true)
    try {
      const blob = await compressImageForEntry(file)
      const fd = new FormData()
      fd.append('files', blob, file.name || 'photo.jpg')
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}/photo`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json().catch(() => null)
      if (data?.ok) {
        setHasStorageImage(true)
        setFormImageUrl('')
        if (typeof data.signed_url === 'string' && data.signed_url) {
          setPhotoPreviewUrl(data.signed_url)
        }
        toast({ description: 'Foto enviada.', duration: 2000 })
      } else {
        toast({ variant: 'destructive', description: 'Não foi possível enviar a foto.', duration: 3000 })
      }
    } catch {
      toast({ variant: 'destructive', description: 'Erro ao enviar a foto.', duration: 3000 })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  async function handleRemovePhoto () {
    if (!deviceId) return
    if (hasStorageImage) {
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}/photo`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!data?.ok) {
        toast({ variant: 'destructive', description: 'Não foi possível remover a foto do armazenamento.', duration: 3000 })
        return
      }
    }
    setHasStorageImage(false)
    setFormImageUrl('')
    setPhotoPreviewUrl(null)
  }

  async function handleGalleryFileChange (e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !deviceId) return
    if (!file.type.startsWith('image/') || file.size === 0) return
    if (formGalleryPaths.length >= 9) {
      toast({ variant: 'destructive', description: 'Limite de 9 fotos extras (10 no total com a capa).', duration: 3000 })
      return
    }
    setIsUploadingGallery(true)
    try {
      const blob = await compressImageForEntry(file)
      const fd = new FormData()
      fd.append('files', blob, file.name || 'photo.jpg')
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}/gallery`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json().catch(() => null)
      if (data?.ok && Array.isArray(data.image_gallery_paths)) {
        setFormGalleryPaths(data.image_gallery_paths as string[])
        if (typeof data.path === 'string' && typeof data.signed_url === 'string' && data.signed_url) {
          setGalleryPreviewByPath((prev) => ({ ...prev, [data.path]: data.signed_url }))
        }
        toast({ description: 'Foto adicionada à galeria.', duration: 2000 })
      } else if (data?.error === 'gallery_full') {
        toast({ variant: 'destructive', description: 'Galeria cheia.', duration: 3000 })
      } else {
        toast({ variant: 'destructive', description: 'Não foi possível enviar a foto.', duration: 3000 })
      }
    } catch {
      toast({ variant: 'destructive', description: 'Erro ao enviar a foto.', duration: 3000 })
    } finally {
      setIsUploadingGallery(false)
    }
  }

  async function handleRemoveGalleryPath (path: string) {
    if (!deviceId) return
    const res = await portalFetch(
      `/api/portal/resale-devices/${deviceId}/gallery?path=${encodeURIComponent(path)}`,
      { method: 'DELETE' },
    )
    const data = await res.json().catch(() => null)
    if (!data?.ok) {
      toast({ variant: 'destructive', description: 'Não foi possível remover a foto.', duration: 3000 })
      return
    }
    setFormGalleryPaths(Array.isArray(data.image_gallery_paths) ? data.image_gallery_paths : [])
    setGalleryPreviewByPath((prev) => {
      const next = { ...prev }
      delete next[path]
      return next
    })
  }

  function updateCost(index: number, field: 'description' | 'value_cents', value: string | number) {
    setFormCosts((prev) => {
      const next = [...prev]
      if (field === 'description') {
        next[index] = { ...next[index], description: String(value) }
      } else {
        const cents =
          typeof value === 'number'
            ? value
            : moneyToCentsFromMasked(String(value)) ?? 0
        next[index] = { ...next[index], value_cents: cents }
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSaving) return
    setErrorMessage('')

    const costsPayload = formCosts
      .filter((c) => (c.description && c.description.trim()) || (c.value_cents && c.value_cents > 0))
      .map((c) => ({
        description: c.description.trim() || null,
        value_cents: c.value_cents ?? 0,
      }))

    function toReaisNum(s: string): number | null {
      const cents = moneyToCentsFromMasked(s)
      if (cents === null) return null
      return cents / 100
    }

    const payload: Record<string, unknown> = {
      device_name: formDeviceName.trim() || null,
      model: formModel.trim() || null,
      color: formColor.trim() || null,
      storage_gb: formStorageGb.trim() || null,
      battery: formStockType === 'lacrado' ? null : (formBattery.trim() || null),
      condition: formStockType === 'lacrado' ? null : (formCondition.trim() || null),
      info: formInfo.trim() || null,
      image_url: formImageUrl.trim() || null,
      image_gallery_paths: formGalleryPaths,
      imei: formImei.trim() || null,
      imei2: formImei2.trim() || null,
      serial: formSerial.trim() || null,
      wholesale_value: toReaisNum(formWholesaleValue) ?? null,
      sale_value: toReaisNum(formSaleValue) ?? null,
      sold_for: toReaisNum(formSoldFor) ?? null,
      advertised: formAdvertised,
      tested: formTested,
      label: formLabel ? '1' : null,
      sold: formSold,
      purchase_date: formPurchaseDate.trim() || null,
      sale_date: formSaleDate.trim() || null,
      costs: costsPayload,
      stock_type: formStockType,
    }
    if (isAdmin) {
      payload.purchase_value = toReaisNum(formPurchaseValue) ?? null
      payload.expected_profit_wholesale = toReaisNum(formExpectedProfitWholesale) ?? null
      payload.expected_profit_sale = toReaisNum(formExpectedProfitSale) ?? null
      payload.actual_profit = (() => {
        const soldCents = moneyToCentsFromMasked(formSoldFor)
        const purchaseCents = moneyToCentsFromMasked(formPurchaseValue) ?? 0
        const costsCents = formCosts.reduce((acc, c) => acc + (c.value_cents ?? 0), 0)
        if (soldCents === null) return null
        return soldCents - purchaseCents - costsCents
      })()
    }

    setIsSaving(true)
    try {
      if (deviceId) {
        const res = await portalFetch(`/api/portal/resale-devices/${deviceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res?.json().catch(() => null)
        if (data?.ok) {
          router.push(backHref)
        } else {
          setErrorMessage(data?.message || 'Não foi possível salvar.')
        }
      } else {
        const res = await portalFetch('/api/portal/resale-devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res?.json().catch(() => null)
        if (data?.ok) {
          toast({ title: 'Aparelho cadastrado', variant: 'success' })
          setPostCreateLabelOfferOpen(true)
        } else {
          setErrorMessage(data?.message || 'Não foi possível cadastrar.')
        }
      }
    } catch {
      setErrorMessage('Erro ao salvar.')
    } finally {
      setIsSaving(false)
    }
  }

  const totalCostsCents = formCosts.reduce((acc, c) => acc + (c.value_cents ?? 0), 0)

  useEffect(() => {
    const purchaseCents = moneyToCentsFromMasked(formPurchaseValue) ?? 0
    const wholesaleCents = moneyToCentsFromMasked(formWholesaleValue)
    const saleCents = moneyToCentsFromMasked(formSaleValue)

    if (wholesaleCents != null) {
      const diff = wholesaleCents - purchaseCents
      setFormExpectedProfitWholesale(maskedFromCents(diff))
    } else {
      setFormExpectedProfitWholesale('')
    }

    if (saleCents != null) {
      const diff = saleCents - purchaseCents
      setFormExpectedProfitSale(maskedFromCents(diff))
    } else {
      setFormExpectedProfitSale('')
    }
  }, [formPurchaseValue, formWholesaleValue, formSaleValue])

  function buildMarkSoldDevice (
    source?: ResaleDevice | null,
  ): ResaleMarkSoldDevice | null {
    if (!deviceId) return null
    const fromDevice = source ?? initialDevice ?? null
    return {
      id: deviceId,
      device_name: (source?.device_name ?? formDeviceName) || null,
      model: (source?.model ?? formModel) || null,
      color: (source?.color ?? formColor) || null,
      storage_gb: (source?.storage_gb ?? formStorageGb) || null,
      battery: (source?.battery ?? formBattery) || null,
      info: (source?.info ?? formInfo) || null,
      imei: (source?.imei ?? formImei) || null,
      serial: (source?.serial ?? formSerial) || null,
      purchase_value_cents:
        source?.purchase_value_cents ?? moneyToCentsFromMasked(formPurchaseValue),
      wholesale_value_cents:
        source?.wholesale_value_cents ?? moneyToCentsFromMasked(formWholesaleValue),
      sale_value_cents:
        source?.sale_value_cents ?? moneyToCentsFromMasked(formSaleValue),
      sold_for_cents:
        source?.sold_for_cents ?? moneyToCentsFromMasked(formSoldFor),
      sale_date: (source?.sale_date ?? formSaleDate) || null,
      costs: (source?.costs ?? formCosts)
        .filter((c) => (c.description?.trim() || (c.value_cents ?? 0) > 0))
        .map((c) => ({
          id: c.id,
          description: c.description ?? '',
          value_cents: c.value_cents ?? 0,
        })),
      payment_method_id: fromDevice?.payment_method_id ?? null,
      payment_installments: fromDevice?.payment_installments ?? null,
      sale_payment_methods: fromDevice?.sale_payment_methods ?? null,
      buyer_name: fromDevice?.buyer_name ?? null,
      buyer_cpf: fromDevice?.buyer_cpf ?? null,
      sale_details: fromDevice?.sale_details ?? null,
      sale_commission_user_id: fromDevice?.sale_commission_user_id ?? null,
    }
  }

  function openSellModal () {
    const snapshot = buildMarkSoldDevice()
    if (!snapshot) return
    setSellDeviceSnapshot(snapshot)
    setSellDialogMode('create')
    setSellDialogOpen(true)
  }

  async function openEditSellModal () {
    if (!deviceId || isSavingSell) return
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}`)
      const data = await res?.json().catch(() => null)
      if (data?.ok && data.device) {
        const d = data.device as ResaleDevice
        const snapshot = buildMarkSoldDevice(d)
        if (!snapshot) return
        setSellDeviceSnapshot(snapshot)
        setSellDialogMode('edit')
        setSellDialogOpen(true)
      }
    } catch {
      // em caso de erro, não abre o dialog
    }
  }

  async function handleCancelSell() {
    if (!deviceId || isSavingSell) return
    if (!(await appConfirm({
      title: 'Cancelar a venda?',
      description: 'O valor e a data de venda serão removidos.',
      confirmLabel: 'Cancelar venda',
      destructive: true,
    }))) return
    setIsSavingSell(true)
    try {
      const res = await portalFetch(`/api/portal/resale-devices/${deviceId}`, {
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
        setFormSold(false)
        setFormSoldFor('')
        setFormSaleDate('')
        setShowTermsDialog(false)
        setFormCosts((prev) =>
          prev.filter((c) => !isSaleDerivedCostDescription(c.description))
        )
        toast({ description: 'Venda cancelada', duration: 2000 })
      } else {
        setErrorMessage(data?.message || 'Não foi possível cancelar.')
      }
    } catch {
      setErrorMessage('Erro ao cancelar.')
    } finally {
      setIsSavingSell(false)
    }
  }

  function getDeviceSnapshotForActions (): SeminovoActionDevice {
    return {
      device_name: formDeviceName.trim() || null,
      storage_gb: formStorageGb.trim() || null,
      color: formColor.trim() || null,
      battery: formStockType === 'lacrado' ? null : (formBattery.trim() || null),
      condition: formStockType === 'lacrado' ? null : (formCondition.trim() || null),
      info: formInfo.trim() || null,
      imei: formImei.trim() || null,
      wholesale_value_cents: moneyToCentsFromMasked(formWholesaleValue) ?? null,
      sale_value_cents: moneyToCentsFromMasked(formSaleValue) ?? null,
    }
  }

  async function handleCopyDeviceData () {
    const text = buildCopyLojistaText(getDeviceSnapshotForActions())
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

  async function handleHeaderCopyLojista () {
    const text = buildCopyLojistaText(getDeviceSnapshotForActions())
    if (!text) {
      toast({ variant: 'destructive', description: 'Nada para copiar. Preencha os dados do aparelho.' })
      return
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast({ variant: 'success', title: 'Copiado', description: 'Texto para lojista na área de transferência.', duration: 2000 })
      }
    } catch {
      // ignore
    }
  }

  async function handleHeaderCopyCliente () {
    const text = buildCopyClienteText(getDeviceSnapshotForActions())
    if (!text) {
      toast({ variant: 'destructive', description: 'Nada para copiar. Preencha os dados do aparelho.' })
      return
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast({ variant: 'success', title: 'Copiado', description: 'Texto para cliente na área de transferência.', duration: 2000 })
      }
    } catch {
      // ignore
    }
  }

  function handleHeaderPrintLabel () {
    if (typeof window === 'undefined') return
    const win = window.open('', '_blank', getLabelWindowFeatures())
    if (!win) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível abrir a impressão',
        description: 'Permita pop-ups para imprimir a etiqueta.',
      })
      return
    }
    const html = buildSeminovoLabelHtml(getDeviceSnapshotForActions())
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  function closePostCreateLabelOffer () {
    setPostCreateLabelOfferOpen(false)
    router.push(backHref)
  }

  if (isLoadingDevice) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">
              {isCreate
                ? (isNewLacradoFlow ? 'Cadastrar aparelho novo' : 'Cadastrar aparelho seminovo')
                : 'Editar aparelho'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isCreate ? 'Preencha os dados do aparelho. Valores em reais.' : 'Altere os dados e salve.'}
            </p>
          </div>
        </div>
        {!isCreate ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2">
                <MoreHorizontal className="h-4 w-4" />
                Ações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuItem asChild>
                <Link href={deviceId ? revendaPath.vitrine(deviceId) : revendaPath.listagem}>
                  <Eye className="h-4 w-4 mr-2" />
                  Visão cliente (vitrine)
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleHeaderPrintLabel}>
                <Tag className="h-4 w-4 mr-2" />
                Imprimir etiqueta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleHeaderCopyLojista}>
                <Store className="h-4 w-4 mr-2" />
                Copiar dados para lojista
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleHeaderCopyCliente}>
                <UserRound className="h-4 w-4 mr-2" />
                Copiar dados para cliente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {!isNewLacradoFlow ? (
        <Card>
          <CardHeader>
            <CardTitle>Dados 3utools (iDevice details)</CardTitle>
            <CardDescription>
              Cole o texto exportado pelo 3utools e clique em &quot;Ler dados e preencher&quot; para preencher automaticamente modelo, cor, IMEI, IMEI 2 e serial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Cole aqui o texto do 3utools (iDevice details)..."
              value={threeUtoolsRaw}
              onChange={(e) => setThreeUtoolsRaw(e.target.value)}
              rows={6}
            />
            <Button type="button" variant="secondary" onClick={handleParse3utools}>
              <FileInput className="h-4 w-4 mr-2" />
              Ler dados e preencher
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Dados do aparelho</CardTitle>
              <CardDescription>Modelo, identificação e estado.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!isCreate && !formSold && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={openSellModal}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Vendido
                </Button>
              )}
              {!isCreate && formSold && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openEditSellModal}
                    disabled={isSavingSell}
                  >
                    Editar venda
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelSell}
                    disabled={isSavingSell}
                  >
                    <Undo2 className="h-4 w-4 mr-2" />
                    Cancelar venda
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyDeviceData}
              >
                Copiar dados
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="formDeviceName">Aparelho</Label>
              <Input id="formDeviceName" value={formDeviceName} onChange={(e) => setFormDeviceName(e.target.value)} placeholder="Ex: iPhone 15 Pro Max" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formColor">Cor</Label>
              <Input id="formColor" value={formColor} onChange={(e) => setFormColor(e.target.value)} placeholder="Ex: Preto" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formModel">Modelo (código)</Label>
              <Input id="formModel" value={formModel} onChange={(e) => setFormModel(e.target.value)} placeholder="Ex: MTMD3 LL/A" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formStorageGb">Gb</Label>
              <Input id="formStorageGb" value={formStorageGb} onChange={(e) => setFormStorageGb(e.target.value)} placeholder="Ex: 128" />
            </div>
            {formStockType === 'seminovo' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="formBattery">Bateria</Label>
                  <Input
                    id="formBattery"
                    inputMode="numeric"
                    value={formBattery}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      if (!digits) {
                        setFormBattery('')
                        return
                      }
                      let n = Number.parseInt(digits, 10)
                      if (Number.isNaN(n)) {
                        setFormBattery('')
                        return
                      }
                      if (n > 100) n = 100
                      setFormBattery(`${n}%`)
                    }}
                    placeholder="Ex: 85%"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="formCondition">Estado</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="h-4 w-4 rounded-full border border-input text-[10px] flex items-center justify-center text-muted-foreground"
                            aria-label="Ajuda sobre estados"
                          >
                            ?
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start">
                          <p className="text-xs font-semibold mb-1">Classificação do estado:</p>
                          <p className="text-xs">A+: excelente, praticamente sem marcas.</p>
                          <p className="text-xs">A: ótimo estado, leves sinais de uso.</p>
                          <p className="text-xs">A-: bom estado, marcas de uso mais visíveis.</p>
                          <p className="text-xs">B+: uso intenso, mas bem conservado.</p>
                          <p className="text-xs">B: sinais claros de uso/desgaste.</p>
                          <p className="text-xs">B-: bem marcado, muitos riscos ou amassados.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <select
                    id="formCondition"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    <option value="A+">A+</option>
                    <option value="A">A</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B">B</option>
                    <option value="B-">B-</option>
                  </select>
                </div>
              </>
            ) : null}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="formInfo">Informação</Label>
              <Input id="formInfo" value={formInfo} onChange={(e) => setFormInfo(e.target.value)} placeholder="Observações gerais" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formImei">IMEI</Label>
              <Input id="formImei" value={formImei} onChange={(e) => setFormImei(e.target.value)} placeholder="IMEI" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formImei2">IMEI 2</Label>
              <Input id="formImei2" value={formImei2} onChange={(e) => setFormImei2(e.target.value)} placeholder="IMEI 2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formSerial">Serial</Label>
              <Input id="formSerial" value={formSerial} onChange={(e) => setFormSerial(e.target.value)} placeholder="Serial" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fotos (vitrine)</CardTitle>
            <CardDescription>
              Imagem de capa (substitui URL ao enviar) e até 9 fotos extras — no máximo 10 imagens no Storage por aparelho.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="space-y-3 shrink-0">
                <Label>Capa</Label>
                <div className="relative h-44 w-full max-w-[220px] overflow-hidden rounded-md border bg-muted">
                  {photoPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreviewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-muted-foreground">
                      <Smartphone className="h-12 w-12 opacity-35" aria-hidden />
                      <span className="text-xs">Sem capa</span>
                    </div>
                  )}
                </div>
                <input
                  ref={photoFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={handlePhotoFileChange}
                />
                {deviceId ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isUploadingPhoto}
                      onClick={() => photoFileInputRef.current?.click()}
                    >
                      {isUploadingPhoto ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Enviando…
                        </>
                      ) : (
                        'Enviar capa'
                      )}
                    </Button>
                    {(hasStorageImage || photoPreviewUrl || formImageUrl.trim()) ? (
                      <Button type="button" variant="outline" disabled={isUploadingPhoto} onClick={handleRemovePhoto}>
                        Remover capa
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground max-w-[220px]">
                    Salve o cadastro para enviar imagens ao servidor.
                  </p>
                )}
                <div className="space-y-2 max-w-sm">
                  <Label htmlFor="formImageUrl">Ou URL da imagem (capa)</Label>
                  <Input
                    id="formImageUrl"
                    type="url"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    placeholder="https://…"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <Label>Galeria ({formGalleryPaths.length}/9 extras)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {formGalleryPaths.map((path) => (
                    <div key={path} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                      {galleryPreviewByPath[path] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={galleryPreviewByPath[path]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center p-2 text-center text-[10px] text-muted-foreground break-all">
                          {path.split('/').pop()}
                        </div>
                      )}
                      {deviceId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="absolute bottom-1 right-1 h-7 px-1.5 text-[10px]"
                          onClick={() => { void handleRemoveGalleryPath(path) }}
                        >
                          Remover
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <input
                  ref={galleryFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={handleGalleryFileChange}
                />
                {deviceId ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUploadingGallery || formGalleryPaths.length >= 9}
                    onClick={() => galleryFileInputRef.current?.click()}
                  >
                    {isUploadingGallery ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando…
                      </>
                    ) : (
                      'Adicionar à galeria'
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Valores (R$)</CardTitle>
            <CardDescription>
              {isAdmin
                ? 'Compra, atacado, varejo, valor da venda e lucros.'
                : 'Atacado, varejo, valor da venda e lucros.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {isAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="formPurchaseValue">Valor Compra</Label>
                <Input
                  id="formPurchaseValue"
                  inputMode="decimal"
                  value={formPurchaseValue}
                  onChange={(e) => setFormPurchaseValue(formatMoneyInput(e.target.value))}
                  placeholder="0,00"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="formWholesaleValue">Valor Atacado</Label>
              <Input
                id="formWholesaleValue"
                inputMode="decimal"
                value={formWholesaleValue}
                onChange={(e) => setFormWholesaleValue(formatMoneyInput(e.target.value))}
                placeholder="0,00"
              />
            </div>
            {isAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="formExpectedProfitWholesale">Lucro Previsto (Atacado)</Label>
                <Input
                  id="formExpectedProfitWholesale"
                  inputMode="decimal"
                  value={formExpectedProfitWholesale}
                  readOnly
                  placeholder="0,00"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="formSaleValue">Valor Varejo</Label>
              <Input
                id="formSaleValue"
                inputMode="decimal"
                value={formSaleValue}
                onChange={(e) => setFormSaleValue(formatMoneyInput(e.target.value))}
                placeholder="0,00"
              />
            </div>
            {isAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="formExpectedProfitSale">Lucro Previsto (Varejo)</Label>
                <Input
                  id="formExpectedProfitSale"
                  inputMode="decimal"
                  value={formExpectedProfitSale}
                  readOnly
                  placeholder="0,00"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Custos de venda</CardTitle>
                <CardDescription>Lista de custos adicionais (descrição e valor em R$).</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addCost}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar custo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {formCosts.map((cost, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  placeholder="Descrição"
                  value={cost.description}
                  onChange={(e) => updateCost(index, 'description', e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Valor R$"
                  value={cost.value_cents ? (cost.value_cents / 100).toFixed(2).replace('.', ',') : ''}
                  onChange={(e) => updateCost(index, 'value_cents', e.target.value)}
                  className="w-28"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeCost(index)} aria-label="Remover custo">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {totalCostsCents > 0 && (
              <p className="text-xs text-muted-foreground">Total custos: R$ {(totalCostsCents / 100).toFixed(2).replace('.', ',')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status e datas</CardTitle>
            <CardDescription>Anunciado, testado, etiqueta e datas de compra/venda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isNewLacradoFlow ? (
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="formStockType">Tipo de estoque</Label>
                <select
                  id="formStockType"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={formStockType}
                  onChange={(e) => setFormStockType(e.target.value === 'lacrado' ? 'lacrado' : 'seminovo')}
                >
                  <option value="seminovo">Seminovo</option>
                  <option value="lacrado">Novo</option>
                </select>
                <p className="text-xs text-muted-foreground">Define em qual aba da listagem o aparelho aparece.</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox id="formAdvertised" checked={formAdvertised} onCheckedChange={(v) => setFormAdvertised(Boolean(v))} />
                <Label htmlFor="formAdvertised">Anunciado</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="formTested" checked={formTested} onCheckedChange={(v) => setFormTested(Boolean(v))} />
                <Label htmlFor="formTested">Testado</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="formLabel" checked={formLabel} onCheckedChange={(v) => setFormLabel(Boolean(v))} />
                <Label htmlFor="formLabel">Etiqueta</Label>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="formPurchaseDate">Data de compra</Label>
                <Input id="formPurchaseDate" type="date" value={formPurchaseDate} onChange={(e) => setFormPurchaseDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="formSaleDate">Data de venda</Label>
                <Input id="formSaleDate" type="date" value={formSaleDate} onChange={(e) => setFormSaleDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {formSold && (
          <Card>
            <CardHeader>
              <CardTitle>Resumo da venda</CardTitle>
              <CardDescription>
                {isAdmin
                  ? 'O valor total corresponde à soma das formas de pagamento registradas na venda. O lucro real considera compra, custos, taxas e comissão.'
                  : 'O valor total corresponde à soma das formas de pagamento registradas na venda.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="formSoldFor">Total da venda</Label>
                <Input
                  id="formSoldFor"
                  inputMode="decimal"
                  value={formSoldFor}
                  readOnly
                  placeholder="0,00"
                />
              </div>
              {isAdmin ? (
                <div className="space-y-2">
                  <Label htmlFor="formActualProfit">Lucro real</Label>
                  <Input
                    id="formActualProfit"
                    inputMode="decimal"
                    value={(() => {
                      const soldCents = moneyToCentsFromMasked(formSoldFor)
                      const purchaseCents = moneyToCentsFromMasked(formPurchaseValue) ?? 0
                      const costsCents = formCosts.reduce((acc, c) => acc + (c.value_cents ?? 0), 0)
                      if (soldCents === null) return ''
                      const profit = soldCents - purchaseCents - costsCents
                      return maskedFromCents(profit)
                    })()}
                    readOnly
                    placeholder="0,00"
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Salvando…' : isCreate ? 'Cadastrar' : 'Salvar'}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={backHref}>Cancelar</Link>
          </Button>
        </div>
      </form>

      <ResaleMarkSoldDialog
        open={sellDialogOpen}
        onOpenChange={(open) => {
          setSellDialogOpen(open)
          if (!open) setSellDeviceSnapshot(null)
        }}
        device={sellDeviceSnapshot}
        mode={sellDialogMode}
        isAdmin={isAdmin}
        canViewPurchaseValue={isAdmin}
        onSold={(updated, meta) => {
          setFormSold(true)
          setFormSoldFor(
            updated.sold_for_cents != null
              ? maskedFromCents(updated.sold_for_cents)
              : '',
          )
          setFormSaleDate(updated.sale_date || '')
          if (Array.isArray(updated.costs)) {
            const mappedCosts = updated.costs.map((c) => ({
              id: c.id,
              description: c.description ?? '',
              value_cents: c.value_cents ?? 0,
            }))
            setFormCosts(mappedCosts.length > 0 ? mappedCosts : [emptyCost()])
          }
          setSellDialogOpen(false)
          setSellDeviceSnapshot(null)
          if (meta.generateWarrantyTerm) {
            setTermsDevice(updated as ResaleDevice)
            setShowTermsDialog(true)
          }
          router.refresh()
        }}
      />

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
                sold_for_cents: termsDevice.sold_for_cents ?? null,
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

      <Dialog
        open={postCreateLabelOfferOpen}
        onOpenChange={(open) => {
          if (!open) closePostCreateLabelOffer()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aparelho cadastrado</DialogTitle>
            <DialogDescription>
              Deseja imprimir a etiqueta deste aparelho agora? Os dados do formulário serão usados na impressão.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closePostCreateLabelOffer}>
              Ir para a lista
            </Button>
            <Button type="button" onClick={handleHeaderPrintLabel}>
              <Tag className="mr-2 h-4 w-4" />
              Imprimir etiqueta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
