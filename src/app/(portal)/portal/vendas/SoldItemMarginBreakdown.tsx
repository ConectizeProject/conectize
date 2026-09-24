'use client'

import type { ReactNode } from 'react'
import {
  Handshake,
  Package,
  Pencil,
  Scale,
  Truck,
  Wallet,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { maskedFromCents } from '@/lib/utils/money'
import { cn } from '@/lib/utils'

export type SoldItemMarginBreakdownData = {
  revenueCents: number
  shippingCents: number
  feeCents: number
  feeDetails: Array<{ label: string, amountCents: number }>
  /** Custo unitário efetivo (null se não definido). */
  effectiveUnitCostCents?: number | null
  costTotalCents: number
  grossProfitCents: number
  taxCents: number
  contributionMarginCents: number
  contributionMarginPercent: number | null
  canEditCost: boolean
}

type Props = {
  margin: SoldItemMarginBreakdownData
  quantity?: number
  onEditCost?: () => void
}

function formatBrl (cents: number) {
  return `R$ ${maskedFromCents(Math.abs(cents))}`
}

function formatSignedCents (cents: number) {
  const value = formatBrl(cents)
  if (cents < 0) return `−${value}`
  return value
}

function formatDeduction (cents: number) {
  return `−${formatBrl(cents)}`
}

function formatPercent (value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null
  return `${value.toFixed(2).replace('.', ',')}%`
}

function MarginRow ({
  icon,
  value,
  valueClassName,
  iconClassName,
  tooltip,
  subValue,
  className,
  onClick,
  clickLabel,
  hoverTrailing,
}: {
  icon: ReactNode
  value: string
  valueClassName?: string
  iconClassName?: string
  tooltip?: ReactNode
  subValue?: string | null
  className?: string
  onClick?: () => void
  clickLabel?: string
  /** Conteúdo à direita, visível só no hover (display: none → inline-flex). */
  hoverTrailing?: ReactNode
}) {
  const isClickable = Boolean(onClick)
  const main = (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 py-px">
      <span className={cn('inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center', iconClassName)}>
        {icon}
      </span>
      <div className="min-w-0 flex-1 text-right">
        <p className={cn('text-[13px] font-semibold tabular-nums leading-tight', valueClassName)}>
          {value}
        </p>
        {subValue ? (
          <p className={cn('text-[10px] tabular-nums leading-tight', valueClassName)}>
            ({subValue})
          </p>
        ) : null}
      </div>
      {hoverTrailing ? (
        <span
          aria-hidden
          className="ml-0.5 hidden h-4 w-4 shrink-0 items-center justify-center text-muted-foreground group-hover:inline-flex group-focus-within:inline-flex"
        >
          {hoverTrailing}
        </span>
      ) : null}
    </div>
  )

  const interactive = (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable || tooltip ? 0 : undefined}
      aria-label={isClickable ? (clickLabel || 'Editar') : undefined}
      className={cn(
        'group min-w-0 w-full rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isClickable ? 'cursor-pointer' : 'cursor-default',
      )}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClick?.()
            }
          }
          : undefined
      }
    >
      {main}
    </div>
  )

  return (
    <div className={cn('flex items-center', className)}>
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            {interactive}
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs space-y-1">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      ) : (
        interactive
      )}
    </div>
  )
}

