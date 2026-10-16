'use client'

import { useCallback, type MouseEvent, type ReactNode } from 'react'
import { Bike, ChevronDown, Copy, Handshake, Package, Pencil, Scale, Truck, Wallet, Zap } from 'lucide-react'
import { meliClaimStatusLabel, saleProfitBreakdown } from '@/lib/vendas/meli-sale-display'
import { MarginRow } from '@/app/(portal)/portal/vendas/SoldItemMarginBreakdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { maskedFromCents } from '@/lib/utils/money'
import { nfeDanfeDownloadUrl } from '@/app/(portal)/portal/vendas/SalesOrderCupomPrint'

export type SalesOrderListItem = {
  product_id: string | null
  name: string
  sku: string | null
  image_url: string | null
  quantity: number
  unit_price_cents: number
  cost_total_cents?: number | null
  stock_current: number | null
  stock_after_sale: number | null
  ml_item_id?: string | null
  ml_item_url?: string | null
  /** Pedido individual MELI (dentro de um carrinho/pack). */
  ml_order_id?: string | null
}

export type SalesOrderListRowData = {
  id: string
  order_number: number
  status: 'in_progress' | 'paid' | 'canceled'
  customer_name: string | null
  total_cents: number
  created_at: string
  ml_order_id?: string | null
  ml_pack_id?: string | null
  ml_logistic_type?: string | null
  ml_buyer_name?: string | null
  ml_buyer_nickname?: string | null
  ml_shipping_gross_cents?: number | null
  ml_shipping_refund_cents?: number | null
  ml_sale_fee_cents?: number | null
  ml_posting_deadline?: string | null
  ml_delivery_estimate?: string | null
  ml_shipping_method?: string | null
  ml_label_status?: string | null
  ml_label_available_at?: string | null
  ml_label_printable?: boolean | null
  ml_claim_status?: string | null
  ml_shipment_id?: string | null
  tax_cents?: number | null
  nfe_status?: 'pending' | 'authorized' | 'rejected' | 'canceled' | 'denied' | null
  nfe_document_id?: string | null
  title?: string | null
  status_label?: string | null
  allow_nfe?: boolean
  items?: SalesOrderListItem[]
}

export type SalesOrderListLine = {
  order: SalesOrderListRowData
  isBusy: boolean
  onEmitNfe: () => void
  onViewNfe: () => void
  onSendNfe: () => void
  onEditCost?: () => void
  /** Abre a edição do produto (ex.: clique em “x disponíveis”). */
  onEditProduct?: (item: SalesOrderListItem) => void
  onPrintLabel?: () => void
  onDownloadLabelZpl?: (kind: 'custom' | 'original' | 'pdf') => void
  isPrintingLabel?: boolean
  menu: ReactNode
}

function statusLabel (status: SalesOrderListRowData['status']) {
  if (status === 'in_progress') return 'Em andamento'
  if (status === 'paid') return 'Pago'
  return 'Pagamento Devolvido'
}

function dateParts (iso: string | null | undefined) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return {
    day: `${pick('day')}/${pick('month')}/${pick('year')}`,
    hour: pick('hour'),
    minute: pick('minute'),
  }
}

function formatPurchaseDate (iso: string) {
  const parts = dateParts(iso)
  if (!parts) return ''
  return `${parts.day} - ${parts.hour}:${parts.minute}`
}

function formatDeadline (iso: string | null | undefined) {
  const parts = dateParts(iso)
  if (!parts) return null
  return `${parts.day} ${parts.hour}:${parts.minute}`
}

function formatDelivery (iso: string | null | undefined) {
  const parts = dateParts(iso)
  if (!parts) return null
  if (parts.hour === '00' && parts.minute === '00') return parts.day
  return `${parts.day} ${parts.hour}:${parts.minute}`
}

function formatLabelAvailableDay (iso: string | null | undefined) {
  const parts = dateParts(iso)
  if (!parts) return null
  return parts.day
}

