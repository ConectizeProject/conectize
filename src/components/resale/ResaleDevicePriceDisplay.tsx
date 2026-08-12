import {
  ceilCentsToWholeReais,
  maskedWholeReaisFromCents,
} from '@/lib/utils/money'
import type { InstallmentRow } from '@/lib/resale/credit-installment-max-fee'

type Props = {
  saleCents: number | null
  row12: InstallmentRow | null
  emptyHint?: string
  className?: string
}

export function ResaleDevicePriceDisplay ({
  saleCents,
  row12,
  emptyHint = 'Cadastre valores de venda',
  className,
}: Props) {
  const showPrazo = Boolean(
    row12
    && saleCents != null
    && saleCents > 0
    && row12.feePercent > 0
    && row12.totalChargeCents > saleCents,
  )
  const prazoTotalCents = showPrazo && row12
    ? ceilCentsToWholeReais(row12.totalChargeCents)
    : null
  const prazoParcelaCents = prazoTotalCents != null
    ? ceilCentsToWholeReais(prazoTotalCents / 12)
    : null
  const avistaCents = saleCents != null && saleCents > 0
    ? ceilCentsToWholeReais(saleCents)
    : null

  return (
    <div className={className ?? 'space-y-2'}>
      {showPrazo && prazoTotalCents != null && prazoParcelaCents != null && avistaCents != null ? (
        <>
          <p className='text-2xl font-bold tabular-nums tracking-tight sm:text-[1.75rem]'>
            R$ {maskedWholeReaisFromCents(prazoTotalCents)}
          </p>
          <p className='text-sm text-muted-foreground'>
            em 12x de{' '}
            <span className='font-semibold tabular-nums text-foreground'>
              R$ {maskedWholeReaisFromCents(prazoParcelaCents)}
            </span>
            {' '}sem juros
          </p>
          <div className='space-y-1 border-t border-border/60 pt-2'>
            <p className='text-[11px] font-medium text-muted-foreground'>
              Melhor opção · à vista com desconto
            </p>
            <p className='text-base font-semibold tabular-nums tracking-tight text-foreground sm:text-lg'>
              R$ {maskedWholeReaisFromCents(avistaCents)}
            </p>
          </div>
        </>
      ) : (
        <>
          <p className='text-2xl font-bold tabular-nums tracking-tight sm:text-[1.75rem]'>
            {avistaCents != null
              ? `R$ ${maskedWholeReaisFromCents(avistaCents)}`
              : 'Sob consulta'}
          </p>
          {avistaCents == null ? (
            <p className='text-sm text-muted-foreground'>{emptyHint}</p>
          ) : null}
        </>
      )}
    </div>
  )
}
