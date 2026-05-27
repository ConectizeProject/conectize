'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { getSalePaymentListFromDevice } from '@/lib/resale/sale-payment-methods'

type CreditInstallmentFee = { installments: number; fee_percent: number }

type PaymentMethod = {
  id: string
  description: string
  type: string
  fee_percent: number
  credit_installment_fees: CreditInstallmentFee[]
}

type TradeInForTerms = {
  device_name: string | null
  imei: string | null
  info: string | null
  condition: string | null
  value_cents: number
}

type ResaleDeviceForTerms = {
  id: string
  device_name: string | null
  model?: string | null
  color?: string | null
  storage_gb: string | null
  battery: string | null
  imei: string | null
  serial?: string | null
  sold_for_cents: number | null
  sale_date: string | null
  buyer_name: string | null
  buyer_cpf: string | null
  sale_details: string | null
  payment_method_id: string | null
  payment_installments: number | null
  sale_payment_methods?: Array<{ payment_method_id: string; value_cents?: number | null; installments?: number }> | null
  trade_ins?: TradeInForTerms[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  device: ResaleDeviceForTerms | null
}

function formatCentsBr(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return 'Não informado'
  const value = (cents / 100).toFixed(2).replace('.', ',')
  return `R$ ${value}`
}

function formatDateBrFromIso(date: string | null | undefined): string {
  if (!date) return 'Não informado'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return 'Não informado'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function addDays(date: string | null | undefined, days: number): string | null {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + days)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function escapeHtml (raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Uma linha por forma de pagamento. */
function buildSalePaymentLines (
  device: ResaleDeviceForTerms,
  paymentMethods: PaymentMethod[]
): string[] {
  const list = getSalePaymentListFromDevice(device)
  if (list.length === 0) return []

  const lines: string[] = []
  for (const entry of list) {
    const id = String(entry.payment_method_id ?? '')
    const pm = paymentMethods.find(
      (p) => p.id === id || p.id.toLowerCase() === id.toLowerCase()
    )
    let label = 'Não informado'
    if (pm) {
      if (pm.type === 'dinheiro') label = 'Dinheiro'
      else if (pm.type === 'pix_direto' || pm.type === 'pix_maquina') label = 'PIX'
      else if (pm.type === 'debito') label = 'Cartão de débito'
      else if (pm.type === 'credito') {
        const installments = entry.installments && entry.installments > 1 ? entry.installments : 1
        label = installments > 1 ? `Cartão de crédito ${installments}x` : 'Cartão de crédito'
      } else label = pm.description || 'Não informado'
    } else if (entry.payment_method_id) {
      const inst = entry.installments && entry.installments > 1 ? ` (${entry.installments}x)` : ''
      label = `Forma de pagamento registrada${inst}`
    }
    if (entry.value_cents != null && entry.value_cents > 0) {
      const value = (entry.value_cents / 100).toFixed(2).replace('.', ',')
      label = `${label} — R$ ${value}`
    }
    lines.push(label)
  }
  return lines
}

function buildTradeInPaymentLines (tradeIns: TradeInForTerms[] | undefined): string[] {
  if (!tradeIns?.length) return []
  return tradeIns.map((t) => {
    const name = (t.device_name || '').trim() || 'Aparelho'
    const value = (t.value_cents / 100).toFixed(2).replace('.', ',')
    return `Aparelho em troca — ${name} — R$ ${value}`
  })
}

function buildTradeInDetailsHtml (tradeIns: TradeInForTerms[]): string {
  if (tradeIns.length === 0) return ''
  const items = tradeIns.map((t) => {
    const name = escapeHtml((t.device_name || '').trim() || 'Aparelho')
    const imei = escapeHtml((t.imei || '').trim() || 'Não informado')
    const condition = escapeHtml((t.condition || '').trim() || 'Não informado')
    const info = escapeHtml((t.info || '').trim() || 'Não informado')
    const value = formatCentsBr(t.value_cents)
    return `<li><strong>${name}</strong> — Valor: ${value}<br />IMEI: ${imei} · Estado: ${condition}<br />Informação: ${info}</li>`
  }).join('')
  return `<div class="section"><h2>Aparelho(s) recebido(s) em troca</h2><ul style="margin:4px 0 8px 18px;padding:0;">${items}</ul></div>`
}

export function ResaleDeviceTermsDialog({ open, onOpenChange, device }: Props) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [serverSnapshot, setServerSnapshot] = useState<ResaleDeviceForTerms | null>(null)
  const [termsFetchLoading, setTermsFetchLoading] = useState(false)
  const deviceRef = useRef(device)
  deviceRef.current = device

  useEffect(() => {
    if (!open) {
      setServerSnapshot(null)
      setTermsFetchLoading(false)
      return
    }
    if (!device?.id) {
      setServerSnapshot(null)
      setTermsFetchLoading(false)
      return
    }
    const id = device.id
    setTermsFetchLoading(true)
    let cancelled = false
    ;(async () => {
      try {
        const res = await portalFetch(`/api/portal/resale-devices/${id}`)
        const data = await res?.json().catch(() => null)
        if (cancelled || !data?.ok || !data.device) return
        const base = deviceRef.current
        if (!base || base.id !== id) return
        const srv = data.device as Record<string, unknown>
        const salePmsMerged = Object.prototype.hasOwnProperty.call(srv, 'sale_payment_methods')
          ? (srv.sale_payment_methods as ResaleDeviceForTerms['sale_payment_methods']) ?? null
          : base.sale_payment_methods
        setServerSnapshot({
          ...base,
          sale_payment_methods: salePmsMerged,
          payment_method_id: (srv.payment_method_id as string | null | undefined) ?? base.payment_method_id,
          payment_installments: (srv.payment_installments as number | null | undefined) ?? base.payment_installments,
          sold_for_cents: (srv.sold_for_cents as number | null | undefined) ?? base.sold_for_cents,
          sale_date: (srv.sale_date as string | null | undefined) ?? base.sale_date,
          buyer_name: (srv.buyer_name as string | null | undefined) ?? base.buyer_name,
          buyer_cpf: (srv.buyer_cpf as string | null | undefined) ?? base.buyer_cpf,
          sale_details: (srv.sale_details as string | null | undefined) ?? base.sale_details,
          device_name: (srv.device_name as string | null | undefined) ?? base.device_name,
          model: (srv.model as string | null | undefined) ?? base.model,
          color: (srv.color as string | null | undefined) ?? base.color,
          storage_gb: (srv.storage_gb as string | null | undefined) ?? base.storage_gb,
          battery: (srv.battery as string | null | undefined) ?? base.battery,
          imei: (srv.imei as string | null | undefined) ?? base.imei,
          serial: (srv.serial as string | null | undefined) ?? base.serial,
          trade_ins: Array.isArray(srv.trade_ins)
            ? (srv.trade_ins as TradeInForTerms[])
            : base.trade_ins,
        })
      } catch {
        if (!cancelled) setServerSnapshot(null)
      } finally {
        if (!cancelled) setTermsFetchLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, device?.id])

  useEffect(() => {
    if (!open) return
    let isMounted = true
    async function loadPaymentMethods() {
      try {
        const res = await portalFetch('/api/portal/payment-methods')
        const data = await res?.json().catch(() => null)
        if (!isMounted) return
        if (data?.ok && Array.isArray(data.paymentMethods)) {
          setPaymentMethods(data.paymentMethods as PaymentMethod[])
        }
      } catch {
        if (isMounted) setPaymentMethods([])
      }
    }
    loadPaymentMethods()
    return () => {
      isMounted = false
    }
  }, [open])

  const effectiveDevice = device ? (serverSnapshot ?? device) : null
  const salePaymentLines = useMemo(() => {
    if (!effectiveDevice) return []
    const cash = buildSalePaymentLines(effectiveDevice, paymentMethods)
    const trade = buildTradeInPaymentLines(effectiveDevice.trade_ins)
    return [...cash, ...trade]
  }, [effectiveDevice, paymentMethods])

  const tradeIns = effectiveDevice?.trade_ins ?? []

  const saleDateBr = formatDateBrFromIso(effectiveDevice?.sale_date ?? null)
  const warrantyEndBr = addDays(effectiveDevice?.sale_date ?? null, 90) || 'Não informado'

  if (!device || !effectiveDevice) return null

  const d = effectiveDevice
  const deviceName = d.device_name || d.model || 'Aparelho'
  const storage = d.storage_gb ? `${d.storage_gb}GB` : null
  const battery = d.battery || null
  const imei = d.imei || d.serial || null
  const buyerName = d.buyer_name || 'Não informado'
  const buyerCpf = d.buyer_cpf || 'Não informado'
  const details = d.sale_details || d.sale_details === '' ? d.sale_details : null

  function handlePrint() {
    if (typeof window === 'undefined' || termsFetchLoading) return
    const linesForPrint = [
      ...buildSalePaymentLines(d, paymentMethods),
      ...buildTradeInPaymentLines(d.trade_ins),
    ]
    const paymentLinesHtml =
      linesForPrint.length > 0
        ? `<ul style="margin:4px 0 8px 18px;padding:0;">${linesForPrint.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
        : '<p>Não informado</p>'
    const title = 'Termo de compra e garantia'
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charSet="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      color: #111827;
      padding: 24px;
    }
    h1 { font-size: 18px; margin-bottom: 8px; }
    h2 { font-size: 14px; margin: 12px 0 4px; }
    p, li { margin: 2px 0; }
    .section { margin-bottom: 10px; }
    .label { font-weight: 600; }
  </style>
</head>
<body>
  <h1>Termo de compra e garantia</h1>

  <div class="section">
    <h2>Dados do comprador</h2>
    <p><span class="label">Nome:</span> ${buyerName}</p>
    <p><span class="label">CPF/CNPJ:</span> ${buyerCpf}</p>
  </div>

  <div class="section">
    <h2>Dados do aparelho</h2>
    <p><span class="label">Modelo:</span> ${deviceName}${storage ? ` — ${storage}` : ''}</p>
    <p><span class="label">IMEI/Serial:</span> ${imei || 'Não informado'}</p>
    <p><span class="label">Bateria:</span> ${battery || 'Não informado'}</p>
    ${details != null && details !== '' ? `<p><span class="label">Detalhes do aparelho:</span> ${String(details).replace(/\n/g, '<br />')}</p>` : ''}
  </div>

  <div class="section">
    <h2>Dados da venda</h2>
    <p><span class="label">Valor pago pelo cliente:</span> ${formatCentsBr(d.sold_for_cents)}</p>
    <p><span class="label">Formas de pagamento utilizadas:</span></p>
    ${paymentLinesHtml}
    <p><span class="label">Data da compra:</span> ${saleDateBr}</p>
  </div>

  ${buildTradeInDetailsHtml(d.trade_ins ?? [])}

  <div class="section">
    <h2>Termo de garantia contra vícios ocultos</h2>
    <p>
      O comprador declara estar ciente de que adquiriu o aparelho descrito neste termo como <span class="label">seminovo</span>,
      tendo sido informado sobre seu estado de conservação, características e eventuais marcas de uso.
    </p>
    <p>
      A <span class="label">garantia contra vícios ocultos</span> é de <span class="label">90 (noventa) dias</span>, contados a partir da data da compra (${saleDateBr}),
      com término em ${warrantyEndBr}, limitada a defeitos de funcionamento não aparentes no momento da venda.
    </p>
    <p>
      Esta garantia <span class="label">não cobre</span> danos decorrentes de mau uso, queda, impacto, contato com líquidos,
      oxidação, violação, intervenção técnica de terceiros não autorizados, uso de acessórios inadequados ou qualquer outra causa
      que não seja considerada vício oculto de fabricação.
    </p>
    <p>
      Em caso de vício oculto coberto por esta garantia, o aparelho poderá ser encaminhado para avaliação técnica. Identificado o vício,
      o vendedor poderá, a seu critério, realizar reparo, substituição por aparelho equivalente ou cancelar a venda com restituição do valor pago,
      observada a legislação vigente.
    </p>
    <p>
      Ao confirmar esta venda, o comprador declara ter lido e concordado com os termos acima, bem como recebido o aparelho nas condições descritas.
      Assim como informado no momento da compra do aparelho, o comprador concordou com os termos.
    </p>
  </div>

</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Termo de compra e garantia</DialogTitle>
          <DialogDescription>
            Documento referente à venda do aparelho seminovo, com informações do produto, pagamento e garantia legal contra vícios ocultos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-relaxed">
          <section className="space-y-1">
            <h3 className="font-semibold text-base">Dados do comprador</h3>
            <p><span className="font-semibold">Nome:</span> {buyerName}</p>
            <p><span className="font-semibold">CPF:</span> {buyerCpf}</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-semibold text-base">Dados do aparelho</h3>
            <p>
              <span className="font-semibold">Modelo:</span> {deviceName}
              {storage ? <> — {storage}</> : null}
            </p>
            <p><span className="font-semibold">IMEI/Serial:</span> {imei || 'Não informado'}</p>
            <p><span className="font-semibold">Bateria:</span> {battery || 'Não informado'}</p>
            {details != null && details !== '' && (
              <p>
                <span className="font-semibold">Detalhes do aparelho:</span>{' '}
                <span className="whitespace-pre-wrap break-words">{details}</span>
              </p>
            )}
          </section>

          <section className="space-y-1">
            <h3 className="font-semibold text-base">Dados da venda</h3>
            <p><span className="font-semibold">Valor pago pelo cliente:</span> {formatCentsBr(d.sold_for_cents)}</p>
            <p className="font-semibold">Formas de pagamento utilizadas:</p>
            {termsFetchLoading ? (
              <p className="text-muted-foreground">Carregando formas de pagamento…</p>
            ) : salePaymentLines.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1">
                {salePaymentLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Não informado</p>
            )}
            <p><span className="font-semibold">Data da compra:</span> {saleDateBr}</p>
          </section>

          {tradeIns.length > 0 ? (
            <section className="space-y-2">
              <h3 className="font-semibold text-base">Aparelho(s) recebido(s) em troca</h3>
              <ul className="list-disc pl-5 space-y-2">
                {tradeIns.map((t, i) => (
                  <li key={i} className="text-sm">
                    <p>
                      <span className="font-semibold">{(t.device_name || '').trim() || 'Aparelho'}</span>
                      {' — '}
                      <span className="font-semibold">Valor:</span> {formatCentsBr(t.value_cents)}
                    </p>
                    <p>
                      <span className="font-semibold">IMEI:</span> {(t.imei || '').trim() || 'Não informado'}
                      {' · '}
                      <span className="font-semibold">Estado:</span> {(t.condition || '').trim() || 'Não informado'}
                    </p>
                    <p>
                      <span className="font-semibold">Informação:</span>{' '}
                      {(t.info || '').trim() || 'Não informado'}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="font-semibold text-base">Termo de garantia contra vícios ocultos</h3>
            <p>
              O comprador declara estar ciente de que adquiriu o aparelho descrito neste termo como <span className="font-semibold">seminovo</span>,
              tendo sido informado sobre seu estado de conservação, características e eventuais marcas de uso.
            </p>
            <p>
              A <span className="font-semibold">garantia contra vícios ocultos</span> é de{' '}
              <span className="font-semibold">90 (noventa) dias</span>, contados a partir da data da compra ({saleDateBr}),
              com término em {warrantyEndBr}, limitada a defeitos de funcionamento não aparentes no momento da venda.
            </p>
            <p>
              Esta garantia <span className="font-semibold">não cobre</span> danos decorrentes de mau uso, queda, impacto, contato com líquidos,
              oxidação, violação, intervenção técnica de terceiros não autorizados, uso de acessórios inadequados ou qualquer outra causa
              que não seja considerada vício oculto de fabricação.
            </p>
            <p>
              Em caso de vício oculto coberto por esta garantia, o aparelho poderá ser encaminhado para avaliação técnica. Identificado o vício,
              o vendedor poderá, a seu critério, realizar reparo, substituição por aparelho equivalente ou cancelar a venda com restituição do valor pago,
              observada a legislação vigente.
            </p>
          </section>

          <section className="space-y-1">
            <p>
              Ao confirmar esta venda, o comprador declara ter lido e concordado com os termos acima, bem como recebido o aparelho nas condições descritas.
              Assim como informado no momento da compra do aparelho, o comprador concordou com os termos.
            </p>
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handlePrint} disabled={termsFetchLoading}>
            Imprimir / PDF
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

