'use client'

import { useMemo } from 'react'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatCentsBr } from '@/lib/utils/format-money'
import { isSaleDerivedCostDescription } from '@/lib/resale/resale-sale-costs'

type CostRow = { description: string | null; value_cents?: number }

type SellPaymentPricingHintProps = {
  purchaseValueCents: number | null | undefined
  wholesaleValueCents: number | null | undefined
  saleValueCents: number | null | undefined
  costs?: CostRow[]
  canViewPurchaseValue?: boolean
}

function formatOptionalCents (cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—'
  return formatCentsBr(cents)
}

export function SellPaymentPricingHint ({
  purchaseValueCents,
  wholesaleValueCents,
  saleValueCents,
  costs = [],
  canViewPurchaseValue = true,
}: SellPaymentPricingHintProps) {
  const totalCustoCents = useMemo(() => {
    if (!canViewPurchaseValue) return null
    const purchase = purchaseValueCents ?? 0
    const operational = (costs || []).reduce((acc, c) => {
      if (isSaleDerivedCostDescription(c.description)) return acc
      return acc + (c.value_cents ?? 0)
    }, 0)
    return purchase + operational
  }, [canViewPurchaseValue, purchaseValueCents, costs])

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Ver custo, atacado e varejo"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[130] w-56 p-3 text-sm"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-xs font-medium text-muted-foreground mb-2">Referência de preços</p>
        <dl className="space-y-1.5">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Custo</dt>
            <dd className="font-medium tabular-nums text-right">
              {formatOptionalCents(totalCustoCents)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Atacado</dt>
            <dd className="font-medium tabular-nums text-right">
              {formatOptionalCents(wholesaleValueCents ?? null)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Varejo</dt>
            <dd className="font-medium tabular-nums text-right">
              {formatOptionalCents(saleValueCents ?? null)}
            </dd>
          </div>
        </dl>
      </PopoverContent>
    </Popover>
  )
}