function money (cents: number) {
  return `R$ ${maskedFromCents(Math.abs(cents))}`
}

function signedMoney (cents: number) {
  if (cents < 0) return `−${money(cents)}`
  return money(cents)
}

function resultClass (cents: number) {
  if (cents < 0) return 'text-red-600 dark:text-red-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

function profitPercentLabel (netCents: number, saleCents: number) {
  if (saleCents <= 0) return null
  const percent = (netCents / saleCents) * 100
  const sign = percent < 0 ? '−' : ''
  return `${sign}${Math.abs(percent).toFixed(2).replace('.', ',')}%`
}

async function copyText (value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    try {
      const input = document.createElement('textarea')
      input.value = value
      input.setAttribute('readonly', '')
      input.style.position = 'fixed'
      input.style.left = '-9999px'
      document.body.appendChild(input)
      input.select()
      const copied = document.execCommand('copy')
      input.remove()
      return copied
    } catch {
      return false
    }
  }
}

function CopyIconButton ({ value, label }: { value: string, label: string }) {
  const onCopy = useCallback(async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const copied = await copyText(value)
    toast(copied
      ? { title: 'Copiado' }
      : { title: 'Não foi possível copiar', variant: 'destructive' })
  }, [value])

  return (
    <button
      type='button'
      className='inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground'
      aria-label={label}
      onClick={onCopy}
    >
      <Copy className='h-3.5 w-3.5' aria-hidden='true' />
    </button>
  )
}

function stopRowClick (event: MouseEvent) {
  event.stopPropagation()
}

