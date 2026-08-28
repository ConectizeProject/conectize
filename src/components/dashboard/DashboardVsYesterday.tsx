'use client'

import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
	vsYesterdayDelta,
	vsYesterdayLabel,
} from '@/lib/dashboard/vs-yesterday'

export function DashboardVsYesterday ({
	todayCents,
	yesterdayCents,
	className,
}: {
	todayCents: number
	yesterdayCents: number
	className?: string
}) {
	const delta = vsYesterdayDelta(todayCents, yesterdayCents)
	const Icon =
		delta.direction === 'up'
			? TrendingUp
			: delta.direction === 'down'
				? TrendingDown
				: Minus

	return (
		<span
			className={cn(
				'inline-flex items-baseline gap-0.5 text-sm font-medium tabular-nums',
				delta.direction === 'up' && 'text-emerald-400',
				delta.direction === 'down' && 'text-red-400',
				delta.direction === 'flat' && 'text-slate-400',
				className,
			)}
			title="Comparado com ontem"
		>
			<Icon className="relative top-px h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
			{vsYesterdayLabel(delta)}
		</span>
	)
}
