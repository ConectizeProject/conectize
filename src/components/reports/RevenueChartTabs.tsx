'use client'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { maskedFromCents } from '@/lib/utils/money'

export type RevenueChartPoint = {
  key: string
  label: string
  grossCents: number
  netCents: number
  count: number
}

type Props = {
  title?: string
  daily: RevenueChartPoint[]
  weekly: RevenueChartPoint[]
  monthly: RevenueChartPoint[]
}

export function RevenueChartTabs (props: Props) {
  const [tab, setTab] = useState<'day' | 'week' | 'month'>('day')

  const data = getSeriesForTab(props, tab)

  const chartData = data.map((item) => ({
    key: item.key,
    label: item.label,
    gross: (item.grossCents || 0) / 100,
    net: (item.netCents || 0) / 100,
  }))

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
            color: 'hsl(var(--chart-1))',
          },
          net: {
            label: 'Faturamento líquido',
            color: 'hsl(var(--chart-2))',
          },
        }}
        className="w-full rounded-lg border bg-card p-4"
      >
        <BarChart data={chartData}>
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
                  return (
                    <span>
                      {name === 'gross' ? 'Bruto: ' : 'Líquido: '}
                      R$ {maskedFromCents(cents)}
                    </span>
                  )
                }}
              />
            }
          />
          <Bar
            dataKey="gross"
            fill="var(--color-gross)"
            radius={4}
          />
          <Bar
            dataKey="net"
            fill="var(--color-net)"
            radius={4}
          />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

function getSeriesForTab (props: Props, tab: 'day' | 'week' | 'month') {
  if (tab === 'week') return props.weekly
  if (tab === 'month') return props.monthly
  return props.daily
}

