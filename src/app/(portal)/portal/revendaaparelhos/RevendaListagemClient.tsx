'use client'

import { Card, CardContent } from '@/components/ui/card'
import { getInstallmentRowForCount } from '@/lib/resale/credit-installment-max-fee'
import { revendaPath } from '@/lib/revenda/revenda-paths'
import { getSeminovosColorEmoji } from '@/lib/seminovos/colors'
import type { ResaleDeviceRow } from '@/lib/seminovos/fetch-seminovos-data'
import { groupDevicesByModel } from '@/lib/seminovos/group-devices-by-model'
import { cn } from '@/lib/utils'
import { maskedFromCents } from '@/lib/utils/money'
import { Smartphone } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { SeminovosFilterCollapsible } from '../seminovos/SeminovosFilterCollapsible'

type PaymentMethod = {
  id: string
  description: string
  type: string
  fee_percent: number
  credit_installment_fees: { installments: number; fee_percent: number }[]
  sort_order: number
}

type FilterInitial = {
  q: string
  condition: string
  storageGb: string
  color: string
  purchaseDateFrom: string
  purchaseDateTo: string
  stockType: 'all'
  deviceName?: string
  valueMin?: string
  valueMax?: string
}

type Props = {
  devices: Array<ResaleDeviceRow & { display_image_url: string | null }>
  paymentMethods: PaymentMethod[]
  isRetailer: boolean
  filterInitialValues: FilterInitial
  distinctDeviceNames: string[]
}

const noop = () => {}

function formatStorageLabel (raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const t = raw.trim()
  return /gb/i.test(t) ? t : `${t} GB`
}

export function RevendaListagemClient ({
  devices,
  paymentMethods,
  isRetailer,
  filterInitialValues,
  distinctDeviceNames,
}: Props) {
  const [priceMode, setPriceMode] = useState<'varejo' | 'atacado'>('varejo')

  const orderedDevices = useMemo(
    () => groupDevicesByModel(devices).flatMap((g) => g.devices),
    [devices],
  )

  const priceToggle = (
    <div
      role="group"
      aria-label="Modo de preço"
      className="inline-flex h-10 shrink-0 items-center gap-0.5 rounded-md border border-border bg-muted/50 p-0.5"
    >
      <button
        type="button"
        className={cn(
          'h-9 min-w-[4.5rem] rounded px-3 text-sm font-semibold transition-colors',
          priceMode === 'varejo'
            ? 'bg-primary text-primary-foreground shadow'
            : 'text-muted-foreground hover:bg-muted',
        )}
        onClick={() => setPriceMode('varejo')}
      >
        Varejo
      </button>
      <button
        type="button"
        className={cn(
          'h-9 min-w-[4.5rem] rounded px-3 text-sm font-semibold transition-colors',
          priceMode === 'atacado'
            ? 'bg-primary text-primary-foreground shadow'
            : 'text-muted-foreground hover:bg-muted',
        )}
        onClick={() => setPriceMode('atacado')}
      >
        Atacado
      </button>
    </div>
  )

  return (
    <div className="space-y-4 pb-8">
      <SeminovosFilterCollapsible
        key={[
          filterInitialValues.q,
          filterInitialValues.condition,
          filterInitialValues.storageGb,
          filterInitialValues.color,
          filterInitialValues.purchaseDateFrom,
          filterInitialValues.purchaseDateTo,
          filterInitialValues.deviceName || '',
          filterInitialValues.stockType,
          filterInitialValues.valueMin || '',
          filterInitialValues.valueMax || '',
        ].join('|')}
        initialValues={filterInitialValues}
        filterFormAction={revendaPath.listagem}
        distinctDeviceNames={distinctDeviceNames}
        catalogMode
        trailingSlot={priceToggle}
        quickFilters={{
          notTested: false,
          notAdvertised: false,
          noLabel: false,
          withInfo: false,
          onToggleNotTested: noop,
          onToggleNotAdvertised: noop,
          onToggleNoLabel: noop,
          onToggleWithInfo: noop,
        }}
      />

      {orderedDevices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum aparelho disponível.
          {!isRetailer ? (
            <>
              {' '}
              <Link href={revendaPath.seminovos} className="text-primary underline">
                Ver seminovos
              </Link>
            </>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {orderedDevices.map((d) => {
            const title =
              (d.device_name || d.model || 'Aparelho').trim() || 'Aparelho'
            const storageLabel = formatStorageLabel(d.storage_gb)
            const displayUrl = d.display_image_url
            const imgOk = Boolean(displayUrl)
            const isNovo = d.stock_type === 'lacrado'
            const saleCents =
              priceMode === 'varejo'
                ? (d.sale_value_cents ?? null)
                : (d.wholesale_value_cents ?? null)
            const row12 =
              saleCents != null && saleCents > 0
                ? getInstallmentRowForCount(saleCents, paymentMethods, 12)
                : null

            const propertySegments: string[] = []
            if (storageLabel) propertySegments.push(storageLabel)
            if (d.color) {
              propertySegments.push(
                `${getSeminovosColorEmoji(d.color)} ${d.color}`.trim(),
              )
            }
            if (!isNovo) {
              if (d.battery) propertySegments.push(d.battery)
              if (d.condition) propertySegments.push(d.condition)
            }

            const priceHint = 'Cadastre valores de venda'

            return (
              <Link
                key={d.id}
                href={revendaPath.vitrine(d.id)}
                className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Card className="h-full overflow-hidden border transition-shadow duration-200 hover:shadow-md hover:border-primary/30">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {isNovo ? (
                      <span className="absolute left-2 top-2 z-[2] rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                        Novo
                      </span>
                    ) : null}
                    {imgOk ? (
                      <img
                        src={displayUrl!}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Smartphone
                          className="h-14 w-14 opacity-35"
                          aria-hidden
                        />
                      </div>
                    )}
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[38%] backdrop-blur-[11px] sm:h-[34%]"
                      style={{
                        maskImage:
                          'linear-gradient(to top, black 0%, black 35%, transparent 100%)',
                        WebkitMaskImage:
                          'linear-gradient(to top, black 0%, black 35%, transparent 100%)',
                      }}
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[52%] sm:h-[48%]"
                      style={{
                        background:
                          'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.72) 12%, rgba(0,0,0,0.42) 32%, rgba(0,0,0,0.18) 58%, rgba(0,0,0,0.05) 82%, transparent 100%)',
                      }}
                      aria-hidden
                    />
                    <div className="absolute inset-x-0 bottom-0 z-[1] p-3 pt-10 sm:p-3.5 sm:pt-12">
                      <h2 className="text-lg font-bold leading-snug text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] line-clamp-3 sm:text-xl">
                        {title}
                      </h2>
                    </div>
                  </div>
                  <CardContent className="flex flex-col gap-3 p-4 pt-3">
                    {propertySegments.length > 0 ? (
                      <p className="text-xs leading-snug text-muted-foreground">
                        {propertySegments.join(' · ')}
                      </p>
                    ) : null}
                    <div className="space-y-2 border-t border-border/80 pt-3">
                      <p className="text-2xl font-bold tabular-nums tracking-tight sm:text-[1.75rem]">
                        {saleCents != null && saleCents > 0
                          ? `R$ ${maskedFromCents(saleCents)}`
                          : 'Sob consulta'}
                      </p>
                      {row12 ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          ou 12x de{' '}
                          <span className="font-semibold tabular-nums text-foreground">
                            R$ {maskedFromCents(row12.installmentValueCents)}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">{priceHint}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