function MarginColumn ({
  order,
  onEditCost,
}: {
  order: SalesOrderListRowData
  onEditCost?: () => void
}) {
  const items = order.items ?? []
  const isCanceled = order.status === 'canceled'
  const saleCents = Math.max(0, Number(order.total_cents) || 0)

  // Cancelada sem gasto adicional: valor pago + devolução integral = 0.
  if (isCanceled) {
    return (
      <div className='w-full min-w-[8.5rem] max-w-[11rem]' onClick={stopRowClick}>
        <MarginRow
          icon={<Handshake className='h-3.5 w-3.5' aria-hidden />}
          iconClassName='text-emerald-600 dark:text-emerald-400'
          value={money(saleCents)}
          valueClassName='text-emerald-600 dark:text-emerald-400'
          tooltip={<p className='text-xs'>Valor pago pelo cliente</p>}
        />
        <MarginRow
          icon={<Handshake className='h-3.5 w-3.5' aria-hidden />}
          iconClassName='text-rose-600 dark:text-rose-400'
          value={`−${money(saleCents)}`}
          valueClassName='text-rose-600 dark:text-rose-400'
          tooltip={<p className='text-xs'>Devolução do pagamento</p>}
        />
        <div className='mt-0.5 border-t border-border/70 pt-0.5'>
          <MarginRow
            icon={<Wallet className='h-3.5 w-3.5' aria-hidden />}
            iconClassName='text-muted-foreground'
            value={signedMoney(0)}
            valueClassName='text-muted-foreground'
            tooltip={<p className='text-xs'>Resultado final da operação</p>}
          />
        </div>
      </div>
    )
  }

  const productCostCents = items.reduce((sum, item) => sum + Math.max(0, Number(item.cost_total_cents) || 0), 0)
  const profit = saleProfitBreakdown({
    saleCents,
    freightCents: Number(order.ml_shipping_gross_cents) || 0,
    refundCents: Number(order.ml_shipping_refund_cents) || 0,
    feeCents: Number(order.ml_sale_fee_cents) || 0,
    productCostCents,
    taxCents: Number(order.tax_cents) || 0,
  })

  return (
    <div className='w-full min-w-[8.5rem] max-w-[11rem]' onClick={stopRowClick}>
      <MarginRow
        icon={<Handshake className='h-3.5 w-3.5' aria-hidden />}
        iconClassName='text-emerald-600 dark:text-emerald-400'
        value={money(profit.saleCents)}
        valueClassName='text-emerald-600 dark:text-emerald-400'
        tooltip={<p className='text-xs'>Valor da venda</p>}
      />
      {profit.freightCents > 0 ? (
        <MarginRow
          icon={<Truck className='h-3.5 w-3.5' aria-hidden />}
          iconClassName='text-muted-foreground'
          value={`−${money(profit.freightCents)}`}
          valueClassName='text-muted-foreground'
          tooltip={<p className='text-xs'>Valor do frete</p>}
        />
      ) : null}
      {profit.refundCents > 0 ? (
        <MarginRow
          icon={<Truck className='h-3.5 w-3.5' aria-hidden />}
          iconClassName='text-emerald-600 dark:text-emerald-400'
          value={money(profit.refundCents)}
          valueClassName='text-emerald-600 dark:text-emerald-400'
          tooltip={<p className='text-xs'>Valor reembolsado pelo Mercado Livre no frete</p>}
        />
      ) : null}
      <MarginRow
        icon={<Handshake className='h-3.5 w-3.5' aria-hidden />}
        iconClassName='text-muted-foreground'
        value={`−${money(profit.feeCents)}`}
        valueClassName='text-muted-foreground'
        tooltip={<p className='text-xs'>Tarifa do Mercado Livre</p>}
      />
      <div className='mt-0.5 border-t border-border/70 pt-0.5'>
        <MarginRow
          icon={<Wallet className='h-3.5 w-3.5' aria-hidden />}
          iconClassName='text-sky-600 dark:text-sky-400'
          value={signedMoney(profit.grossCents)}
          valueClassName='text-sky-600 dark:text-sky-400'
          tooltip={<p className='text-xs'>Lucro bruto, depois do frete, do reembolso e da tarifa</p>}
        />
      </div>
      <div className='mt-0.5 space-y-0 border-t border-border/70 pt-0.5'>
        <MarginRow
          icon={<Package className='h-3.5 w-3.5' aria-hidden />}
          iconClassName='text-muted-foreground'
          value={`−${money(profit.productCostCents)}`}
          valueClassName='text-muted-foreground'
          tooltip={<p className='text-xs'>Valor do produto</p>}
          onClick={onEditCost}
          clickLabel='Editar custo do produto'
          hoverTrailing={onEditCost ? <Pencil className='h-3 w-3' /> : null}
        />
        <MarginRow
          icon={<Scale className='h-3.5 w-3.5' aria-hidden />}
          iconClassName='text-muted-foreground'
          value={`−${money(profit.taxCents)}`}
          valueClassName='text-muted-foreground'
          tooltip={<p className='text-xs'>Imposto estimado pela alíquota média da empresa</p>}
        />
      </div>
      <div className='mt-0.5 border-t border-border/70 pt-0.5'>
        <MarginRow
          icon={<Wallet className='h-3.5 w-3.5' aria-hidden />}
          iconClassName={resultClass(profit.netCents)}
          value={signedMoney(profit.netCents)}
          valueClassName={resultClass(profit.netCents)}
          subValue={profitPercentLabel(profit.netCents, profit.saleCents)}
          tooltip={<p className='text-xs'>Lucro líquido, depois do custo do produto e do imposto</p>}
        />
      </div>
    </div>
  )
}

