'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'
import { DashboardMoneyText } from '@/components/dashboard/dashboard-money-visibility'
import { DashboardVsYesterday } from '@/components/dashboard/DashboardVsYesterday'
import {
	dashboardFaturamentoOsHref,
	dashboardVendasHojeHref,
} from '@/lib/dashboard/dashboard-links'

type Props = {
	dateStr: string
	isAdmin: boolean
	salesCents: number
	osCents: number
	salesNetCents: number
	osNetCents: number
	salesGoalCents: number
	osGoalCents: number
	yesterdaySalesCents: number
	yesterdayOsCents: number
	yesterdaySalesNetCents: number
	yesterdayOsNetCents: number
}

function FaturamentoChannelCard ({
	title,
	href,
	valueCents,
	netCents,
	goalCents,
	yesterdayCents,
	yesterdayNetCents,
	accentClass,
	barClass,
}: {
	title: string
	href: string
	valueCents: number
	netCents: number
	goalCents: number
	yesterdayCents: number
	yesterdayNetCents: number
	accentClass: string
	barClass: string
}) {
	const progress = goalCents > 0
		? Math.min(100, Math.round((valueCents / goalCents) * 100))
		: 0
	const goalReached = goalCents > 0 && valueCents >= goalCents

	return (
		<div className="relative cursor-pointer overflow-hidden rounded-xl bg-slate-900 px-5 py-5 text-slate-50 shadow-sm transition-colors hover:bg-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 sm:px-6 sm:py-6">
			<Link
				href={href}
				transitionTypes={['nav-forward']}
				className="absolute inset-0 z-0"
				aria-label={title}
			/>
			<div className="pointer-events-none absolute -right-4 -top-6 z-0 text-[7rem] font-bold leading-none text-white/[0.04]" aria-hidden>
				$
			</div>

			<div className="pointer-events-none relative z-10 flex flex-wrap items-start justify-between gap-4">
				<div>
					<p className="text-[11px] font-medium tracking-wider text-slate-400">
						{title}
					</p>
					<p className={cn('mt-1 flex flex-wrap items-baseline gap-2', accentClass)}>
						<span className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
							<DashboardMoneyText cents={valueCents} />
						</span>
						<DashboardVsYesterday
							todayCents={valueCents}
							yesterdayCents={yesterdayCents}
						/>
					</p>
				</div>
				<div className="text-right">
					<p className="text-[11px] font-medium tracking-wider text-slate-400">
						Meta Diária
					</p>
					<p className="mt-1 text-base font-semibold tabular-nums text-slate-200 sm:text-lg">
						{goalCents > 0 ? <DashboardMoneyText cents={goalCents} /> : '—'}
					</p>
				</div>
			</div>

			<div className="pointer-events-none relative z-10 mt-5">
				{goalCents > 0 ? (
					<>
						<div className="h-2 overflow-hidden rounded-full bg-slate-700/90">
							<div
								className={cn('h-full rounded-full transition-[width] duration-500', barClass)}
								style={{ width: `${Math.max(progress, valueCents > 0 ? 2 : 0)}%` }}
							/>
						</div>
						<div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
							<span className="tabular-nums">{progress}% Da Meta</span>
							{goalReached ? (
								<span className="inline-flex items-center gap-1 font-medium text-emerald-300">
									<TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} />
									Meta Batida! Parabéns
								</span>
							) : null}
						</div>
					</>
				) : (
					<p className="text-xs text-slate-400">
						Meta Não Definida.{' '}
						<Link
							href="/portal/admin/dados-empresa"
							className="pointer-events-auto relative z-10 text-sky-300 hover:underline"
							onClick={(e) => e.stopPropagation()}
						>
							Configurar
						</Link>
					</p>
				)}
			</div>

			<div className="pointer-events-none relative z-10 mt-5 border-t border-slate-700/80 pt-4">
				<p className="text-[11px] font-medium tracking-wider text-slate-400">
					Valor Líquido
				</p>
				<p className="mt-1 flex flex-wrap items-baseline gap-2 text-emerald-400">
					<span className="text-xl font-semibold tabular-nums sm:text-2xl">
						<DashboardMoneyText cents={netCents} />
					</span>
					<DashboardVsYesterday
						todayCents={netCents}
						yesterdayCents={yesterdayNetCents}
					/>
				</p>
			</div>
		</div>
	)
}

export function DashboardFaturamentoCard ({
	dateStr,
	isAdmin,
	salesCents,
	osCents,
	salesNetCents,
	osNetCents,
	salesGoalCents,
	osGoalCents,
	yesterdaySalesCents,
	yesterdayOsCents,
	yesterdaySalesNetCents,
	yesterdayOsNetCents,
}: Props) {
	return (
		<div className="grid w-full gap-4 md:grid-cols-2">
			<FaturamentoChannelCard
				title="Faturamento Em Vendas"
				href={dashboardVendasHojeHref(dateStr)}
				valueCents={salesCents}
				netCents={salesNetCents}
				goalCents={salesGoalCents}
				yesterdayCents={yesterdaySalesCents}
				yesterdayNetCents={yesterdaySalesNetCents}
				accentClass="text-white"
				barClass="bg-emerald-400"
			/>
			<FaturamentoChannelCard
				title="Faturamento Em OS"
				href={dashboardFaturamentoOsHref({ dateStr, isAdmin })}
				valueCents={osCents}
				netCents={osNetCents}
				goalCents={osGoalCents}
				yesterdayCents={yesterdayOsCents}
				yesterdayNetCents={yesterdayOsNetCents}
				accentClass="text-white"
				barClass="bg-sky-400"
			/>
		</div>
	)
}
