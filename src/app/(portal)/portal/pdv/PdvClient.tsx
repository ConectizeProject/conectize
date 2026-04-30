'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { maskedFromCents, moneyToCentsFromMasked, formatMoneyInput } from '@/lib/utils/money'
import { toast } from '@/hooks/use-toast'

type CatalogProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  sale_price_cents: number | null
  stock: number
}

type CartItem = {
  productId: string
  name: string
  quantity: number
  unitPriceCents: number
  discountCents: number
}

type PaymentLine = {
  payment_method_id?: string | null
  payment_method_type: 'dinheiro' | 'pix' | 'credito' | 'debito' | 'outro'
  amountMasked: string
}

type PaymentMethod = {
  id: string
  description: string
  type: 'dinheiro' | 'pix_direto' | 'pix_maquina' | 'credito' | 'debito'
}

function normalizePaymentType (type: PaymentMethod['type']): PaymentLine['payment_method_type'] {
  if (type === 'pix_direto' || type === 'pix_maquina') return 'pix'
  if (type === 'credito') return 'credito'
  if (type === 'debito') return 'debito'
  if (type === 'dinheiro') return 'dinheiro'
  return 'outro'
}

export function PdvClient () {
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingCash, setLoadingCash] = useState(true)
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [payments, setPayments] = useState<PaymentLine[]>([])
  const [discountTotalMasked, setDiscountTotalMasked] = useState('')
  const [cashOpen, setCashOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [countedAmount, setCountedAmount] = useState('')
  const [busy, setBusy] = useState(false)

  const discountTotalCents = moneyToCentsFromMasked(discountTotalMasked) || 0

  const subtotalCents = useMemo(() => cart.reduce((acc, item) => {
    const raw = item.quantity * item.unitPriceCents
    return acc + Math.max(0, raw - item.discountCents)
  }, 0), [cart])

  const totalCents = Math.max(0, subtotalCents - discountTotalCents)
  const paidCents = useMemo(() => payments.reduce((acc, payment) => acc + (moneyToCentsFromMasked(payment.amountMasked) || 0), 0), [payments])
  const hasCashPayment = payments.some((p) => p.payment_method_type === 'dinheiro')
  const changeCents = hasCashPayment ? Math.max(0, paidCents - totalCents) : 0

  const searchProducts = useCallback(async (value: string) => {
    setLoadingProducts(true)
    const q = value.trim()
    const res = await portalFetch(`/api/portal/pdv/catalog?q=${encodeURIComponent(q)}`)
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.products)) {
      setProducts(data.products)
    } else {
      setProducts([])
    }
    setLoadingProducts(false)
  }, [])

  const loadCash = useCallback(async () => {
    setLoadingCash(true)
    const res = await portalFetch('/api/portal/pdv/cash/current')
    const data = await res?.json().catch(() => null)
    setCashOpen(Boolean(data?.ok && data?.session))
    setLoadingCash(false)
  }, [])

  const loadMethods = useCallback(async () => {
    const res = await portalFetch('/api/portal/payment-methods')
    const data = await res?.json().catch(() => null)
    if (data?.ok && Array.isArray(data.paymentMethods)) {
      setPaymentMethods(data.paymentMethods)
    }
  }, [])

  useEffect(() => {
    void searchProducts('')
    void loadCash()
    void loadMethods()
  }, [searchProducts, loadCash, loadMethods])

  useEffect(() => {
    function onKeyDown (event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault()
        document.getElementById('pdv-search')?.focus()
      }
      if (event.key === 'F6') {
        event.preventDefault()
        void finalizeSale()
      }
      if (event.key === 'Escape') {
        setQuery('')
      }
      if (event.ctrlKey && event.key === 'Backspace') {
        event.preventDefault()
        resetSale()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [cart, payments, discountTotalMasked, cashOpen])

  function addProduct (product: CatalogProduct) {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.productId === product.id)
      if (idx < 0) {
        return [...prev, {
          productId: product.id,
          name: product.name,
          quantity: 1,
          unitPriceCents: Number(product.sale_price_cents) || 0,
          discountCents: 0,
        }]
      }
      const next = [...prev]
      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
      return next
    })
  }

  function updateQty (productId: string, quantity: number) {
    setCart((prev) => prev.map((item) => item.productId === productId ? { ...item, quantity: Math.max(1, Math.round(quantity || 1)) } : item))
  }

  function removeItem (productId: string) {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }

  function resetSale () {
    setCart([])
    setPayments([])
    setDiscountTotalMasked('')
  }

  async function openCash () {
    const cents = moneyToCentsFromMasked(openingAmount) || 0
    setBusy(true)
    const res = await portalFetch('/api/portal/pdv/cash/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opening_amount_cents: cents }),
    })
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (data?.ok) {
      setCashOpen(true)
      setOpeningAmount('')
      toast({ title: 'Caixa aberto com sucesso' })
      return
    }
    toast({ title: data?.error || 'Erro ao abrir caixa', variant: 'destructive' })
  }

  async function closeCash () {
    const cents = moneyToCentsFromMasked(countedAmount) || 0
    setBusy(true)
    const res = await portalFetch('/api/portal/pdv/cash/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counted_cash_cents: cents }),
    })
    const data = await res?.json().catch(() => null)
    setBusy(false)
    if (data?.ok) {
      setCashOpen(false)
      setCountedAmount('')
      toast({ title: 'Caixa fechado com sucesso' })
      return
    }
    toast({ title: data?.error || 'Erro ao fechar caixa', variant: 'destructive' })
  }

  function addPaymentLine (method?: PaymentMethod) {
    setPayments((prev) => [...prev, {
      payment_method_id: method?.id ?? null,
      payment_method_type: method ? normalizePaymentType(method.type) : 'dinheiro',
      amountMasked: '',
    }])
  }

  function setPaymentLine (idx: number, patch: Partial<PaymentLine>) {
    setPayments((prev) => prev.map((line, index) => index === idx ? { ...line, ...patch } : line))
  }

  function removePaymentLine (idx: number) {
    setPayments((prev) => prev.filter((_, index) => index !== idx))
  }

  async function finalizeSale () {
    if (!cashOpen) {
      toast({ title: 'Abra o caixa antes de vender', variant: 'destructive' })
      return
    }
    if (cart.length === 0) {
      toast({ title: 'Adicione itens no carrinho', variant: 'destructive' })
      return
    }
    if (paidCents < totalCents) {
      toast({ title: 'Pagamento insuficiente', variant: 'destructive' })
      return
    }

    setBusy(true)
    const saleRes = await portalFetch('/api/portal/pdv/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discount_total_cents: discountTotalCents,
        items: cart.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
          discount_cents: item.discountCents,
        })),
      }),
    })
    const saleData = await saleRes?.json().catch(() => null)
    const saleId = saleData?.sale_id
    if (!saleData?.ok || !saleId) {
      setBusy(false)
      toast({ title: saleData?.error || 'Erro ao criar venda', variant: 'destructive' })
      return
    }

    const paymentPayload = payments.map((line) => ({
      payment_method_id: line.payment_method_id ?? null,
      payment_method_type: line.payment_method_type,
      amount_cents: moneyToCentsFromMasked(line.amountMasked) || 0,
      status: 'paid',
    })).filter((line) => line.amount_cents > 0)

    const payRes = await portalFetch(`/api/portal/pdv/sales/${saleId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payments: paymentPayload }),
    })
    const payData = await payRes?.json().catch(() => null)
    if (!payData?.ok) {
      setBusy(false)
      toast({ title: payData?.error || 'Erro ao lançar pagamento', variant: 'destructive' })
      return
    }

    const finalizeRes = await portalFetch(`/api/portal/pdv/sales/${saleId}/finalize`, { method: 'POST' })
    const finalizeData = await finalizeRes?.json().catch(() => null)
    setBusy(false)
    if (!finalizeData?.ok) {
      toast({ title: finalizeData?.error || 'Erro ao finalizar', variant: 'destructive' })
      return
    }

    toast({ title: `Venda #${finalizeData.sale.sale_number} finalizada` })
    resetSale()
    void searchProducts(query)
  }

  return (
    <div className='space-y-4 py-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold'>PDV</h1>
        <div className='flex items-center gap-2'>
          <Link href='/portal/pdv/vendas'><Button variant='outline'>Histórico</Button></Link>
          <Link href='/portal/pdv/relatorios'><Button variant='outline'>Resumo diário</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gestão de caixa</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-wrap items-end gap-3'>
          {loadingCash ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
          {!cashOpen ? (
            <>
              <div className='w-48'>
                <Label>Valor inicial</Label>
                <Input value={openingAmount} onChange={(e) => setOpeningAmount(formatMoneyInput(e.target.value))} placeholder='0,00' />
              </div>
              <Button onClick={openCash} disabled={busy}>Abrir caixa</Button>
            </>
          ) : (
            <>
              <div className='w-48'>
                <Label>Valor contado no fechamento</Label>
                <Input value={countedAmount} onChange={(e) => setCountedAmount(formatMoneyInput(e.target.value))} placeholder='0,00' />
              </div>
              <Button variant='destructive' onClick={closeCash} disabled={busy}>Fechar caixa</Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex gap-2'>
              <Input
                id='pdv-search'
                placeholder='Buscar por nome, SKU ou código de barras (F2)'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void searchProducts(query)
                  }
                }}
              />
              <Button variant='outline' onClick={() => void searchProducts(query)}><Search className='h-4 w-4' /></Button>
            </div>
            {loadingProducts ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
            <div className='max-h-[460px] space-y-2 overflow-auto'>
              {products.map((product) => (
                <button
                  key={product.id}
                  type='button'
                  onClick={() => addProduct(product)}
                  className='w-full rounded border p-3 text-left hover:bg-accent'
                >
                  <div className='font-medium'>{product.name}</div>
                  <div className='text-xs text-muted-foreground'>SKU: {product.sku || '—'} | Estoque: {product.stock}</div>
                  <div className='text-sm'>Venda: {maskedFromCents(product.sale_price_cents || 0)}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carrinho e pagamento</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='max-h-52 space-y-2 overflow-auto'>
              {cart.map((item) => (
                <div key={item.productId} className='rounded border p-2'>
                  <div className='text-sm font-medium'>{item.name}</div>
                  <div className='mt-1 flex items-center gap-2'>
                    <Input type='number' min={1} value={item.quantity} onChange={(e) => updateQty(item.productId, Number(e.target.value) || 1)} className='w-20' />
                    <Input value={maskedFromCents(item.unitPriceCents)} onChange={(e) => {
                      const cents = moneyToCentsFromMasked(formatMoneyInput(e.target.value)) || 0
                      setCart((prev) => prev.map((line) => line.productId === item.productId ? { ...line, unitPriceCents: cents } : line))
                    }} className='w-28' />
                    <Button variant='ghost' size='icon' onClick={() => removeItem(item.productId)}><Trash2 className='h-4 w-4' /></Button>
                  </div>
                </div>
              ))}
            </div>

            <div className='grid gap-2 sm:grid-cols-2'>
              <div>
                <Label>Desconto total</Label>
                <Input value={discountTotalMasked} onChange={(e) => setDiscountTotalMasked(formatMoneyInput(e.target.value))} placeholder='0,00' />
              </div>
              <div className='flex items-end'>
                <Button variant='outline' onClick={resetSale}>Cancelar venda (Ctrl+Backspace)</Button>
              </div>
            </div>

            <div className='space-y-1 rounded border p-3 text-sm'>
              <div className='flex justify-between'><span>Subtotal</span><strong>{maskedFromCents(subtotalCents)}</strong></div>
              <div className='flex justify-between'><span>Desconto</span><strong>- {maskedFromCents(discountTotalCents)}</strong></div>
              <div className='flex justify-between'><span>Total</span><strong>{maskedFromCents(totalCents)}</strong></div>
              <div className='flex justify-between'><span>Pago</span><strong>{maskedFromCents(paidCents)}</strong></div>
              <div className='flex justify-between'><span>Troco</span><strong>{maskedFromCents(changeCents)}</strong></div>
            </div>

            <div className='space-y-2'>
              <div className='flex gap-2'>
                <Button variant='outline' onClick={() => addPaymentLine()}>Adicionar pagamento</Button>
              </div>
              {payments.map((line, idx) => (
                <div key={`${idx}-${line.payment_method_type}`} className='grid gap-2 sm:grid-cols-[1fr,1fr,auto]'>
                  <select
                    className='h-10 rounded border bg-background px-2 text-sm'
                    value={line.payment_method_id || ''}
                    onChange={(e) => {
                      const id = e.target.value || null
                      const method = paymentMethods.find((m) => m.id === id)
                      setPaymentLine(idx, {
                        payment_method_id: id,
                        payment_method_type: method ? normalizePaymentType(method.type) : line.payment_method_type,
                      })
                    }}
                  >
                    <option value=''>Sem método</option>
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>{method.description}</option>
                    ))}
                  </select>
                  <Input value={line.amountMasked} onChange={(e) => setPaymentLine(idx, { amountMasked: formatMoneyInput(e.target.value) })} placeholder='0,00' />
                  <Button variant='ghost' size='icon' onClick={() => removePaymentLine(idx)}><Trash2 className='h-4 w-4' /></Button>
                </div>
              ))}
            </div>

            <Button className='w-full' disabled={busy || !cashOpen} onClick={() => void finalizeSale()}>
              {busy ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
              Finalizar venda (F6)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

