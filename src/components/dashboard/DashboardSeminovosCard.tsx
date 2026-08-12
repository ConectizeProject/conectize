'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getSeminovosColorStyle } from '@/lib/seminovos/colors'
import { maskedFromCents } from '@/lib/utils/money'

export type ColorInfo = {
  count: number
  minCents: number
  maxCents: number
  hasValue: boolean
}

export type SeminovosGroup = {
  label: string
  total: number
  byColor: Record<string, ColorInfo>
  minCents: number
  maxCents: number
  hasAnyValue: boolean
}

type Props = {
  totalAvailable: number
  groups: SeminovosGroup[]
}

export function DashboardSeminovosCard({ totalAvailable, groups }: Props) {
  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Aparelhos seminovos</CardTitle>
          <CardDescription>Disponíveis em estoque</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-muted/50 px-3 py-2.5 text-center">
            <div className="text-2xl font-bold tabular-nums">{totalAvailable}</div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">Aparelhos disponíveis</p>
          </div>
          {groups.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {groups.map((g) => {
                const colorEntries = Object.entries(g.byColor).filter(([, info]) => info.count > 0)
                const tooltipLines = colorEntries.map(([cor, info]) => {
                  const range = info.hasValue
                    ? info.minCents === info.maxCents
                      ? `R$ ${maskedFromCents(info.minCents)}`
                      : `R$ ${maskedFromCents(info.minCents)} ~ R$ ${maskedFromCents(info.maxCents)}`
                    : null
                  return range ? `${cor}: ${info.count}un (${range})` : `${cor}: ${info.count}un`
                })
                const hasTooltip = tooltipLines.length > 0
                return (
                  <li key={g.label} className="flex items-center gap-2 min-w-0">
                    <span className="min-w-0 truncate font-bold">{g.label}</span>
                    <span className="text-muted-foreground shrink-0">•</span>
                    <span className="tabular-nums text-muted-foreground shrink-0">{g.total}un</span>
                    <span className="text-muted-foreground shrink-0">•</span>
                    {g.hasAnyValue && (
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {g.minCents === g.maxCents
                          ? `R$ ${maskedFromCents(g.minCents)}`
                          : `R$ ${maskedFromCents(g.minCents)} ~ R$ ${maskedFromCents(g.maxCents)}`}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 inline-flex items-center gap-1">
                      {hasTooltip ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1">
                              {colorEntries.slice(0, 5).map(([cor]) => {
                                const style = getSeminovosColorStyle(cor)
                                return (
                                  <span
                                    key={cor}
                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: style.bg }}
                                    aria-hidden
                                  />
                                )
                              })}
                              {colorEntries.length > 5 && (
                                <span className="text-[10px] text-muted-foreground">+{colorEntries.length - 5}</span>
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-[260px]">
                            <p className="font-medium mb-1">Por cor</p>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              {tooltipLines.join(' • ')}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-muted" aria-hidden />
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum aparelho disponível</p>
          )}
          <div className="flex flex-row gap-2 pt-1 justify-start items-center">
            <Link
              href="/portal/revendaaparelhos"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver aparelhos →
            </Link>
            <Link
              href="/portal/revendaaparelhos/nova"
              className="text-xs font-medium text-primary hover:underline"
            >
              Cadastrar seminovo →
            </Link>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
