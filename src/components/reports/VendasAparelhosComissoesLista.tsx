'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { maskedFromCents } from '@/lib/utils/money'

export type ComissaoDeviceLine = {
  deviceId: string
  label: string
  saleDate: string | null
  commissionCents: number
}

export type ComissaoVendedorRow = {
  groupKey: string
  displayName: string
  cents: number
  devices: ComissaoDeviceLine[]
}

type Props = {
  rows: ComissaoVendedorRow[]
  totalCents: number
}

function formatSaleDateBr (ymd: string | null): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '—'
  const [y, mo, d] = ymd.split('-')
  return `${d}/${mo}/${y}`
}

export function VendasAparelhosComissoesLista ({ rows, totalCents }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<ComissaoVendedorRow | null>(null)

  return (
    <>
      <ul className="divide-y rounded-md border">
        {rows.map((row) => (
          <li key={row.groupKey}>
            <button
              type="button"
              onClick={() => {
                setActive(row)
                setOpen(true)
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
            >
              <span className="min-w-0 truncate font-medium underline-offset-2 hover:underline">
                {row.displayName}
              </span>
              <span className="shrink-0 font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                R$ {maskedFromCents(row.cents)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setActive(null)
        }}
      >
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md" side="right">
          <SheetHeader>
            <SheetTitle>Comissão — {active?.displayName ?? ''}</SheetTitle>
            <SheetDescription>
              Aparelhos vendidos no período que compõem este total.
            </SheetDescription>
          </SheetHeader>
          <ul className="mt-4 flex-1 space-y-0 divide-y overflow-y-auto rounded-md border">
            {(active?.devices ?? []).map((d) => (
              <li
                key={d.deviceId}
                className="flex flex-col gap-1.5 px-3 py-3 text-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={`/portal/seminovos/${d.deviceId}`}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {d.label}
                  </Link>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-0.5 text-xs text-muted-foreground sm:items-end sm:text-sm">
                  <span className="font-mono tabular-nums text-foreground">
                    R$ {maskedFromCents(d.commissionCents)}
                  </span>
                  <span>Venda {formatSaleDateBr(d.saleDate)}</span>
                </div>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        <span className="font-medium text-muted-foreground">Total pago em comissões</span>
        <span className="font-mono text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
          R$ {maskedFromCents(totalCents)}
        </span>
      </div>
    </>
  )
}
