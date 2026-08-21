'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FileUp, Loader2, Plus, Search, Trash2, Upload } from 'lucide-react'
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
import { toast } from '@/hooks/use-toast'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { parse3utoolsText } from '@/lib/resale/parse-3utools'
import { formatCpfCnpj } from '@/lib/utils/format-cpf-cnpj'
import {
  formatMoneyInput,
  moneyToCentsFromMasked,
} from '@/lib/utils/money'
import { onlyDigits } from '@/lib/utils/strings'
import { cn } from '@/lib/utils'

type Mode = 'xml' | 'manual' | 'usados'

type CustomerHit = {
  id: string
  full_name?: string | null
  company_name?: string | null
  trade_name?: string | null
  cpf?: string | null
  cnpj?: string | null
}

type PaymentMethod = {
  id: string
  description?: string | null
  type?: string | null
}

type ManualLine = {
  key: string
  description: string
  quantity: string
  unitValue: string
  productId: string | null
  productLabel: string
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

function customerDisplayName (customer: CustomerHit) {
  return String(
    customer.full_name
      || customer.trade_name
      || customer.company_name
      || '',
  ).trim()
}

function emptyManualLine (): ManualLine {
  return {
    key: newKey(),
    description: '',
    quantity: '1',
    unitValue: '',
    productId: null,
    productLabel: '',
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
  const [mode, setMode] = useState<Mode>(
    initialMode === 'manual' || initialMode === 'usados' ? initialMode : 'xml',
  )
  const [isSaving, setIsSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // XML
  const [isImporting, setIsImporting] = useState(false)

  // Manual products
  const [issuerName, setIssuerName] = useState('')
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [manualLines, setManualLines] = useState<ManualLine[]>([emptyManualLine()])
  const [productSearchByKey, setProductSearchByKey] = useState<Record<string, string>>({})
  const [productHitsByKey, setProductHitsByKey] = useState<Record<string, Array<{ id: string, name: string, sku?: string | null, barcode?: string | null, hasVariations?: boolean }>>>({})

  // Used
  const [sellerSearch, setSellerSearch] = useState('')
  const [sellerHits, setSellerHits] = useState<CustomerHit[]>([])
  const [sellerCustomerId, setSellerCustomerId] = useState<string | null>(null)
  const [sellerName, setSellerName] = useState('')
  const [sellerDocument, setSellerDocument] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState('')
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
    if (mode !== 'usados') return
    const q = sellerSearch.trim()
    if (q.length < 2) {
      setSellerHits([])
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const digits = onlyDigits(q)
      const url = digits.length >= 5
        ? `/api/portal/customers/search?documentPrefix=${encodeURIComponent(digits.slice(0, 5))}`
        : `/api/portal/customers/search?name=${encodeURIComponent(q)}`
      portalFetch(url, { signal: controller.signal })
        .then(async (res) => {
          const data = await res?.json().catch(() => null)
          if (controller.signal.aborted) return
          setSellerHits(Array.isArray(data?.customers) ? data.customers.slice(0, 8) : [])
        })
        .catch(() => {
          if (!controller.signal.aborted) setSellerHits([])
        })
    }, 250)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [mode, sellerSearch])

  const modes = useMemo(() => ([
    { id: 'xml' as const, title: 'Importar XML', description: 'Produtos novos a partir do XML do fornecedor' },
    { id: 'manual' as const, title: 'Cadastro manual', description: 'Produtos novos sem XML' },
    { id: 'usados' as const, title: 'Usados / aparelhos', description: 'Compra de seminovo de cliente final' },
  ]), [])

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
    setIsSaving(true)
    try {
      const items = manualLines.map((line) => ({
        description: line.description.trim() || line.productLabel.trim(),
        quantity: Number(line.quantity.replace(',', '.')),
        unit_value_cents: moneyToCentsFromMasked(line.unitValue) ?? 0,
        product_id: line.productId,
      }))
      const res = await portalFetch('/api/portal/fiscal/inbound-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'manual',
          issuer_name: issuerName.trim() || null,
          issued_at: issuedAt || null,
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
      const res = await portalFetch('/api/portal/fiscal/inbound-nfe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'used_devices',
          seller_customer_id: sellerCustomerId,
          seller_name: sellerName.trim() || null,
          seller_document: onlyDigits(sellerDocument) || null,
          purchase_date: purchaseDate || null,
          purchase_payment_methods: paymentMethodId
            ? [{ payment_method_id: paymentMethodId, value_cents: totalCents }]
            : [],
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

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='text-lg font-medium'>Nova NF-e de entrada</h2>
          <p className='text-sm text-muted-foreground'>
            Produtos novos (XML ou manual) ou aparelhos usados.
          </p>
        </div>
        <Link href='/portal/vendas/nfe/entradas'>
          <Button type='button' variant='outline'>Voltar</Button>
        </Link>
      </div>

      <div className='grid gap-3 md:grid-cols-3'>
        {modes.map((item) => (
          <button
            key={item.id}
            type='button'
            onClick={() => setMode(item.id)}
            className={cn(
              'rounded-lg border p-4 text-left transition-colors',
              mode === item.id
                ? 'border-primary bg-primary/5'
                : 'hover:bg-muted/50',
            )}
          >
            <p className='font-medium'>{item.title}</p>
            <p className='mt-1 text-sm text-muted-foreground'>{item.description}</p>
          </button>
        ))}
      </div>

      {mode === 'xml' ? (
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Importar XML do fornecedor</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
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
              disabled={isImporting}
              onClick={() => fileRef.current?.click()}
            >
              {isImporting ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : <Upload className='mr-1 h-4 w-4' />}
              {isImporting ? 'Importando...' : 'Selecionar XML'}
            </Button>
            <p className='text-sm text-muted-foreground'>
              Após importar, você vincula os itens aos produtos e lança o estoque.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {mode === 'manual' ? (
        <div className='space-y-4'>
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Fornecedor</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label htmlFor='issuer'>Nome / razão social</Label>
                <Input id='issuer' value={issuerName} onChange={(e) => setIssuerName(e.target.value)} />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='issued'>Data</Label>
                <Input id='issued' type='date' value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
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

          <div className='flex justify-end'>
            <Button type='button' disabled={isSaving} onClick={() => void submitManual()}>
              {isSaving ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : <FileUp className='mr-1 h-4 w-4' />}
              Criar rascunho
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'usados' ? (
        <div className='space-y-4'>
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>Cliente vendedor</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='relative space-y-1.5'>
                <Label>Buscar cliente</Label>
                <div className='relative'>
                  <Input
                    value={sellerSearch}
                    onChange={(e) => {
                      setSellerSearch(e.target.value)
                      setSellerCustomerId(null)
                    }}
                    placeholder='Nome ou CPF/CNPJ'
                  />
                  <Search className='pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground' />
                </div>
                {sellerHits.length > 0 ? (
                  <ul className='max-h-40 overflow-auto rounded-md border bg-background'>
                    {sellerHits.map((hit) => {
                      const doc = onlyDigits(String(hit.cnpj || hit.cpf || ''))
                      return (
                        <li key={hit.id}>
                          <button
                            type='button'
                            className='flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted'
                            onClick={() => {
                              const name = customerDisplayName(hit)
                              setSellerCustomerId(hit.id)
                              setSellerName(name)
                              setSellerDocument(doc)
                              setSellerSearch(name)
                              setSellerHits([])
                            }}
                          >
                            <span className='font-medium'>{customerDisplayName(hit) || 'Sem nome'}</span>
                            <span className='text-xs text-muted-foreground'>
                              {doc ? formatCpfCnpj(doc) : hit.id.slice(0, 8)}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label>Nome do vendedor</Label>
                  <Input value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
                </div>
                <div className='space-y-1.5'>
                  <Label>CPF/CNPJ</Label>
                  <Input
                    value={sellerDocument ? formatCpfCnpj(sellerDocument) : ''}
                    onChange={(e) => setSellerDocument(onlyDigits(e.target.value).slice(0, 14))}
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label>Data da compra</Label>
                  <Input type='date' value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                </div>
                <div className='space-y-1.5'>
                  <Label>Forma de pagamento</Label>
                  <Select value={paymentMethodId || undefined} onValueChange={setPaymentMethodId}>
                    <SelectTrigger>
                      <SelectValue placeholder='Opcional — saída financeira' />
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
    </div>
  )
}
