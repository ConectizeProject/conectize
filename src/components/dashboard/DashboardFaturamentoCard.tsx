'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'
import { DashboardMoneyText } from '@/components/dashboard/dashboard-money-visibility'

type Props = {
	salesCents: number
	osCents: number
	salesNetCents: number
	osNetCents: number
	salesGoalCents: number
	osGoalCents: number
}

function FaturamentoChannelCard ({
	title,
	valueCents,
	netCents,
	goalCents,
	accentClass,
	barClass,
}: {
	title: string
	valueCents: number
	netCents: number
	goalCents: number
	accentClass: string
	barClass: string
}) {
	const progress = goalCents > 0
		? Math.min(100, Math.round((valueCents / goalCents) * 100))
		: 0
	const goalReached = goalCents > 0 && valueCents >= goalCents

	return (
		<div className="relative overflow-hidden rounded-xl bg-slate-900 px-5 py-5 text-slate-50 shadow-sm dark:bg-slate-950 sm:px-6 sm:py-6">
			<div className="pointer-events-none absolute -right-4 -top-6 text-[7rem] font-bold leading-none text-white/[0.04]" aria-hidden>
				$
			</div>

			<div className="relative flex flex-wrap items-start justify-between gap-4">
				<div>
					<p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
						{title}
					</p>
					<p className={cn('mt-1 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl', accentClass)}>
						<DashboardMoneyText cents={valueCents} />
					</p>
				</div>
				<div className="text-right">
					<p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
						Meta diária
					</p>
					<p className="mt-1 text-base font-semibold tabular-nums text-slate-200 sm:text-lg">
						{goalCents > 0 ? <DashboardMoneyText cents={goalCents} /> : '—'}
					</p>
				</div>
			</div>

			<div className="relative mt-5">
				{goalCents > 0 ? (
					<>
						<div className="h-2 overflow-hidden rounded-full bg-slate-700/90">
							<div
								className={cn('h-full rounded-full transition-[width] duration-500', barClass)}
								style={{ width: `${Math.max(progress, valueCents > 0 ? 2 : 0)}%` }}
							/>
						</div>
						<div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-400">
							<span className="tabular-nums">{progress}% da meta</span>
							{goalReached ? (
								<span className="inline-flex items-center gap-1 font-medium text-emerald-300">
									<TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} />
									Meta batida! Parabéns
								</span>
							) : null}
						</div>
					</>
				) : (
					<p className="text-xs text-slate-400">
						Meta não definida.{' '}
						<Link
							href="/portal/admin/dados-empresa"
							className="text-sky-300 hover:underline"
						>
							Configurar
						</Link>
					</p>
				)}
			</div>

			<div className="relative mt-5 border-t border-slate-700/80 pt-4">
				<p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
					Valor líquido
				</p>
				<p className="mt-1 text-xl font-semibold tabular-nums text-emerald-400 sm:text-2xl">
					<DashboardMoneyText cents={netCents} />
				</p>
			</div>
		</div>
	)
}

export function DashboardFaturamentoCard ({
	salesCents,
	osCents,
	salesNetCents,
	osNetCents,
	salesGoalCents,
	osGoalCents,
}: Props) {
	return (
		<div className="grid w-full gap-4 md:grid-cols-2">
			<FaturamentoChannelCard
				title="Faturamento em vendas"
				valueCents={salesCents}
				netCents={salesNetCents}
				goalCents={salesGoalCents}
				accentClass="text-white"
				barClass="bg-emerald-400"
			/>
			<FaturamentoChannelCard
				title="Faturamento em OS"
				valueCents={osCents}
				netCents={osNetCents}
				goalCents={osGoalCents}
				accentClass="text-white"
				barClass="bg-sky-400"
			/>
		</div>
	)
}
