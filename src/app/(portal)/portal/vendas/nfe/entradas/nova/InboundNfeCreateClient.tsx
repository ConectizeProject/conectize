'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Barcode, FileUp, Info, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { CreateCustomerDialog, EditCustomerDialog, type CustomerHit } from '@/components/customers'
import { DateInput, MoneyInput } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { extractNfeAccessKey } from '@/lib/fiscal/nfe-access-key'
import { csosnOptions } from '@/lib/fiscal/csosn-options'
import { ipiCstOptions, pisCofinsCstOptions } from '@/lib/fiscal/tax-cst-options'
import { syncAmountRowsToTotal } from '@/lib/fiscal/sync-payment-amounts'
import {
  FiscalPaymentsEditor,
  emptyFiscalPaymentDraft,
  fiscalPaymentDraftCents,
  syncFiscalPaymentDrafts,
  type FiscalPaymentDraft,
} from '../FiscalPaymentsEditor'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { parse3utoolsText } from '@/lib/resale/parse-3utools'
import {
  formatMoneyInput,
  maskedFromCents,
  moneyToCentsFromMasked,
} from '@/lib/utils/money'
import { onlyDigits } from '@/lib/utils/strings'
import { NovaOrdemCustomerCard } from '../../../../ordens/nova/NovaOrdemCustomerCard'
import {
  getCustomerDocumentDigits,
  getCustomerDisplayName,
  useNovaOrdemCustomerSearch,
} from '../../../../ordens/nova/use-nova-ordem-customer-search'

type Mode = 'xml' | 'manual' | 'usados'
type FiscalPurpose = 'resale' | 'fixed_asset' | 'use_consumption'
type EntryType = 'own_issuance' | 'third_party' | 'import' | 'xml_import'

type PaymentMethod = {
  id: string
  description?: string | null
  type?: string | null
}

type PurchasePaymentDraft = {
  key: string
  paymentMethodId: string
  value: string
}

type ManualLine = {
  key: string
  description: string
  quantity: string
  unitValue: string
  productId: string | null
  productLabel: string
  ncm: string
  cest: string
  unit: string
  cfop: string
  fiscalOrigin: string
  icmsCsosn: string
  pisCst: string
  cofinsCst: string
  ipiCst: string
}

type UsedLine = {
  key: string
  deviceName: string
  color: string
  storageGb: string
  battery: string
  condition: string
  imei: string
  imei2: string
  serial: string
  info: string
  purchaseValue: string
  saleValue: string
}