function ProductColumn ({
  order,
  showIndividualOrderId,
  showLogisticLine,
  onEditProduct,
}: {
  order: SalesOrderListRowData
  showIndividualOrderId: boolean
  showLogisticLine: boolean
  onEditProduct?: (item: SalesOrderListItem) => void
}) {
  const isFlex = order.ml_logistic_type === 'self_service'
  const isFull = order.ml_logistic_type === 'fulfillment'
  const items = order.items ?? []
  const lineOrderId = String(
    items[0]?.ml_order_id || order.ml_order_id || '',
  ).trim()

  if (items.length === 0) {
    return <p className='text-sm text-muted-foreground'>Sem itens vinculados</p>
  }

  return (
    <div className='min-w-0 space-y-3'>
      {items.map((item) => {
        // FULL: estoque no depósito do ML, saldo local não se aplica.
        const stock = isFull ? null : (item.stock_after_sale ?? item.stock_current)
        const shippingMethod = showLogisticLine ? String(order.ml_shipping_method || '').trim() : ''
        const showLogistic = showLogisticLine && (isFlex || isFull || Boolean(shippingMethod))
        const itemOrderId = String(item.ml_order_id || lineOrderId || '').trim()
        const canEditProduct = Boolean(item.product_id && onEditProduct)
        return (
          <div key={`${order.id}-${item.product_id || item.name}`} className='min-w-0 space-y-2'>
            {showIndividualOrderId && itemOrderId ? (
              <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                <span className='font-mono text-foreground'>{itemOrderId}</span>
                <CopyIconButton value={itemOrderId} label='Copiar pedido individual' />
              </p>
            ) : null}
            <p className='flex items-start gap-2'>
              <span className='inline-flex h-6 shrink-0 items-center justify-center rounded-md bg-amber-500/15 px-2 text-xs font-semibold tabular-nums text-amber-800 dark:text-amber-300'>
                {item.quantity}x
              </span>
              <span className='line-clamp-2 text-sm font-medium'>{item.name}</span>
            </p>
            <div className='flex min-w-0 gap-3'>
              <span className='flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md text-muted-foreground'>
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt=''
                    loading='lazy'
                    decoding='async'
                    className='h-auto max-h-full w-auto max-w-full object-contain'
                  />
                ) : (
                  <Package className='h-7 w-7' aria-hidden='true' />
                )}
              </span>
              <div className='min-w-0 space-y-0.5'>
                {item.sku ? (
                  <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                    <span className='truncate'>SKU: {item.sku}</span>
                    <CopyIconButton value={item.sku} label='Copiar SKU' />
                  </p>
                ) : null}
                {item.ml_item_id ? (
                  <p className='flex items-center gap-1 text-xs'>
                    {item.ml_item_url ? (
                      <a
                        href={item.ml_item_url}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='truncate font-mono text-foreground underline-offset-2 hover:underline'
                        onClick={stopRowClick}
                      >
                        {item.ml_item_id}
                      </a>
                    ) : (
                      <span className='truncate font-mono'>{item.ml_item_id}</span>
                    )}
                    <CopyIconButton value={item.ml_item_id} label='Copiar anúncio' />
                  </p>
                ) : null}
                <p className='text-sm'>
                  <span className='font-semibold text-emerald-600'>{money(item.unit_price_cents)}</span>
                  {stock != null ? (
                    <>
                      <span className='mx-1.5 text-muted-foreground' aria-hidden='true'>·</span>
                      {canEditProduct ? (
                        <button
                          type='button'
                          className='inline font-semibold text-emerald-600 underline-offset-2 hover:underline'
                          aria-label={
                            stock === 1
                              ? '1 disponível. Abrir edição de estoque'
                              : `${stock} disponíveis. Abrir edição de estoque`
                          }
                          onClick={(event) => {
                            stopRowClick(event)
                            onEditProduct?.(item)
                          }}
                        >
                          <span>{stock}</span>
                          <span className='font-normal text-foreground'>
                            {stock === 1 ? ' disponível' : ' disponíveis'}
                          </span>
                        </button>
                      ) : (
                        <>
                          <span className='font-semibold text-emerald-600'>{stock}</span>
                          <span className='text-foreground'>
                            {stock === 1 ? ' disponível' : ' disponíveis'}
                          </span>
                        </>
                      )}
                    </>
                  ) : null}
                </p>
                {showLogistic ? (
                  <p className='flex items-center gap-1 text-xs'>
                    {isFlex ? (
                      <>
                        <Bike className='h-3.5 w-3.5 shrink-0 text-emerald-600' aria-hidden='true' />
                        <span className='italic font-semibold text-emerald-600'>Flex</span>
                      </>
                    ) : null}
                    {isFull ? (
                      <>
                        <Zap className='h-3.5 w-3.5 shrink-0 text-emerald-600' aria-hidden='true' />
                        <span className='font-bold text-emerald-600'>FULL</span>
                      </>
                    ) : null}
                    {(isFlex || isFull) && shippingMethod ? (
                      <span className='mx-0.5 text-muted-foreground' aria-hidden='true'>·</span>
                    ) : null}
                    {shippingMethod ? (
                      <span className='text-foreground'>{shippingMethod}</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ActionsColumn ({
  line,
}: {
  line: SalesOrderListLine
}) {
  const order = line.order
  const isFull = order.ml_logistic_type === 'fulfillment'
  const isCanceled = order.status === 'canceled'
  const postingDeadline = formatDeadline(order.ml_posting_deadline)
  const deliveryEstimate = formatDelivery(order.ml_delivery_estimate)
  const labelAvailableDay = formatLabelAvailableDay(order.ml_label_available_at)
  const labelPrintable = order.ml_label_printable === true
  const showLabelAvailable = Boolean(labelAvailableDay) && !labelPrintable && !isFull && !isCanceled
  const allowNfe = order.allow_nfe !== false
  const canDownloadNfe = allowNfe && order.nfe_status === 'authorized' && Boolean(order.nfe_document_id)
  const canViewNfe = allowNfe && Boolean(order.nfe_document_id)
  const canEmitNfe = !isFull && !isCanceled && allowNfe && order.status === 'paid' && !order.nfe_document_id
  const canSendNfe = !isFull && !isCanceled && allowNfe && order.status === 'paid'
  const canceledLabel = order.status_label || statusLabel('canceled')
  const claimStatus = String(order.ml_claim_status || '').trim().toLowerCase()
  const claimLabel = meliClaimStatusLabel(claimStatus)

  if (isCanceled) {
    return (
      <div className='space-y-3' onClick={stopRowClick}>
        <div
          className='flex w-full items-center justify-center gap-2 rounded-md border border-rose-500 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-300'
          role='status'
        >
          <span aria-hidden='true'>✕</span>
          <span>{canceledLabel}</span>
        </div>
        {claimLabel ? (
          <div
            className={
              claimStatus === 'closed'
                ? 'flex w-full items-center justify-center gap-2 rounded-md bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'flex w-full items-center justify-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
            }
            role='status'
          >
            {claimStatus === 'closed' ? (
              <span aria-hidden='true'>✓</span>
            ) : null}
            <span>{claimLabel}</span>
          </div>
        ) : null}
        <div className='flex justify-end'>{line.menu}</div>
      </div>
    )
  }

  return (
    <div className='space-y-3' onClick={stopRowClick}>
      {postingDeadline || deliveryEstimate ? (
        <div className='grid grid-cols-2 gap-3'>
          {postingDeadline ? (
            <p className='min-w-0 text-sm'>
              <span className='block text-xs text-muted-foreground'>Limite de postagem</span>
              <span className='font-medium'>{postingDeadline}</span>
            </p>
          ) : null}
          {deliveryEstimate ? (
            <p className='min-w-0 text-sm'>
              <span className='block text-xs text-muted-foreground'>Estimativa de entrega</span>
              <span className='font-medium'>{deliveryEstimate}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      {showLabelAvailable ? (
        <div className='flex w-full items-center justify-center rounded-md bg-muted px-2.5 py-1.5'>
          <p className='text-center text-sm font-medium text-muted-foreground'>
            Disponível dia {labelAvailableDay}
          </p>
        </div>
      ) : null}
      {order.ml_label_status && !showLabelAvailable ? (
        !isFull && line.onPrintLabel && labelPrintable ? (
          <div className='flex w-full items-stretch'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='h-auto min-w-0 flex-1 whitespace-normal rounded-r-none border-violet-300 px-2.5 py-1.5 text-left text-sm font-medium text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950'
              disabled={line.isBusy || line.isPrintingLabel}
              onClick={line.onPrintLabel}
            >
              {line.isPrintingLabel ? 'Carregando etiqueta…' : order.ml_label_status}
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='h-auto shrink-0 rounded-l-none border-l-0 border-violet-300 px-1.5 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950'
                  disabled={line.isBusy || line.isPrintingLabel || !line.onDownloadLabelZpl}
                  aria-label='Opções de download da etiqueta'
                >
                  <ChevronDown className='h-4 w-4' aria-hidden='true' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='min-w-56'>
                <DropdownMenuItem
                  disabled={!line.onDownloadLabelZpl}
                  onSelect={(event) => {
                    event.preventDefault()
                    line.onDownloadLabelZpl?.('custom')
                  }}
                >
                  Baixar ZPL customizado
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!line.onDownloadLabelZpl}
                  onSelect={(event) => {
                    event.preventDefault()
                    line.onDownloadLabelZpl?.('original')
                  }}
                >
                  Baixar ZPL do Mercado Livre
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!line.onDownloadLabelZpl}
                  onSelect={(event) => {
                    event.preventDefault()
                    line.onDownloadLabelZpl?.('pdf')
                  }}
                >
                  Baixar PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className='flex w-full items-center justify-center rounded-md bg-muted px-2.5 py-1.5'>
            <p className='text-center text-sm font-medium text-muted-foreground'>
              {order.ml_label_status}
            </p>
          </div>
        )
      ) : null}
      <div className='grid grid-cols-2 gap-2'>
        {isFull ? null : (
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={line.isBusy || !canSendNfe}
            onClick={line.onSendNfe}
          >
            Enviar NF-e
          </Button>
        )}
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={!canDownloadNfe}
          onClick={() => {
            if (!order.nfe_document_id) return
            window.open(nfeDanfeDownloadUrl(order.nfe_document_id), '_blank', 'noopener,noreferrer')
          }}
        >
          Baixar NF-e
        </Button>
        {isFull ? null : (
          <Button
            type='button'
            size='sm'
            className='bg-violet-600 text-white hover:bg-violet-600/90'
            disabled={line.isBusy || !canEmitNfe}
            onClick={line.onEmitNfe}
          >
            Gerar NF-e
          </Button>
        )}
        <Button
          type='button'
          size='sm'
          className='bg-emerald-600 text-white hover:bg-emerald-600/90'
          disabled={!canViewNfe}
          onClick={line.onViewNfe}
        >
          Ver NF-e
        </Button>
      </div>
      <div className='flex justify-end'>{line.menu}</div>
    </div>
  )
}

function CartHeader ({
  order,
}: {
  order: SalesOrderListRowData
}) {
  const buyerName = String(order.ml_buyer_name || order.customer_name || '').trim() || 'Consumidor'
  const nickname = String(order.ml_buyer_nickname || '').trim()
  const showNickname = Boolean(nickname) && nickname.toLowerCase() !== buyerName.toLowerCase()
  const mlOrderId = String(order.ml_order_id || '').trim()
  const mlPackId = String(order.ml_pack_id || '').trim()
  const mlTargetId = (mlPackId || mlOrderId).trim()
  const mlHref = mlTargetId
    ? `https://www.mercadolivre.com.br/vendas/${encodeURIComponent(mlTargetId)}/detalhe`
    : null
  const displayMlId = mlPackId || mlOrderId
  const title = order.title || `Pedido #${order.order_number}`

  return (
    <div className='min-w-0 space-y-1.5 text-sm'>
      <div className='flex flex-wrap items-center gap-2'>
        <p className='font-semibold'>{title}</p>
        {order.status === 'canceled' ? null : (
          <Badge
            variant={order.status === 'paid' ? 'secondary' : 'default'}
          >
            {order.status_label || statusLabel(order.status)}
          </Badge>
        )}
      </div>
      {mlHref && displayMlId ? (
        <p className='flex items-center gap-1'>
          <span className='font-bold text-[#ffe600]'>MELI</span>
          <span className='text-muted-foreground'>:</span>
          <a
            href={mlHref}
            target='_blank'
            rel='noopener noreferrer'
            className='font-mono text-foreground underline-offset-2 hover:underline'
            onClick={stopRowClick}
          >
            {displayMlId}
          </a>
          <CopyIconButton value={displayMlId} label='Copiar número da venda no MELI' />
        </p>
      ) : null}
      <p className='flex items-center gap-1'>
        <span className='truncate'>{buyerName}</span>
        <CopyIconButton value={buyerName} label='Copiar nome do comprador' />
      </p>
      {showNickname ? (
        <p className='flex items-center gap-1 text-muted-foreground'>
          <span className='truncate'>{nickname}</span>
          <CopyIconButton value={nickname} label='Copiar apelido do comprador' />
        </p>
      ) : null}
      <p className='text-xs text-muted-foreground'>
        Data da compra: {formatPurchaseDate(order.created_at)}
      </p>
    </div>
  )
}

export function SalesOrderListRow ({
  order,
  lines: linesProp,
  isBusy,
  isLast = false,
  onOpen,
  onEmitNfe,
  onViewNfe,
  onSendNfe,
  onEditCost,
  onPrintLabel,
  onDownloadLabelZpl,
  isPrintingLabel,
  menu,
}: {
  order?: SalesOrderListRowData
  lines?: SalesOrderListLine[]
  isBusy?: boolean
  /** Último item da lista: sem border-bottom (last:child falha com paginação no mesmo pai). */
  isLast?: boolean
  onOpen?: () => void
  onEmitNfe?: () => void
  onViewNfe?: () => void
  onSendNfe?: () => void
  onEditCost?: () => void
  onPrintLabel?: () => void
  onDownloadLabelZpl?: (kind: 'custom' | 'original' | 'pdf') => void
  isPrintingLabel?: boolean
  menu?: ReactNode
}) {
  const lines: SalesOrderListLine[] = linesProp?.length
    ? linesProp
    : order
      ? [{
        order,
        isBusy: Boolean(isBusy),
        onEmitNfe: onEmitNfe || (() => {}),
        onViewNfe: onViewNfe || (() => {}),
        onSendNfe: onSendNfe || (() => {}),
        onEditCost,
        onPrintLabel,
        onDownloadLabelZpl,
        isPrintingLabel,
        menu: menu ?? null,
      }]
      : []

  if (lines.length === 0) return null

  const isPackGroup = lines.length > 1
  const primaryLine = lines[0]
  const headerOrder = {
    ...primaryLine.order,
    // Um pedido nosso por carrinho: título e número do pedido principal.
    title: primaryLine.order.title || `Pedido #${primaryLine.order.order_number}`,
  }

  return (
    <article
      className={`px-4 py-4${isLast ? '' : ' border-b'}${onOpen ? ' cursor-pointer' : ''}`}
      onClick={onOpen}
    >
      <div className='grid gap-4 lg:grid-cols-[minmax(13rem,0.9fr)_minmax(27rem,2.15fr)_minmax(13rem,0.95fr)]'>
        <CartHeader order={headerOrder} />
        <div className='min-w-0 space-y-4'>
          {lines.map((line, index) => (
            <div
              key={line.order.id}
              className='grid gap-4 sm:grid-cols-[minmax(16rem,1.3fr)_minmax(11rem,0.85fr)]'
            >
              <ProductColumn
                order={line.order}
                showIndividualOrderId={isPackGroup}
                showLogisticLine={index === 0}
                onEditProduct={line.onEditProduct}
              />
              <MarginColumn order={line.order} onEditCost={line.onEditCost} />
            </div>
          ))}
        </div>
        <ActionsColumn line={primaryLine} />
      </div>
    </article>
  )
}
