'use client'

import { useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { portalFetch } from '@/lib/portal/portal-fetch'
import { useEffect, useState } from 'react'

type CreditInstallmentFee = { installments: number; fee_percent: number }

type PaymentMethod = {
  id: string
  description: string
  type: string
  fee_percent: number
  credit_installment_fees: CreditInstallmentFee[]
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

export function ResaleDeviceTermsDialog({ open, onOpenChange, device }: Props) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])

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

  const paymentSummary = useMemo(() => {
    if (!device) return 'Não informado'
    const list = Array.isArray(device.sale_payment_methods) && device.sale_payment_methods.length > 0
      ? device.sale_payment_methods
      : (device.payment_method_id
        ? [{ payment_method_id: device.payment_method_id, installments: device.payment_installments ?? 1, value_cents: null }]
        : [])
    if (list.length === 0) return 'Não informado'

    const labels: string[] = []
    for (const entry of list) {
      const pm = paymentMethods.find((p) => p.id === entry.payment_method_id)
      if (!pm) continue
      let label = 'Não informado'
      if (pm.type === 'dinheiro') label = 'Dinheiro'
      else if (pm.type === 'pix_direto' || pm.type === 'pix_maquina') label = 'PIX'
      else if (pm.type === 'debito') label = 'Cartão de débito'
      else if (pm.type === 'credito') {
        const installments = entry.installments && entry.installments > 1 ? entry.installments : 1
        label = installments > 1 ? `Cartão de crédito ${installments}x` : 'Cartão de crédito'
      } else label = pm.description || 'Não informado'
      if (entry.value_cents != null && entry.value_cents > 0) {
        const value = (entry.value_cents / 100).toFixed(2).replace('.', ',')
        label = `${label} (R$ ${value})`
      }
      labels.push(label)
    }
    return labels.length > 0 ? labels.join('; ') : 'Não informado'
  }, [device, paymentMethods])

  const saleDateBr = formatDateBrFromIso(device?.sale_date ?? null)
  const warrantyEndBr = addDays(device?.sale_date ?? null, 90) || 'Não informado'

  if (!device) return null

  const deviceName = device.device_name || device.model || 'Aparelho'
  const storage = device.storage_gb ? `${device.storage_gb}GB` : null
  const battery = device.battery || null
  const imei = device.imei || device.serial || null
  const buyerName = device.buyer_name || 'Não informado'
  const buyerCpf = device.buyer_cpf || 'Não informado'
  const details = device.sale_details || device.sale_details === '' ? device.sale_details : null

  function handlePrint() {
    if (typeof window === 'undefined') return
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
    .small { font-size: 11px; color: #4b5563; margin-top: 10px; }
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
    <p><span class="label">Valor pago pelo cliente:</span> ${formatCentsBr(device.sold_for_cents)}</p>
    <p><span class="label">Forma de pagamento:</span> ${paymentSummary}</p>
    <p><span class="label">Data da compra:</span> ${saleDateBr}</p>
  </div>

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
    </p>
  </div>

  <p class="small">
    Para enviar este documento em PDF por WhatsApp, utilize a opção de impressão do navegador e salve como PDF antes de anexar na conversa.
  </p>
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
            <p><span className="font-semibold">Valor pago pelo cliente:</span> {formatCentsBr(device.sold_for_cents)}</p>
            <p><span className="font-semibold">Forma de pagamento:</span> {paymentSummary}</p>
            <p><span className="font-semibold">Data da compra:</span> {saleDateBr}</p>
          </section>

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
            </p>
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handlePrint}>
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