function newKey () {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function emptyManualLine (): ManualLine {
  return {
    key: newKey(),
    description: '',
    quantity: '1',
    unitValue: '',
    productId: null,
    productLabel: '',
    ncm: '',
    cest: '',
    unit: 'UN',
    cfop: '1102',
    fiscalOrigin: '0',
    icmsCsosn: '102',
    pisCst: '99',
    cofinsCst: '99',
    ipiCst: '53',
  }
}

function emptyUsedLine (): UsedLine {
  return {
    key: newKey(),
    deviceName: '',
    color: '',
    storageGb: '',
    battery: '',
    condition: '',
    imei: '',
    imei2: '',
    serial: '',
    info: '',
    purchaseValue: '',
    saleValue: '',
  }
}

export function InboundNfeCreateClient () {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialMode = (searchParams.get('tipo') || searchParams.get('mode') || 'xml') as Mode
  const initialEntryType: EntryType = initialMode === 'xml' ? 'xml_import' : 'own_issuance'
  const [entryType, setEntryType] = useState<EntryType>(initialEntryType)
  const [mode, setMode] = useState<Mode>(initialEntryType === 'xml_import' ? 'xml' : 'manual')
  const [isSaving, setIsSaving] = useState(false)
  const [referenceNumber, setReferenceNumber] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // XML
  const [isImporting, setIsImporting] = useState(false)
  const [accessKey, setAccessKey] = useState('')
  const accessKeyLookupRef = useRef(false)
  const lastAccessKeyLookupRef = useRef('')

  // Manual products
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [fiscalPurpose, setFiscalPurpose] = useState<FiscalPurpose>('resale')
  const [shouldMoveStock, setShouldMoveStock] = useState(true)
  const [freight, setFreight] = useState('')
  const [insurance, setInsurance] = useState('')
  const [otherExpenses, setOtherExpenses] = useState('')
  const [discount, setDiscount] = useState('')
  const [transportMode, setTransportMode] = useState<'none' | 'buyer' | 'seller' | 'carrier'>('none')
  const [complementaryInformation, setComplementaryInformation] = useState('')
  const [fiscalInformation, setFiscalInformation] = useState('')
  const [fiscalPayments, setFiscalPayments] = useState<FiscalPaymentDraft[]>([emptyFiscalPaymentDraft()])
  const [importDeclaration, setImportDeclaration] = useState({
    number: '',
    registrationDate: '',
    exporterCode: '',
    customsExpenses: '',
    clearancePlace: '',
    clearanceState: '',
    clearanceDate: '',
    transportWay: '',
    importForm: '',
    acquirerCnpj: '',
    acquirerState: '',
  })
  const [manualLines, setManualLines] = useState<ManualLine[]>([emptyManualLine()])
  const [productSearchByKey, setProductSearchByKey] = useState<Record<string, string>>({})
  const [productHitsByKey, setProductHitsByKey] = useState<Record<string, Array<{ id: string, name: string, sku?: string | null, barcode?: string | null, hasVariations?: boolean }>>>({})

  // Used
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(null)
  const [sellerCustomerId, setSellerCustomerId] = useState<string | null>(null)
  const [sellerName, setSellerName] = useState('')
  const [sellerDocument, setSellerDocument] = useState('')
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false)
  const [createCustomerInitialDocumentDigits, setCreateCustomerInitialDocumentDigits] = useState('')
  const [customerToEdit, setCustomerToEdit] = useState<CustomerHit | null>(null)
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
  } = useNovaOrdemCustomerSearch({ selectedCustomer })
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [purchasePayments, setPurchasePayments] = useState<PurchasePaymentDraft[]>([{
    key: newKey(),
    paymentMethodId: '',
    value: '',
  }])
  const [usedLines, setUsedLines] = useState<UsedLine[]>([emptyUsedLine()])
  const [threeUtoolsRaw, setThreeUtoolsRaw] = useState('')

  useEffect(() => {
    if (mode !== 'usados') return
    let cancelled = false
    portalFetch('/api/portal/payment-methods')
      .then(async (res) => {
        const data = await res?.json().catch(() => null)
        if (cancelled) return
        if (data?.ok && Array.isArray(data.paymentMethods)) {
          setPaymentMethods(data.paymentMethods as PaymentMethod[])
        }
      })
      .catch(() => {
        if (!cancelled) setPaymentMethods([])
      })
    return () => {
      cancelled = true
    }
  }, [mode])

  useEffect(() => {
    let cancelled = false
    portalFetch('/api/portal/fiscal/inbound-nfe?next=1')
      .then(async (res) => {
        const data = await res?.json().catch(() => null)
        if (!cancelled && data?.ok) setReferenceNumber(Number(data.number) || null)
      })
      .catch(() => {
        if (!cancelled) setReferenceNumber(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function selectSellerCustomer (customer: CustomerHit) {
    setSelectedCustomer(customer)
    setSellerCustomerId(customer.id)
    setSellerName(getCustomerDisplayName(customer))
    setSellerDocument(getCustomerDocumentDigits(customer))
    setIsCpfPopoverOpen(false)
  }

  function clearSellerCustomer () {
    setSelectedCustomer(null)
    setSellerCustomerId(null)
    setSellerName('')
    setSellerDocument('')
    setIsCpfPopoverOpen(true)
  }

  function editSellerCustomer () {
    setCustomerToEdit(selectedCustomer)
    setIsCreateCustomerOpen(true)
  }

  function createSellerCustomer () {
    setCreateCustomerInitialDocumentDigits(documentDigits)
    setCustomerToEdit(null)
    setIsCpfPopoverOpen(false)
    setIsCreateCustomerOpen(true)
  }

  async function lookupByAccessKey (raw: string) {
    if (accessKeyLookupRef.current || isImporting) return
    const key = extractNfeAccessKey(raw)
    if (!key) {
      toast({
        title: 'Chave inválida',
        description: 'Leia o código de barras do DANFE. A chave tem 44 dígitos.',
        variant: 'destructive',
      })
      return
    }
    accessKeyLookupRef.current = true
    setIsImporting(true)
    try {
      const res = await portalFetch('/api/portal/fiscal/inbound-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'access_key', access_key: key }),
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok || !data.document?.id) {
        toast({
          title: 'Não foi possível buscar a nota',
          description: data?.message || data?.error || 'A SEFAZ não devolveu o XML.',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Nota importada', description: 'Revise os itens e lance no estoque.' })
      router.push(`/portal/vendas/nfe/entradas/${encodeURIComponent(String(data.document.id))}`)
    } catch (err) {
      toast({
        title: 'Não foi possível buscar a nota',
        description: err instanceof Error ? err.message : 'Falha ao consultar a SEFAZ.',
        variant: 'destructive',
      })
    } finally {
      accessKeyLookupRef.current = false
      setIsImporting(false)
    }
  }

  function onAccessKeyChange (value: string) {
    setAccessKey(value)
    const key = extractNfeAccessKey(value)
    if (!key || key === lastAccessKeyLookupRef.current) return
    lastAccessKeyLookupRef.current = key
    void lookupByAccessKey(value)
  }

  async function onXmlFile (file: File | null) {
    if (!file || isImporting) return
    setIsImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await portalFetch('/api/portal/fiscal/inbound-nfe', {
        method: 'POST',
        body: form,
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok || !data.document?.id) {
        toast({
          title: 'Falha ao importar XML',
          description: data?.message || data?.error || 'Verifique o arquivo.',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'XML importado', description: 'Revise os itens e lance no estoque.' })
      router.push(`/portal/vendas/nfe/entradas/${encodeURIComponent(String(data.document.id))}`)
    } catch (err) {
      toast({
        title: 'Falha ao importar XML',
        description: err instanceof Error ? err.message : 'Não foi possível enviar o arquivo.',
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function searchProduct (lineKey: string, query: string) {
    setProductSearchByKey((prev) => ({ ...prev, [lineKey]: query }))
    if (query.trim().length < 2) {
      setProductHitsByKey((prev) => ({ ...prev, [lineKey]: [] }))
      return
    }
    const params = new URLSearchParams({ q: query, kind: 'product' })
    const res = await portalFetch(`/api/portal/produtos/search?${params.toString()}`)
    const data = await res?.json().catch(() => null)
    const list = Array.isArray(data?.items) ? data.items : []
    setProductHitsByKey((prev) => ({
      ...prev,
      [lineKey]: list.filter((hit: { hasVariations?: boolean }) => !hit.hasVariations),
    }))
  }

  async function submitManual () {
    if (isSaving) return
    if (!sellerCustomerId) {
      toast({
        title: 'Selecione o fornecedor',
        description: 'Busque um cliente existente ou cadastre um novo antes de continuar.',
        variant: 'destructive',
      })
      return
    }
    const typedPayments = fiscalPayments.filter((payment) => payment.type)
    if (typedPayments.length > 0 && fiscalPaymentDraftCents(typedPayments) !== noteTotalCents) {
      toast({
        title: 'Pagamentos diferentes do total',
        description: 'A soma dos valores pagos precisa ser igual ao total da nota.',
        variant: 'destructive',
      })
      return
    }
    setIsSaving(true)
    try {
      const items = manualLines.map((line) => ({
        description: line.description.trim() || line.productLabel.trim(),
        quantity: Number(line.quantity.replace(',', '.')),
        unit_value_cents: moneyToCentsFromMasked(line.unitValue) ?? 0,
        product_id: line.productId,
        ncm: onlyDigits(line.ncm),
        cest: onlyDigits(line.cest) || null,
        unit: line.unit.trim().toUpperCase(),
        cfop: onlyDigits(line.cfop),
        fiscal_origin: Number(line.fiscalOrigin),
        icms_csosn: onlyDigits(line.icmsCsosn),
        pis_cst: onlyDigits(line.pisCst),
        cofins_cst: onlyDigits(line.cofinsCst),
        ipi_cst: onlyDigits(line.ipiCst) || null,
      }))
      const res = await portalFetch('/api/portal/fiscal/inbound-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'manual',
          entry_type: entryType,
          seller_customer_id: sellerCustomerId,
          seller_name: sellerName.trim() || null,
          seller_document: onlyDigits(sellerDocument) || null,
          issuer_name: sellerName.trim() || null,
          issued_at: issuedAt || null,
          fiscal_purpose: fiscalPurpose,
          should_move_stock: shouldMoveStock,
          import_declaration: entryType === 'import' ? importDeclaration : null,
          freight_cents: moneyToCentsFromMasked(freight) ?? 0,
          insurance_cents: moneyToCentsFromMasked(insurance) ?? 0,
          other_expenses_cents: moneyToCentsFromMasked(otherExpenses) ?? 0,
          discount_cents: moneyToCentsFromMasked(discount) ?? 0,
          transport_mode: transportMode,
          complementary_information: complementaryInformation.trim() || null,
          fiscal_information: fiscalInformation.trim() || null,
          fiscal_payments: fiscalPayments
            .filter((payment) => payment.type)
            .map((payment) => ({
              type: payment.type,
              value_cents: payment.type === '90' ? 0 : (moneyToCentsFromMasked(payment.value) ?? 0),
            })),
          items,
        }),
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok || !data.document?.id) {
        toast({
          title: 'Não foi possível criar a entrada',
          description: data?.message || data?.error || 'Revise os itens.',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'NF-e de entrada criada', description: 'Revise vínculos e lance no estoque.' })
      router.push(`/portal/vendas/nfe/entradas/${encodeURIComponent(String(data.document.id))}`)
    } finally {
      setIsSaving(false)
    }
  }

  function apply3utoolsToFirstLine () {
    const parsed = parse3utoolsText(threeUtoolsRaw)
    if (!parsed.model && !parsed.imei && !parsed.serial) {
      toast({
        title: 'Não foi possível ler o 3utools',
        description: 'Cole o texto completo e tente de novo.',
        variant: 'destructive',
      })
      return
    }
    setUsedLines((prev) => {
      const [first, ...rest] = prev.length > 0 ? prev : [emptyUsedLine()]
      return [{
        ...first,
        deviceName: parsed.model || first.deviceName,
        color: parsed.color || first.color,
        storageGb: parsed.storage_gb || first.storageGb,
        imei: parsed.imei || first.imei,
        imei2: parsed.imei2 || first.imei2,
        serial: parsed.serial || first.serial,
      }, ...rest]
    })
    toast({ title: 'Dados preenchidos no primeiro aparelho' })
  }

  async function submitUsed () {
    if (isSaving) return
    if (!sellerCustomerId) {
      toast({
        title: 'Selecione o cliente vendedor',
        description: 'Busque um cliente existente ou cadastre um novo antes de continuar.',
        variant: 'destructive',
      })
      return
    }
    setIsSaving(true)
    try {
      const devices = usedLines.map((line) => ({
        purchase_value_cents: moneyToCentsFromMasked(line.purchaseValue) ?? 0,
        device: {
          device_name: line.deviceName.trim(),
          color: line.color.trim() || null,
          storage_gb: line.storageGb.trim() || null,
          battery: line.battery.trim() || null,
          condition: line.condition.trim() || null,
          info: line.info.trim() || null,
          imei: line.imei.trim() || null,
          imei2: line.imei2.trim() || null,
          serial: line.serial.trim() || null,
          sale_value_cents: moneyToCentsFromMasked(line.saleValue),
        },
      }))
      const totalCents = devices.reduce((sum, d) => sum + (d.purchase_value_cents || 0), 0)
      const purchasePaymentMethods = purchasePayments
        .filter((payment) => payment.paymentMethodId)
        .map((payment) => ({
          payment_method_id: payment.paymentMethodId,
          value_cents: moneyToCentsFromMasked(payment.value) ?? 0,
        }))
        .filter((payment) => payment.value_cents > 0)
      const paidCents = purchasePaymentMethods.reduce((sum, payment) => sum + payment.value_cents, 0)
      if (purchasePaymentMethods.length > 0 && paidCents !== totalCents) {
        toast({
          title: 'Pagamentos diferentes do total',
          description: 'A soma das formas de pagamento precisa ser igual ao valor pago nos aparelhos.',
          variant: 'destructive',
        })
        return
      }
      const res = await portalFetch('/api/portal/fiscal/inbound-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'used_devices',
          seller_customer_id: sellerCustomerId,
          seller_name: sellerName.trim() || null,
          seller_document: onlyDigits(sellerDocument) || null,
          purchase_date: purchaseDate || null,
          purchase_payment_methods: purchasePaymentMethods,
          devices,
        }),
      })
      const data = await res?.json().catch(() => null)
      if (!data?.ok || !data.document?.id) {
        toast({
          title: 'Não foi possível criar a entrada',
          description: data?.message || data?.error || 'Revise os aparelhos.',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Entrada de usados criada', description: 'Confirme e lance para gerar os seminovos.' })
      router.push(`/portal/vendas/nfe/entradas/${encodeURIComponent(String(data.document.id))}`)
    } finally {
      setIsSaving(false)
    }
  }

  const productsTotalCents = manualLines.reduce((total, line) => {
    const quantity = Number(line.quantity.replace(',', '.')) || 0
    const unitValueCents = moneyToCentsFromMasked(line.unitValue) ?? 0
    return total + Math.round(quantity * unitValueCents)
  }, 0)
  const noteTotalCents = Math.max(
    0,
    productsTotalCents
      + (moneyToCentsFromMasked(freight) ?? 0)
      + (moneyToCentsFromMasked(insurance) ?? 0)
      + (moneyToCentsFromMasked(otherExpenses) ?? 0)
      - (moneyToCentsFromMasked(discount) ?? 0),
  )
  const usedTotalCents = usedLines.reduce(
    (sum, line) => sum + (moneyToCentsFromMasked(line.purchaseValue) ?? 0),
    0,
  )

  useEffect(() => {
    if (mode !== 'manual') return
    setFiscalPayments((current) => {
      const next = syncFiscalPaymentDrafts(current, noteTotalCents)
      const same = next.length === current.length && next.every((row, index) => (
        row.value === current[index]?.value && row.type === current[index]?.type
      ))
      return same ? current : next
    })
  }, [mode, noteTotalCents])

  useEffect(() => {
    if (mode !== 'usados') return
    setPurchasePayments((current) => {
      const cents = syncAmountRowsToTotal(
        current.map((payment) => ({
          type: '',
          valueCents: moneyToCentsFromMasked(payment.value) ?? 0,
        })),
        usedTotalCents,
      )
      const next = current.map((payment, index) => ({
        ...payment,
        value: maskedFromCents(cents[index] ?? 0),
      }))
      const same = next.every((row, index) => row.value === current[index]?.value)
      return same ? current : next
    })
  }, [mode, usedTotalCents])

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='text-lg font-medium'>Nova NF-e de entrada</h2>
          <p className='text-sm text-muted-foreground'>
            Informe como a entrada será registrada e complete somente os dados aplicáveis.
          </p>
        </div>
        <Link href='/portal/vendas/nfe/entradas'>
          <Button type='button' variant='outline'>Voltar</Button>
        </Link>
      </div>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>Identificação da entrada</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-1.5'>
            <Label htmlFor='entry-type'>Tipo de entrada</Label>
            <Select
              value={entryType}
              onValueChange={(value: EntryType) => {
                setEntryType(value)
                setMode(value === 'xml_import' ? 'xml' : 'manual')
              }}
            >
              <SelectTrigger id='entry-type'><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='own_issuance'>Emissão própria</SelectItem>
                <SelectItem value='third_party'>Emitida por terceiros</SelectItem>
                <SelectItem value='import'>Importação</SelectItem>
                <SelectItem value='xml_import'>Importação de XML de entrada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1.5'>
            <div className='flex items-center gap-1.5'>
              <Label htmlFor='reference-number'>Número de referência</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type='button' aria-label='Informação sobre o número'>
                    <Info className='h-3.5 w-3.5 text-muted-foreground' />
                  </button>
                </TooltipTrigger>
                <TooltipContent className='max-w-64'>
                  Este número é somente uma referência e pode mudar se outra nota for gerada antes.
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id='reference-number'
              value={referenceNumber == null ? 'Calculando...' : `1/${referenceNumber}`}
              readOnly
              aria-readonly='true'
            />
          </div>
        </CardContent>
      </Card>

      {mode === 'xml' ? (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Importar XML do fornecedor</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <form
              className='flex flex-col gap-2 sm:flex-row sm:items-end'
              onSubmit={(event) => {
                event.preventDefault()
                const field = event.currentTarget.elements.namedItem('access_key')
                const value = field instanceof HTMLInputElement ? field.value : accessKey
                void lookupByAccessKey(value)
              }}
            >
              <div className='min-w-0 flex-1 space-y-1'>
                <Label htmlFor='inbound-nfe-access-key'>Chave de acesso</Label>
                <Input
                  id='inbound-nfe-access-key'
                  name='access_key'
                  value={accessKey}
                  onChange={(event) => onAccessKeyChange(event.target.value)}
                  inputMode='numeric'
                  autoComplete='off'
                  placeholder='Leia o código de barras do DANFE'
                  disabled={isImporting}
                />
              </div>
              <Button type='submit' disabled={isImporting || !accessKey.trim()}>
                {isImporting ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : <Barcode className='mr-1 h-4 w-4' />}
                {isImporting ? 'Buscando...' : 'Buscar nota'}
              </Button>
            </form>
            <p className='text-sm text-muted-foreground'>
              O leitor preenche a chave de 44 dígitos. A consulta usa o certificado A1 da loja e importa o XML quando a SEFAZ devolve a nota completa.
            </p>
            <input
              ref={fileRef}
              type='file'
              accept='.xml,text/xml,application/xml'
              className='sr-only'
              onChange={(event) => {
                void onXmlFile(event.target.files?.[0] ?? null)
              }}
            />
            <Button
              type='button'
              variant='outline'
              disabled={isImporting}
              onClick={() => fileRef.current?.click()}
            >
              {isImporting ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : <Upload className='mr-1 h-4 w-4' />}
              Selecionar XML
            </Button>
            <p className='text-sm text-muted-foreground'>
              Depois da importação, você vincula os itens aos produtos e lança o estoque.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {mode === 'manual' ? (
        <div className='space-y-4'>
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
            onSelectCustomer={selectSellerCustomer}
            onClearCustomer={clearSellerCustomer}
            onEditCustomer={editSellerCustomer}
            onCreateCustomer={createSellerCustomer}
          />
          {entryType === 'import' ? (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-base'>Declaração de importação</CardTitle>
              </CardHeader>
              <CardContent className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                {[
                  ['number', 'Número da DI', 'text'],
                  ['registrationDate', 'Data de registro da DI', 'date'],
                  ['exporterCode', 'Código do exportador', 'text'],
                  ['customsExpenses', 'Despesas aduaneiras', 'text'],
                  ['clearancePlace', 'Local do desembaraço', 'text'],
                  ['clearanceState', 'UF do desembaraço', 'text'],
                  ['clearanceDate', 'Data do desembaraço', 'date'],
                  ['transportWay', 'Via de transporte', 'text'],
                  ['importForm', 'Forma de importação', 'text'],
                  ['acquirerCnpj', 'CNPJ do adquirente', 'text'],
                  ['acquirerState', 'UF do adquirente', 'text'],
                ].map(([key, label, type]) => (
                  <div key={key} className='space-y-1.5'>
                    <Label htmlFor={`import-${key}`}>{label}</Label>
                    <Input
                      id={`import-${key}`}
                      type={type}
                      value={importDeclaration[key as keyof typeof importDeclaration]}
                      onChange={(event) => setImportDeclaration((previous) => ({
                        ...previous,
                        [key]: event.target.value,
                      }))}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Dados fiscais da entrada</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <p className='text-sm text-muted-foreground'>
                A Conectize será a emitente da NF-e de entrada. O cliente selecionado acima será identificado como vendedor.
              </p>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label htmlFor='issued'>Data da entrada</Label>
                  <DateInput id='issued' value={issuedAt} onChange={setIssuedAt} />
                </div>
                <div className='space-y-1.5'>
                  <Label htmlFor='fiscal-purpose'>Finalidade</Label>
                  <Select
                    value={fiscalPurpose}
                    onValueChange={(value: FiscalPurpose) => {
                      setFiscalPurpose(value)
                      const cfop = value === 'fixed_asset'
                        ? '1551'
                        : value === 'use_consumption'
                          ? '1556'
                          : '1102'
                      setManualLines((previous) => previous.map((line) => ({
                        ...line,
                        cfop,
                      })))
                      if (value !== 'resale') setShouldMoveStock(false)
                    }}
                  >
                    <SelectTrigger id='fiscal-purpose'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='resale'>Mercadoria para revenda</SelectItem>
                      <SelectItem value='fixed_asset'>Ativo imobilizado</SelectItem>
                      <SelectItem value='use_consumption'>Uso ou consumo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className='flex items-start justify-between gap-4 rounded-md border p-3'>
                <div>
                  <Label htmlFor='should-move-stock'>Movimentar estoque</Label>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Desative quando o item já estiver cadastrado no estoque ou quando não houver entrada física.
                  </p>
                </div>
                <Switch
                  id='should-move-stock'
                  checked={shouldMoveStock}
                  onCheckedChange={setShouldMoveStock}
                  aria-label='Movimentar estoque'
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between gap-2'>
                <CardTitle className='text-base'>Itens</CardTitle>
                <Button type='button' variant='outline' size='sm' onClick={() => setManualLines((prev) => [...prev, emptyManualLine()])}>
                  <Plus className='mr-1 h-4 w-4' />
                  Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              {manualLines.map((line) => (
                <div key={line.key} className='space-y-3 rounded-md border p-3'>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <div className='space-y-1.5 sm:col-span-2'>
                      <Label>Descrição</Label>
                      <Input
                        value={line.description}
                        onChange={(e) => setManualLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, description: e.target.value } : row
                        )))}
                        placeholder='Nome do produto'
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Quantidade</Label>
                      <Input
                        value={line.quantity}
                        onChange={(e) => setManualLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, quantity: e.target.value } : row
                        )))}
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Valor unitário</Label>
                      <Input
                        value={line.unitValue}
                        onChange={(e) => setManualLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, unitValue: formatMoneyInput(e.target.value) } : row
                        )))}
                        placeholder='0,00'
                      />
                    </div>
                    <div className='relative space-y-1.5 sm:col-span-2'>
                      <Label>Vincular produto (opcional agora)</Label>
                      <Input
                        value={productSearchByKey[line.key] ?? line.productLabel}
                        onChange={(e) => {
                          void searchProduct(line.key, e.target.value)
                          setManualLines((prev) => prev.map((row) => (
                            row.key === line.key ? { ...row, productId: null, productLabel: '' } : row
                          )))
                        }}
                        placeholder='Buscar produto...'
                      />
                      {(productHitsByKey[line.key] || []).length > 0 ? (
                        <ul className='absolute z-10 max-h-40 w-full overflow-auto rounded-md border bg-background'>
                          {(productHitsByKey[line.key] || []).map((hit) => (
                            <li key={hit.id}>
                              <button
                                type='button'
                                className='flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted'
                                onClick={() => {
                                  setManualLines((prev) => prev.map((row) => (
                                    row.key === line.key
                                      ? {
                                        ...row,
                                        productId: hit.id,
                                        productLabel: hit.name,
                                        description: row.description || hit.name,
                                      }
                                      : row
                                  )))
                                  setProductSearchByKey((prev) => ({ ...prev, [line.key]: hit.name }))
                                  setProductHitsByKey((prev) => ({ ...prev, [line.key]: [] }))
                                }}
                              >
                                <span className='font-medium'>{hit.name}</span>
                                <span className='text-xs text-muted-foreground'>
                                  {[hit.sku, hit.barcode].filter(Boolean).join(' · ') || hit.id}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {line.productId ? (
                        <p className='text-xs text-muted-foreground'>Vinculado: {line.productLabel}</p>
                      ) : null}
                    </div>
                    <div className='space-y-1.5'>
                      <Label>NCM</Label>
                      <Input
                        value={line.ncm}
                        inputMode='numeric'
                        maxLength={8}
                        onChange={(event) => setManualLines((previous) => previous.map((row) => (
                          row.key === line.key ? { ...row, ncm: onlyDigits(event.target.value) } : row
                        )))}
                        placeholder='8 dígitos'
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>CEST</Label>
                      <Input
                        value={line.cest}
                        inputMode='numeric'
                        maxLength={7}
                        onChange={(event) => setManualLines((previous) => previous.map((row) => (
                          row.key === line.key ? { ...row, cest: onlyDigits(event.target.value) } : row
                        )))}
                        placeholder='Quando aplicável'
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>CFOP</Label>
                      <Input
                        value={line.cfop}
                        inputMode='numeric'
                        maxLength={4}
                        onChange={(event) => setManualLines((previous) => previous.map((row) => (
                          row.key === line.key ? { ...row, cfop: onlyDigits(event.target.value) } : row
                        )))}
                      />
                      <p className='text-xs text-muted-foreground'>
                        Use CFOP iniciado por 2 para vendedor de outro estado.
                      </p>
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Unidade</Label>
                      <Input
                        value={line.unit}
                        maxLength={6}
                        onChange={(event) => setManualLines((previous) => previous.map((row) => (
                          row.key === line.key ? { ...row, unit: event.target.value.toUpperCase() } : row
                        )))}
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Origem da mercadoria</Label>
                      <Select
                        value={line.fiscalOrigin}
                        onValueChange={(value) => setManualLines((previous) => previous.map((row) => (
                          row.key === line.key ? { ...row, fiscalOrigin: value } : row
                        )))}
                      >
                        <SelectTrigger className='bg-transparent'><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value='0'>0 - Nacional</SelectItem>
                          <SelectItem value='1'>1 - Estrangeira, importação direta</SelectItem>
                          <SelectItem value='2'>2 - Estrangeira, adquirida no mercado interno</SelectItem>
                          <SelectItem value='3'>3 - Nacional, conteúdo de importação superior a 40%</SelectItem>
                          <SelectItem value='4'>4 - Nacional, processo produtivo básico</SelectItem>
                          <SelectItem value='5'>5 - Nacional, conteúdo de importação até 40%</SelectItem>
                          <SelectItem value='6'>6 - Estrangeira sem similar nacional</SelectItem>
                          <SelectItem value='7'>7 - Estrangeira sem similar, mercado interno</SelectItem>
                          <SelectItem value='8'>8 - Nacional, conteúdo de importação superior a 70%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-1.5'>
                      <Label>CSOSN do ICMS</Label>
                      <Select
                        value={line.icmsCsosn}
                        onValueChange={(value) => setManualLines((previous) => previous.map((row) => (
                          row.key === line.key ? { ...row, icmsCsosn: value } : row
                        )))}
                      >
                        <SelectTrigger className='bg-transparent'><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {csosnOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-1.5'>
                      <Label>CST PIS</Label>
                      <Select
                        value={line.pisCst}
                        onValueChange={(value) => setManualLines((previous) => previous.map((row) => (
                          row.key === line.key ? { ...row, pisCst: value } : row
                        )))}
                      >
                        <SelectTrigger className='bg-transparent'><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {pisCofinsCstOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-1.5'>
                      <Label>CST COFINS</Label>
                      <Select
                        value={line.cofinsCst}
                        onValueChange={(value) => setManualLines((previous) => previous.map((row) => (
                          row.key === line.key ? { ...row, cofinsCst: value } : row
                        )))}
                      >
                        <SelectTrigger className='bg-transparent'><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {pisCofinsCstOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className='space-y-1.5'>
                      <Label>CST IPI</Label>
                      <Select
                        value={line.ipiCst}
                        onValueChange={(value) => setManualLines((previous) => previous.map((row) => (
                          row.key === line.key ? { ...row, ipiCst: value } : row
                        )))}
                      >
                        <SelectTrigger className='bg-transparent'><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ipiCstOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {manualLines.length > 1 ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => setManualLines((prev) => prev.filter((row) => row.key !== line.key))}
                    >
                      <Trash2 className='mr-1 h-4 w-4' />
                      Remover
                    </Button>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Totais da nota</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
              <div className='space-y-1.5'>
                <Label>Total dos produtos</Label>
                <Input value={`R$ ${maskedFromCents(productsTotalCents)}`} readOnly />
              </div>
              {[
                ['Frete', freight, setFreight],
                ['Seguro', insurance, setInsurance],
                ['Outras despesas', otherExpenses, setOtherExpenses],
                ['Desconto', discount, setDiscount],
              ].map(([label, value, setter]) => (
                <div key={String(label)} className='space-y-1.5'>
                  <Label>{String(label)}</Label>
                  <Input
                    value={String(value)}
                    inputMode='numeric'
                    placeholder='0,00'
                    onChange={(event) => {
                      const setValue = setter as (next: string) => void
                      setValue(formatMoneyInput(event.target.value))
                    }}
                  />
                </div>
              ))}
              <div className='space-y-1.5'>
                <Label>Total da nota</Label>
                <Input value={`R$ ${maskedFromCents(noteTotalCents)}`} readOnly className='font-semibold' />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Transporte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='max-w-md space-y-1.5'>
                <Label htmlFor='transport-mode'>Modalidade</Label>
                <Select value={transportMode} onValueChange={(value: typeof transportMode) => setTransportMode(value)}>
                  <SelectTrigger id='transport-mode'><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>Sem transporte</SelectItem>
                    <SelectItem value='buyer'>Frete por conta da Conectize</SelectItem>
                    <SelectItem value='seller'>Frete por conta do vendedor</SelectItem>
                    <SelectItem value='carrier'>Transportadora</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Pagamento da operação</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3'>
              <FiscalPaymentsEditor
                payments={fiscalPayments}
                totalCents={noteTotalCents}
                disabled={isSaving}
                onChange={setFiscalPayments}
              />
              <p className='text-xs text-muted-foreground'>
                O valor pago acompanha o total da nota quando um item muda. Esta informação vai no XML e não gera lançamento financeiro automaticamente.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Informações adicionais</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label htmlFor='complementary-information'>Informações complementares</Label>
                <Textarea
                  id='complementary-information'
                  value={complementaryInformation}
                  onChange={(event) => setComplementaryInformation(event.target.value)}
                  rows={3}
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='fiscal-information'>Informações de interesse do fisco</Label>
                <Textarea
                  id='fiscal-information'
                  value={fiscalInformation}
                  onChange={(event) => setFiscalInformation(event.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className='flex justify-end'>
            <Button type='button' disabled={isSaving} onClick={() => void submitManual()}>
              {isSaving ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : <FileUp className='mr-1 h-4 w-4' />}
              Salvar rascunho fiscal
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'usados' ? (
        <div className='space-y-4'>
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
                onSelectCustomer={selectSellerCustomer}
                onClearCustomer={clearSellerCustomer}
                onEditCustomer={editSellerCustomer}
                onCreateCustomer={createSellerCustomer}
          />
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Dados da compra</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label>Data da compra</Label>
                  <DateInput value={purchaseDate} onChange={setPurchaseDate} />
                </div>
                <div className='space-y-3 sm:col-span-2'>
                  <Label>Formas de pagamento</Label>
                  {purchasePayments.map((payment, index) => (
                    <div key={payment.key} className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end'>
                      <div className='space-y-1.5'>
                        <Label htmlFor={`used-payment-${payment.key}`}>
                          {purchasePayments.length > 1 ? `Forma ${index + 1}` : 'Forma de pagamento'}
                        </Label>
                        <Select
                          value={payment.paymentMethodId}
                          onValueChange={(paymentMethodId) => {
                            setPurchasePayments((current) => current.map((row) => (
                              row.key === payment.key ? { ...row, paymentMethodId } : row
                            )))
                          }}
                        >
                          <SelectTrigger id={`used-payment-${payment.key}`}>
                            <SelectValue placeholder='Opcional, saída financeira' />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentMethods.map((method) => (
                              <SelectItem key={method.id} value={method.id}>
                                {method.description || method.type || method.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='space-y-1.5'>
                        <Label htmlFor={`used-payment-value-${payment.key}`}>Valor</Label>
                        <MoneyInput
                          id={`used-payment-value-${payment.key}`}
                          value={payment.value}
                          onChange={(value) => {
                            setPurchasePayments((current) => current.map((row) => (
                              row.key === payment.key ? { ...row, value } : row
                            )))
                          }}
                        />
                      </div>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='text-muted-foreground'
                        disabled={purchasePayments.length === 1}
                        aria-label={`Remover forma de pagamento ${index + 1}`}
                        onClick={() => {
                          setPurchasePayments((current) => (
                            current.length === 1
                              ? current
                              : current.filter((row) => row.key !== payment.key)
                          ))
                        }}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        const paid = purchasePayments.reduce(
                          (sum, payment) => sum + (moneyToCentsFromMasked(payment.value) ?? 0),
                          0,
                        )
                        setPurchasePayments((current) => [...current, {
                          key: newKey(),
                          paymentMethodId: '',
                          value: maskedFromCents(Math.max(0, usedTotalCents - paid)),
                        }])
                      }}
                    >
                      <Plus className='mr-1 h-4 w-4' />
                      Incluir forma de pagamento
                    </Button>
                    <p className='text-xs text-muted-foreground'>
                      O valor acompanha a soma do valor pago nos aparelhos.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>3utools (opcional)</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <Textarea
                value={threeUtoolsRaw}
                onChange={(e) => setThreeUtoolsRaw(e.target.value)}
                rows={3}
                placeholder='Cole o texto do 3utools para preencher o primeiro aparelho'
              />
              <Button type='button' variant='secondary' onClick={apply3utoolsToFirstLine}>
                Ler dados e preencher
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <div className='flex items-center justify-between gap-2'>
                <CardTitle className='text-base'>Aparelhos</CardTitle>
                <Button type='button' variant='outline' size='sm' onClick={() => setUsedLines((prev) => [...prev, emptyUsedLine()])}>
                  <Plus className='mr-1 h-4 w-4' />
                  Aparelho
                </Button>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              {usedLines.map((line) => (
                <div key={line.key} className='space-y-3 rounded-md border p-3'>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    <div className='space-y-1.5 sm:col-span-2'>
                      <Label>Aparelho</Label>
                      <Input
                        value={line.deviceName}
                        onChange={(e) => setUsedLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, deviceName: e.target.value } : row
                        )))}
                        placeholder='Ex: iPhone 13 128GB'
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Cor</Label>
                      <Input
                        value={line.color}
                        onChange={(e) => setUsedLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, color: e.target.value } : row
                        )))}
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Armazenamento</Label>
                      <Input
                        value={line.storageGb}
                        onChange={(e) => setUsedLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, storageGb: e.target.value } : row
                        )))}
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Bateria</Label>
                      <Input
                        value={line.battery}
                        onChange={(e) => setUsedLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, battery: e.target.value } : row
                        )))}
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Condição</Label>
                      <Input
                        value={line.condition}
                        onChange={(e) => setUsedLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, condition: e.target.value } : row
                        )))}
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>IMEI</Label>
                      <Input
                        value={line.imei}
                        onChange={(e) => setUsedLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, imei: e.target.value } : row
                        )))}
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>IMEI 2</Label>
                      <Input
                        value={line.imei2}
                        onChange={(e) => setUsedLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, imei2: e.target.value } : row
                        )))}
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Valor pago</Label>
                      <Input
                        value={line.purchaseValue}
                        onChange={(e) => setUsedLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, purchaseValue: formatMoneyInput(e.target.value) } : row
                        )))}
                        placeholder='0,00'
                      />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Preço de venda (opcional)</Label>
                      <Input
                        value={line.saleValue}
                        onChange={(e) => setUsedLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, saleValue: formatMoneyInput(e.target.value) } : row
                        )))}
                        placeholder='0,00'
                      />
                    </div>
                    <div className='space-y-1.5 sm:col-span-2'>
                      <Label>Observações</Label>
                      <Textarea
                        value={line.info}
                        onChange={(e) => setUsedLines((prev) => prev.map((row) => (
                          row.key === line.key ? { ...row, info: e.target.value } : row
                        )))}
                        rows={2}
                      />
                    </div>
                  </div>
                  {usedLines.length > 1 ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => setUsedLines((prev) => prev.filter((row) => row.key !== line.key))}
                    >
                      <Trash2 className='mr-1 h-4 w-4' />
                      Remover
                    </Button>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className='flex justify-end'>
            <Button type='button' disabled={isSaving} onClick={() => void submitUsed()}>
              {isSaving ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : null}
              Criar rascunho
            </Button>
          </div>
        </div>
      ) : null}

      {customerToEdit ? (
        <EditCustomerDialog
          open={isCreateCustomerOpen}
          onOpenChange={setIsCreateCustomerOpen}
          customer={customerToEdit}
          onSaved={selectSellerCustomer}
        />
      ) : (
        <CreateCustomerDialog
          open={isCreateCustomerOpen}
          onOpenChange={setIsCreateCustomerOpen}
          initialDocumentDigits={createCustomerInitialDocumentDigits}
          mode='create'
          onCreated={selectSellerCustomer}
        />
      )}
    </div>
  )
}
