'use client'

import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Line,
	XAxis,
	YAxis,
} from 'recharts'
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from '@/components/ui/chart'
import { useDashboardMoneyVisibility } from '@/components/dashboard/dashboard-money-visibility'
import { resumoOuterCardClassName } from '@/components/dashboard/resumo-card-styles'
import type { DashboardDaySeriesPoint } from '@/lib/dashboard/last-7-days'
import { cn } from '@/lib/utils'

type Props = {
	sales: DashboardDaySeriesPoint[]
	os: DashboardDaySeriesPoint[]
}

function toChartRows (points: DashboardDaySeriesPoint[]) {
	return points.map((p) => ({
		label: p.label,
		dateStr: p.dateStr,
		gross: (p.grossCents || 0) / 100,
		net: (p.netCents || 0) / 100,
		grossCents: p.grossCents,
		netCents: p.netCents,
	}))
}

function WeekChannelChart ({
	title,
	points,
	barColor,
	lineColor,
}: {
	title: string
	points: DashboardDaySeriesPoint[]
	barColor: string
	lineColor: string
}) {
	const { formatMoney, hideMoney } = useDashboardMoneyVisibility()
	const data = toChartRows(points)

	return (
		<div className={cn(resumoOuterCardClassName, 'p-4 sm:p-5')}>
			<div className="mb-3">
				<h3 className="text-sm font-semibold tracking-tight text-foreground">
					{title}
				</h3>
				<p className="text-xs text-muted-foreground">
					Últimos 7 dias · barras = faturamento · linha = margem líquida
				</p>
			</div>
			<ChartContainer
				config={{
					gross: {
						label: 'Faturamento',
						color: barColor,
					},
					net: {
						label: 'Margem líquida',
						color: lineColor,
					},
				}}
				className="aspect-auto h-[220px] w-full"
			>
				<ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
					<CartesianGrid vertical={false} strokeDasharray="4 4" />
					<XAxis
						dataKey="label"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						interval={0}
						tick={{ fontSize: 11 }}
					/>
					<YAxis
						tickLine={false}
						axisLine={false}
						tickMargin={4}
						width={44}
						tickFormatter={(value) => {
							if (hideMoney) return '••'
							const n = Number(value) || 0
							if (n >= 1000) return `${Math.round(n / 1000)}k`
							return String(Math.round(n))
						}}
					/>
					<ChartTooltip
						cursor={{ fill: 'hsl(var(--muted))', opacity: 0.35 }}
						content={
							<ChartTooltipContent
								formatter={(value, name) => {
									const cents = typeof value === 'number'
										? Math.round(value * 100)
										: 0
									const label = name === 'net' ? 'Margem líquida' : 'Faturamento'
									return (
										<span>
											{label}: {formatMoney(cents)}
										</span>
									)
								}}
							/>
						}
					/>
					<ChartLegend content={<ChartLegendContent />} />
					<Bar
						dataKey="gross"
						fill="var(--color-gross)"
						radius={[4, 4, 0, 0]}
						maxBarSize={36}
					/>
					<Line
						type="monotone"
						dataKey="net"
						stroke="var(--color-net)"
						strokeWidth={2.25}
						dot={{ r: 3.5, fill: 'var(--color-net)', strokeWidth: 0 }}
						activeDot={{ r: 5 }}
					/>
				</ComposedChart>
			</ChartContainer>
		</div>
	)
}

export function DashboardWeekCharts ({ sales, os }: Props) {
	return (
		<section className="grid w-full gap-4 md:grid-cols-2" aria-label="Faturamento dos últimos 7 dias">
			<WeekChannelChart
				title="Vendas — 7 dias"
				points={sales}
				barColor="hsl(152, 60%, 42%)"
				lineColor="hsl(152, 70%, 28%)"
			/>
			<WeekChannelChart
				title="OS — 7 dias"
				points={os}
				barColor="hsl(199, 70%, 48%)"
				lineColor="hsl(199, 80%, 32%)"
			/>
		</section>
	)
}