export function SoldItemMarginBreakdown ({ margin, quantity = 1, onEditCost }: Props) {
  const contribPositive = margin.contributionMarginCents >= 0
  const contribNegative = margin.contributionMarginCents < 0
  const percentLabel = formatPercent(margin.contributionMarginPercent)
  const qty = Math.max(1, Math.trunc(Number(quantity) || 1))
  const unitCostCents =
    typeof margin.effectiveUnitCostCents === 'number' && margin.effectiveUnitCostCents > 0
      ? margin.effectiveUnitCostCents
      : qty > 0
        ? Math.round(margin.costTotalCents / qty)
        : margin.costTotalCents

  const costTooltip =
    qty > 1
      ? (
        <div className="space-y-1 text-xs">
          <p>
            <span className="font-semibold">Custo individual do produto:</span>
            {' '}
            {formatBrl(unitCostCents)}
          </p>
          <p>
            <span className="font-semibold">
              Custo dos produtos ({qty} {qty === 1 ? 'unidade' : 'unidades'}):
            </span>
            {' '}
            {formatBrl(margin.costTotalCents)}
          </p>
        </div>
      )
      : (
        <div className="space-y-1 text-xs">
          <p>
            <span className="font-semibold">Custo do produto:</span>
            {' '}
            {formatBrl(margin.costTotalCents)}
          </p>
        </div>
      )

  const percentOfRevenue = formatPercent(margin.contributionMarginPercent)
  const percentOfCost =
    margin.costTotalCents > 0
      ? formatPercent((margin.contributionMarginCents / margin.costTotalCents) * 100)
      : null

  const contributionTooltip = (
    <div className="space-y-1 text-xs">
      <p className="font-semibold">Margem de contribuição da venda</p>
      {percentOfRevenue ? (
        <p>
          <span className="font-semibold">{percentOfRevenue}</span>
          {' '}
          do valor da venda
        </p>
      ) : null}
      {percentOfCost ? (
        <p>
          <span className="font-semibold">{percentOfCost}</span>
          {' '}
          do valor do custo
        </p>
      ) : (
        <p className="text-muted-foreground">Sem custo cadastrado para comparar.</p>
      )}
    </div>
  )

  const feeTooltip =
    margin.feeDetails.length > 0
      ? (
        <div className="space-y-0.5 text-xs">
          {margin.feeDetails.map((d) => (
            <p key={`${d.label}-${d.amountCents}`}>
              {d.label}: {formatBrl(d.amountCents)}
            </p>
          ))}
        </div>
      )
      : (
        <p className="text-xs">Tarifas da venda: {formatBrl(margin.feeCents)}</p>
      )

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full min-w-[10.5rem] max-w-[13rem] space-y-0 text-sm leading-none">
        <MarginRow
          icon={<Handshake className="h-3.5 w-3.5" aria-hidden />}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          value={formatSignedCents(margin.revenueCents)}
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />

        {margin.shippingCents > 0 ? (
          <MarginRow
            icon={<Truck className="h-3.5 w-3.5" aria-hidden />}
            iconClassName="text-muted-foreground"
            value={formatDeduction(margin.shippingCents)}
            valueClassName="text-muted-foreground"
            tooltip={<p className="text-xs">Frete: {formatBrl(margin.shippingCents)}</p>}
          />
        ) : null}

        {margin.feeCents > 0 ? (
          <MarginRow
            icon={<Handshake className="h-3.5 w-3.5" aria-hidden />}
            iconClassName="text-muted-foreground"
            value={formatDeduction(margin.feeCents)}
            valueClassName="text-muted-foreground"
            tooltip={feeTooltip}
          />
        ) : null}

        <div className="border-t border-border/70 pt-0.5 mt-0.5">
          <MarginRow
            icon={<Wallet className="h-3.5 w-3.5" aria-hidden />}
            iconClassName="text-teal-700 dark:text-teal-400"
            value={formatSignedCents(margin.grossProfitCents)}
            valueClassName="text-teal-700 dark:text-teal-400"
            tooltip={<p className="text-xs">Lucro bruto (após frete e tarifas)</p>}
          />
        </div>

        <div className="border-t border-border/70 pt-0.5 mt-0.5 space-y-0">
          <MarginRow
            icon={<Package className="h-3.5 w-3.5" aria-hidden />}
            iconClassName="text-muted-foreground"
            value={formatDeduction(margin.costTotalCents)}
            valueClassName="text-muted-foreground"
            tooltip={costTooltip}
            onClick={
              margin.canEditCost && onEditCost
                ? onEditCost
                : undefined
            }
            clickLabel="Editar custo do produto"
            hoverTrailing={
              margin.canEditCost && onEditCost
                ? <Pencil className="h-3 w-3" />
                : null
            }
          />

          {margin.taxCents > 0 ? (
            <MarginRow
              icon={<Scale className="h-3.5 w-3.5" aria-hidden />}
              iconClassName="text-muted-foreground"
              value={formatDeduction(margin.taxCents)}
              valueClassName="text-muted-foreground"
              tooltip={<p className="text-xs">Imposto estimado (alíquota média da empresa)</p>}
            />
          ) : null}
        </div>

        <div className="border-t border-border/70 pt-0.5 mt-0.5">
          <MarginRow
            icon={<Wallet className="h-3.5 w-3.5" aria-hidden />}
            iconClassName={cn(
              contribPositive && 'text-emerald-600 dark:text-emerald-400',
              contribNegative && 'text-red-600 dark:text-red-400',
            )}
            value={formatSignedCents(margin.contributionMarginCents)}
            valueClassName={cn(
              contribPositive && 'text-emerald-600 dark:text-emerald-400',
              contribNegative && 'text-red-600 dark:text-red-400',
            )}
            subValue={percentLabel}
            tooltip={contributionTooltip}
          />
        </div>
      </div>
    </TooltipProvider>
  )
}
