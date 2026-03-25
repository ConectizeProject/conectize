'use client'

import React, { useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { maskedFromCents } from '@/lib/utils/money'

export type RevenueChartPoint = {
  key: string
  label: string
  grossCents: number
  netCents: number
  count: number
}

export type RevenueChartTabsProps = {
  title?: string
  daily: RevenueChartPoint[]
  weekly: RevenueChartPoint[]
  monthly: RevenueChartPoint[]
  dailyPrevious?: RevenueChartPoint[]
  weeklyPrevious?: RevenueChartPoint[]
  monthlyPrevious?: RevenueChartPoint[]
}

export const RevenueChartTabs: React.FC<RevenueChartTabsProps> = (props) => {
  const [tab, setTab] = useState<'day' | 'week' | 'month'>('day')

  const data = getSeriesForTab(props, tab)
  const dataPrev = getSeriesForTabPrevious(props, tab)

  const chartData = data.map((item, i) => {
    const prev = dataPrev[i]
    return {
      key: item.key,
      label: item.label,
      gross: (item.grossCents || 0) / 100,
      net: (item.netCents || 0) / 100,
      grossPrevious: prev ? (prev.grossCents || 0) / 100 : 0,
      netPrevious: prev ? (prev.netCents || 0) / 100 : 0,
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            {props.title || 'Faturamento'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Visualize o faturamento por dia, semana ou mês.
          </p>
          {dataPrev.length > 0 && (
            <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 border-t-2 border-dashed border-[hsl(210,85%,72%)]" />
                Período anterior
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 h-0.5 border-t-2 border-[hsl(142,65%,30%)]" />
                Período atual
              </span>
            </div>
          )}
        </div>

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as 'day' | 'week' | 'month')}
        >
          <TabsList>
            <TabsTrigger value="day">Dia</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ChartContainer
        config={{
          gross: {
            label: 'Faturamento bruto',
            color: 'hsl(142, 65%, 55%)',
          },
          net: {
            label: 'Faturamento líquido',
            color: 'hsl(142, 65%, 30%)',
          },
          grossPrevious: {
            label: 'Bruto (período anterior)',
            color: 'hsl(210, 90%, 82%)',
          },
          netPrevious: {
            label: 'Líquido (período anterior)',
            color: 'hsl(210, 85%, 72%)',
          },
        }}
        className="w-full aspect-auto h-[280px] rounded-lg border bg-card p-4"
      >
        <AreaChart data={chartData}>
          <CartesianGrid vertical={false} strokeDasharray="4 4" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <ChartTooltip
            cursor={{ fill: 'hsl(var(--muted))' }}
            content={
              <ChartTooltipContent
                formatter={(value, name) => {
                  if (typeof value !== 'number') return `${name}: ${value}`
                  const cents = Math.round(value * 100)
                  const labels: Record<string, string> = {
                    gross: 'Bruto: ',
                    net: 'Líquido: ',
                    grossPrevious: 'Bruto (ant.): ',
                    netPrevious: 'Líquido (ant.): ',
                  }
                  return (
                    <span>
                      {labels[name] ?? name}
                      R$ {maskedFromCents(cents)}
                    </span>
                  )
                }}
              />
            }
          />
          {/* Atrás: 2 linhas do período anterior (azul claro, range preenchido) */}
          {dataPrev.length > 0 && (
            <>
              <Area
                type="monotone"
                dataKey="grossPrevious"
                stroke="var(--color-grossPrevious)"
                fill="var(--color-grossPrevious)"
                fillOpacity={0.4}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="netPrevious"
                stroke="var(--color-netPrevious)"
                fill="var(--color-netPrevious)"
                fillOpacity={0.4}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
              />
            </>
          )}
          {/* Na frente: 2 linhas do período atual (verde, com pontos) */}
          <Area
            type="monotone"
            dataKey="gross"
            stroke="var(--color-gross)"
            fill="var(--color-gross)"
            fillOpacity={0.25}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={{ fill: 'var(--color-gross)', r: 4 }}
            activeDot={{ r: 5 }}
          />
          <Area
            type="monotone"
            dataKey="net"
            stroke="var(--color-net)"
            fill="var(--color-net)"
            fillOpacity={0.25}
            strokeWidth={2}
            dot={{ fill: 'var(--color-net)', r: 4 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

function getSeriesForTab (props: RevenueChartTabsProps, tab: 'day' | 'week' | 'month') {
  if (tab === 'week') return props.weekly
  if (tab === 'month') return props.monthly
  return props.daily
}

function getSeriesForTabPrevious (props: RevenueChartTabsProps, tab: 'day' | 'week' | 'month'): RevenueChartPoint[] {
  const prev = tab === 'week' ? props.weeklyPrevious : tab === 'month' ? props.monthlyPrevious : props.dailyPrevious
  return prev ?? []
}

